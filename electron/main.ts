import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Axiom Stock Ledger',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

import { startAutoSync, setMongoUri, getSyncStatus, getSyncInfo, runSyncCycle, notifyLocalChange, flushSync, testConnection } from './sync';
import { getConfig, saveConfig } from './config';
import { initDb, isDataCollection, findDocs, insertDoc, updateDocs, removeDocs, recordTombstones, clean, DATA_COLLECTIONS } from './db';
import { initAutoUpdater } from './updater';
import { createBackup, getBackupDir, listBackups, restoreBackup, startAutoBackups } from './backup';

app.whenReady().then(() => {
  const config = getConfig();

  // Initialize Datastores with configured path
  initDb(config.dbPath);

  // Set MongoDB URI if configured
  setMongoUri(config.mongoUri || '');

  createWindow();

  // Initialize auto-updater (production only — skip in dev mode)
  if (!isDev && mainWindow) {
    initAutoUpdater(mainWindow);
  }

  // Local safety snapshots (startup + every few hours)
  startAutoBackups();

  // Cloud sync: full cycle every 60 seconds, plus a push a few seconds after each local change
  startAutoSync(60000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Push any pending changes to the cloud before quitting (bounded, so quit never hangs).
let quitFlushed = false;
app.on('before-quit', (event) => {
  if (quitFlushed) return;
  event.preventDefault();
  quitFlushed = true;
  flushSync(6000).finally(() => app.quit());
});

// Settings & Config IPC Handlers
ipcMain.handle('get-config', () => getConfig());
ipcMain.handle('get-sync-status', () => getSyncStatus());
ipcMain.handle('get-sync-info', () => getSyncInfo());
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('save-config', (event, newConfig) => {
  const saved = saveConfig(newConfig);
  if (typeof newConfig?.mongoUri === 'string') {
    setMongoUri(saved.mongoUri);
    runSyncCycle();
  }
  return saved;
});

ipcMain.handle('test-mongo-uri', (event, uri: string) => testConnection(uri));

ipcMain.handle('sync-now', async () => {
  await runSyncCycle();
  return getSyncInfo();
});

ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.quit();
});

// ─── Backups ────────────────────────────────────────────────────────────────
ipcMain.handle('backup-now', async () => {
  const file = await createBackup('manual');
  return { success: true, file };
});

ipcMain.handle('list-backups', () => listBackups());

ipcMain.handle('open-backups-folder', () => shell.openPath(getBackupDir()));

ipcMain.handle('restore-backup', async () => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a backup to restore',
    defaultPath: getBackupDir(),
    filters: [{ name: 'Axiom Backup', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return { success: false, canceled: true };
  try {
    const result = await restoreBackup(filePaths[0]);
    notifyLocalChange();
    return { success: true, ...result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// IPC Handler for saving CSV using native dialog
ipcMain.handle('save-csv', async (event, { filename, content }) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save CSV Report',
      defaultPath: filename,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    // Write file with UTF-8 BOM
    fs.writeFileSync(filePath, '\ufeff' + content, 'utf8');
    return { success: true };
  } catch (error: any) {
    console.error('Error saving CSV:', error);
    return { success: false, error: error.message };
  }
});

// ─── Local Database (NeDB) Handlers ─────────────────────────────────────────
// Every write is stamped with `updatedAt` and every delete leaves a tombstone,
// which is what lets cloud sync propagate edits and deletions correctly.

function assertCollection(collection: string) {
  if (!isDataCollection(collection)) throw new Error(`Unknown collection "${collection}"`);
}

function stampUpdate(update: any) {
  const updatedAt = new Date().toISOString();
  if (Object.keys(update || {}).some((k) => k.startsWith('$'))) {
    return { ...update, $set: { ...(update.$set || {}), updatedAt } };
  }
  return { ...clean(update || {}), updatedAt };
}

ipcMain.handle('db-find', async (event, { collection, query }) => {
  assertCollection(collection);
  return findDocs(collection, query || {});
});

ipcMain.handle('db-insert', async (event, { collection, doc }) => {
  assertCollection(collection);
  const result = await insertDoc(collection, { ...clean(doc), updatedAt: new Date().toISOString() });
  notifyLocalChange();
  return result;
});

ipcMain.handle('db-update', async (event, { collection, query, update, options }) => {
  assertCollection(collection);
  const num = await updateDocs(collection, query, stampUpdate(update), options || {});
  notifyLocalChange();
  return num;
});

ipcMain.handle('db-remove', async (event, { collection, query, options }) => {
  assertCollection(collection);
  const victims = await findDocs(collection, query || {});
  const targets = options?.multi ? victims : victims.slice(0, 1);
  await recordTombstones(collection, targets.map((d) => d.id));
  const num = await removeDocs(collection, query, options || {});
  notifyLocalChange();
  return num;
});

ipcMain.handle('db-clear-all', async () => {
  // Always keep a snapshot — this is the one operation that wipes everything.
  const backupFile = await createBackup('before-clear-all');
  for (const name of DATA_COLLECTIONS) {
    const docs = await findDocs(name);
    await recordTombstones(name, docs.map((d) => d.id));
    await removeDocs(name, {}, { multi: true });
  }
  notifyLocalChange();
  return { success: true, backupFile };
});
