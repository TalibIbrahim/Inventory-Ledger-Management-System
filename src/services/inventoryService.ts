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
} from '../types/inventory';
export const DEFAULT_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-01',
    code: 'WH-KHI-01',
    name: 'Karachi Central Depot',
    city: 'Karachi',
    address: 'Plot 42, Sector 15, Korangi Industrial Area, Karachi',
    manager: 'Tariq Mehmood',
  },
  {
    id: 'wh-02',
    code: 'WH-LHE-01',
    name: 'Lahore Distribution Hub',
    city: 'Lahore',
    address: 'Plot 18, Block B, Sundar Industrial Estate, Lahore',
    manager: 'Usman Ghani',
  },
  {
    id: 'wh-03',
    code: 'WH-ISB-01',
    name: 'Islamabad Regional Hub',
    city: 'Islamabad',
    address: 'Plot 7, Street 3, I-9/3 Industrial Area, Islamabad',
    manager: 'Nadeem Akhtar',
  },
];

const PRODUCTS_KEY = 'ledger_live_products_v1';
const WAREHOUSES_KEY = 'ledger_live_warehouses_v1';
const PV_KEY = 'ledger_live_pv_v1';
const SV_KEY = 'ledger_live_sv_v1';
const SR_KEY = 'ledger_live_sr_v1';
const OS_KEY = 'ledger_live_os_v1';
const SA_KEY = 'ledger_live_sa_v1';
const LEDGER_KEY = 'ledger_live_ledger_v1';

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
  };

  private static isInitialized = false;

  // ─── Initialization (Called once on App mount) ────────────────────────────
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (window.electronAPI) {
      try {
        this.cache.products = await window.electronAPI.db.find('products');
        this.cache.warehouses = await window.electronAPI.db.find('warehouses');
        if (this.cache.warehouses.length === 0) {
          for (const w of DEFAULT_WAREHOUSES) await window.electronAPI.db.insert('warehouses', w);
          this.cache.warehouses = [...DEFAULT_WAREHOUSES];
        }
        this.cache.pv = await window.electronAPI.db.find('purchaseVouchers');
        this.cache.sv = await window.electronAPI.db.find('saleVouchers');
        this.cache.sr = await window.electronAPI.db.find('saleReturns');
        this.cache.os = await window.electronAPI.db.find('openingStocks');
        this.cache.sa = await window.electronAPI.db.find('stockAdjustments');
        this.cache.ledger = await window.electronAPI.db.find('ledger');
        
        // Sort ledger by timestamp descending
        this.cache.ledger.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (e) {
        console.error('Failed to initialize DB', e);
      }
    } else {
      // Fallback to localStorage for browser dev mode
      this.cache.products = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
      this.cache.warehouses = JSON.parse(localStorage.getItem(WAREHOUSES_KEY) || 'null') || DEFAULT_WAREHOUSES;
      this.cache.pv = JSON.parse(localStorage.getItem(PV_KEY) || '[]');
      this.cache.sv = JSON.parse(localStorage.getItem(SV_KEY) || '[]');
      this.cache.sr = JSON.parse(localStorage.getItem(SR_KEY) || '[]');
      this.cache.os = JSON.parse(localStorage.getItem(OS_KEY) || '[]');
      this.cache.sa = JSON.parse(localStorage.getItem(SA_KEY) || '[]');
      this.cache.ledger = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]');
    }
    
    this.isInitialized = true;
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

        const voucherSeq = osList.length + 1;
        const voucherNo = `OS-${new Date().getFullYear()}-${String(voucherSeq).padStart(4, '0')}`;
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

        const txnSeq = ledger.length + 1;
        const ledgerEntry: StockLedgerEntry = {
          id: `TXN-${new Date().getFullYear()}-${String(txnSeq).padStart(4, '0')}`,
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

    const voucherSeq = pvList.length + 1;
    const voucherNo = `PV-${new Date().getFullYear()}-${String(voucherSeq).padStart(4, '0')}`;
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
      const txnSeq = ledger.length + newLedgerEntries.length + 1;
      const ledgerEntry: StockLedgerEntry = {
        id: `TXN-${new Date().getFullYear()}-${String(txnSeq).padStart(4, '0')}`,
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

    const voucherSeq = svList.length + 1;
    const invoiceNo = `INV-${new Date().getFullYear()}-${String(voucherSeq).padStart(4, '0')}`;
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
      const txnSeq = ledger.length + newLedgerEntries.length + 1;
      const ledgerEntry: StockLedgerEntry = {
        id: `TXN-${new Date().getFullYear()}-${String(txnSeq).padStart(4, '0')}`,
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

    const voucherSeq = srList.length + 1;
    const returnNo = `SR-${new Date().getFullYear()}-${String(voucherSeq).padStart(4, '0')}`;
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
      const txnSeq = ledger.length + newLedgerEntries.length + 1;
      const ledgerEntry: StockLedgerEntry = {
        id: `TXN-${new Date().getFullYear()}-${String(txnSeq).padStart(4, '0')}`,
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

    const voucherSeq = osList.length + 1;
    const voucherNo = `OS-${new Date().getFullYear()}-${String(voucherSeq).padStart(4, '0')}`;
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
      const txnSeq = ledger.length + newLedgerEntries.length + 1;
      const ledgerEntry: StockLedgerEntry = {
        id: `TXN-${new Date().getFullYear()}-${String(txnSeq).padStart(4, '0')}`,
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

    const voucherSeq = saList.length + 1;
    const voucherNo = `SA-${new Date().getFullYear()}-${String(voucherSeq).padStart(4, '0')}`;
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

      const txnSeq = ledger.length + newLedgerEntries.length + 1;
      const ledgerEntry: StockLedgerEntry = {
        id: `TXN-${new Date().getFullYear()}-${String(txnSeq).padStart(4, '0')}`,
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

    this.saveStockAdjustmentVouchers([newVoucher, ...saList]);
    this.saveLedger([...newLedgerEntries, ...ledger]);
    this.saveProducts(products);

    return { success: true, voucher: newVoucher };
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
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
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

    await this.saveWarehouses(DEFAULT_WAREHOUSES);
  }
}
