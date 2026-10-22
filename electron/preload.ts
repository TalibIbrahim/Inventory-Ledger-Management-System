import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveCSV: (filename: string, content: string) => ipcRenderer.invoke('save-csv', { filename, content }),
  db: {
    find: (collection: string, query: any = {}) => ipcRenderer.invoke('db-find', { collection, query }),
    insert: (collection: string, doc: any) => ipcRenderer.invoke('db-insert', { collection, doc }),
    update: (collection: string, query: any, update: any, options: any = {}) => ipcRenderer.invoke('db-update', { collection, query, update, options }),
    remove: (collection: string, query: any, options: any = {}) => ipcRenderer.invoke('db-remove', { collection, query, options }),
    clearAll: () => ipcRenderer.invoke('db-clear-all'),
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  getSyncInfo: () => ipcRenderer.invoke('get-sync-info'),
  onSyncInfo: (callback: (info: any) => void) => {
    ipcRenderer.on('sync-info', (_event, info) => callback(info));
  },
  syncNow: () => ipcRenderer.invoke('sync-now'),
  testMongoUri: (uri: string) => ipcRenderer.invoke('test-mongo-uri', uri),
  onDataChanged: (callback: () => void) => {
    ipcRenderer.on('data-changed', () => callback());
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  // Backups
  backupNow: () => ipcRenderer.invoke('backup-now'),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  openBackupsFolder: () => ipcRenderer.invoke('open-backups-folder'),
  restoreBackup: () => ipcRenderer.invoke('restore-backup'),
  onSyncStatus: (callback: (status: 'syncing' | 'synced' | 'error' | 'offline') => void) => {
    ipcRenderer.on('sync-status', (_event, status) => callback(status));
  },
  // Auto-updater
  checkForUpdate: () => ipcRenderer.invoke('updater-check'),
  installUpdate: () => ipcRenderer.invoke('updater-install'),
  onUpdateStatus: (callback: (data: any) => void) => {
    ipcRenderer.on('updater-status', (_event, data) => callback(data));
  },
});
