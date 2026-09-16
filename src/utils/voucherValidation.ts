export interface FormLineItem {
  productId: string;
  quantity: string | number;
  unitPrice: string | number;
}

export interface VoucherValidationResult {
  isValid: boolean;
  generalError?: string;
  fieldErrors: {
    partyName?: string;
    warehouseId?: string;
    date?: string;
  };
  lineErrors: Record<
    number,
    {
      productId?: string;
      quantity?: string;
      unitPrice?: string;
    }
  >;
}

export interface PurchaseValidationInput {
  supplierName: string;
  warehouseId: string;
  date: string;
  items: FormLineItem[];
}

export interface SaleValidationInput {
  customerName: string;
  warehouseId: string;
  date: string;
  items: FormLineItem[];
  getProductStockAtWarehouse?: (productId: string, warehouseId?: string) => number;
}

export function validatePurchaseVoucher(input: PurchaseValidationInput): VoucherValidationResult {
  const fieldErrors: VoucherValidationResult['fieldErrors'] = {};
  const lineErrors: VoucherValidationResult['lineErrors'] = {};
  let generalError: string | undefined;

  if (!input.supplierName || !input.supplierName.trim()) {
    fieldErrors.partyName = 'Supplier / Vendor name is required';
  }

  if (!input.warehouseId || !input.warehouseId.trim()) {
    fieldErrors.warehouseId = 'Please select a receiving warehouse';
  }

  if (!input.date || !input.date.trim()) {
    fieldErrors.date = 'Voucher date is required';
  }

  if (!input.items || input.items.length === 0) {
    generalError = 'At least one line item is required';
  } else {
    input.items.forEach((item, idx) => {
      const itemErrors: { productId?: string; quantity?: string; unitPrice?: string } = {};

      if (!item.productId) {
        itemErrors.productId = 'Please select a product';
      }

      const qty = Number(item.quantity);
      if (item.quantity === '' || isNaN(qty) || qty <= 0) {
        itemErrors.quantity = 'Quantity must be at least 1';
      }

      const price = Number(item.unitPrice);
      if (item.unitPrice === '' || isNaN(price) || price < 0) {
        itemErrors.unitPrice = 'Rate must be 0 or greater';
      }

      if (Object.keys(itemErrors).length > 0) {
        lineErrors[idx] = itemErrors;
      }
    });
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const hasLineErrors = Object.keys(lineErrors).length > 0;
  const isValid = !hasFieldErrors && !hasLineErrors && !generalError;

  if (!isValid && !generalError) {
    if (hasFieldErrors && hasLineErrors) {
      generalError = 'Please fix the errors in the header and line items.';
    } else if (hasFieldErrors) {
      generalError = 'Please fill in all required voucher fields.';
    } else {
      generalError = 'One or more line items have invalid quantities or rates.';
    }
  }

  return {
    isValid,
    generalError,
    fieldErrors,
    lineErrors,
  };
}

export function validateSaleVoucher(input: SaleValidationInput): VoucherValidationResult {
  const fieldErrors: VoucherValidationResult['fieldErrors'] = {};
  const lineErrors: VoucherValidationResult['lineErrors'] = {};
  let generalError: string | undefined;

  if (!input.customerName || !input.customerName.trim()) {
    fieldErrors.partyName = 'Customer / Client name is required';
  }

  if (!input.warehouseId || !input.warehouseId.trim()) {
    fieldErrors.warehouseId = 'Please select a dispatch warehouse';
  }

  if (!input.date || !input.date.trim()) {
    fieldErrors.date = 'Invoice date is required';
  }

  if (!input.items || input.items.length === 0) {
    generalError = 'At least one line item is required';
  } else {
    input.items.forEach((item, idx) => {
      const itemErrors: { productId?: string; quantity?: string; unitPrice?: string } = {};

      if (!item.productId) {
        itemErrors.productId = 'Please select a product';
      }

      const qty = Number(item.quantity);
      if (item.quantity === '' || isNaN(qty) || qty <= 0) {
        itemErrors.quantity = 'Quantity must be at least 1';
      } else if (input.getProductStockAtWarehouse && input.warehouseId && item.productId) {
        const available = input.getProductStockAtWarehouse(item.productId, input.warehouseId);
        if (qty > available) {
          itemErrors.quantity = `Exceeds available stock (available: ${available})`;
        }
      }

      const price = Number(item.unitPrice);
      if (item.unitPrice === '' || isNaN(price) || price < 0) {
        itemErrors.unitPrice = 'Rate must be 0 or greater';
      }

      if (Object.keys(itemErrors).length > 0) {
        lineErrors[idx] = itemErrors;
      }
    });
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const hasLineErrors = Object.keys(lineErrors).length > 0;
  const isValid = !hasFieldErrors && !hasLineErrors && !generalError;

  if (!isValid && !generalError) {
    if (hasLineErrors) {
      const stockIssue = Object.values(lineErrors).some((e) => e.quantity?.includes('Exceeds available stock'));
      if (stockIssue) {
        generalError = 'One or more items exceed the stock available at the selected warehouse.';
      } else {
        generalError = 'Please check the item quantities and rates.';
      }
    } else if (hasFieldErrors) {
      generalError = 'Please fill in all required invoice fields.';
    }
  }

  return {
    isValid,
    generalError,
    fieldErrors,
    lineErrors,
  };
}
