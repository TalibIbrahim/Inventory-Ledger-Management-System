import React, { useEffect } from 'react';
import { X, Sparkles, BadgePercent, Banknote, RotateCcw, BarChart3, Keyboard, ArrowRight, ShieldCheck } from 'lucide-react';
import { SHORTCUTS } from '../utils/shortcuts';

export const CURRENT_APP_VERSION = '1.0.11';
export const CHANGELOG_STORAGE_KEY = 'axiom_last_seen_changelog_version';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowShortcuts?: () => void;
}

export const KeyCaps: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="inline-flex items-center gap-1 flex-shrink-0">
    {keys.map((k) => (
      <kbd
        key={k}
        className="min-w-[22px] text-center font-mono text-[10px] font-semibold bg-white text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-300 shadow-[0_1px_0_rgba(15,23,42,0.15)]"
      >
        {k}
      </kbd>
    ))}
  </span>
);

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose, onShowShortcuts }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const features = [
    {
      icon: <BadgePercent className="w-5 h-5 text-purple-600" />,
      bg: 'bg-purple-50 border-purple-100',
      title: 'Customer Paid Less? Forgive the Rest',
      description:
        'Bill was Rs. 1,500 but you agreed on Rs. 1,000? In Customer Accounts → Record Payment, enter 1,000 and tick "Forgive the remaining Rs. 500". The bill closes, Cash Collected shows 1,000, and the 500 is listed as a discount. Changed your mind? Press Undo on the customer ledger.',
      where: 'Customer Accounts',
    },
    {
      icon: <Banknote className="w-5 h-5 text-blue-600" />,
      bg: 'bg-blue-50 border-blue-100',
      title: 'Part Payments on New Bills',
      description:
        'When creating a sale invoice you can now choose "Part Paid" and enter what the customer paid now. The rest is tracked as due automatically.',
      where: 'Sale Invoice',
    },
    {
      icon: <Sparkles className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50 border-emerald-100',
      title: 'Discount on the Bill',
      description:
        'Give a discount while making the bill (in rupees, or tap 5% / 10%). The slip shows subtotal, discount and total.',
      where: 'Sale Invoice',
    },
    {
      icon: <BarChart3 className="w-5 h-5 text-indigo-600" />,
      bg: 'bg-indigo-50 border-indigo-100',
      title: 'Reports Show the True Numbers',
      description:
        'Monthly and sales reports now show Gross Sales, Discounts, Returns and Net Revenue separately. Cash Collected counts only money actually received.',
      where: 'Reports',
    },
    {
      icon: <RotateCcw className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-50 border-amber-100',
      title: 'Returns Reduce What the Customer Owes',
      description:
        "A new sale return now takes its value off the customer's unpaid bills (the linked invoice first). Returns entered before this update are left as they were.",
      where: 'Sale Returns',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-slate-600" />,
      bg: 'bg-slate-50 border-slate-200',
      title: 'Your Existing Data Is Untouched',
      description:
        'All your bills, payments and reports from before the update read exactly as they did. Nothing was changed or removed.',
      where: 'Safe',
    },
  ];

  const quickKeys = SHORTCUTS.filter((s) => s.group === 'Work faster');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200">
        {/* Header Graphic */}
        <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white relative overflow-hidden flex-shrink-0">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>What's new in this update · v{CURRENT_APP_VERSION}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Discounts, Part Payments & Shortcuts</h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-md">
                Record what the customer really paid, keep reports accurate, and work faster from the keyboard.
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feature Cards List */}
        <div className="p-6 overflow-y-auto space-y-3.5 bg-slate-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((item) => (
              <div
                key={item.title}
                className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className={`p-2 rounded-xl border ${item.bg}`}>{item.icon}</div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                      {item.where}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight">{item.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Keyboard shortcuts */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border border-blue-100/80">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs">
                <Keyboard className="w-4 h-4 text-blue-600" />
                <span>New: Keyboard Shortcuts</span>
              </div>
              {onShowShortcuts && (
                <button
                  onClick={onShowShortcuts}
                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  See all →
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 font-medium">
              {quickKeys.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between gap-2 bg-white/80 px-2.5 py-1.5 rounded-lg border border-blue-100"
                >
                  <span>{s.label}</span>
                  <KeyCaps keys={s.keys} />
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 bg-white/80 px-2.5 py-1.5 rounded-lg border border-blue-100">
                <span>Jump between screens</span>
                <KeyCaps keys={[SHORTCUTS[5].keys[0], '1–8']} />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            You can open this again from the "What's New" badge at the top.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm active:scale-[0.98] transition-all"
          >
            <span>Got it</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
