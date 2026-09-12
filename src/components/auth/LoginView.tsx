import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { hasInitializedAuth, login, setupInitialAuth } = useAuth();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    const success = login(password);
    if (!success) {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setupInitialAuth(password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-emerald-100 selection:text-emerald-900 font-sans">
      <div className="w-full max-w-md">
        
        {/* Logo / Header Area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200/60 mb-4">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Axiom Stock Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {hasInitializedAuth 
              ? 'Enter your administrative password to continue' 
              : 'Set up your master administrative password'}
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 shadow-xl shadow-slate-200/50 rounded-3xl p-8">
          
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 text-center animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {hasInitializedAuth ? (
            /* LOGIN FORM */
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3 px-4 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
              >
                Unlock Database
                <ArrowRight className="w-4 h-4 opacity-70" />
              </button>
            </form>
          ) : (
            /* SETUP FORM */
            <form onSubmit={handleSetup} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">Set Master Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] mt-2"
              >
                Secure & Initialize
                <ShieldCheck className="w-4 h-4 opacity-70" />
              </button>
            </form>
          )}

        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Data is stored securely on your local device with bcrypt encryption.
        </p>
      </div>
    </div>
  );
};
