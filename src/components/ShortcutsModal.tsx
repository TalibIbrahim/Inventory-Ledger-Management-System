import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { SHORTCUTS, isMac } from '../utils/shortcuts';
import { KeyCaps } from './ChangelogModal';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const groups = ['Work faster', 'Jump to'] as const;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
              <Keyboard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Keyboard Shortcuts</h3>
              <p className="text-[11px] text-slate-500">
                {isMac ? '⌘ is the Command key, next to the space bar.' : 'Hold Ctrl and press the key.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {groups.map((group) => (
            <div key={group}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{group}</div>
              <div className="space-y-1.5">
                {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-3 text-xs text-slate-700">
                    <span>{s.label}</span>
                    <KeyCaps keys={s.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
