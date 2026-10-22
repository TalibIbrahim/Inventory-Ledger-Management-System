import { createContext, useContext } from 'react';
import type { TrashKind } from '../../types/inventory';

export type TrashVoucherFn = (
  kind: TrashKind,
  voucherId: string,
  reason: string
) => Promise<{ success: boolean; error?: string }>;

// Lets any voucher slip offer "Move to Trash" without threading props through every view.
export const TrashActionsContext = createContext<TrashVoucherFn | null>(null);

export const useTrashVoucher = () => useContext(TrashActionsContext);
