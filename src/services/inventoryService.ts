import type {
  Product,
  Warehouse,
  PurchaseVoucher,
  PurchaseVoucherLine,
  SaleVoucher,
  SaleVoucherLine,
  SaleReturnVoucher,
  SaleReturnVoucherLine,
  OpeningStockVoucher,
  OpeningStockLine,
  StockAdjustmentVoucher,
  StockAdjustmentLine,
  StockLedgerEntry,
  PaymentStatus,
  PaymentRecord,
  PaymentMethod,
  TrashEntry,
  TrashKind,
  TrashedRecords,
} from '../types/inventory';
import {
  INITIAL_WAREHOUSES,
  INITIAL_PRODUCTS,
  INITIAL_PURCHASE_VOUCHERS,
  INITIAL_SALE_VOUCHERS,
  INITIAL_SALE_RETURNS,
  INITIAL_OPENING_STOCK,
  INITIAL_STOCK_ADJUSTMENTS,
  INITIAL_LEDGER,
} from '../data/mockData';
export const DEFAULT_WAREHOUSES: Warehouse[] = [];

const PRODUCTS_KEY = 'ledger_live_products_v1';
const WAREHOUSES_KEY = 'ledger_live_warehouses_v1';
const PV_KEY = 'ledger_live_pv_v1';
const SV_KEY = 'ledger_live_sv_v1';
const SR_KEY = 'ledger_live_sr_v1';
const OS_KEY = 'ledger_live_os_v1';
const SA_KEY = 'ledger_live_sa_v1';
const LEDGER_KEY = 'ledger_live_ledger_v1';
const TRASH_KEY = 'ledger_live_trash_v1';
const LEGACY_MIGRATED_KEY = 'ledger_localstorage_migrated_v1';

type VoucherCollection = 'purchaseVouchers' | 'saleVouchers' | 'saleReturns' | 'openingStocks' | 'stockAdjustments';
type CacheKey = 'pv' | 'sv' | 'sr' | 'os' | 'sa';

const TRASH_KINDS: Record<TrashKind, { collection: VoucherCollection; cacheKey: CacheKey; storageKey: string; label: string }> = {
  purchase: { collection: 'purchaseVouchers', cacheKey: 'pv', storageKey: PV_KEY, label: 'Purchase Voucher' },
  sale: { collection: 'saleVouchers', cacheKey: 'sv', storageKey: SV_KEY, label: 'Sale Invoice' },
  saleReturn: { collection: 'saleReturns', cacheKey: 'sr', storageKey: SR_KEY, label: 'Sale Return' },
  openingStock: { collection: 'openingStocks', cacheKey: 'os', storageKey: OS_KEY, label: 'Opening Stock' },
  stockAdjustment: { collection: 'stockAdjustments', cacheKey: 'sa', storageKey: SA_KEY, label: 'Stock Adjustment' },
};

const voucherNumberOf = (v: any): string => v?.voucherNo || v?.invoiceNo || v?.returnNo || '';

export class InventoryService {
  // ─── Local In-Memory Cache ────────────────────────────────────────────────
  private static cache = {
    products: [] as Product[],
    warehouses: [] as Warehouse[],
    pv: [] as PurchaseVoucher[],
    sv: [] as SaleVoucher[],
    sr: [] as SaleReturnVoucher[],
    os: [] as OpeningStockVoucher[],
    sa: [] as StockAdjustmentVoucher[],
    ledger: [] as StockLedgerEntry[],
    trash: [] as TrashEntry[],
  };

  private static isInitialized = false;
  private static initPromise: Promise<void> | null = null;

  // ─── Initialization (Called once on App mount) ────────────────────────────
  // Single-flight: concurrent callers share one load, so the one-time migration
  // below can never run twice in parallel.
  static initialize(): Promise<void> {
    if (this.isInitialized) return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = this.load().finally(() => {
        this.initPromise = null;
      });
    }
    return this.initPromise;
  }

  private static async load(): Promise<void> {
    
    if (window.electronAPI) {
      try {
        await this.migrateLegacyLocalStorage();

        this.cache.products = await window.electronAPI.db.find('products');
        this.cache.warehouses = await window.electronAPI.db.find('warehouses');

        // ─── One-time migration: remove hardcoded seed warehouses ────────────
        const SEED_IDS = ['wh-01', 'wh-02', 'wh-03'];
        if (this.cache.warehouses.some((w) => SEED_IDS.includes(w.id))) {
          await window.electronAPI.db.remove('warehouses', {}, { multi: true });
          // Re-insert only the non-seed ones (in case user had added real ones too)
          const realWarehouses = this.cache.warehouses.filter((w) => !SEED_IDS.includes(w.id));
          for (const w of realWarehouses) await window.electronAPI.db.insert('warehouses', w);
          this.cache.warehouses = realWarehouses;
        }
        // ─────────────────────────────────────────────────────────────────────
        this.cache.pv = await window.electronAPI.db.find('purchaseVouchers');
        this.cache.sv = await window.electronAPI.db.find('saleVouchers');
        this.cache.sr = await window.electronAPI.db.find('saleReturns');
        this.cache.os = await window.electronAPI.db.find('openingStocks');
        this.cache.sa = await window.electronAPI.db.find('stockAdjustments');
        this.cache.ledger = await window.electronAPI.db.find('ledger');
        this.cache.trash = await window.electronAPI.db.find('trash');
        this.cache.trash.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
        
        // Sort ledger by timestamp descending
        this.cache.ledger.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (e) {
        console.error('Failed to initialize DB', e);
      }
    } else {
      // Fallback to localStorage for browser dev mode
      const rawProducts = localStorage.getItem(PRODUCTS_KEY);
      this.cache.products = rawProducts !== null ? JSON.parse(rawProducts) : import.meta.env.DEV ? INITIAL_PRODUCTS : [];

      const rawWarehouses = localStorage.getItem(WAREHOUSES_KEY);
      this.cache.warehouses = rawWarehouses !== null ? JSON.parse(rawWarehouses) : import.meta.env.DEV ? INITIAL_WAREHOUSES : [];

      const rawPv = localStorage.getItem(PV_KEY);
      this.cache.pv = rawPv !== null ? JSON.parse(rawPv) : import.meta.env.DEV ? INITIAL_PURCHASE_VOUCHERS : [];

      const rawSv = localStorage.getItem(SV_KEY);
      this.cache.sv = rawSv !== null ? JSON.parse(rawSv) : import.meta.env.DEV ? INITIAL_SALE_VOUCHERS : [];

      const rawSr = localStorage.getItem(SR_KEY);
      this.cache.sr = rawSr !== null ? JSON.parse(rawSr) : import.meta.env.DEV ? INITIAL_SALE_RETURNS : [];

      const rawOs = localStorage.getItem(OS_KEY);
      this.cache.os = rawOs !== null ? JSON.parse(rawOs) : import.meta.env.DEV ? INITIAL_OPENING_STOCK : [];

      const rawSa = localStorage.getItem(SA_KEY);
      this.cache.sa = rawSa !== null ? JSON.parse(rawSa) : import.meta.env.DEV ? INITIAL_STOCK_ADJUSTMENTS : [];

      const rawTrash = localStorage.getItem(TRASH_KEY);
      this.cache.trash = rawTrash !== null ? JSON.parse(rawTrash) : [];

      const rawLedger = localStorage.getItem(LEDGER_KEY);
      this.cache.ledger = rawLedger !== null ? JSON.parse(rawLedger) : import.meta.env.DEV ? INITIAL_LEDGER : [];

      // In browser dev mode, if no sale vouchers or products exist, pre-populate initial datasets
      if (import.meta.env.DEV && this.cache.sv.length === 0 && (!rawSv || rawSv === '[]')) {
        this.cache.sv = [...INITIAL_SALE_VOUCHERS];
        this.cache.products = [...INITIAL_PRODUCTS];
        this.cache.warehouses = [...INITIAL_WAREHOUSES];
        this.cache.pv = [...INITIAL_PURCHASE_VOUCHERS];
        this.cache.sr = [...INITIAL_SALE_RETURNS];
        this.cache.os = [...INITIAL_OPENING_STOCK];
        this.cache.sa = [...INITIAL_STOCK_ADJUSTMENTS];
        this.cache.ledger = [...INITIAL_LEDGER];
      }
    }
    
    this.isInitialized = true;
  }

  // ─── Legacy localStorage → NeDB migration ─────────────────────────────────
  // Builds up to v1.0.9 shipped an ES-module preload that Electron refused to
  // load, so the app silently ran in browser-fallback mode: it seeded the demo
  // dataset and saved everything to localStorage. Move the user's real records
  // into the database once, leaving the demo records behind.
  private static async migrateLegacyLocalStorage(): Promise<void> {
    if (!window.electronAPI || localStorage.getItem(LEGACY_MIGRATED_KEY)) return;
    const db = window.electronAPI.db;

    const read = <T>(key: string): T[] => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T[]) : [];
      } catch {
        return [];
      }
    };

    const legacy = {
      products: read<Product>(PRODUCTS_KEY),
      warehouses: read<Warehouse>(WAREHOUSES_KEY),
      purchaseVouchers: read<PurchaseVoucher>(PV_KEY),
      saleVouchers: read<SaleVoucher>(SV_KEY),
      saleReturns: read<SaleReturnVoucher>(SR_KEY),
      openingStocks: read<OpeningStockVoucher>(OS_KEY),
      stockAdjustments: read<StockAdjustmentVoucher>(SA_KEY),
      ledger: read<StockLedgerEntry>(LEDGER_KEY),
    };

    const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id));
    const demoVoucherIds = new Set([
      ...ids(INITIAL_PURCHASE_VOUCHERS),
      ...ids(INITIAL_SALE_VOUCHERS),
      ...ids(INITIAL_SALE_RETURNS),
      ...ids(INITIAL_OPENING_STOCK),
      ...ids(INITIAL_STOCK_ADJUSTMENTS),
    ]);
    const notDemo = <T extends { id: string }>(list: T[]) => list.filter((x) => !demoVoucherIds.has(x.id));

    const purchaseVouchers = notDemo(legacy.purchaseVouchers);
    const saleVouchers = notDemo(legacy.saleVouchers);
    const saleReturns = notDemo(legacy.saleReturns);
    const openingStocks = notDemo(legacy.openingStocks);
    const stockAdjustments = notDemo(legacy.stockAdjustments);
    const ledger = legacy.ledger.filter((e) => !demoVoucherIds.has(e.voucherId));

    // Keep demo products/warehouses only if the user's own records use them.
    const usedProducts = new Set<string>();
    const usedWarehouses = new Set<string>();
    for (const v of [...purchaseVouchers, ...saleVouchers, ...saleReturns, ...openingStocks, ...stockAdjustments]) {
      usedWarehouses.add(v.warehouseId);
      for (const line of v.items) usedProducts.add(line.productId);
    }
    for (const e of ledger) {
      usedProducts.add(e.productId);
      usedWarehouses.add(e.warehouseId);
    }
    const demoProductIds = ids(INITIAL_PRODUCTS);
    const demoWarehouseIds = ids(INITIAL_WAREHOUSES);
    const products = legacy.products.filter((p) => !demoProductIds.has(p.id) || usedProducts.has(p.id));
    const warehouses = legacy.warehouses.filter((w) => !demoWarehouseIds.has(w.id) || usedWarehouses.has(w.id));

    const toInsert: [string, { id: string }[]][] = [
      ['products', products],
      ['warehouses', warehouses],
      ['purchaseVouchers', purchaseVouchers],
      ['saleVouchers', saleVouchers],
      ['saleReturns', saleReturns],
      ['openingStocks', openingStocks],
      ['stockAdjustments', stockAdjustments],
      ['ledger', ledger],
    ];
    // Merge: only add records the database doesn't already have.
    for (const [collection, docs] of toInsert) {
      const existing = new Set((await db.find(collection)).map((d: { id: string }) => d.id));
      for (const doc of docs) {
        if (existing.has(doc.id)) continue;
        await db.insert(collection, doc);
        existing.add(doc.id);
      }
    }

    // The legacy keys are left in place as a backup; the flag stops a re-import.
    localStorage.setItem(LEGACY_MIGRATED_KEY, new Date().toISOString());
  }

  /** Re-read everything from the database (e.g. after cloud sync pulled changes). */
  static async reload(): Promise<void> {
    if (this.initPromise) await this.initPromise;
    this.isInitialized = false;
    await this.initialize();
  }

  // ─── Numbering ──────────────────────────────────────────────────────────────
  // Numbers continue from the highest one ever issued (including vouchers in the
  // Trash), so trashing or restoring can never produce duplicate numbers.
  private static trashedDocs(collection: TrashedRecords['collection']): any[] {
    return this.cache.trash.flatMap((t) => t.records.filter((r) => r.collection === collection).flatMap((r) => r.docs));
  }

  private static nextNumber(prefix: string, collection: VoucherCollection, live: any[]): string {
    const pattern = new RegExp(`^${prefix}-\\d{4}-(\\d+)$`);
    let max = 0;
    for (const v of [...live, ...this.trashedDocs(collection)]) {
      const m = pattern.exec(voucherNumberOf(v));
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `${prefix}-${new Date().getFullYear()}-${String(max + 1).padStart(4, '0')}`;
  }

  private static nextTxnId(offset = 0): string {
    let max = 0;
    for (const e of [...this.cache.ledger, ...this.trashedDocs('ledger')]) {
      const m = /^TXN-\d{4}-(\d+)$/.exec(e.id);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `TXN-${new Date().getFullYear()}-${String(max + 1 + offset).padStart(4, '0')}`;
  }

  // ─── Products Master ────────────────────────────────────────────────────────
  static getProducts(): Product[] {
    return [...this.cache.products];
  }

  static async saveProducts(products: Product[]): Promise<void> {
    this.cache.products = products;
    if (!window.electronAPI) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    }
  }

  static async createProduct(
    input: Omit<Product, 'id' | 'currentStock' | 'createdAt' | 'updatedAt'> & {
      initialStock?: number;
      initialWarehouseId?: string;
    }
  ): Promise<{
    success: boolean;
    product?: Product;
    error?: string;
  }> {
    const products = this.getProducts();
    const existing = products.find((p) => p.sku.trim().toLowerCase() === input.sku.trim().toLowerCase());
    if (existing) {
      return { success: false, error: `Product with SKU "${input.sku}" already exists.` };
    }

    const initQty = Math.max(0, Number(input.initialStock) || 0);
    const purchaseCost = Math.max(0, Number(input.purchasePrice) || 0);

    const newProduct: Product = {
      id: `prod-${Date.now().toString(36)}`,
      sku: input.sku.trim().toUpperCase(),
      name: input.name.trim(),
      brand: input.brand.trim() || 'General',
      type: input.type.trim() || 'General',
      uom: input.uom.trim() || 'pcs',
      reorderThreshold: Math.max(0, Number(input.reorderThreshold) || 0),
      purchasePrice: purchaseCost,
      salePrice: Math.max(0, Number(input.salePrice) || 0),
      currentStock: initQty,
      createdAt: new Date().toISOString(),
    };

    const updated = [newProduct, ...products];
    await this.saveProducts(updated);
    
    if (window.electronAPI) {
      await window.electronAPI.db.insert('products', newProduct);
    }

    // If initial stock was specified, auto-create Opening Stock voucher and Stock Ledger entry
    if (initQty > 0) {
      const warehouses = this.getWarehouses();
      const targetWh =
        warehouses.find((w) => w.id === input.initialWarehouseId) || warehouses[0];

      if (targetWh) {
        const osList = this.getOpeningStockVouchers();
        const ledger = this.getLedger();

        const voucherNo = this.nextNumber('OS', 'openingStocks', osList);
        const voucherId = `os-${Date.now().toString(36)}`;
        const totalVal = initQty * purchaseCost;

        const osLine: OpeningStockLine = {
          id: `osl-${voucherId}-1`,
          productId: newProduct.id,
          sku: newProduct.sku,
          productName: newProduct.name,
          brand: newProduct.brand,
          uom: newProduct.uom,
          quantity: initQty,
          unitCost: purchaseCost,
          totalCost: totalVal,
        };

        const newVoucher: OpeningStockVoucher = {
          id: voucherId,
          voucherNo,
          date: new Date().toISOString().slice(0, 10),
          warehouseId: targetWh.id,
          warehouseName: targetWh.name,
          items: [osLine],
          totalQuantity: initQty,
          totalAmount: totalVal,
          notes: `Initial stock entered during product onboarding`,
          recordedBy: 'Catalog Manager',
          createdAt: new Date().toISOString(),
        };

        const ledgerEntry: StockLedgerEntry = {
          id: this.nextTxnId(),
          timestamp: new Date().toISOString(),
          voucherType: 'OPENING_STOCK',
          voucherId,
          voucherNo,
          warehouseId: targetWh.id,
          warehouseName: targetWh.name,
          productId: newProduct.id,
          sku: newProduct.sku,
          productName: newProduct.name,
          brand: newProduct.brand,
          uom: newProduct.uom,
          qtyIn: initQty,
          qtyOut: 0,
          changeQty: initQty,
          runningBalance: initQty,
          locationRunningBalance: initQty,
          rate: purchaseCost,
          totalValue: totalVal,
          partyName: 'Initial Product Registration',
          notes: `Initial stock entered: ${initQty} ${newProduct.uom} at ${targetWh.name}`,
          recordedBy: 'Catalog Manager',
        };

        await this.saveOpeningStockVouchers([newVoucher, ...osList]);
        await this.saveLedger([ledgerEntry, ...ledger]);
        
        if (window.electronAPI) {
          await window.electronAPI.db.insert('openingStocks', newVoucher);
          await window.electronAPI.db.insert('ledger', ledgerEntry);
        }
      }
    }

    return { success: true, product: newProduct };
  }

  static async updateProduct(
    id: string,
    updates: Partial<Omit<Product, 'id' | 'currentStock' | 'createdAt'>>
  ): Promise<{ success: boolean; product?: Product; error?: string }> {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return { success: false, error: 'Product not found.' };

    const updatedProduct: Product = {
      ...products[index],
      ...updates,
      sku: updates.sku ? updates.sku.trim().toUpperCase() : products[index].sku,
      name: updates.name ? updates.name.trim() : products[index].name,
      brand: updates.brand ? updates.brand.trim() : products[index].brand,
      type: updates.type ? updates.type.trim() : products[index].type,
      uom: updates.uom ? updates.uom.trim() : products[index].uom,
      updatedAt: new Date().toISOString(),
    };

    products[index] = updatedProduct;
    await this.saveProducts(products);
    
    if (window.electronAPI) {
      await window.electronAPI.db.update('products', { id }, updatedProduct);
    }
    
    return { success: true, product: updatedProduct };
  }

  static async deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
    const products = this.getProducts();
    const ledger = this.getLedger();

    // Safety check: check if product has transactions in ledger
    const hasTransactions = ledger.some((l) => l.productId === id);
    if (hasTransactions) {
      return {
        success: false,
        error: 'Cannot delete product with existing audit ledger transactions. It has recorded stock history.',
      };
    }

    if (this.trashedDocs('ledger').some((l) => l.productId === id)) {
      return {
        success: false,
        error: 'This product is used by a voucher in the Trash. Delete that voucher permanently first.',
      };
    }

    const filtered = products.filter((p) => p.id !== id);
    await this.saveProducts(filtered);
    
    if (window.electronAPI) {
      await window.electronAPI.db.remove('products', { id });
    }
    
    return { success: true };
  }

  // ─── Warehouses / Location ──────────────────────────────────────────────────
  static getWarehouses(): Warehouse[] {
    return [...this.cache.warehouses];
  }

  static async saveWarehouses(warehouses: Warehouse[]): Promise<void> {
    this.cache.warehouses = warehouses;
    if (!window.electronAPI) {
      localStorage.setItem(WAREHOUSES_KEY, JSON.stringify(warehouses));
    }
  }

  static async createWarehouse(input: Omit<Warehouse, 'id'>): Promise<{
    success: boolean;
    warehouse?: Warehouse;
    error?: string;
  }> {
    const warehouses = this.getWarehouses();
    const existing = warehouses.find((w) => w.code.trim().toLowerCase() === input.code.trim().toLowerCase());
    if (existing) {
      return { success: false, error: `Warehouse with code "${input.code}" already exists.` };
    }

    const newWh: Warehouse = {
      id: `wh-${Date.now().toString(36)}`,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      city: input.city.trim(),
      address: input.address.trim(),
      manager: input.manager.trim() || 'Warehouse Lead',
    };

    const updated = [...warehouses, newWh];
    await this.saveWarehouses(updated);
    
    if (window.electronAPI) {
      await window.electronAPI.db.insert('warehouses', newWh);
    }
    
    return { success: true, warehouse: newWh };
  }

  // ─── Central Ledger ─────────────────────────────────────────────────────────
  static getLedger(): StockLedgerEntry[] {
    return [...this.cache.ledger];
  }

  static async saveLedger(ledger: StockLedgerEntry[]): Promise<void> {
    this.cache.ledger = ledger;
    if (!window.electronAPI) {
      localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    }
  }

  /**
   * Helper to get real-time stock of a product at a specific warehouse or across all
   */
  static getProductStockAtWarehouse(productId: string, warehouseId?: string): number {
    const ledger = this.getLedger();
    let stock = 0;
    for (const entry of ledger) {
      if (entry.productId === productId) {
        if (!warehouseId || entry.warehouseId === warehouseId) {
          stock += entry.changeQty;
        }
      }
    }
    return stock;
  }

  // ─── Purchase Module ────────────────────────────────────────────────────────
  static getPurchaseVouchers(): PurchaseVoucher[] {
    return [...this.cache.pv];
  }

  static async savePurchaseVouchers(vouchers: PurchaseVoucher[]): Promise<void> {
    this.cache.pv = vouchers;
    if (!window.electronAPI) {
      localStorage.setItem(PV_KEY, JSON.stringify(vouchers));
    }
  }

  static async createPurchaseVoucher(input: {
    supplierName: string;
    supplierInvoiceNo?: string;
    warehouseId: string;
    date: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    notes?: string;
    recordedBy: string;
  }): Promise<{ success: boolean; voucher?: PurchaseVoucher; error?: string }> {
    if (!input.supplierName.trim()) return { success: false, error: 'Supplier name is required.' };
    if (!input.warehouseId) return { success: false, error: 'Please select a receiving warehouse.' };
    if (!input.items || input.items.length === 0) {
      return { success: false, error: 'At least one line item is required.' };
    }

    const products = this.getProducts();
    const warehouses = this.getWarehouses();
    const targetWh = warehouses.find((w) => w.id === input.warehouseId);
    if (!targetWh) return { success: false, error: 'Invalid warehouse selected.' };

    const pvList = this.getPurchaseVouchers();
    const ledger = this.getLedger();

    const voucherNo = this.nextNumber('PV', 'purchaseVouchers', pvList);
    const voucherId = `pv-${Date.now().toString(36)}`;

    let totalQuantity = 0;
    let totalAmount = 0;
    const lines: PurchaseVoucherLine[] = [];
    const newLedgerEntries: StockLedgerEntry[] = [];
    const updatedProducts: Product[] = [];

    // Process each line item
    for (let i = 0; i < input.items.length; i++) {
      const itemInput = input.items[i];
      const prod = products.find((p) => p.id === itemInput.productId);
      if (!prod) continue;

      const qty = Math.max(1, Number(itemInput.quantity) || 1);
      const price = Math.max(0, Number(itemInput.unitPrice) || prod.purchasePrice);
      const lineTotal = qty * price;

      totalQuantity += qty;
      totalAmount += lineTotal;

      lines.push({
        id: `pvl-${voucherId}-${i + 1}`,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        brand: prod.brand,
        uom: prod.uom,
        quantity: qty,
        unitPrice: price,
        totalPrice: lineTotal,
      });

      // Update product current stock and purchase cost
      prod.currentStock += qty;
      prod.purchasePrice = price; // update last purchase price
      prod.updatedAt = new Date().toISOString();
      updatedProducts.push(prod);

      // Create Stock Ledger Entry (Inflow Debit)
      const currentWhStock = this.getProductStockAtWarehouse(prod.id, targetWh.id);
      const ledgerEntry: StockLedgerEntry = {
        id: this.nextTxnId(newLedgerEntries.length),
        timestamp: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
        voucherType: 'PURCHASE',
        voucherId,
        voucherNo,
        warehouseId: targetWh.id,
        warehouseName: targetWh.name,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        brand: prod.brand,
        uom: prod.uom,
        qtyIn: qty,
        qtyOut: 0,
        changeQty: qty,
        runningBalance: prod.currentStock,
        locationRunningBalance: currentWhStock + qty,
        rate: price,
        totalValue: lineTotal,
        partyName: input.supplierName.trim(),
        notes: input.notes?.trim() || `Purchased from ${input.supplierName.trim()}`,
        recordedBy: input.recordedBy.trim() || 'System Operator',
      };
      newLedgerEntries.push(ledgerEntry);
    }

    const newVoucher: PurchaseVoucher = {
      id: voucherId,
      voucherNo,
      supplierInvoiceNo: input.supplierInvoiceNo?.trim(),
      date: input.date || new Date().toISOString().slice(0, 10),
      supplierName: input.supplierName.trim(),
      warehouseId: targetWh.id,
      warehouseName: targetWh.name,
      items: lines,
      totalQuantity,
      totalAmount,
      notes: input.notes?.trim() || '',
      recordedBy: input.recordedBy.trim() || 'System Operator',
      createdAt: new Date().toISOString(),
    };

    // Save
    await this.savePurchaseVouchers([newVoucher, ...pvList]);
    await this.saveLedger([...newLedgerEntries, ...ledger]);
    await this.saveProducts(products);
    
    if (window.electronAPI) {
      await window.electronAPI.db.insert('purchaseVouchers', newVoucher);
      for (const e of newLedgerEntries) await window.electronAPI.db.insert('ledger', e);
      for (const p of updatedProducts) await window.electronAPI.db.update('products', { id: p.id }, p);
    }

    return { success: true, voucher: newVoucher };
  }

  // ─── Sales Module ───────────────────────────────────────────────────────────
  static getSaleVouchers(): SaleVoucher[] {
    return [...this.cache.sv];
  }

  static async saveSaleVouchers(vouchers: SaleVoucher[]): Promise<void> {
    this.cache.sv = vouchers;
    if (!window.electronAPI) {
      localStorage.setItem(SV_KEY, JSON.stringify(vouchers));
    }
  }

  static async createSaleVoucher(input: {
    customerName: string;
    warehouseId: string;
    date: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    notes?: string;
    recordedBy: string;
    paymentStatus?: PaymentStatus;
    paidAmount?: number;
    paymentMethod?: string;
    dueDate?: string;
  }): Promise<{ success: boolean; voucher?: SaleVoucher; error?: string }> {
    if (!input.customerName.trim()) return { success: false, error: 'Customer name is required.' };
    if (!input.warehouseId) return { success: false, error: 'Please select a dispatch warehouse.' };
    if (!input.items || input.items.length === 0) {
      return { success: false, error: 'At least one line item is required.' };
    }

    const products = this.getProducts();
    const warehouses = this.getWarehouses();
    const targetWh = warehouses.find((w) => w.id === input.warehouseId);
    if (!targetWh) return { success: false, error: 'Invalid warehouse selected.' };

    // Stock validation: verify warehouse stock for each item
    for (const itemInput of input.items) {
      const prod = products.find((p) => p.id === itemInput.productId);
      if (!prod) continue;
      const whStock = this.getProductStockAtWarehouse(prod.id, targetWh.id);
      if (itemInput.quantity > whStock) {
        return {
          success: false,
          error: `Insufficient stock at ${targetWh.name}! "${prod.name}" has only ${whStock} ${prod.uom} on hand. Requested: ${itemInput.quantity} ${prod.uom}.`,
        };
      }
    }

    const svList = this.getSaleVouchers();
    const ledger = this.getLedger();

    const invoiceNo = this.nextNumber('INV', 'saleVouchers', svList);
    const voucherId = `sv-${Date.now().toString(36)}`;

    let totalQuantity = 0;
    let totalAmount = 0;
    const lines: SaleVoucherLine[] = [];
    const newLedgerEntries: StockLedgerEntry[] = [];
    const updatedProducts: Product[] = [];

    for (let i = 0; i < input.items.length; i++) {
      const itemInput = input.items[i];
      const prod = products.find((p) => p.id === itemInput.productId);
      if (!prod) continue;

      const qty = Math.max(1, Number(itemInput.quantity) || 1);
      const price = Math.max(0, Number(itemInput.unitPrice) || prod.salePrice);
      const lineTotal = qty * price;

      totalQuantity += qty;
      totalAmount += lineTotal;

      lines.push({
        id: `svl-${voucherId}-${i + 1}`,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        brand: prod.brand,
        uom: prod.uom,
        quantity: qty,
        unitPrice: price,
        unitCost: prod.purchasePrice,
        totalPrice: lineTotal,
      });

      prod.currentStock -= qty;
      prod.updatedAt = new Date().toISOString();
      updatedProducts.push(prod);

      const currentWhStock = this.getProductStockAtWarehouse(prod.id, targetWh.id);
      const ledgerEntry: StockLedgerEntry = {
        id: this.nextTxnId(newLedgerEntries.length),
        timestamp: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
        voucherType: 'SALE',
        voucherId,
        voucherNo: invoiceNo,
        warehouseId: targetWh.id,
        warehouseName: targetWh.name,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        brand: prod.brand,
        uom: prod.uom,
        qtyIn: 0,
        qtyOut: qty,
        changeQty: -qty,
        runningBalance: prod.currentStock,
        locationRunningBalance: currentWhStock - qty,
        rate: price,
        totalValue: lineTotal,
        partyName: input.customerName.trim(),
        notes: input.notes?.trim() || `Sold to ${input.customerName.trim()}`,
        recordedBy: input.recordedBy.trim() || 'System Operator',
      };
      newLedgerEntries.push(ledgerEntry);
    }

    // Payment details computation
    const chosenStatus = input.paymentStatus || 'PAID';
    let initialPaid = 0;
    if (chosenStatus === 'PAID') {
      initialPaid = totalAmount;
    } else if (input.paidAmount !== undefined) {
      initialPaid = Math.min(totalAmount, Math.max(0, Number(input.paidAmount) || 0));
    }
    const dueAmount = Math.max(0, totalAmount - initialPaid);
    const resolvedStatus: PaymentStatus =
      dueAmount === 0 ? 'PAID' : initialPaid > 0 ? 'PARTIAL' : 'PAYMENT_DUE';

    const paymentHistory: PaymentRecord[] = [];
    if (initialPaid > 0) {
      paymentHistory.push({
        id: `pay-${voucherId}-init`,
        voucherId,
        invoiceNo,
        customerName: input.customerName.trim(),
        date: input.date || new Date().toISOString().slice(0, 10),
        amount: initialPaid,
        paymentMethod: input.paymentMethod || (resolvedStatus === 'PAID' ? 'CASH' : 'CREDIT'),
        notes: resolvedStatus === 'PAID' ? 'Settled on dispatch (Cash on Hand)' : 'Initial upfront payment',
        recordedBy: input.recordedBy.trim() || 'System Operator',
        createdAt: new Date().toISOString(),
      });
    }

    const newVoucher: SaleVoucher = {
      id: voucherId,
      invoiceNo,
      date: input.date || new Date().toISOString().slice(0, 10),
      customerName: input.customerName.trim(),
      warehouseId: targetWh.id,
      warehouseName: targetWh.name,
      items: lines,
      totalQuantity,
      totalAmount,
      notes: input.notes?.trim() || '',
      recordedBy: input.recordedBy.trim() || 'System Operator',
      createdAt: new Date().toISOString(),
      paymentStatus: resolvedStatus,
      paidAmount: initialPaid,
      dueAmount,
      paymentMethod: input.paymentMethod || (resolvedStatus === 'PAID' ? 'CASH' : 'CREDIT'),
      dueDate:
        input.dueDate ||
        (resolvedStatus !== 'PAID'
          ? new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
          : undefined),
      paymentHistory,
    };

    await this.saveSaleVouchers([newVoucher, ...svList]);
    await this.saveLedger([...newLedgerEntries, ...ledger]);
    await this.saveProducts(products);

    if (window.electronAPI) {
      await window.electronAPI.db.insert('saleVouchers', newVoucher);
      for (const e of newLedgerEntries) await window.electronAPI.db.insert('ledger', e);
      for (const p of updatedProducts) await window.electronAPI.db.update('products', { id: p.id }, p);
    }

    return { success: true, voucher: newVoucher };
  }

  static async recordCustomerPayment(input: {
    voucherId: string;
    amount: number;
    date?: string;
    paymentMethod: PaymentMethod | string;
    referenceNo?: string;
    notes?: string;
    recordedBy: string;
  }): Promise<{ success: boolean; voucher?: SaleVoucher; error?: string }> {
    const svList = this.getSaleVouchers();
    const index = svList.findIndex((v) => v.id === input.voucherId);
    if (index === -1) {
      return { success: false, error: 'Invoice not found.' };
    }

    const voucher = { ...svList[index] };
    const payAmount = Math.max(0, Number(input.amount) || 0);
    if (payAmount <= 0) {
      return { success: false, error: 'Payment amount must be greater than 0.' };
    }

    const currentPaid = voucher.paidAmount ?? (voucher.paymentStatus === 'PAYMENT_DUE' ? 0 : voucher.totalAmount);
    const newPaid = Math.min(voucher.totalAmount, currentPaid + payAmount);
    const newDue = Math.max(0, voucher.totalAmount - newPaid);
    const newStatus: PaymentStatus = newDue === 0 ? 'PAID' : 'PARTIAL';

    const payRecord: PaymentRecord = {
      id: `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      voucherId: voucher.id,
      invoiceNo: voucher.invoiceNo,
      customerName: voucher.customerName,
      date: input.date || new Date().toISOString().slice(0, 10),
      amount: payAmount,
      paymentMethod: input.paymentMethod || 'CASH',
      referenceNo: input.referenceNo?.trim(),
      notes: input.notes?.trim() || 'Payment received from customer',
      recordedBy: input.recordedBy.trim() || 'System Operator',
      createdAt: new Date().toISOString(),
    };

    const updatedVoucher: SaleVoucher = {
      ...voucher,
      paidAmount: newPaid,
      dueAmount: newDue,
      paymentStatus: newStatus,
      paymentMethod: input.paymentMethod || voucher.paymentMethod,
      paymentHistory: [...(voucher.paymentHistory || []), payRecord],
    };

    svList[index] = updatedVoucher;
    await this.saveSaleVouchers(svList);

    if (window.electronAPI) {
      await window.electronAPI.db.update('saleVouchers', { id: updatedVoucher.id }, updatedVoucher);
    }

    return { success: true, voucher: updatedVoucher };
  }

  static async recordCustomerAccountPayment(input: {
    customerName: string;
    amount: number;
    date?: string;
    paymentMethod: PaymentMethod | string;
    referenceNo?: string;
    notes?: string;
    recordedBy: string;
  }): Promise<{ success: boolean; paidInvoicesCount: number; error?: string }> {
    const svList = this.getSaleVouchers();
    let remainingAmount = Math.max(0, Number(input.amount) || 0);
    if (remainingAmount <= 0) {
      return { success: false, paidInvoicesCount: 0, error: 'Payment amount must be greater than 0.' };
    }

    // Find all invoices for this customer with outstanding due, oldest first
    const customerInvoices = svList
      .filter((v) => v.customerName.toLowerCase() === input.customerName.toLowerCase())
      .filter((v) => {
        const due = v.dueAmount ?? (v.paymentStatus === 'PAYMENT_DUE' ? v.totalAmount : 0);
        return due > 0;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (customerInvoices.length === 0) {
      return {
        success: false,
        paidInvoicesCount: 0,
        error: `No outstanding balance found for customer "${input.customerName}".`,
      };
    }

    let affectedCount = 0;
    for (const inv of customerInvoices) {
      if (remainingAmount <= 0) break;
      const currentPaid = inv.paidAmount ?? (inv.paymentStatus === 'PAYMENT_DUE' ? 0 : inv.totalAmount);
      const currentDue = inv.dueAmount ?? Math.max(0, inv.totalAmount - currentPaid);

      const allocation = Math.min(currentDue, remainingAmount);
      if (allocation <= 0) continue;

      const res = await this.recordCustomerPayment({
        voucherId: inv.id,
        amount: allocation,
        date: input.date,
        paymentMethod: input.paymentMethod,
        referenceNo: input.referenceNo,
        notes: input.notes ? `${input.notes} (Account allocation)` : 'Account payment allocation',
        recordedBy: input.recordedBy,
      });

      if (res.success) {
        affectedCount++;
        remainingAmount -= allocation;
      }
    }

    return { success: true, paidInvoicesCount: affectedCount };
  }

  // ─── Sale Returns ───────────────────────────────────────────────────────────
  static getSaleReturns(): SaleReturnVoucher[] {
    return [...this.cache.sr];
  }

  static async saveSaleReturns(returns: SaleReturnVoucher[]): Promise<void> {
    this.cache.sr = returns;
    if (!window.electronAPI) {
      localStorage.setItem(SR_KEY, JSON.stringify(returns));
    }
  }

  static async createSaleReturn(input: {
    customerName: string;
    originalInvoiceNo?: string;
    warehouseId: string;
    date: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number; reason: string }>;
    notes?: string;
    recordedBy: string;
  }): Promise<{ success: boolean; voucher?: SaleReturnVoucher; error?: string }> {
    if (!input.customerName.trim()) return { success: false, error: 'Customer name is required.' };
    if (!input.warehouseId) return { success: false, error: 'Please select a receiving warehouse.' };
    if (!input.items || input.items.length === 0) {
      return { success: false, error: 'At least one return item is required.' };
    }

    const products = this.getProducts();
    const warehouses = this.getWarehouses();
    const targetWh = warehouses.find((w) => w.id === input.warehouseId);
    if (!targetWh) return { success: false, error: 'Invalid warehouse selected.' };

    const srList = this.getSaleReturns();
    const ledger = this.getLedger();

    const returnNo = this.nextNumber('SR', 'saleReturns', srList);
    const voucherId = `sr-${Date.now().toString(36)}`;

    let totalQuantity = 0;
    let totalAmount = 0;
    const lines: SaleReturnVoucherLine[] = [];
    const newLedgerEntries: StockLedgerEntry[] = [];
    const updatedProducts: Product[] = [];

    for (let i = 0; i < input.items.length; i++) {
      const itemInput = input.items[i];
      const prod = products.find((p) => p.id === itemInput.productId);
      if (!prod) continue;

      const qty = Math.max(1, Number(itemInput.quantity) || 1);
      const price = Math.max(0, Number(itemInput.unitPrice) || prod.salePrice);
      const lineTotal = qty * price;

      totalQuantity += qty;
      totalAmount += lineTotal;

      lines.push({
        id: `srl-${voucherId}-${i + 1}`,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        brand: prod.brand,
        uom: prod.uom,
        quantity: qty,
        unitPrice: price,
        totalPrice: lineTotal,
        reason: itemInput.reason?.trim() || 'Customer Return',
      });

      prod.currentStock += qty; // restore stock
      prod.updatedAt = new Date().toISOString();
      updatedProducts.push(prod);

      const currentWhStock = this.getProductStockAtWarehouse(prod.id, targetWh.id);
      const ledgerEntry: StockLedgerEntry = {
        id: this.nextTxnId(newLedgerEntries.length),
        timestamp: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
        voucherType: 'SALE_RETURN',
        voucherId,
        voucherNo: returnNo,
        warehouseId: targetWh.id,
        warehouseName: targetWh.name,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        brand: prod.brand,
        uom: prod.uom,
        qtyIn: qty,
        qtyOut: 0,
        changeQty: qty,
        runningBalance: prod.currentStock,
        locationRunningBalance: currentWhStock + qty,
        rate: price,
        totalValue: lineTotal,
        partyName: input.customerName.trim(),
        notes: `Returned: ${itemInput.reason?.trim() || 'Customer return'}${
          input.originalInvoiceNo ? ` (Ref: ${input.originalInvoiceNo})` : ''
        }`,
        recordedBy: input.recordedBy.trim() || 'System Operator',
      };
      newLedgerEntries.push(ledgerEntry);
    }

    const newVoucher: SaleReturnVoucher = {
      id: voucherId,
      returnNo,
      originalInvoiceNo: input.originalInvoiceNo?.trim(),
      date: input.date || new Date().toISOString().slice(0, 10),
      customerName: input.customerName.trim(),
      warehouseId: targetWh.id,
      warehouseName: targetWh.name,
      items: lines,
      totalQuantity,
      totalAmount,
      notes: input.notes?.trim() || '',
      recordedBy: input.recordedBy.trim() || 'System Operator',
      createdAt: new Date().toISOString(),
    };

    await this.saveSaleReturns([newVoucher, ...srList]);
    await this.saveLedger([...newLedgerEntries, ...ledger]);
    await this.saveProducts(products);

    if (window.electronAPI) {
      await window.electronAPI.db.insert('saleReturns', newVoucher);
      for (const e of newLedgerEntries) await window.electronAPI.db.insert('ledger', e);
      for (const p of updatedProducts) await window.electronAPI.db.update('products', { id: p.id }, p);
    }

    return { success: true, voucher: newVoucher };
  }

  // ─── Inventory Vouchers (Opening Stock & Stock Adjustment) ─────────────────
  static getOpeningStockVouchers(): OpeningStockVoucher[] {
    return [...this.cache.os];
  }

  static async saveOpeningStockVouchers(vouchers: OpeningStockVoucher[]): Promise<void> {
    this.cache.os = vouchers;
    if (!window.electronAPI) {
      localStorage.setItem(OS_KEY, JSON.stringify(vouchers));
    }
  }

  static async createOpeningStockVoucher(input: {
    warehouseId: string;
    date: string;
    items: Array<{ productId: string; quantity: number; unitCost: number }>;
    notes?: string;
    recordedBy: string;
  }): Promise<{ success: boolean; voucher?: OpeningStockVoucher; error?: string }> {
    if (!input.warehouseId) return { success: false, error: 'Please select a warehouse location.' };
    if (!input.items || input.items.length === 0) {
      return { success: false, error: 'At least one product item is required.' };
    }

    const products = this.getProducts();
    const warehouses = this.getWarehouses();
    const targetWh = warehouses.find((w) => w.id === input.warehouseId);
    if (!targetWh) return { success: false, error: 'Invalid warehouse selected.' };

    const osList = this.getOpeningStockVouchers();
    const ledger = this.getLedger();

    const voucherNo = this.nextNumber('OS', 'openingStocks', osList);
    const voucherId = `os-${Date.now().toString(36)}`;

    let totalQuantity = 0;
    let totalAmount = 0;
    const lines: OpeningStockLine[] = [];
    const newLedgerEntries: StockLedgerEntry[] = [];
    const updatedProducts: Product[] = [];

    for (let i = 0; i < input.items.length; i++) {
      const itemInput = input.items[i];
      const prod = products.find((p) => p.id === itemInput.productId);
      if (!prod) continue;

      const qty = Math.max(1, Number(itemInput.quantity) || 1);
      const cost = Math.max(0, Number(itemInput.unitCost) || prod.purchasePrice);
      const lineTotal = qty * cost;

      totalQuantity += qty;
      totalAmount += lineTotal;

      lines.push({
        id: `osl-${voucherId}-${i + 1}`,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        brand: prod.brand,
        uom: prod.uom,
        quantity: qty,
        unitCost: cost,
        totalCost: lineTotal,
      });

      prod.currentStock += qty;
      prod.purchasePrice = cost;
      prod.updatedAt = new Date().toISOString();
      updatedProducts.push(prod);

      const currentWhStock = this.getProductStockAtWarehouse(prod.id, targetWh.id);
      const ledgerEntry: StockLedgerEntry = {
        id: this.nextTxnId(newLedgerEntries.length),
        timestamp: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
        voucherType: 'OPENING_STOCK',
        voucherId,
        voucherNo,
        warehouseId: targetWh.id,
        warehouseName: targetWh.name,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        brand: prod.brand,
        uom: prod.uom,
        qtyIn: qty,
        qtyOut: 0,
        changeQty: qty,
        runningBalance: prod.currentStock,
        locationRunningBalance: currentWhStock + qty,
        rate: cost,
        totalValue: lineTotal,
        partyName: 'Opening Stock Inventory',
        notes: input.notes?.trim() || 'Opening inventory balance',
        recordedBy: input.recordedBy.trim() || 'System Administrator',
      };
      newLedgerEntries.push(ledgerEntry);
    }

    const newVoucher: OpeningStockVoucher = {
      id: voucherId,
      voucherNo,
      date: input.date || new Date().toISOString().slice(0, 10),
      warehouseId: targetWh.id,
      warehouseName: targetWh.name,
      items: lines,
      totalQuantity,
      totalAmount,
      notes: input.notes?.trim() || '',
      recordedBy: input.recordedBy.trim() || 'System Administrator',
      createdAt: new Date().toISOString(),
    };

    await this.saveOpeningStockVouchers([newVoucher, ...osList]);
    await this.saveLedger([...newLedgerEntries, ...ledger]);
    await this.saveProducts(products);

    if (window.electronAPI) {
      await window.electronAPI.db.insert('openingStocks', newVoucher);
      for (const e of newLedgerEntries) await window.electronAPI.db.insert('ledger', e);
      for (const p of updatedProducts) await window.electronAPI.db.update('products', { id: p.id }, p);
    }

    return { success: true, voucher: newVoucher };
  }

  static getStockAdjustmentVouchers(): StockAdjustmentVoucher[] {
    return [...this.cache.sa];
  }

  static async saveStockAdjustmentVouchers(vouchers: StockAdjustmentVoucher[]): Promise<void> {
    this.cache.sa = vouchers;
    if (!window.electronAPI) {
      localStorage.setItem(SA_KEY, JSON.stringify(vouchers));
    }
  }

  static async createStockAdjustmentVoucher(input: {
    warehouseId: string;
    date: string;
    adjustmentType: 'INCREASE' | 'DECREASE' | 'WRITE_OFF' | 'RECONCILIATION';
    items: Array<{ productId: string; changeQty: number; unitCost?: number; reason: string }>;
    notes?: string;
    recordedBy: string;
  }): Promise<{ success: boolean; voucher?: StockAdjustmentVoucher; error?: string }> {
    if (!input.warehouseId) return { success: false, error: 'Warehouse is required.' };
    if (!input.items || input.items.length === 0) {
      return { success: false, error: 'At least one item is required.' };
    }

    const products = this.getProducts();
    const warehouses = this.getWarehouses();
    const targetWh = warehouses.find((w) => w.id === input.warehouseId);
    if (!targetWh) return { success: false, error: 'Invalid warehouse selected.' };

    const saList = this.getStockAdjustmentVouchers();
    const ledger = this.getLedger();

    const voucherNo = this.nextNumber('SA', 'stockAdjustments', saList);
    const voucherId = `sa-${Date.now().toString(36)}`;

    let totalQuantityChanged = 0;
    let totalValueImpact = 0;
    const lines: StockAdjustmentLine[] = [];
    const newLedgerEntries: StockLedgerEntry[] = [];
    const updatedProducts: Product[] = [];

    for (let i = 0; i < input.items.length; i++) {
      const itemInput = input.items[i];
      const prod = products.find((p) => p.id === itemInput.productId);
      if (!prod) continue;

      if (itemInput.changeQty === 0) continue;

      const currentWhStock = this.getProductStockAtWarehouse(prod.id, targetWh.id);
      if (itemInput.changeQty < 0 && Math.abs(itemInput.changeQty) > currentWhStock) {
        return {
          success: false,
          error: `Adjustment fails: Cannot decrease stock of "${prod.name}" by ${Math.abs(itemInput.changeQty)}. Only ${currentWhStock} available at ${targetWh.name}.`,
        };
      }

      const rate = itemInput.unitCost ?? prod.purchasePrice;
      const valImpact = Math.abs(itemInput.changeQty) * rate;

      totalQuantityChanged += itemInput.changeQty;
      totalValueImpact += valImpact;

      lines.push({
        id: `sal-${voucherId}-${i + 1}`,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        brand: prod.brand,
        uom: prod.uom,
        changeQty: itemInput.changeQty,
        unitCost: rate,
        totalValue: valImpact,
        reason: itemInput.reason.trim(),
      });

      prod.currentStock += itemInput.changeQty;
      prod.updatedAt = new Date().toISOString();
      updatedProducts.push(prod);

      const ledgerEntry: StockLedgerEntry = {
        id: this.nextTxnId(newLedgerEntries.length),
        timestamp: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
        voucherType: 'STOCK_ADJUSTMENT',
        voucherId,
        voucherNo,
        warehouseId: targetWh.id,
        warehouseName: targetWh.name,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        brand: prod.brand,
        uom: prod.uom,
        qtyIn: itemInput.changeQty > 0 ? itemInput.changeQty : 0,
        qtyOut: itemInput.changeQty < 0 ? Math.abs(itemInput.changeQty) : 0,
        changeQty: itemInput.changeQty,
        runningBalance: prod.currentStock,
        locationRunningBalance: currentWhStock + itemInput.changeQty,
        rate: rate,
        totalValue: valImpact,
        partyName: 'Internal Adjustment',
        notes: `[${input.adjustmentType}] ${itemInput.reason.trim()}`,
        recordedBy: input.recordedBy.trim() || 'System Operator',
      };
      newLedgerEntries.push(ledgerEntry);
    }

    if (lines.length === 0) return { success: false, error: 'No valid adjustments processed.' };

    const newVoucher: StockAdjustmentVoucher = {
      id: voucherId,
      voucherNo,
      date: input.date || new Date().toISOString().slice(0, 10),
      warehouseId: targetWh.id,
      warehouseName: targetWh.name,
      adjustmentType: input.adjustmentType,
      items: lines,
      netQuantityDelta: totalQuantityChanged,
      totalAmount: totalValueImpact,
      notes: input.notes?.trim() || '',
      recordedBy: input.recordedBy.trim() || 'Inventory Controller',
      createdAt: new Date().toISOString(),
    };

    await this.saveStockAdjustmentVouchers([newVoucher, ...saList]);
    await this.saveLedger([...newLedgerEntries, ...ledger]);
    await this.saveProducts(products);

    if (window.electronAPI) {
      await window.electronAPI.db.insert('stockAdjustments', newVoucher);
      for (const e of newLedgerEntries) await window.electronAPI.db.insert('ledger', e);
      for (const p of updatedProducts) await window.electronAPI.db.update('products', { id: p.id }, p);
    }

    return { success: true, voucher: newVoucher };
  }

  // ─── Trash (move to trash / restore / delete forever) ──────────────────────
  // Trashing a voucher removes it together with its stock ledger entries (and, for a
  // sale, any sale returns raised against it). Everything is kept in one Trash entry so
  // Restore puts it all back exactly as it was. Stock totals are rebuilt from the ledger.
  static getTrash(): TrashEntry[] {
    return [...this.cache.trash];
  }

  private static async saveTrash(trash: TrashEntry[]): Promise<void> {
    this.cache.trash = trash;
    if (!window.electronAPI) {
      localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
    }
  }

  private static async setVoucherList(kind: TrashKind, list: any[]): Promise<void> {
    const cfg = TRASH_KINDS[kind];
    (this.cache[cfg.cacheKey] as any[]) = list;
    if (!window.electronAPI) {
      localStorage.setItem(cfg.storageKey, JSON.stringify(list));
    }
  }

  private static kindForCollection(collection: string): TrashKind | null {
    const found = (Object.keys(TRASH_KINDS) as TrashKind[]).find((k) => TRASH_KINDS[k].collection === collection);
    return found ?? null;
  }

  /**
   * Compare warehouse stock before/after a change, only for the product+warehouse pairs
   * touched by `changed`. Returns a message if any of them would be pushed below zero.
   */
  private static stockProblem(
    before: StockLedgerEntry[],
    after: StockLedgerEntry[],
    changed: StockLedgerEntry[]
  ): string | null {
    const keyOf = (e: StockLedgerEntry) => `${e.productId}|${e.warehouseId}`;
    const keys = new Set(changed.map(keyOf));
    const totals = (list: StockLedgerEntry[]) => {
      const m = new Map<string, number>();
      for (const e of list) {
        const k = keyOf(e);
        if (keys.has(k)) m.set(k, (m.get(k) ?? 0) + (Number(e.changeQty) || 0));
      }
      return m;
    };
    const b = totals(before);
    const a = totals(after);
    for (const k of keys) {
      const nowQty = b.get(k) ?? 0;
      const nextQty = a.get(k) ?? 0;
      if (nextQty < 0 && nextQty < nowQty) {
        const sample = changed.find((e) => keyOf(e) === k)!;
        return `"${sample.productName}" at ${sample.warehouseName} would go to ${nextQty} ${sample.uom} (currently ${nowQty})`;
      }
    }
    return null;
  }

  /** Recompute running balances and product totals from the ledger for the given products. */
  private static async rebuildStock(productIds: Set<string>): Promise<void> {
    const ledger = this.cache.ledger;
    const changedEntries: StockLedgerEntry[] = [];
    const changedProducts: Product[] = [];

    for (const productId of productIds) {
      const entries = ledger
        .filter((e) => e.productId === productId)
        .sort((x, y) => x.timestamp.localeCompare(y.timestamp) || x.id.localeCompare(y.id));
      let total = 0;
      const perWarehouse = new Map<string, number>();
      for (const e of entries) {
        total += Number(e.changeQty) || 0;
        const wh = (perWarehouse.get(e.warehouseId) ?? 0) + (Number(e.changeQty) || 0);
        perWarehouse.set(e.warehouseId, wh);
        if (e.runningBalance !== total || e.locationRunningBalance !== wh) {
          e.runningBalance = total;
          e.locationRunningBalance = wh;
          changedEntries.push(e);
        }
      }
      const product = this.cache.products.find((p) => p.id === productId);
      if (product && product.currentStock !== total) {
        product.currentStock = total;
        product.updatedAt = new Date().toISOString();
        changedProducts.push(product);
      }
    }

    await this.saveLedger([...ledger]);
    await this.saveProducts([...this.cache.products]);
    if (window.electronAPI) {
      for (const e of changedEntries) await window.electronAPI.db.update('ledger', { id: e.id }, e);
      for (const p of changedProducts) await window.electronAPI.db.update('products', { id: p.id }, p);
    }
  }

  static async trashVoucher(
    kind: TrashKind,
    voucherId: string,
    reason: string
  ): Promise<{ success: boolean; entry?: TrashEntry; linkedReturns?: number; error?: string }> {
    const cfg = TRASH_KINDS[kind];
    const list = this.cache[cfg.cacheKey] as any[];
    const voucher = list.find((v) => v.id === voucherId);
    if (!voucher) return { success: false, error: `${cfg.label} not found.` };

    const groups: { kind: TrashKind; vouchers: any[] }[] = [{ kind, vouchers: [voucher] }];
    if (kind === 'sale') {
      const invoiceNo = String(voucher.invoiceNo || '').trim().toLowerCase();
      const linked = this.cache.sr.filter((r) => (r.originalInvoiceNo || '').trim().toLowerCase() === invoiceNo);
      if (invoiceNo && linked.length) groups.push({ kind: 'saleReturn', vouchers: linked });
    }

    const voucherIds = new Set(groups.flatMap((g) => g.vouchers.map((v) => v.id)));
    const ledgerDocs = this.cache.ledger.filter((e) => voucherIds.has(e.voucherId));
    const remaining = this.cache.ledger.filter((e) => !voucherIds.has(e.voucherId));

    const problem = this.stockProblem(this.cache.ledger, remaining, ledgerDocs);
    if (problem) {
      return {
        success: false,
        error: `Can't move ${voucherNumberOf(voucher)} to Trash: ${problem}. Some of this stock has already been sold or adjusted — trash those vouchers first.`,
      };
    }

    const strip = (d: any) => {
      const { _id, ...rest } = d;
      return rest;
    };
    const now = new Date().toISOString();
    const entry: TrashEntry = {
      id: `trash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      voucherId,
      voucherNo: voucherNumberOf(voucher),
      partyName: voucher.supplierName || voucher.customerName || voucher.warehouseName || '',
      date: voucher.date,
      totalAmount: Number(voucher.totalAmount) || 0,
      totalQuantity: Number(voucher.totalQuantity ?? voucher.netQuantityDelta) || 0,
      reason: reason.trim(),
      trashedAt: now,
      createdAt: now,
      records: [
        ...groups.map((g) => ({ collection: TRASH_KINDS[g.kind].collection, docs: g.vouchers.map(strip) })),
        { collection: 'ledger' as const, docs: ledgerDocs.map(strip) },
      ],
    };

    // Write the Trash entry first, so the data is never only in memory.
    if (window.electronAPI) await window.electronAPI.db.insert('trash', entry);
    await this.saveTrash([entry, ...this.cache.trash]);

    for (const g of groups) {
      const ids = new Set(g.vouchers.map((v) => v.id));
      const gcfg = TRASH_KINDS[g.kind];
      await this.setVoucherList(g.kind, (this.cache[gcfg.cacheKey] as any[]).filter((v) => !ids.has(v.id)));
      if (window.electronAPI) {
        for (const id of ids) await window.electronAPI.db.remove(gcfg.collection, { id });
      }
    }

    await this.saveLedger(remaining);
    if (window.electronAPI) {
      for (const e of ledgerDocs) await window.electronAPI.db.remove('ledger', { id: e.id });
    }

    await this.rebuildStock(new Set(ledgerDocs.map((e) => e.productId)));
    return { success: true, entry, linkedReturns: groups.length > 1 ? groups[1].vouchers.length : 0 };
  }

  static async restoreFromTrash(trashId: string): Promise<{ success: boolean; entry?: TrashEntry; error?: string }> {
    const entry = this.cache.trash.find((t) => t.id === trashId);
    if (!entry) return { success: false, error: 'Item not found in Trash.' };

    const ledgerDocs: StockLedgerEntry[] = entry.records
      .filter((r) => r.collection === 'ledger')
      .flatMap((r) => r.docs);

    const missingProducts = [...new Set(ledgerDocs.map((e) => e.productId))].filter(
      (pid) => !this.cache.products.some((p) => p.id === pid)
    );
    if (missingProducts.length) {
      return { success: false, error: `Can't restore ${entry.voucherNo}: one or more of its products no longer exist.` };
    }

    const existingLedgerIds = new Set(this.cache.ledger.map((e) => e.id));
    const ledgerToAdd = ledgerDocs.filter((e) => !existingLedgerIds.has(e.id));
    const problem = this.stockProblem(this.cache.ledger, [...this.cache.ledger, ...ledgerToAdd], ledgerToAdd);
    if (problem) {
      return { success: false, error: `Can't restore ${entry.voucherNo}: ${problem}. There isn't enough stock left.` };
    }

    // Put everything back first, then remove the Trash entry (no window where data is missing).
    for (const record of entry.records) {
      if (record.collection === 'ledger') continue;
      const kind = this.kindForCollection(record.collection);
      if (!kind) continue;
      const cfg = TRASH_KINDS[kind];
      const current = this.cache[cfg.cacheKey] as any[];
      const have = new Set(current.map((v) => v.id));
      const toAdd = record.docs.filter((d) => !have.has(d.id));
      await this.setVoucherList(kind, [...toAdd, ...current]);
      if (window.electronAPI) {
        for (const d of toAdd) await window.electronAPI.db.insert(cfg.collection, d);
      }
    }

    await this.saveLedger([...ledgerToAdd, ...this.cache.ledger]);
    if (window.electronAPI) {
      for (const e of ledgerToAdd) await window.electronAPI.db.insert('ledger', e);
    }

    if (window.electronAPI) await window.electronAPI.db.remove('trash', { id: trashId });
    await this.saveTrash(this.cache.trash.filter((t) => t.id !== trashId));

    await this.rebuildStock(new Set(ledgerDocs.map((e) => e.productId)));
    return { success: true, entry };
  }

  static async deleteTrashPermanently(trashId: string): Promise<{ success: boolean; error?: string }> {
    const entry = this.cache.trash.find((t) => t.id === trashId);
    if (!entry) return { success: false, error: 'Item not found in Trash.' };
    if (window.electronAPI) await window.electronAPI.db.remove('trash', { id: trashId });
    await this.saveTrash(this.cache.trash.filter((t) => t.id !== trashId));
    return { success: true };
  }

  // ─── CSV Export Utility ─────────────────────────────────────────────────────
  static async exportToCSV(headers: string[], rows: (string | number)[][], filename: string): Promise<void> {
    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join(
      '\r\n'
    );

    if (window.electronAPI) {
      const result = await window.electronAPI.saveCSV(filename, csvContent);
      if (!result.success && !result.canceled) {
        console.error('Electron CSV save failed:', result.error);
        alert('Failed to save CSV file: ' + result.error);
      }
    } else {
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Delay cleanup to ensure Chrome reads the download attribute correctly
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    }
  }

  // ─── Clear All Data / Reset System ──────────────────────────────────────────
  static async clearAllData(): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.db.clearAll();
    } else {
      const keysToRemove = [
        PRODUCTS_KEY,
        WAREHOUSES_KEY,
        PV_KEY,
        SV_KEY,
        SR_KEY,
        OS_KEY,
        SA_KEY,
        LEDGER_KEY,
        TRASH_KEY,
      ];
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }

    // Reset memory cache
    this.cache.products = [];
    this.cache.pv = [];
    this.cache.sv = [];
    this.cache.sr = [];
    this.cache.os = [];
    this.cache.sa = [];
    this.cache.ledger = [];
    this.cache.trash = [];

    await this.saveWarehouses(DEFAULT_WAREHOUSES);
  }
}
