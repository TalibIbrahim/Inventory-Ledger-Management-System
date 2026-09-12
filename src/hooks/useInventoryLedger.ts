import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Product,
  Warehouse,
  PurchaseVoucher,
  SaleVoucher,
  SaleReturnVoucher,
  OpeningStockVoucher,
  StockAdjustmentVoucher,
  StockLedgerEntry,
} from '../types/inventory';
import { InventoryService } from '../services/inventoryService';

export function useInventoryLedger() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [purchaseVouchers, setPurchaseVouchers] = useState<PurchaseVoucher[]>([]);
  const [saleVouchers, setSaleVouchers] = useState<SaleVoucher[]>([]);
  const [saleReturns, setSaleReturns] = useState<SaleReturnVoucher[]>([]);
  const [openingStocks, setOpeningStocks] = useState<OpeningStockVoucher[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentVoucher[]>([]);
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Refresh all state from localStorage
  const refreshAll = useCallback(() => {
    setProducts(InventoryService.getProducts());
    setWarehouses(InventoryService.getWarehouses());
    setPurchaseVouchers(InventoryService.getPurchaseVouchers());
    setSaleVouchers(InventoryService.getSaleVouchers());
    setSaleReturns(InventoryService.getSaleReturns());
    setOpeningStocks(InventoryService.getOpeningStockVouchers());
    setStockAdjustments(InventoryService.getStockAdjustmentVouchers());
    setLedger(InventoryService.getLedger());
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await InventoryService.initialize();
      refreshAll();
      setLoading(false);
    };
    init();
  }, [refreshAll]);

  // Actions
  const createProduct = useCallback(
    async (
      input: Omit<Product, 'id' | 'currentStock' | 'createdAt' | 'updatedAt'> & {
        initialStock?: number;
        initialWarehouseId?: string;
      }
    ) => {
      const res = await InventoryService.createProduct(input);
      if (res.success) refreshAll();
      return res;
    },
    [refreshAll]
  );

  const updateProduct = useCallback(
    async (id: string, updates: Partial<Omit<Product, 'id' | 'currentStock' | 'createdAt'>>) => {
      const res = await InventoryService.updateProduct(id, updates);
      if (res.success) refreshAll();
      return res;
    },
    [refreshAll]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const res = await InventoryService.deleteProduct(id);
      if (res.success) refreshAll();
      return res;
    },
    [refreshAll]
  );

  const createWarehouse = useCallback(
    async (input: Omit<Warehouse, 'id'>) => {
      const res = await InventoryService.createWarehouse(input);
      if (res.success) refreshAll();
      return res;
    },
    [refreshAll]
  );

  const createPurchaseVoucher = useCallback(
    async (input: {
      supplierName: string;
      supplierInvoiceNo?: string;
      warehouseId: string;
      date: string;
      items: Array<{ productId: string; quantity: number; unitPrice: number }>;
      notes?: string;
      recordedBy: string;
    }) => {
      const res = await InventoryService.createPurchaseVoucher(input);
      if (res.success) refreshAll();
      return res;
    },
    [refreshAll]
  );

  const createSaleVoucher = useCallback(
    async (input: {
      customerName: string;
      warehouseId: string;
      date: string;
      items: Array<{ productId: string; quantity: number; unitPrice: number }>;
      notes?: string;
      recordedBy: string;
    }) => {
      const res = await InventoryService.createSaleVoucher(input);
      if (res.success) refreshAll();
      return res;
    },
    [refreshAll]
  );

  const createSaleReturn = useCallback(
    async (input: {
      customerName: string;
      originalInvoiceNo?: string;
      warehouseId: string;
      date: string;
      items: Array<{ productId: string; quantity: number; unitPrice: number; reason: string }>;
      notes?: string;
      recordedBy: string;
    }) => {
      const res = await InventoryService.createSaleReturn(input);
      if (res.success) refreshAll();
      return res;
    },
    [refreshAll]
  );

  const createOpeningStockVoucher = useCallback(
    async (input: {
      warehouseId: string;
      date: string;
      items: Array<{ productId: string; quantity: number; unitCost: number }>;
      notes?: string;
      recordedBy: string;
    }) => {
      const res = await InventoryService.createOpeningStockVoucher(input);
      if (res.success) refreshAll();
      return res;
    },
    [refreshAll]
  );

  const createStockAdjustmentVoucher = useCallback(
    async (input: {
      warehouseId: string;
      date: string;
      adjustmentType: 'INCREASE' | 'DECREASE' | 'WRITE_OFF' | 'RECONCILIATION';
      items: Array<{ productId: string; changeQty: number; unitCost?: number; reason: string }>;
      notes?: string;
      recordedBy: string;
    }) => {
      const res = await InventoryService.createStockAdjustmentVoucher(input);
      if (res.success) refreshAll();
      return res;
    },
    [refreshAll]
  );

  const clearAllData = useCallback(async () => {
    await InventoryService.clearAllData();
    refreshAll();
  }, [refreshAll]);

  // Computed Executive Metrics
  const metrics = useMemo(() => {
    let totalStockUnits = 0;
    let totalInventoryValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      totalStockUnits += p.currentStock;
      totalInventoryValue += p.currentStock * p.purchasePrice;
      if (p.currentStock <= 0) {
        outOfStockCount++;
      } else if (p.currentStock <= p.reorderThreshold) {
        lowStockCount++;
      }
    }

    const totalPurchasesAmount = purchaseVouchers.reduce((acc, pv) => acc + pv.totalAmount, 0);
    const totalSalesAmount = saleVouchers.reduce((acc, sv) => acc + sv.totalAmount, 0);
    const totalReturnsAmount = saleReturns.reduce((acc, sr) => acc + sr.totalAmount, 0);

    return {
      totalInventoryValue,
      totalStockUnits,
      lowStockCount,
      outOfStockCount,
      totalPurchasesAmount,
      totalSalesAmount,
      totalReturnsAmount,
      totalProductsCount: products.length,
      totalWarehousesCount: warehouses.length,
      ledgerEntriesCount: ledger.length,
    };
  }, [products, warehouses, purchaseVouchers, saleVouchers, saleReturns, ledger]);

  const getProductStockAtWarehouse = useCallback(
    (productId: string, warehouseId?: string) => {
      return InventoryService.getProductStockAtWarehouse(productId, warehouseId);
    },
    []
  );

  return {
    products,
    warehouses,
    purchaseVouchers,
    saleVouchers,
    saleReturns,
    openingStocks,
    stockAdjustments,
    ledger,
    loading,
    metrics,
    createProduct,
    updateProduct,
    deleteProduct,
    createWarehouse,
    createPurchaseVoucher,
    createSaleVoucher,
    createSaleReturn,
    createOpeningStockVoucher,
    createStockAdjustmentVoucher,
    getProductStockAtWarehouse,
    clearAllData,
    refreshAll,
  };
}
