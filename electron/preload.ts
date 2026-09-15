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
  onSyncStatus: (callback: (status: 'syncing' | 'synced' | 'error' | 'offline') => void) => {
    ipcRenderer.on('sync-status', (_event, status) => callback(status));
  }
});
