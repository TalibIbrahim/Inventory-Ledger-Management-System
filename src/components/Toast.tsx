import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-2xl transition-all duration-300 animate-in slide-in-from-bottom-4 ${
              isSuccess
                ? 'bg-white/90 border-emerald-200/90 text-slate-800 shadow-emerald-950/5'
                : isError
                ? 'bg-white/90 border-rose-200/90 text-slate-800 shadow-rose-950/5'
                : 'bg-white/90 border-slate-200/90 text-slate-800 shadow-slate-950/5'
            }`}
          >
            {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
            {isError && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
            {!isSuccess && !isError && <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />}

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900">{toast.title}</p>
              {toast.message && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{toast.message}</p>}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="btn-press text-slate-400 hover:text-slate-700 transition-colors shrink-0 p-1 hover:bg-slate-100 rounded-lg"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
