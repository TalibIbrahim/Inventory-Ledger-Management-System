import Datastore from '@seald-io/nedb';
import * as path from 'path';

// Business collections — synced to the cloud and included in backups.
export const DATA_COLLECTIONS = [
  'products',
  'warehouses',
  'purchaseVouchers',
  'saleVouchers',
  'saleReturns',
  'openingStocks',
  'stockAdjustments',
  'ledger',
  'trash',
] as const;

export type DataCollection = (typeof DATA_COLLECTIONS)[number];

// `tombstones` records deletions so they propagate through cloud sync
// instead of being re-downloaded on the next cycle.
export const db: Partial<Record<DataCollection | 'tombstones', Datastore>> = {};

export function initDb(dataPath: string) {
  for (const name of [...DATA_COLLECTIONS, 'tombstones'] as const) {
    db[name] = new Datastore({ filename: path.join(dataPath, `${name}.db`), autoload: true });
  }
}

export function isDataCollection(name: string): name is DataCollection {
  return (DATA_COLLECTIONS as readonly string[]).includes(name);
}

// ─── Promise helpers ────────────────────────────────────────────────────────
function store(name: string): Datastore {
  const ds = (db as Record<string, Datastore | undefined>)[name];
  if (!ds) throw new Error(`Unknown collection "${name}"`);
  return ds;
}

export function findDocs(name: string, query: any = {}): Promise<any[]> {
  return new Promise((resolve, reject) => {
    store(name).find(query, (err: Error | null, docs: any[]) => (err ? reject(err) : resolve(docs)));
  });
}

export function insertDoc(name: string, doc: any): Promise<any> {
  return new Promise((resolve, reject) => {
    store(name).insert(doc, (err: Error | null, newDoc: any) => (err ? reject(err) : resolve(newDoc)));
  });
}

export function updateDocs(name: string, query: any, update: any, options: any = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    store(name).update(query, update, options, (err: Error | null, num: number) => (err ? reject(err) : resolve(num)));
  });
}

export function removeDocs(name: string, query: any, options: any = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    store(name).remove(query, options, (err: Error | null, num: number) => (err ? reject(err) : resolve(num)));
  });
}

/** Strip NeDB's internal _id so documents are portable between stores. */
export function clean<T extends Record<string, any>>(doc: T): Omit<T, '_id'> {
  const { _id, ...rest } = doc;
  return rest;
}

// ─── Change tracking ────────────────────────────────────────────────────────
export function docTime(doc: any): number {
  if (!doc) return 0;
  const t = Date.parse(doc.updatedAt || doc.createdAt || '');
  return Number.isNaN(t) ? 0 : t;
}

/** Record that documents were deleted locally, so sync removes them everywhere. */
export async function recordTombstones(collection: string, docIds: string[]): Promise<void> {
  const deletedAt = new Date().toISOString();
  for (const docId of docIds) {
    if (!docId) continue;
    const id = `${collection}:${docId}`;
    await updateDocs('tombstones', { id }, { id, collection, docId, deletedAt }, { upsert: true });
  }
}
