import { MongoClient } from 'mongodb';
import type { AnyBulkWriteOperation } from 'mongodb';
import { BrowserWindow } from 'electron';
import { DATA_COLLECTIONS, clean, docTime, findDocs, insertDoc, removeDocs, updateDocs } from './db';

export type SyncState = 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncInfo {
  status: SyncState;
  lastSyncedAt: string | null;
  lastError: string | null;
  configured: boolean;
}

// AXIOM_SYNC_DB lets tests point at a scratch database instead of the real one.
const DB_NAME = process.env.AXIOM_SYNC_DB || 'inventory_db';
const CLOUD_TOMBSTONES = '_tombstones';
const CLIENT_OPTIONS = { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 };
const LOCAL_CHANGE_DEBOUNCE_MS = 4000;

let MONGO_URI = '';
let mongoClient: MongoClient | null = null;
let running: Promise<void> | null = null;
let syncAgain = false;
let indexesEnsured = false;
let changeTimer: NodeJS.Timeout | null = null;

const info: SyncInfo = { status: 'offline', lastSyncedAt: null, lastError: null, configured: false };

export function getSyncStatus(): SyncState {
  return info.status;
}

export function getSyncInfo(): SyncInfo {
  return { ...info };
}

function broadcast(channel: string, payload?: unknown) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  });
}

function setStatus(status: SyncState, error: string | null = null) {
  info.status = status;
  if (status === 'synced') {
    info.lastSyncedAt = new Date().toISOString();
    info.lastError = null;
  }
  if (status === 'error') info.lastError = error;
  broadcast('sync-status', status);
  broadcast('sync-info', getSyncInfo());
}

export function setMongoUri(uri: string) {
  const trimmed = (uri || '').trim();
  if (MONGO_URI !== trimmed) {
    MONGO_URI = trimmed;
    indexesEnsured = false;
    if (mongoClient) {
      mongoClient.close().catch(() => {});
      mongoClient = null;
    }
  }
  info.configured = !!MONGO_URI;
  if (!MONGO_URI) setStatus('offline');
}

/** Try a URI without touching the active sync configuration. */
export async function testConnection(uri: string): Promise<{ ok: boolean; error?: string; collections?: number }> {
  const trimmed = (uri || '').trim();
  if (!/^mongodb(\+srv)?:\/\//.test(trimmed)) {
    return { ok: false, error: 'The URI must start with mongodb:// or mongodb+srv://' };
  }
  const client = new MongoClient(trimmed, CLIENT_OPTIONS);
  try {
    await client.connect();
    const database = client.db(DB_NAME);
    await database.command({ ping: 1 });
    // Prove we can write, not just read.
    const probe = database.collection('_connection_test');
    await probe.updateOne({ id: 'probe' }, { $set: { id: 'probe', at: new Date() } }, { upsert: true });
    await probe.deleteOne({ id: 'probe' });
    const collections = (await database.listCollections().toArray()).filter((c) => !c.name.startsWith('_')).length;
    return { ok: true, collections };
  } catch (err: any) {
    return { ok: false, error: friendlyError(err) };
  } finally {
    await client.close().catch(() => {});
  }
}

function friendlyError(err: any): string {
  const msg: string = err?.message || String(err);
  if (/bad auth|authentication failed/i.test(msg)) return 'Wrong database username or password.';
  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(msg)) return 'Cannot reach the database server. Check the internet connection and the URI host.';
  if (/Server selection timed out|timed out/i.test(msg)) {
    return 'Connection timed out. Check the internet connection, and that this network\'s IP is allowed in MongoDB Atlas → Network Access.';
  }
  return msg;
}

async function getClient(): Promise<MongoClient | null> {
  if (!MONGO_URI) return null;
  if (!mongoClient) {
    const client = new MongoClient(MONGO_URI, CLIENT_OPTIONS);
    await client.connect();
    mongoClient = client;
  }
  return mongoClient;
}

/**
 * One full bi-directional sync.
 *
 * Every record carries `updatedAt` (stamped by the main process on each local write).
 * Deletions are recorded as tombstones. For each record id, a copy is "dead" if a
 * tombstone is at least as new as it; otherwise the newest live copy wins and is
 * written to whichever side is behind. Nothing is ever deleted without a tombstone.
 */
export function runSyncCycle(): Promise<void> {
  if (!MONGO_URI) return Promise.resolve();
  // A request during a running cycle queues exactly one more pass; callers
  // always get a promise that settles once everything requested is synced.
  if (running) {
    syncAgain = true;
    return running;
  }
  running = (async () => {
    do {
      syncAgain = false;
      await syncOnce();
    } while (syncAgain && MONGO_URI);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce(): Promise<void> {
  setStatus('syncing');

  let localChanged = false;
  try {
    const client = await getClient();
    if (!client) return;
    const cloud = client.db(DB_NAME);

    if (!indexesEnsured) {
      for (const name of [...DATA_COLLECTIONS, CLOUD_TOMBSTONES]) {
        await cloud.collection(name).createIndex({ id: 1 }).catch(() => {});
      }
      indexesEnsured = true;
    }

    // ── 1. Merge tombstones (union, newest deletedAt wins) ──────────────────
    const localTombs = await findDocs('tombstones');
    const cloudTombs = await cloud.collection(CLOUD_TOMBSTONES).find({}, { projection: { _id: 0 } }).toArray();
    const tombs = new Map<string, any>();
    for (const t of [...localTombs.map(clean), ...cloudTombs]) {
      const prev = tombs.get(t.id);
      if (!prev || Date.parse(t.deletedAt) > Date.parse(prev.deletedAt)) tombs.set(t.id, t);
    }
    const localTombMap = new Map(localTombs.map((t) => [t.id, t]));
    const cloudTombMap = new Map(cloudTombs.map((t: any) => [t.id, t]));
    const tombOps: AnyBulkWriteOperation[] = [];
    for (const t of tombs.values()) {
      if (localTombMap.get(t.id)?.deletedAt !== t.deletedAt) {
        await updateDocs('tombstones', { id: t.id }, t, { upsert: true });
      }
      if ((cloudTombMap.get(t.id) as any)?.deletedAt !== t.deletedAt) {
        tombOps.push({ replaceOne: { filter: { id: t.id }, replacement: t, upsert: true } });
      }
    }
    if (tombOps.length) await cloud.collection(CLOUD_TOMBSTONES).bulkWrite(tombOps, { ordered: false });

    // ── 2. Reconcile each collection ───────────────────────────────────────
    for (const name of DATA_COLLECTIONS) {
      const cloudCol = cloud.collection(name);
      const localDocs = await findDocs(name);
      const cloudDocs = await cloudCol.find({}, { projection: { _id: 0 } }).toArray();

      const localMap = new Map<string, any>();
      for (const d of localDocs) if (d.id) localMap.set(d.id, d);
      const cloudMap = new Map<string, any>();
      for (const d of cloudDocs) if ((d as any).id) cloudMap.set((d as any).id, d);

      const ops: AnyBulkWriteOperation[] = [];
      const ids = new Set([...localMap.keys(), ...cloudMap.keys()]);

      for (const id of ids) {
        const l = localMap.get(id);
        const c = cloudMap.get(id);
        const tomb = tombs.get(`${name}:${id}`);
        const deletedAt = tomb ? Date.parse(tomb.deletedAt) : -Infinity;
        const lt = docTime(l);
        const ct = docTime(c);
        const lAlive = !!l && lt > deletedAt;
        const cAlive = !!c && ct > deletedAt;

        if (l && !lAlive) {
          await removeDocs(name, { id }, { multi: true });
          localChanged = true;
        }
        if (c && !cAlive) ops.push({ deleteMany: { filter: { id } } });

        if (lAlive && (!cAlive || lt > ct)) {
          ops.push({ replaceOne: { filter: { id }, replacement: clean(l), upsert: true } });
        } else if (cAlive && (!lAlive || ct > lt)) {
          if (l) await updateDocs(name, { id }, c, {});
          else await insertDoc(name, c);
          localChanged = true;
        }
      }

      if (ops.length) await cloudCol.bulkWrite(ops, { ordered: false });
    }

    setStatus('synced');
  } catch (error: any) {
    console.error('[Sync] Cycle failed:', error);
    // Drop the client so the next cycle reconnects from scratch.
    if (mongoClient) {
      mongoClient.close().catch(() => {});
      mongoClient = null;
    }
    setStatus('error', friendlyError(error));
  } finally {
    if (localChanged) broadcast('data-changed');
  }
}

/** Called after every local write — pushes changes to the cloud within a few seconds. */
export function notifyLocalChange() {
  if (!MONGO_URI) return;
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    changeTimer = null;
    runSyncCycle();
  }, LOCAL_CHANGE_DEBOUNCE_MS);
}

/** Final push before the app quits; gives up after `timeoutMs` so quitting never hangs. */
export async function flushSync(timeoutMs = 8000): Promise<void> {
  if (!MONGO_URI) return;
  if (changeTimer) {
    clearTimeout(changeTimer);
    changeTimer = null;
  }
  await Promise.race([runSyncCycle(), new Promise((r) => setTimeout(r, timeoutMs))]);
}

export function startAutoSync(intervalMs = 60000) {
  if (!MONGO_URI) {
    setStatus('offline');
  } else {
    runSyncCycle();
  }
  setInterval(runSyncCycle, intervalMs);
}
