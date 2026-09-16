export const DRAFT_STORAGE_KEYS = {
  PURCHASE_VOUCHER: 'axiom_draft_purchase_voucher',
  SALE_VOUCHER: 'axiom_draft_sale_voucher',
} as const;

export interface PurchaseDraftData {
  supplierName: string;
  supplierInvoiceNo: string;
  warehouseId: string;
  date: string;
  notes: string;
  recordedBy: string;
  lineItems: Array<{
    productId: string;
    quantity: string;
    unitPrice: string;
  }>;
  savedAt?: number;
}

export interface SaleDraftData {
  customerName: string;
  warehouseId: string;
  date: string;
  notes: string;
  recordedBy: string;
  lineItems: Array<{
    productId: string;
    quantity: string;
    unitPrice: string;
  }>;
  savedAt?: number;
}

export function saveVoucherDraft<T>(key: string, data: T): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const payload = {
      ...data,
      savedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn(`Failed to save draft to localStorage for key ${key}`, err);
  }
}

export function loadVoucherDraft<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Failed to load draft from localStorage for key ${key}`, err);
    return null;
  }
}

export function clearVoucherDraft(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`Failed to clear draft from localStorage for key ${key}`, err);
  }
}

export function isPurchaseDraftSubstantive(draft: PurchaseDraftData | null | undefined): boolean {
  if (!draft) return false;
  if (draft.supplierName && draft.supplierName.trim().length > 0) return true;
  if (draft.supplierInvoiceNo && draft.supplierInvoiceNo.trim().length > 0) return true;
  if (draft.notes && draft.notes.trim().length > 0) return true;
  if (draft.lineItems && draft.lineItems.length > 1) return true;
  return false;
}

export function isSaleDraftSubstantive(draft: SaleDraftData | null | undefined): boolean {
  if (!draft) return false;
  if (draft.customerName && draft.customerName.trim().length > 0) return true;
  if (draft.notes && draft.notes.trim().length > 0) return true;
  if (draft.lineItems && draft.lineItems.length > 1) return true;
  return false;
}
