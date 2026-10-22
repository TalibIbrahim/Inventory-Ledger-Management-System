export {};

export interface SyncInfo {
  status: 'syncing' | 'synced' | 'error' | 'offline';
  lastSyncedAt: string | null;
  lastError: string | null;
  configured: boolean;
}

declare global {
  interface Window {
    electronAPI?: {
      saveCSV: (filename: string, content: string) => Promise<{ success: boolean; error?: string; canceled?: boolean }>;
      db: {
        find: (collection: string, query?: any) => Promise<any[]>;
        insert: (collection: string, doc: any) => Promise<any>;
        update: (collection: string, query: any, update: any, options?: any) => Promise<number>;
        remove: (collection: string, query: any, options?: any) => Promise<number>;
        clearAll: () => Promise<{ success: boolean; backupFile?: string }>;
      };
      getConfig: () => Promise<{ dbPath: string; mongoUri: string }>;
      saveConfig: (config: { dbPath?: string; mongoUri?: string }) => Promise<{ dbPath: string; mongoUri: string }>;
      selectDirectory: () => Promise<string | null>;
      restartApp: () => Promise<void>;
      getSyncStatus: () => Promise<'syncing' | 'synced' | 'error' | 'offline'>;
      onSyncStatus: (callback: (status: 'syncing' | 'synced' | 'error' | 'offline') => void) => void;
      getSyncInfo: () => Promise<SyncInfo>;
      onSyncInfo: (callback: (info: SyncInfo) => void) => void;
      syncNow: () => Promise<SyncInfo>;
      testMongoUri: (uri: string) => Promise<{ ok: boolean; error?: string; collections?: number }>;
      onDataChanged: (callback: () => void) => void;
      getAppVersion: () => Promise<string>;
      // Backups
      backupNow: () => Promise<{ success: boolean; file: string }>;
      listBackups: () => Promise<{ file: string; createdAt: string; size: number }[]>;
      openBackupsFolder: () => Promise<string>;
      restoreBackup: () => Promise<{ success: boolean; canceled?: boolean; error?: string; restored?: number; safetyBackup?: string }>;
      // Auto-updater
      checkForUpdate: () => Promise<void>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (callback: (data: {
        status: 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';
        version?: string;
        percent?: number;
        message?: string;
      }) => void) => void;
    };
  }
}
