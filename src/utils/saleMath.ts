/**
 * Money math for sale invoices: what was billed, received, forgiven, returned and still due.
 *
 * Every field read here is optional on older invoices, so each helper falls back to the
 * values those invoices were saved with. Old records are never rewritten just to be read.
 */
import type { PaymentRecord, PaymentStatus, SaleReturnVoucher, SaleVoucher } from '../types/inventory';

export const roundMoney = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

export const recordKind = (p: PaymentRecord) => p.kind ?? 'PAYMENT';

/** Cash received so far. */
export const getPaid = (v: SaleVoucher): number =>
  v.paidAmount ?? (v.paymentStatus === 'PAYMENT_DUE' ? 0 : v.totalAmount);

/** Balance still owed by the customer. */
export const getDue = (v: SaleVoucher): number =>
  v.dueAmount ?? (v.paymentStatus === 'PAYMENT_DUE' ? v.totalAmount : 0);

/** Discount given on the bill when it was made. */
export const getInvoiceDiscount = (v: SaleVoucher): number => v.invoiceDiscount ?? 0;

/** Balance forgiven after the bill was made. */
export const getSettlementDiscount = (v: SaleVoucher): number => v.discountAmount ?? 0;

export const getReturnCredit = (v: SaleVoucher): number => v.returnCredit ?? 0;

/** Value of the goods at the rates entered, before any discount. */
export const getGrossAmount = (v: SaleVoucher): number => roundMoney(v.totalAmount + getInvoiceDiscount(v));

/** All discounts on this invoice: on the bill + forgiven later. */
export const getTotalDiscount = (v: SaleVoucher): number =>
  roundMoney(getInvoiceDiscount(v) + getSettlementDiscount(v));

/** What the sale is really worth after all discounts (returns are reported separately). */
export const getNetSale = (v: SaleVoucher): number => roundMoney(v.totalAmount - getSettlementDiscount(v));

/** Recompute the outstanding balance and status from billed, paid, forgiven and returned amounts. */
export function settleInvoice(v: SaleVoucher): SaleVoucher {
  const paidAmount = roundMoney(getPaid(v));
  const discountAmount = roundMoney(getSettlementDiscount(v));
  const returnCredit = roundMoney(getReturnCredit(v));
  const cleared = paidAmount + discountAmount + returnCredit;
  const dueAmount = roundMoney(Math.max(0, v.totalAmount - cleared));
  const paymentStatus: PaymentStatus = dueAmount <= 0 ? 'PAID' : cleared > 0 ? 'PARTIAL' : 'PAYMENT_DUE';
  return { ...v, paidAmount, discountAmount, returnCredit, dueAmount, paymentStatus };
}

export const sameCustomer = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const byDate = <T extends { date: string; createdAt?: string }>(a: T, b: T) =>
  a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '');

/**
 * Apply one customer's sale returns to their invoice balances.
 *
 * Only returns that carry `creditApplied` take part (returns made from v1.0.11 on); older
 * returns are left exactly as they were. Each return clears its linked invoice first, then
 * the customer's oldest unpaid invoices. Anything left over is credit owed back to the customer.
 *
 * It recomputes from scratch, so it's safe to run again after a return or invoice is trashed
 * or restored. Returns only the invoices and returns that actually changed.
 */
export function allocateReturnCredits(
  invoices: SaleVoucher[],
  returns: SaleReturnVoucher[]
): { invoices: SaleVoucher[]; returns: SaleReturnVoucher[] } {
  const working = new Map<string, SaleVoucher>();
  const touched = new Set<string>();

  // Start from each invoice's balance with no return credit on it.
  for (const inv of invoices) {
    const hasReturnRecords = (inv.paymentHistory || []).some((p) => recordKind(p) === 'RETURN');
    if (hasReturnRecords || getReturnCredit(inv) > 0) {
      touched.add(inv.id);
      working.set(
        inv.id,
        settleInvoice({
          ...inv,
          returnCredit: 0,
          paymentHistory: (inv.paymentHistory || []).filter((p) => recordKind(p) !== 'RETURN'),
        })
      );
    } else {
      working.set(inv.id, inv);
    }
  }

  const ordered = [...invoices].sort(byDate);
  const updatedReturns: SaleReturnVoucher[] = [];

  for (const ret of [...returns].filter((r) => r.creditApplied !== undefined).sort(byDate)) {
    let remaining = roundMoney(ret.totalAmount);
    const applied: NonNullable<SaleReturnVoucher['creditApplied']> = [];
    const linkedNo = (ret.originalInvoiceNo || '').trim().toLowerCase();
    const targets = [
      ...ordered.filter((i) => linkedNo && i.invoiceNo.trim().toLowerCase() === linkedNo),
      ...ordered.filter((i) => !(linkedNo && i.invoiceNo.trim().toLowerCase() === linkedNo)),
    ];

    for (const target of targets) {
      if (remaining <= 0) break;
      const inv = working.get(target.id)!;
      const amount = roundMoney(Math.min(getDue(inv), remaining));
      if (amount <= 0) continue;

      const record: PaymentRecord = {
        id: `ret-${ret.id}-${inv.id}`,
        kind: 'RETURN',
        returnId: ret.id,
        voucherId: inv.id,
        invoiceNo: inv.invoiceNo,
        customerName: inv.customerName,
        date: ret.date,
        amount,
        paymentMethod: 'RETURN',
        notes: `Sale return ${ret.returnNo}`,
        recordedBy: ret.recordedBy,
        createdAt: ret.createdAt,
      };
      working.set(
        inv.id,
        settleInvoice({
          ...inv,
          returnCredit: roundMoney(getReturnCredit(inv) + amount),
          paymentHistory: [...(inv.paymentHistory || []), record],
        })
      );
      touched.add(inv.id);
      applied.push({ invoiceId: inv.id, invoiceNo: inv.invoiceNo, amount });
      remaining = roundMoney(remaining - amount);
    }

    if (JSON.stringify(applied) !== JSON.stringify(ret.creditApplied)) {
      updatedReturns.push({ ...ret, creditApplied: applied });
    }
  }

  const changedInvoices = invoices
    .filter((inv) => touched.has(inv.id))
    .map((inv) => ({ before: inv, after: working.get(inv.id)! }))
    .filter(({ before, after }) => invoiceMoneyKey(before) !== invoiceMoneyKey(after))
    .map(({ after }) => after);

  return { invoices: changedInvoices, returns: updatedReturns };
}

const invoiceMoneyKey = (v: SaleVoucher) =>
  JSON.stringify([
    getDue(v),
    getReturnCredit(v),
    v.paymentStatus,
    (v.paymentHistory || []).filter((p) => recordKind(p) === 'RETURN').map((p) => [p.id, p.amount]),
  ]);

/** Credit from a return that didn't go against any balance (owed back to the customer). */
export const getUnappliedReturnCredit = (r: SaleReturnVoucher): number | null =>
  r.creditApplied === undefined
    ? null
    : roundMoney(r.totalAmount - r.creditApplied.reduce((acc, c) => acc + c.amount, 0));

export interface SalesSummary {
  grossSales: number; // goods at entered rates
  invoiceDiscounts: number; // discounts on bills
  settlementDiscounts: number; // balances forgiven later
  discounts: number; // both of the above
  returns: number;
  netSales: number; // gross - discounts - returns
  collected: number; // cash received
  due: number; // still owed
}

export function summarizeSales(vouchers: SaleVoucher[], returns: SaleReturnVoucher[]): SalesSummary {
  let grossSales = 0;
  let invoiceDiscounts = 0;
  let settlementDiscounts = 0;
  let collected = 0;
  let due = 0;
  for (const v of vouchers) {
    grossSales += getGrossAmount(v);
    invoiceDiscounts += getInvoiceDiscount(v);
    settlementDiscounts += getSettlementDiscount(v);
    collected += getPaid(v);
    due += getDue(v);
  }
  const returnsTotal = returns.reduce((acc, r) => acc + r.totalAmount, 0);
  const discounts = invoiceDiscounts + settlementDiscounts;
  return {
    grossSales: roundMoney(grossSales),
    invoiceDiscounts: roundMoney(invoiceDiscounts),
    settlementDiscounts: roundMoney(settlementDiscounts),
    discounts: roundMoney(discounts),
    returns: roundMoney(returnsTotal),
    netSales: roundMoney(grossSales - discounts - returnsTotal),
    collected: roundMoney(collected),
    due: roundMoney(due),
  };
}
