import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const REPO_OWNER = 'TalibIbrahim';
const REPO_NAME = 'Inventory-Ledger-Management-System';
const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

let mainWindow: BrowserWindow | null = null;
let downloadedMacDmgPath: string | null = null;
let isChecking = false;
let isDownloading = false;

// Configure electron-updater for Windows
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

/**
 * Compare two semver strings (e.g. "1.0.7" vs "1.0.6")
 * Returns true if vLatest > vCurrent
 */
function isNewerVersion(vLatest: string, vCurrent: string): boolean {
  const cleanL = vLatest.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const cleanC = vCurrent.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const l = cleanL[i] || 0;
    const c = cleanC[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Initialize auto-updater. Called once when main window is ready.
 */
export function initAutoUpdater(win: BrowserWindow) {
  mainWindow = win;

  // ─── Windows electron-updater event bindings ─────────────────────────
  if (process.platform === 'win32') {
    autoUpdater.on('checking-for-update', () => sendStatus('checking'));
    autoUpdater.on('update-available', (info) => {
      sendStatus('available', { version: info.version, releaseNotes: info.releaseNotes });
      autoUpdater.downloadUpdate();
    });
    autoUpdater.on('update-not-available', () => sendStatus('not-available'));
    autoUpdater.on('download-progress', (progress) => {
      sendStatus('downloading', {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
      });
    });
    autoUpdater.on('update-downloaded', (info) => {
      sendStatus('ready', { version: info.version, releaseNotes: info.releaseNotes });
    });
    autoUpdater.on('error', (err) => {
      sendStatus('error', { message: err?.message ?? 'Update check failed' });
    });
  }

  // ─── IPC Handlers ───────────────────────────────────────────────────
  ipcMain.handle('updater-check', async () => {
    return checkUpdates();
  });

  ipcMain.handle('updater-install', async () => {
    installUpdate();
  });

  // ─── Startup check (runs 2s after launch) ───────────────────────────
  setTimeout(() => {
    checkUpdates().catch(() => {});
  }, 2000);

  // ─── Periodic check every 25 minutes while app is running ───────────
  setInterval(() => {
    checkUpdates().catch(() => {});
  }, 25 * 60 * 1000);
}

/**
 * Primary check for updates
 */
async function checkUpdates() {
  if (isChecking || isDownloading) return;
  isChecking = true;
  sendStatus('checking');

  if (process.platform === 'win32') {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err: any) {
      sendStatus('error', { message: err?.message || 'Update check failed' });
    } finally {
      isChecking = false;
    }
    return;
  }

  // ─── macOS Custom Updater (handles unsigned builds & DMGs seamlessly) ───
  try {
    const currentVersion = app.getVersion();
    const release = await fetchLatestGitHubRelease();

    if (!release || !release.tag_name) {
      sendStatus('not-available');
      isChecking = false;
      return;
    }

    const latestVersion = release.tag_name.replace(/^v/, '');
    if (!isNewerVersion(latestVersion, currentVersion)) {
      sendStatus('not-available');
      isChecking = false;
      return;
    }

    // New version found!
    sendStatus('available', {
      version: latestVersion,
      releaseNotes: release.body,
    });

    // Find macOS asset (prefer arm64 if on arm64 mac, else generic dmg)
    const isArm64 = process.arch === 'arm64';
    let asset = release.assets.find((a: any) =>
      isArm64 ? a.name.endsWith('-arm64.dmg') : a.name.endsWith('.dmg') && !a.name.endsWith('-arm64.dmg')
    );
    if (!asset) {
      asset = release.assets.find((a: any) => a.name.endsWith('.dmg'));
    }

    if (!asset) {
      sendStatus('error', { message: `No macOS installer found for v${latestVersion}` });
      isChecking = false;
      return;
    }

    // Begin downloading DMG in background
    isDownloading = true;
    const destPath = path.join(app.getPath('temp'), asset.name);
    downloadedMacDmgPath = destPath;

    await downloadFileWithProgress(
      asset.browser_download_url,
      destPath,
      (percent, transferred, total) => {
        sendStatus('downloading', {
          version: latestVersion,
          percent,
          transferred,
          total,
        });
      }
    );

    isDownloading = false;
    sendStatus('ready', {
      version: latestVersion,
      releaseNotes: release.body,
    });
  } catch (err: any) {
    isDownloading = false;
    sendStatus('error', { message: err?.message || 'Failed to check GitHub releases' });
  } finally {
    isChecking = false;
  }
}

/**
 * Install the update and restart
 */
function installUpdate() {
  if (process.platform === 'win32') {
    autoUpdater.quitAndInstall(false, true);
    return;
  }

  if (process.platform === 'darwin' && downloadedMacDmgPath && fs.existsSync(downloadedMacDmgPath)) {
    // Generate macOS helper install script
    const scriptPath = path.join(app.getPath('temp'), 'axiom_apply_update.sh');
    const targetApp = '/Applications/Axiom Stock Ledger.app';
    const scriptContent = `#!/bin/bash
sleep 1.2
DMG_PATH="${downloadedMacDmgPath}"
TARGET_APP="${targetApp}"
MOUNT_DIR=$(mktemp -d /tmp/axiom_mount_XXXXXX)

if hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_DIR" -nobrowse -quiet; then
  SOURCE_APP=$(find "$MOUNT_DIR" -maxdepth 1 -name "*.app" | head -n 1)
  if [ -n "$SOURCE_APP" ] && [ -d "$SOURCE_APP" ]; then
    rm -rf "$TARGET_APP" 2>/dev/null || true
    cp -R "$SOURCE_APP" /Applications/ 2>/dev/null || true
    xattr -rd com.apple.quarantine "$TARGET_APP" 2>/dev/null || true
  fi
  hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
  rm -rf "$MOUNT_DIR"
  if [ -d "$TARGET_APP" ]; then
    open "$TARGET_APP"
    exit 0
  fi
fi

# Fallback: Open DMG for standard drag & drop
open "$DMG_PATH"
`;

    try {
      fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
      const child = spawn('/bin/bash', [scriptPath], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      app.quit();
    } catch {
      // If executing script fails, open DMG file for the user
      shell.openPath(downloadedMacDmgPath);
      app.quit();
    }
  }
}

/**
 * Fetch latest release from GitHub API
 */
function fetchLatestGitHubRelease(): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(GITHUB_LATEST_RELEASE_API);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'Axiom-Stock-Ledger-Updater',
        Accept: 'application/vnd.github.v3+json',
      },
    };

    https
      .get(options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirect
          https.get(res.headers.location, { headers: options.headers }, (redirectRes) => {
            let data = '';
            redirectRes.on('data', (chunk) => (data += chunk));
            redirectRes.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
          });
          return;
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Download file from URL with redirects and progress calculation
 */
function downloadFileWithProgress(
  fileUrl: string,
  destPath: string,
  onProgress: (percent: number, transferred: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestUrl = (targetUrl: string) => {
      const parsedUrl = new URL(targetUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      client
        .get(targetUrl, { headers: { 'User-Agent': 'Axiom-Stock-Ledger-Updater' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return requestUrl(res.headers.location);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
          }

          const total = parseInt(res.headers['content-length'] || '0', 10);
          let transferred = 0;
          const fileStream = fs.createWriteStream(destPath);

          res.on('data', (chunk) => {
            transferred += chunk.length;
            if (total > 0) {
              const percent = Math.min(100, Math.round((transferred / total) * 100));
              onProgress(percent, transferred, total);
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });

          fileStream.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        })
        .on('error', reject);
    };

    requestUrl(fileUrl);
  });
}

/**
 * Send IPC event to renderer window
 */
function sendStatus(status: string, data?: Record<string, any>) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater-status', { status, ...data });
  }
}
