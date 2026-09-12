export type VoucherType =
  | 'PURCHASE'
  | 'SALE'
  | 'SALE_RETURN'
  | 'OPENING_STOCK'
  | 'STOCK_ADJUSTMENT';

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string; // e.g. "Siemens", "Packages Ltd", "Espressif", "Pakistan Cables"
  type: string; // Category / Type: e.g. "Electronics", "Raw Materials", "Packaging", "Industrial Hardware"
  uom: string; // Unit of Measure: e.g. "pcs", "kg", "boxes", "meters", "liters", "packs"
  reorderThreshold: number;
  purchasePrice: number; // in Rs.
  salePrice: number; // in Rs.
  currentStock: number; // Calculated total across all warehouses
  createdAt?: string;
  updatedAt?: string;
}

export interface Warehouse {
  id: string;
  code: string; // e.g. "WH-KHI-01", "WH-LHE-01", "WH-ISB-01"
  name: string; // e.g. "Karachi Central Depot", "Lahore Distribution Hub"
  city: string; // "Karachi", "Lahore", "Islamabad", "Faisalabad"
  address: string;
  manager: string;
}

// Purchase Voucher Line Item & Voucher
export interface PurchaseVoucherLine {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  uom: string;
  quantity: number;
  unitPrice: number; // Rs.
  totalPrice: number; // Rs.
}

export interface PurchaseVoucher {
  id: string;
  voucherNo: string; // e.g. "PV-2026-0001"
  supplierInvoiceNo?: string;
  date: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  items: PurchaseVoucherLine[];
  totalQuantity: number;
  totalAmount: number; // Rs.
  notes: string;
  recordedBy: string;
  createdAt: string;
}

// Sale Voucher Line Item & Voucher
export interface SaleVoucherLine {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  uom: string;
  quantity: number;
  unitPrice: number; // Selling Price in Rs.
  unitCost: number; // Purchase Cost in Rs. (for margin reporting)
  totalPrice: number; // Rs.
}

export interface SaleVoucher {
  id: string;
  invoiceNo: string; // e.g. "INV-2026-0001"
  date: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  items: SaleVoucherLine[];
  totalQuantity: number;
  totalAmount: number; // Rs.
  notes: string;
  recordedBy: string;
  createdAt: string;
}

// Sale Return Line Item & Voucher
export interface SaleReturnVoucherLine {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  uom: string;
  quantity: number;
  unitPrice: number; // Refund Rate in Rs.
  totalPrice: number; // Rs.
  reason: string; // e.g. "Defective", "Surplus", "Damaged", "Incorrect Specification"
}

export interface SaleReturnVoucher {
  id: string;
  returnNo: string; // e.g. "SR-2026-0001"
  originalInvoiceNo?: string;
  date: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  items: SaleReturnVoucherLine[];
  totalQuantity: number;
  totalAmount: number; // Rs.
  notes: string;
  recordedBy: string;
  createdAt: string;
}

// Inventory Opening Stock Line Item & Voucher
export interface OpeningStockLine {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  uom: string;
  quantity: number;
  unitCost: number; // Rs.
  totalCost: number; // Rs.
}

export interface OpeningStockVoucher {
  id: string;
  voucherNo: string; // e.g. "OS-2026-0001"
  date: string;
  warehouseId: string;
  warehouseName: string;
  items: OpeningStockLine[];
  totalQuantity: number;
  totalAmount: number; // Rs.
  notes: string;
  recordedBy: string;
  createdAt: string;
}

// Inventory Stock Adjustment Line Item & Voucher
export interface StockAdjustmentLine {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  uom: string;
  changeQty: number; // Positive for addition (+), Negative for deduction (-)
  unitCost: number; // Rs.
  totalValue: number; // Math.abs(changeQty) * unitCost
  reason: string; // e.g. "Physical audit variance", "Damage write-off", "Quality quarantine", "Counting reconciliation"
}

export interface StockAdjustmentVoucher {
  id: string;
  voucherNo: string; // e.g. "SA-2026-0001"
  date: string;
  warehouseId: string;
  warehouseName: string;
  adjustmentType: 'INCREASE' | 'DECREASE' | 'WRITE_OFF' | 'RECONCILIATION';
  items: StockAdjustmentLine[];
  netQuantityDelta: number;
  totalAmount: number; // Rs.
  notes: string;
  recordedBy: string;
  createdAt: string;
}

// Immutable Central Stock Ledger
export interface StockLedgerEntry {
  id: string;
  timestamp: string;
  voucherType: VoucherType;
  voucherId: string;
  voucherNo: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  uom: string;
  qtyIn: number; // Inflow debit
  qtyOut: number; // Outflow credit
  changeQty: number; // Signed: + In, - Out
  runningBalance: number; // Company-wide running balance after entry
  locationRunningBalance: number; // Warehouse running balance after entry
  rate: number; // Price or Cost in Rs.
  totalValue: number; // Rs.
  partyName: string; // Supplier / Customer / Department / Auditor
  notes: string;
  recordedBy: string;
}
