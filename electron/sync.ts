import { MongoClient } from 'mongodb';
import { db as collections } from './db';
import { BrowserWindow } from 'electron';

let currentSyncStatus: 'syncing' | 'synced' | 'error' | 'offline' = 'offline';

export function getSyncStatus() {
  return currentSyncStatus;
}

function broadcastSyncStatus(status: 'syncing' | 'synced' | 'error' | 'offline') {
  currentSyncStatus = status;
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('sync-status', status);
    }
  });
}

let MONGO_URI = '';
const DB_NAME = 'inventory_db';

export function setMongoUri(uri: string) {
  if (MONGO_URI !== uri) {
    MONGO_URI = uri;
    if (mongoClient) {
      mongoClient.close().catch(console.error);
      mongoClient = null;
    }
  }
}

let mongoClient: MongoClient | null = null;
let isSyncing = false;

export async function connectToCloud(): Promise<boolean> {
  try {
    if (!mongoClient) {
      if (!MONGO_URI) return false;
      mongoClient = new MongoClient(MONGO_URI);
      await mongoClient.connect();
      console.log('Connected to MongoDB Atlas successfully.');
    }
    return true;
  } catch (error) {
    console.error('Failed to connect to MongoDB Atlas:', error);
    mongoClient = null;
    broadcastSyncStatus('error');
    return false;
  }
}

export async function runSyncCycle() {
  if (isSyncing) return;
  if (!mongoClient) {
    const connected = await connectToCloud();
    if (!connected) return;
  }

  isSyncing = true;
  broadcastSyncStatus('syncing');
  try {
    const db = mongoClient!.db(DB_NAME);

    const syncCollections = [
      'products',
      'warehouses',
      'purchaseVouchers',
      'saleVouchers',
      'saleReturns',
      'openingStocks',
      'stockAdjustments',
      'ledger'
    ];

    for (const colName of syncCollections) {
      const localStore = collections[colName];
      if (!localStore) continue;

      const cloudCol = db.collection(colName);
      
      // 1. Fetch all local documents
      const localDocs: any[] = await new Promise((resolve, reject) => {
        localStore.find({}, (err: any, docs: any) => {
          if (err) reject(err);
          else resolve(docs);
        });
      });

      // 2. Fetch all cloud documents
      const cloudDocs = await cloudCol.find({}).toArray();
      const cloudDocsMap = new Map(cloudDocs.map(doc => [doc.id, doc]));

      // 3. Push Local to Cloud
      for (const localDoc of localDocs) {
        const cloudDoc = cloudDocsMap.get(localDoc.id);
        
        // Remove nedb internal _id for mongo
        const docToPush = { ...localDoc };
        delete docToPush._id;

        if (!cloudDoc) {
          // Exists locally but not in cloud -> Push
          await cloudCol.insertOne(docToPush);
        } else {
          // Compare updatedAt if it exists (for mutable items like products)
          const localTime = localDoc.updatedAt ? new Date(localDoc.updatedAt).getTime() : 0;
          const cloudTime = cloudDoc.updatedAt ? new Date(cloudDoc.updatedAt).getTime() : 0;
          
          if (localTime > cloudTime) {
            await cloudCol.updateOne({ id: localDoc.id }, { $set: docToPush });
          }
        }
      }

      // 4. Pull Cloud to Local
      const localDocsMap = new Map(localDocs.map(doc => [doc.id, doc]));
      for (const cloudDoc of cloudDocs) {
        const localDoc = localDocsMap.get(cloudDoc.id);
        
        if (!localDoc) {
          // Exists in cloud but not locally -> Pull
          const docToPull = { ...cloudDoc };
          delete docToPull._id;
          await new Promise((resolve) => localStore.insert(docToPull, resolve));
        } else {
          // Compare updatedAt
          const localTime = localDoc.updatedAt ? new Date(localDoc.updatedAt).getTime() : 0;
          const cloudTime = cloudDoc.updatedAt ? new Date(cloudDoc.updatedAt).getTime() : 0;
          
          if (cloudTime > localTime) {
            const docToPull = { ...cloudDoc };
            delete docToPull._id;
            await new Promise((resolve) => localStore.update({ id: cloudDoc.id }, docToPull, {}, resolve));
          }
        }
      }
    }

    console.log(`[Sync] Cycle completed at ${new Date().toLocaleTimeString()}`);
    broadcastSyncStatus('synced');
  } catch (error) {
    console.error('[Sync] Error during sync cycle:', error);
    broadcastSyncStatus('error');
  } finally {
    isSyncing = false;
  }
}

export function startAutoSync(intervalMs = 60000) {
  console.log(`[Sync] Starting auto-sync every ${intervalMs / 1000} seconds.`);
  // Run immediate first sync
  runSyncCycle();
  // Schedule intervals
  setInterval(runSyncCycle, intervalMs);
}
