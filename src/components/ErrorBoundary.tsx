import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Keeps one broken screen (e.g. a malformed record) from blanking the whole app —
// the header, Settings and Backups stay usable.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">This screen couldn't be displayed</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Your data is safe. Try another section, or restart the app. If this keeps happening, use Settings → Back Up Now
          and send the backup file to support.
        </p>
        <p className="text-[11px] font-mono text-red-600 break-all">{this.state.error.message}</p>
        <button
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset?.();
          }}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }
}
