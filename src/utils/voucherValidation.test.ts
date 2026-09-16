import { test } from 'node:test';
import assert from 'node:assert';
import { validatePurchaseVoucher, validateSaleVoucher } from './voucherValidation.ts';
import { isPurchaseDraftSubstantive, isSaleDraftSubstantive } from './voucherDrafts.ts';

test('validatePurchaseVoucher: rejects empty supplier name and missing warehouse', () => {
  const result = validatePurchaseVoucher({
    supplierName: '   ',
    warehouseId: '',
    date: '2026-09-16',
    items: [{ productId: 'p1', quantity: '10', unitPrice: '500' }],
  });

  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.fieldErrors.partyName, 'Supplier / Vendor name is required');
  assert.strictEqual(result.fieldErrors.warehouseId, 'Please select a receiving warehouse');
});

test('validatePurchaseVoucher: validates item quantities and unit rates', () => {
  const result = validatePurchaseVoucher({
    supplierName: 'Pak Cables',
    warehouseId: 'w1',
    date: '2026-09-16',
    items: [
      { productId: 'p1', quantity: '0', unitPrice: '100' },
      { productId: 'p2', quantity: '-5', unitPrice: '-20' },
      { productId: '', quantity: '10', unitPrice: '50' },
    ],
  });

  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.lineErrors[0]?.quantity, 'Quantity must be at least 1');
  assert.strictEqual(result.lineErrors[1]?.quantity, 'Quantity must be at least 1');
  assert.strictEqual(result.lineErrors[1]?.unitPrice, 'Rate must be 0 or greater');
  assert.strictEqual(result.lineErrors[2]?.productId, 'Please select a product');
});

test('validatePurchaseVoucher: succeeds for valid input', () => {
  const result = validatePurchaseVoucher({
    supplierName: 'Siemens Pakistan',
    warehouseId: 'w1',
    date: '2026-09-16',
    items: [
      { productId: 'p1', quantity: '25', unitPrice: '1200' },
      { productId: 'p2', quantity: '1', unitPrice: '0' },
    ],
  });

  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.generalError, undefined);
  assert.strictEqual(Object.keys(result.fieldErrors).length, 0);
  assert.strictEqual(Object.keys(result.lineErrors).length, 0);
});

test('validateSaleVoucher: rejects when requested quantity exceeds warehouse stock', () => {
  const stockMock = (productId: string, warehouseId?: string) => {
    if (productId === 'p1' && warehouseId === 'w1') return 15;
    return 0;
  };

  const result = validateSaleVoucher({
    customerName: 'Indus Systems',
    warehouseId: 'w1',
    date: '2026-09-16',
    items: [{ productId: 'p1', quantity: '20', unitPrice: '2500' }],
    getProductStockAtWarehouse: stockMock,
  });

  assert.strictEqual(result.isValid, false);
  assert.ok(result.lineErrors[0]?.quantity?.includes('Exceeds available stock (available: 15)'));
  assert.ok(result.generalError?.includes('exceed the stock available'));
});

test('validateSaleVoucher: passes when stock is sufficient', () => {
  const stockMock = (productId: string, warehouseId?: string) => {
    if (productId === 'p1' && warehouseId === 'w1') return 15;
    return 0;
  };

  const result = validateSaleVoucher({
    customerName: 'Indus Systems',
    warehouseId: 'w1',
    date: '2026-09-16',
    items: [{ productId: 'p1', quantity: '15', unitPrice: '2500' }],
    getProductStockAtWarehouse: stockMock,
  });

  assert.strictEqual(result.isValid, true);
  assert.strictEqual(Object.keys(result.lineErrors).length, 0);
});

test('voucherDrafts: correctly detects substantive drafts', () => {
  assert.strictEqual(isPurchaseDraftSubstantive(null), false);
  assert.strictEqual(
    isPurchaseDraftSubstantive({
      supplierName: '',
      supplierInvoiceNo: '',
      warehouseId: 'w1',
      date: '2026-09-16',
      notes: '',
      recordedBy: 'Admin',
      lineItems: [{ productId: 'p1', quantity: '5', unitPrice: '10' }],
    }),
    false
  );

  assert.strictEqual(
    isPurchaseDraftSubstantive({
      supplierName: 'Agility',
      supplierInvoiceNo: '',
      warehouseId: 'w1',
      date: '2026-09-16',
      notes: '',
      recordedBy: 'Admin',
      lineItems: [{ productId: 'p1', quantity: '5', unitPrice: '10' }],
    }),
    true
  );

  assert.strictEqual(
    isSaleDraftSubstantive({
      customerName: 'Alpha Corp',
      warehouseId: 'w1',
      date: '2026-09-16',
      notes: '',
      recordedBy: 'Admin',
      lineItems: [],
    }),
    true
  );
});
