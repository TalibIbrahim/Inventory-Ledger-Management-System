export {};

declare global {
  interface Window {
    electronAPI?: {
      saveCSV: (filename: string, content: string) => Promise<{ success: boolean; error?: string; canceled?: boolean }>;
      db: {
        find: (collection: string, query?: any) => Promise<any[]>;
        insert: (collection: string, doc: any) => Promise<any>;
        update: (collection: string, query: any, update: any, options?: any) => Promise<number>;
        remove: (collection: string, query: any, options?: any) => Promise<number>;
        clearAll: () => Promise<{ success: boolean }>;
      };
      getConfig: () => Promise<{ dbPath: string; mongoUri: string }>;
      saveConfig: (config: { dbPath?: string; mongoUri?: string }) => Promise<{ dbPath: string; mongoUri: string }>;
      selectDirectory: () => Promise<string | null>;
      restartApp: () => Promise<void>;
      getSyncStatus: () => Promise<'syncing' | 'synced' | 'error' | 'offline'>;
      onSyncStatus: (callback: (status: 'syncing' | 'synced' | 'error' | 'offline') => void) => void;
    };
  }
}
