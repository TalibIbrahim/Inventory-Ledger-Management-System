import { app, BrowserWindow, ipcMain, dialog } from 'electron';
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
      preload: path.join(__dirname, 'preload.js'),
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

import { startAutoSync, setMongoUri } from './sync';
import { getConfig, saveConfig } from './config';
import { initDb } from './db';

app.whenReady().then(() => {
  const config = getConfig();
  
  // Initialize Datastores with configured path
  initDb(config.dbPath);
  
  // Set MongoDB URI if configured
  if (config.mongoUri) {
    setMongoUri(config.mongoUri);
  }

  createWindow();
  
  // Start cloud sync to MongoDB every 60 seconds
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

// Settings & Config IPC Handlers
ipcMain.handle('get-config', () => getConfig());

ipcMain.handle('save-config', (event, newConfig) => {
  return saveConfig(newConfig);
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
import { db } from './db';

ipcMain.handle('db-find', async (event, { collection, query }) => {
  return new Promise((resolve, reject) => {
    (db as any)[collection].find(query || {}, (err: Error | null, docs: any[]) => {
      if (err) reject(err);
      else resolve(docs);
    });
  });
});

ipcMain.handle('db-insert', async (event, { collection, doc }) => {
  return new Promise((resolve, reject) => {
    (db as any)[collection].insert(doc, (err: Error | null, newDoc: any) => {
      if (err) reject(err);
      else resolve(newDoc);
    });
  });
});

ipcMain.handle('db-update', async (event, { collection, query, update, options }) => {
  return new Promise((resolve, reject) => {
    (db as any)[collection].update(query, update, options || {}, (err: Error | null, numReplaced: number) => {
      if (err) reject(err);
      else resolve(numReplaced);
    });
  });
});

ipcMain.handle('db-remove', async (event, { collection, query, options }) => {
  return new Promise((resolve, reject) => {
    (db as any)[collection].remove(query, options || {}, (err: Error | null, numRemoved: number) => {
      if (err) reject(err);
      else resolve(numRemoved);
    });
  });
});

ipcMain.handle('db-clear-all', async () => {
  const collections = Object.keys(db);
  const promises = collections.map((col) => {
    return new Promise((resolve, reject) => {
      (db as any)[col].remove({}, { multi: true }, (err: Error | null) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  });
  await Promise.all(promises);
  return { success: true };
});
