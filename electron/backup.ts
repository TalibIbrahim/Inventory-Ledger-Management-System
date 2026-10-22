import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { DATA_COLLECTIONS, clean, findDocs, insertDoc, recordTombstones, removeDocs } from './db';

const KEEP_BACKUPS = 60;
const AUTO_BACKUP_INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4 hours while running

export function getBackupDir(): string {
  const dir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Write a full JSON snapshot of every business collection.
 * Written to a temp file first and renamed, so a crash never leaves a half-written backup.
 */
export async function createBackup(reason: string): Promise<string> {
  const data: Record<string, any[]> = {};
  let total = 0;
  for (const name of DATA_COLLECTIONS) {
    data[name] = (await findDocs(name)).map(clean);
    total += data[name].length;
  }

  const payload = {
    app: 'Axiom Stock Ledger',
    version: app.getVersion(),
    createdAt: new Date().toISOString(),
    reason,
    totalRecords: total,
    collections: data,
  };

  const dir = getBackupDir();
  const file = path.join(dir, `axiom-backup-${stamp()}-${reason.replace(/[^a-z0-9-]/gi, '')}.json`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload), 'utf-8');
  fs.renameSync(tmp, file);
  pruneBackups(dir);
  return file;
}

function pruneBackups(dir: string) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('axiom-backup-') && f.endsWith('.json'))
    .sort(); // timestamped names sort chronologically
  for (const f of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
    try {
      fs.unlinkSync(path.join(dir, f));
    } catch {
      // ignore — a stale backup is harmless
    }
  }
}

export function listBackups(): { file: string; createdAt: string; size: number }[] {
  const dir = getBackupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('axiom-backup-') && f.endsWith('.json'))
    .map((f) => {
      const stat = fs.statSync(path.join(dir, f));
      return { file: path.join(dir, f), createdAt: stat.mtime.toISOString(), size: stat.size };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Replace all local data with the contents of a backup file.
 * A safety backup of the current state is taken first. Restored records are stamped
 * as fresh edits so cloud sync propagates the restored state instead of overwriting it.
 */
export async function restoreBackup(file: string): Promise<{ restored: number; safetyBackup: string }> {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!parsed || typeof parsed !== 'object' || !parsed.collections) {
    throw new Error('This file is not an Axiom Stock Ledger backup.');
  }

  const safetyBackup = await createBackup('before-restore');
  const now = new Date().toISOString();
  let restored = 0;

  for (const name of DATA_COLLECTIONS) {
    const incoming: any[] = Array.isArray(parsed.collections[name]) ? parsed.collections[name] : [];
    const existing = await findDocs(name);
    const incomingIds = new Set(incoming.map((d) => d.id));

    await recordTombstones(
      name,
      existing.map((d) => d.id).filter((id) => !incomingIds.has(id))
    );
    await removeDocs(name, {}, { multi: true });
    for (const doc of incoming) {
      await insertDoc(name, { ...clean(doc), updatedAt: now });
      restored++;
    }
  }

  return { restored, safetyBackup };
}

export function startAutoBackups() {
  createBackup('startup').catch((err) => console.error('[Backup] Startup backup failed:', err));
  setInterval(() => {
    createBackup('auto').catch((err) => console.error('[Backup] Auto backup failed:', err));
  }, AUTO_BACKUP_INTERVAL_MS);
}
