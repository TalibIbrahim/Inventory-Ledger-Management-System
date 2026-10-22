import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Cloud,
  FolderOpen,
  Save,
  RefreshCw,
  Info,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  HardDrive,
  Download,
  Upload,
  PlugZap,
} from 'lucide-react';
import { CURRENT_APP_VERSION } from './ChangelogModal';
import { PasswordPromptModal } from './auth/PasswordPromptModal';
import type { SyncInfo } from '../types/electron';

interface SettingsViewProps {
  onOpenChangelog?: () => void;
}

type Notice = { text: string; type: 'success' | 'error' | 'info' } | null;

const noticeClass = (type: 'success' | 'error' | 'info') =>
  type === 'success'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : type === 'error'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-slate-50 border-slate-200 text-slate-700';

const NoticeBox: React.FC<{ notice: Notice }> = ({ notice }) =>
  notice ? (
    <div className={`mt-3 p-3 rounded-xl border flex items-start gap-2 text-xs font-medium ${noticeClass(notice.type)}`}>
      {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      <span>{notice.text}</span>
    </div>
  ) : null;

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenChangelog }) => {
  const api = window.electronAPI;
  const [dbPath, setDbPath] = useState('');
  const [savedDbPath, setSavedDbPath] = useState('');
  const [mongoUri, setMongoUri] = useState('');
  const [savedMongoUri, setSavedMongoUri] = useState('');
  const [showUri, setShowUri] = useState(false);
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
  const [backupCount, setBackupCount] = useState(0);
  const [latestBackup, setLatestBackup] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [cloudNotice, setCloudNotice] = useState<Notice>(null);
  const [backupNotice, setBackupNotice] = useState<Notice>(null);
  const [folderNotice, setFolderNotice] = useState<Notice>(null);
  const [isRestorePromptOpen, setIsRestorePromptOpen] = useState(false);

  const refreshBackups = useCallback(async () => {
    if (!api?.listBackups) return;
    const list = await api.listBackups();
    setBackupCount(list.length);
    setLatestBackup(list[0]?.createdAt ?? null);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    api.getConfig().then((config) => {
      setDbPath(config.dbPath || '');
      setSavedDbPath(config.dbPath || '');
      setMongoUri(config.mongoUri || '');
      setSavedMongoUri(config.mongoUri || '');
    });
    api.getSyncInfo?.().then(setSyncInfo);
    api.onSyncInfo?.(setSyncInfo);
    refreshBackups();
  }, [api, refreshBackups]);

  if (!api) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-sm text-slate-600">
        Settings are only available in the desktop app.
      </div>
    );
  }

  const handleTest = async () => {
    setBusy('test');
    setCloudNotice(null);
    const res = await api.testMongoUri(mongoUri);
    setBusy(null);
    setCloudNotice(
      res.ok
        ? {
            type: 'success',
            text: `Connection works — the app can read and write to this database${
              res.collections ? ` (${res.collections} collections already there)` : ' (it is empty — your data will be uploaded)'
            }.`,
          }
        : { type: 'error', text: res.error || 'Connection failed.' }
    );
  };

  const handleSaveUri = async () => {
    setBusy('save-uri');
    setCloudNotice(null);
    if (mongoUri.trim()) {
      const res = await api.testMongoUri(mongoUri);
      if (!res.ok) {
        setBusy(null);
        setCloudNotice({ type: 'error', text: `Not saved — ${res.error || 'connection failed.'}` });
        return;
      }
    }
    await api.saveConfig({ mongoUri: mongoUri.trim() });
    setSavedMongoUri(mongoUri.trim());
    setBusy(null);
    setCloudNotice(
      mongoUri.trim()
        ? { type: 'success', text: 'Connected. Your data is uploading now and will keep syncing automatically.' }
        : { type: 'info', text: 'Cloud sync turned off. Data is still saved on this computer.' }
    );
  };

  const handleSyncNow = async () => {
    setBusy('sync');
    const info = await api.syncNow();
    setSyncInfo(info);
    setBusy(null);
  };

  const handleBackupNow = async () => {
    setBusy('backup');
    setBackupNotice(null);
    try {
      const res = await api.backupNow();
      setBackupNotice({ type: 'success', text: `Backup saved: ${res.file}` });
      refreshBackups();
    } catch (e: any) {
      setBackupNotice({ type: 'error', text: `Backup failed: ${e?.message || e}` });
    }
    setBusy(null);
  };

  const handleRestore = async () => {
    setBusy('restore');
    setBackupNotice(null);
    const res = await api.restoreBackup();
    setBusy(null);
    if (res.canceled) return;
    if (res.success) {
      setBackupNotice({
        type: 'success',
        text: `Restored ${res.restored} records. Your previous data was backed up first. Reloading…`,
      });
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setBackupNotice({ type: 'error', text: res.error || 'Restore failed.' });
    }
  };

  const handleSelectFolder = async () => {
    const path = await api.selectDirectory();
    if (path) setDbPath(path);
  };

  const handleSaveFolder = async () => {
    setBusy('folder');
    try {
      await api.saveConfig({ dbPath });
      setFolderNotice({ type: 'success', text: 'Saved. The app will restart to use the new folder.' });
      setTimeout(() => api.restartApp(), 1500);
    } catch {
      setFolderNotice({ type: 'error', text: 'Failed to save settings.' });
      setBusy(null);
    }
  };

  const uriDirty = mongoUri.trim() !== savedMongoUri.trim();
  const syncConfigured = !!savedMongoUri.trim();

  const syncLine = (() => {
    if (!syncConfigured) return { icon: <AlertCircle className="w-4 h-4 text-slate-400" />, text: 'Cloud sync is off. Data is saved only on this computer.' };
    if (!syncInfo) return { icon: <RefreshCw className="w-4 h-4 text-slate-400" />, text: 'Checking…' };
    if (syncInfo.status === 'syncing') return { icon: <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />, text: 'Syncing now…' };
    if (syncInfo.status === 'error')
      return {
        icon: <AlertCircle className="w-4 h-4 text-red-600" />,
        text: `Last sync failed: ${syncInfo.lastError}. Your data is safe on this computer and will upload when the connection is back.`,
      };
    return {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      text: syncInfo.lastSyncedAt ? `Synced — last at ${new Date(syncInfo.lastSyncedAt).toLocaleString()}` : 'Waiting for first sync…',
    };
  })();

  const btn =
    'px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="flex-1 p-2 md:p-4 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Application Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Cloud sync, backups and where your data is stored.</p>
        </div>

        {/* ── Cloud Sync ─────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Cloud Sync (MongoDB Atlas)</h2>
              <p className="text-xs text-slate-500">
                Uploads every change within seconds and checks for updates every minute.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            {syncLine.icon}
            <span className="flex-1">{syncLine.text}</span>
            {syncConfigured && (
              <button onClick={handleSyncNow} disabled={!!busy} className={`${btn} py-1 text-slate-700 bg-white border border-slate-200 hover:bg-slate-100`}>
                <RefreshCw className={`w-3.5 h-3.5 ${busy === 'sync' ? 'animate-spin' : ''}`} />
                Sync Now
              </button>
            )}
          </div>

          <label className="block text-xs font-semibold text-slate-700 mt-4 mb-1.5">Connection URI</label>
          <div className="relative">
            <input
              type={showUri ? 'text' : 'password'}
              value={mongoUri}
              onChange={(e) => setMongoUri(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="w-full text-sm font-mono bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-slate-400"
              placeholder="mongodb+srv://user:password@cluster.mongodb.net/"
            />
            <button
              type="button"
              onClick={() => setShowUri((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
              title={showUri ? 'Hide' : 'Show'}
            >
              {showUri ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={handleTest} disabled={!!busy || !mongoUri.trim()} className={`${btn} text-slate-700 bg-white border border-slate-200 hover:bg-slate-50`}>
              <PlugZap className={`w-3.5 h-3.5 ${busy === 'test' ? 'animate-pulse' : ''}`} />
              {busy === 'test' ? 'Testing…' : 'Test Connection'}
            </button>
            <button onClick={handleSaveUri} disabled={!!busy || !uriDirty} className={`${btn} text-white bg-emerald-600 hover:bg-emerald-700`}>
              <Save className="w-3.5 h-3.5" />
              {busy === 'save-uri' ? 'Connecting…' : mongoUri.trim() || !syncConfigured ? 'Save & Connect' : 'Turn Off Sync'}
            </button>
          </div>
          <NoticeBox notice={cloudNotice} />
        </section>

        {/* ── Backups ───────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Backups</h2>
              <p className="text-xs text-slate-500">
                A full backup is saved on this computer at startup, every 4 hours, and before any reset or restore.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            {backupCount > 0
              ? `${backupCount} backup${backupCount > 1 ? 's' : ''} saved • latest ${latestBackup ? new Date(latestBackup).toLocaleString() : '—'}`
              : 'No backups yet.'}
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={handleBackupNow} disabled={!!busy} className={`${btn} text-white bg-slate-900 hover:bg-slate-800`}>
              <Download className="w-3.5 h-3.5" />
              {busy === 'backup' ? 'Backing up…' : 'Back Up Now'}
            </button>
            <button onClick={() => api.openBackupsFolder()} className={`${btn} text-slate-700 bg-white border border-slate-200 hover:bg-slate-50`}>
              <FolderOpen className="w-3.5 h-3.5" />
              Open Backups Folder
            </button>
            <button onClick={() => setIsRestorePromptOpen(true)} disabled={!!busy} className={`${btn} text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100`}>
              <Upload className="w-3.5 h-3.5" />
              {busy === 'restore' ? 'Restoring…' : 'Restore from Backup…'}
            </button>
          </div>
          <NoticeBox notice={backupNotice} />
        </section>

        {/* ── Local Database ───────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Local Database Location</h2>
              <p className="text-xs text-slate-500">Where your .db files are saved on this computer.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              readOnly
              value={dbPath}
              className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-600 focus:outline-none"
              placeholder="No path selected"
            />
            <button onClick={handleSelectFolder} className={`${btn} text-slate-700 bg-white border border-slate-200 hover:bg-slate-50`}>
              <FolderOpen className="w-4 h-4" />
              Browse
            </button>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Changing this folder starts with that folder's data; with cloud sync on, your data downloads into it automatically.
          </p>
          {dbPath !== savedDbPath && (
            <button onClick={handleSaveFolder} disabled={!!busy} className={`${btn} mt-3 text-white bg-slate-900 hover:bg-slate-800`}>
              <Save className="w-3.5 h-3.5" />
              Save & Restart App
            </button>
          )}
          <NoticeBox notice={folderNotice} />
        </section>

        {/* ── Version ───────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Axiom Stock Ledger</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                v{CURRENT_APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Updates download automatically; you'll see a banner when one is ready.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => api.checkForUpdate?.()}
              className={`${btn} text-slate-700 bg-white hover:bg-slate-100 border border-slate-200`}
              title="Search GitHub for newer releases"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              Check for Updates
            </button>
            {onOpenChangelog && (
              <button type="button" onClick={onOpenChangelog} className={`${btn} text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80`}>
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                v{CURRENT_APP_VERSION} What's New
              </button>
            )}
          </div>
        </section>
      </div>

      <PasswordPromptModal
        isOpen={isRestorePromptOpen}
        onClose={() => setIsRestorePromptOpen(false)}
        onSuccess={handleRestore}
        title="Restore from Backup"
        description="This replaces all current data with the backup you choose (a backup of your current data is saved first). Enter your master password to continue."
      />
    </div>
  );
};
