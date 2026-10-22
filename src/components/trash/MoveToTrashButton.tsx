import React, { useState } from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import type { TrashKind } from '../../types/inventory';
import { useTrashVoucher } from './TrashContext';

interface MoveToTrashButtonProps {
  kind: TrashKind;
  voucherId: string;
  voucherNo: string;
  /** Extra warning shown in the confirmation (e.g. linked returns). */
  note?: string;
  /** Called after the voucher was moved to Trash (typically closes the slip). */
  onDone: () => void;
}

export const MoveToTrashButton: React.FC<MoveToTrashButtonProps> = ({ kind, voucherId, voucherNo, note, onDone }) => {
  const trashVoucher = useTrashVoucher();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!trashVoucher) return null;

  const close = () => {
    setIsOpen(false);
    setReason('');
    setError('');
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError('');
    const res = await trashVoucher(kind, voucherId, reason);
    setBusy(false);
    if (res.success) {
      close();
      onDone();
    } else {
      setError(res.error || 'Could not move this voucher to Trash.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-red-700 bg-white hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Move to Trash
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={busy ? undefined : close} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-900/20 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <button
              onClick={close}
              disabled={busy}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Move {voucherNo} to Trash?</h3>
                <p className="text-xs text-slate-500">Its stock movements are reversed. You can restore it from Trash at any time.</p>
              </div>
            </div>

            {note && (
              <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{note}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Entered twice by mistake"
                className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Moving…' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
