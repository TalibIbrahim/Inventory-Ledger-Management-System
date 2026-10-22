import React, { useMemo, useState } from 'react';
import { Trash2, RotateCcw, Search, Inbox } from 'lucide-react';
import type { TrashEntry, TrashKind } from '../../types/inventory';
import { PasswordPromptModal } from '../auth/PasswordPromptModal';
import { formatPKR } from '../../utils/currency';

const KIND_LABELS: Record<TrashKind, { label: string; className: string }> = {
  purchase: { label: 'Purchase', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  sale: { label: 'Sale', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  saleReturn: { label: 'Sale Return', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  openingStock: { label: 'Opening Stock', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  stockAdjustment: { label: 'Adjustment', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

interface TrashViewProps {
  trash: TrashEntry[];
  onRestore: (trashId: string) => Promise<{ success: boolean; error?: string }>;
  onDeleteForever: (trashId: string) => Promise<{ success: boolean; error?: string }>;
}

export const TrashView: React.FC<TrashViewProps> = ({ trash, onRestore, onDeleteForever }) => {
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TrashEntry | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trash;
    return trash.filter((t) =>
      [t.voucherNo, t.partyName, t.reason, KIND_LABELS[t.kind]?.label].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [trash, query]);

  const itemsOf = (t: TrashEntry): string[] => {
    const main = t.records.find((r) => r.collection !== 'ledger');
    const voucher = main?.docs.find((d) => d.id === t.voucherId) ?? main?.docs[0];
    return (voucher?.items || []).map((i: any) => `${i.productName} × ${Math.abs(i.quantity ?? i.changeQty ?? 0)}`);
  };

  const linkedReturns = (t: TrashEntry) =>
    t.kind === 'sale' ? t.records.filter((r) => r.collection === 'saleReturns').reduce((n, r) => n + r.docs.length, 0) : 0;

  const handleRestore = async (t: TrashEntry) => {
    setBusyId(t.id);
    await onRestore(t.id);
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-slate-500" />
            Trash
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Vouchers moved to Trash are hidden from reports and their stock movements are reversed. Restore puts everything back
            exactly as it was.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search voucher #, party, reason…"
            className="w-full text-sm bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">{trash.length === 0 ? 'Trash is empty' : 'No matches'}</p>
          <p className="text-xs text-slate-500 mt-1">
            {trash.length === 0 ? 'Open any voucher slip and choose “Move to Trash” to remove it.' : 'Try a different search.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
          {filtered.map((t) => {
            const kind = KIND_LABELS[t.kind] ?? KIND_LABELS.stockAdjustment;
            const items = itemsOf(t);
            const returns = linkedReturns(t);
            return (
              <div key={t.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${kind.className}`}>{kind.label}</span>
                    <span className="font-mono text-sm font-bold text-slate-900">{t.voucherNo}</span>
                    <span className="text-xs text-slate-600 truncate">{t.partyName}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {items.slice(0, 3).join(' • ')}
                    {items.length > 3 ? ` • +${items.length - 3} more` : ''}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Voucher date {t.date} • Trashed {new Date(t.trashedAt).toLocaleString()}
                    {t.reason ? ` • “${t.reason}”` : ''}
                    {returns > 0 ? ` • includes ${returns} linked return${returns > 1 ? 's' : ''}` : ''}
                  </div>
                </div>
                <div className="text-right font-mono text-sm font-bold text-slate-800 md:w-36">{formatPKR(t.totalAmount)}</div>
                <div className="flex items-center gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => handleRestore(t)}
                    disabled={busyId === t.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {busyId === t.id ? 'Restoring…' : 'Restore'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-700 bg-white hover:bg-red-50 border border-red-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Forever
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PasswordPromptModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onSuccess={() => {
          if (pendingDelete) onDeleteForever(pendingDelete.id);
        }}
        title="Delete Forever"
        description={`${pendingDelete?.voucherNo ?? 'This voucher'} will be permanently deleted and can't be restored. Enter your master password to confirm.`}
      />
    </div>
  );
};
