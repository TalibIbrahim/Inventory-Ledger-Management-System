import React, { useEffect } from 'react';
import {
  X,
  Sparkles,
  Cloud,
  Trash2,
  HardDrive,
  Zap,
  ShieldCheck,
  Command,
  ArrowRight,
} from 'lucide-react';

export const CURRENT_APP_VERSION = '1.0.10';

// One-line highlights for the "Updated" banner shown at the top after an update.
export const RELEASE_HIGHLIGHTS = [
  'Your data now saves to the database (demo data removed)',
  'Reliable cloud sync',
  'Trash & Restore for vouchers',
  'Automatic backups',
];
export const CHANGELOG_STORAGE_KEY = 'axiom_last_seen_changelog_version';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
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

  const isMac =
    typeof navigator !== 'undefined' &&
    (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
      navigator.userAgent.toUpperCase().indexOf('MAC') >= 0);

  const modKey = isMac ? '⌘' : 'Ctrl';

  const features = [
    {
      icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50 border-emerald-100',
      title: 'Your Data Now Saves to the Database',
      description:
        'Fixed a problem where the app ran in demo mode and showed sample purchases and warehouses. Your own entries have been moved into the real database automatically, and the demo data is gone.',
      shortcut: 'Automatic',
    },
    {
      icon: <Cloud className="w-5 h-5 text-blue-600" />,
      bg: 'bg-blue-50 border-blue-100',
      title: 'Reliable Cloud Sync',
      description:
        'Everything syncs to your MongoDB cloud a few seconds after each change and every minute in the background — including edits and deletions. Test your connection and see the last sync time in Settings.',
      shortcut: 'Settings → Cloud',
    },
    {
      icon: <Trash2 className="w-5 h-5 text-red-600" />,
      bg: 'bg-red-50 border-red-100',
      title: 'Trash & Restore for Vouchers',
      description:
        'Open any purchase, sale, return, opening stock or adjustment slip and choose "Move to Trash". Its stock movements are reversed. Changed your mind? Restore it from the Trash with one click.',
      shortcut: 'Header → Trash',
    },
    {
      icon: <HardDrive className="w-5 h-5 text-indigo-600" />,
      bg: 'bg-indigo-50 border-indigo-100',
      title: 'Automatic Local Backups',
      description:
        'A full backup is saved on this Mac when the app starts and every 4 hours (the last 60 are kept). You can also back up or restore manually from Settings.',
      shortcut: 'Settings → Backups',
    },
    {
      icon: <Zap className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-50 border-amber-100',
      title: 'Stock Adjustments Are Saved Properly',
      description:
        'Stock adjustment vouchers are now saved permanently. Voucher and ledger numbers can no longer repeat.',
      shortcut: 'Fixed',
    },
    {
      icon: <Sparkles className="w-5 h-5 text-purple-600" />,
      bg: 'bg-purple-50 border-purple-100',
      title: 'Updates Install Themselves',
      description:
        'When a new version is ready you\'ll see a "Restart To Update" banner. After each update, a banner at the top shows what\'s new.',
      shortcut: 'Auto',
    },
  ];

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
                <span>What's New in v{CURRENT_APP_VERSION}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Axiom Stock Ledger
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-md">
                Automatic updates, customer credit ledger, monthly sales reports, and smarter payment tracking — all designed to save you time.
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
            {features.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className={`p-2 rounded-xl border ${item.bg}`}>
                      {item.icon}
                    </div>
                    {item.shortcut && (
                      <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Shortcuts Cheatsheet Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border border-blue-100/80">
            <div className="flex items-center gap-2 mb-2 text-blue-900 font-semibold text-xs">
              <Command className="w-4 h-4 text-blue-600" />
              <span>Keyboard Shortcuts Cheatsheet</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-700 font-medium">
              <div className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded-lg border border-blue-100">
                <span>Focus Search</span>
                <kbd className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                  {modKey}+K
                </kbd>
              </div>
              <div className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded-lg border border-blue-100">
                <span>Add Next Item</span>
                <kbd className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                  Enter
                </kbd>
              </div>
              <div className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded-lg border border-blue-100">
                <span>Dismiss / Close</span>
                <kbd className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                  Escape
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            You can review this changelog anytime from Settings or the top bar.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm active:scale-[0.98] transition-all"
          >
            <span>Got it, let's explore!</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
