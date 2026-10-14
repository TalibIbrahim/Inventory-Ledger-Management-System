import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';

// Do not auto-download — we want user control over when to restart
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;

/**
 * Initialize the auto-updater. Call once after the window is created.
 * Sends status events to the renderer via IPC so the UI can show
 * an "Update Available" / "Restart To Update" banner.
 */
export function initAutoUpdater(win: BrowserWindow) {
  mainWindow = win;

  // ── Update lifecycle events ─────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    sendStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatus('available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
    // Automatically start downloading once we know an update exists
    autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', () => {
    sendStatus('not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatus('downloading', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus('ready', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('error', (err) => {
    sendStatus('error', { message: err?.message ?? 'Unknown error' });
  });

  // ── IPC handlers so the renderer can trigger actions ────────────────

  ipcMain.handle('updater-check', () => {
    return autoUpdater.checkForUpdates();
  });

  ipcMain.handle('updater-install', () => {
    // Quit and install the already-downloaded update
    autoUpdater.quitAndInstall(false, true);
  });

  // ── Initial check on startup ────────────────────────────────────────
  // Small delay so the window is ready to receive IPC messages
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // Silently ignore – offline or no release yet
    });
  }, 3000);

  // ── Periodic check every 30 minutes while the app is running ────────
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 30 * 60 * 1000);
}

// ── Helper ──────────────────────────────────────────────────────────────
function sendStatus(status: string, data?: Record<string, any>) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater-status', { status, ...data });
  }
}
