import Datastore from '@seald-io/nedb';
import * as path from 'path';

export const db: {
  products?: Datastore;
  warehouses?: Datastore;
  purchaseVouchers?: Datastore;
  saleVouchers?: Datastore;
  saleReturns?: Datastore;
  openingStocks?: Datastore;
  stockAdjustments?: Datastore;
  ledger?: Datastore;
} = {};

export function initDb(dataPath: string) {
  db.products = new Datastore({ filename: path.join(dataPath, 'products.db'), autoload: true });
  db.warehouses = new Datastore({ filename: path.join(dataPath, 'warehouses.db'), autoload: true });
  db.purchaseVouchers = new Datastore({ filename: path.join(dataPath, 'purchaseVouchers.db'), autoload: true });
  db.saleVouchers = new Datastore({ filename: path.join(dataPath, 'saleVouchers.db'), autoload: true });
  db.saleReturns = new Datastore({ filename: path.join(dataPath, 'saleReturns.db'), autoload: true });
  db.openingStocks = new Datastore({ filename: path.join(dataPath, 'openingStocks.db'), autoload: true });
  db.stockAdjustments = new Datastore({ filename: path.join(dataPath, 'stockAdjustments.db'), autoload: true });
  db.ledger = new Datastore({ filename: path.join(dataPath, 'ledger.db'), autoload: true });
}
