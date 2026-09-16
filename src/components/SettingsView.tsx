import React, { useState, useEffect } from 'react';
import { Database, Cloud, FolderOpen, Save, RefreshCw, Info, Sparkles } from 'lucide-react';

interface SettingsViewProps {
  onOpenChangelog?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenChangelog }) => {
  const [dbPath, setDbPath] = useState('');
  const [mongoUri, setMongoUri] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getConfig().then((config) => {
        setDbPath(config.dbPath || '');
        setMongoUri(config.mongoUri || '');
      });
    }
  }, []);

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return;
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      setDbPath(path);
    }
  };

  const handleSave = async () => {
    if (!window.electronAPI) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await window.electronAPI.saveConfig({ dbPath, mongoUri });
      setMessage({ text: 'Settings saved! The application will now restart to apply changes.', type: 'success' });
      
      // Delay slightly so user sees the message
      setTimeout(() => {
        window.electronAPI?.restartApp();
      }, 2000);
    } catch (error) {
      setMessage({ text: 'Failed to save settings.', type: 'error' });
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 lg:p-12 overflow-y-auto bg-slate-50">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Application Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Configure your local database storage and cloud sync preferences.</p>
        </div>

        {message && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Info className="w-5 h-5" />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Local Database Section */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Local Database Location</h2>
                <p className="text-xs text-slate-500">Where your .db files are saved on this computer.</p>
              </div>
            </div>
            
            <div className="mt-4 flex gap-3">
              <input 
                type="text" 
                readOnly
                value={dbPath}
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-600 focus:outline-none"
                placeholder="No path selected"
              />
              <button 
                onClick={handleSelectFolder}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                Browse
              </button>
            </div>
            <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              If you change this folder, the app will start fresh and download your data from the cloud automatically.
            </p>
          </div>

          {/* Cloud Sync Section */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">MongoDB Cloud Sync URI</h2>
                <p className="text-xs text-slate-500">Your MongoDB Atlas connection string for bi-directional syncing.</p>
              </div>
            </div>
            
            <div className="mt-4">
              <input 
                type="text" 
                value={mongoUri}
                onChange={(e) => setMongoUri(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                placeholder="mongodb+srv://..."
              />
            </div>
          </div>

          {/* Release Notes & Version Section */}
          <div className="p-6 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Axiom Stock Ledger</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200 text-slate-800">
                  v1.0.4
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Includes voucher search, keyboard shortcuts, auto-drafts, and stock validation.
              </p>
            </div>
            {onOpenChangelog && (
              <button
                type="button"
                onClick={onOpenChangelog}
                className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>What's New in v1.0.4</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-md shadow-slate-900/10 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Restart App
          </button>
        </div>
      </div>
    </div>
  );
};
