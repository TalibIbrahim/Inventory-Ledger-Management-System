import { test } from 'node:test';
import assert from 'node:assert';
import type { SaleReturnVoucher, SaleVoucher } from '../types/inventory';
import {
  allocateReturnCredits,
  getDue,
  getNetSale,
  getPaid,
  settleInvoice,
  summarizeSales,
} from './saleMath.ts';

const invoice = (over: Partial<SaleVoucher> = {}): SaleVoucher => ({
  id: 'sv-1',
  invoiceNo: 'INV-2026-0001',
  date: '2026-11-01',
  customerName: 'Ahmed Traders',
  warehouseId: 'wh',
  warehouseName: 'Main',
  items: [],
  totalQuantity: 1,
  totalAmount: 1500,
  notes: '',
  recordedBy: 'Test',
  createdAt: '2026-11-01T10:00:00.000Z',
  paymentStatus: 'PAYMENT_DUE',
  paidAmount: 0,
  dueAmount: 1500,
  paymentHistory: [],
  ...over,
});

const saleReturn = (over: Partial<SaleReturnVoucher> = {}): SaleReturnVoucher => ({
  id: 'sr-1',
  returnNo: 'SR-2026-0001',
  date: '2026-11-05',
  customerName: 'Ahmed Traders',
  warehouseId: 'wh',
  warehouseName: 'Main',
  items: [],
  totalQuantity: 1,
  totalAmount: 300,
  notes: '',
  recordedBy: 'Test',
  createdAt: '2026-11-05T10:00:00.000Z',
  creditApplied: [],
  ...over,
});

test('old invoices without the new fields read the same as before', () => {
  const paidLegacy = invoice({ paymentStatus: 'PAID', paidAmount: undefined, dueAmount: undefined });
  assert.strictEqual(getPaid(paidLegacy), 1500);
  assert.strictEqual(getDue(paidLegacy), 0);

  const dueLegacy = invoice({ paidAmount: undefined, dueAmount: undefined });
  assert.strictEqual(getPaid(dueLegacy), 0);
  assert.strictEqual(getDue(dueLegacy), 1500);

  // Settling an old invoice that has no discounts/returns changes nothing about its balance.
  const partial = invoice({ paymentStatus: 'PARTIAL', paidAmount: 400, dueAmount: 1100 });
  const settled = settleInvoice(partial);
  assert.strictEqual(settled.dueAmount, 1100);
  assert.strictEqual(settled.paymentStatus, 'PARTIAL');
});

test('paid 1000 of 1500 and forgave 500: settled, cash 1000, net sale 1000', () => {
  const v = settleInvoice(invoice({ paidAmount: 1000, discountAmount: 500 }));
  assert.strictEqual(v.dueAmount, 0);
  assert.strictEqual(v.paymentStatus, 'PAID');
  assert.strictEqual(getNetSale(v), 1000);

  const s = summarizeSales([v], []);
  assert.strictEqual(s.grossSales, 1500);
  assert.strictEqual(s.discounts, 500);
  assert.strictEqual(s.netSales, 1000);
  assert.strictEqual(s.collected, 1000);
  assert.strictEqual(s.due, 0);
});

test('discount on the bill shows in gross, discounts and net', () => {
  // Goods worth 1500, discount 500 on the bill, so the bill total is 1000.
  const v = invoice({ totalAmount: 1000, invoiceDiscount: 500, paymentStatus: 'PAID', paidAmount: 1000, dueAmount: 0 });
  const s = summarizeSales([v], []);
  assert.strictEqual(s.grossSales, 1500);
  assert.strictEqual(s.invoiceDiscounts, 500);
  assert.strictEqual(s.netSales, 1000);
  assert.strictEqual(s.collected, 1000);
});

test('a return clears its linked invoice first, then the oldest unpaid one', () => {
  const older = invoice({ id: 'sv-old', invoiceNo: 'INV-1', date: '2026-10-01', totalAmount: 1000, dueAmount: 1000 });
  const linked = invoice({ id: 'sv-new', invoiceNo: 'INV-2', date: '2026-11-01', totalAmount: 200, dueAmount: 200 });
  const ret = saleReturn({ totalAmount: 500, originalInvoiceNo: 'inv-2' });

  const out = allocateReturnCredits([older, linked], [ret]);
  const byId = new Map(out.invoices.map((v) => [v.id, v]));
  assert.strictEqual(byId.get('sv-new')!.dueAmount, 0);
  assert.strictEqual(byId.get('sv-old')!.dueAmount, 700);
  assert.deepStrictEqual(out.returns[0].creditApplied, [
    { invoiceId: 'sv-new', invoiceNo: 'INV-2', amount: 200 },
    { invoiceId: 'sv-old', invoiceNo: 'INV-1', amount: 300 },
  ]);
});

test('return credit beyond what is owed stays with the return, nothing goes negative', () => {
  const v = invoice({ totalAmount: 1000, paidAmount: 900, dueAmount: 100, paymentStatus: 'PARTIAL' });
  const out = allocateReturnCredits([v], [saleReturn({ totalAmount: 400 })]);
  assert.strictEqual(out.invoices[0].dueAmount, 0);
  assert.strictEqual(out.invoices[0].returnCredit, 100);
  assert.deepStrictEqual(out.returns[0].creditApplied, [{ invoiceId: 'sv-1', invoiceNo: 'INV-2026-0001', amount: 100 }]);
});

test('returns made before this update are not applied', () => {
  const v = invoice();
  const legacyReturn = saleReturn({ creditApplied: undefined });
  const out = allocateReturnCredits([v], [legacyReturn]);
  assert.strictEqual(out.invoices.length, 0);
  assert.strictEqual(out.returns.length, 0);
});

test('re-running is stable, and removing the return gives the balance back', () => {
  const ret = saleReturn({ totalAmount: 300 });
  const first = allocateReturnCredits([invoice()], [ret]);
  const credited = first.invoices[0];
  assert.strictEqual(credited.dueAmount, 1200);

  const again = allocateReturnCredits([credited], first.returns);
  assert.strictEqual(again.invoices.length, 0);
  assert.strictEqual(again.returns.length, 0);

  // Return moved to Trash: run again without it.
  const undone = allocateReturnCredits([credited], []);
  assert.strictEqual(undone.invoices[0].dueAmount, 1500);
  assert.strictEqual(undone.invoices[0].paymentStatus, 'PAYMENT_DUE');
  assert.strictEqual(undone.invoices[0].paymentHistory!.length, 0);
});
