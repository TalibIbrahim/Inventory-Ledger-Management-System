/**
 * Currency utilities for Pakistan (PKR / Rs.)
 */

export const CURRENCY_CODE = 'PKR';
export const CURRENCY_SYMBOL = 'Rs.';

/**
 * Format numerical amounts to Pakistani Rupee format
 * Example: 1450.5 -> "Rs. 1,450.50"
 */
export const formatPKR = (amount: number): string => {
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `Rs. ${formatted}`;
};
