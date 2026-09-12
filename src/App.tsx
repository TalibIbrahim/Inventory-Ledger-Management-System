import { useState } from 'react';
import { useInventoryLedger } from './hooks/useInventoryLedger';
import { useAuth } from './contexts/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { Header } from './components/Header';
import type { MainSection, SubOption } from './components/Header';
import { PurchaseVoucherView } from './components/purchase/PurchaseVoucherView';
import { PurchaseReportsView } from './components/purchase/PurchaseReportsView';
import { SaleVoucherView } from './components/sales/SaleVoucherView';
import { SaleReturnView } from './components/sales/SaleReturnView';
import { SalesReportsView } from './components/sales/SalesReportsView';
import { ProductInfoView } from './components/inventory/ProductInfoView';
import { InventoryVouchersView } from './components/inventory/InventoryVouchersView';
import { InventoryReportsView } from './components/inventory/InventoryReportsView';
import { LocationView } from './components/inventory/LocationView';
import { SettingsView } from './components/SettingsView';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';

export function App() {
  const { isAuthenticated } = useAuth();
  
  const {
    products,
    warehouses,
    purchaseVouchers,
    saleVouchers,
    saleReturns,
    openingStocks,
    stockAdjustments,
    ledger,
    loading,
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
  } = useInventoryLedger();

  // Navigation State
  const [activeSection, setActiveSection] = useState<MainSection>('purchase');
  const [activeSubOption, setActiveSubOption] = useState<SubOption>('purchase_voucher');

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Wrapped Actions with Toast
  const handleCreatePurchaseVoucher = async (input: any) => {
    const res = await createPurchaseVoucher(input);
    if (res.success && res.voucher) {
      addToast(
        'success',
        `Purchase Voucher ${res.voucher.voucherNo} Posted`,
        `Received ${res.voucher.totalQuantity} units from ${res.voucher.supplierName} into ${res.voucher.warehouseName}.`
      );
    } else {
      addToast('error', 'Purchase Failed', res.error);
    }
    return res;
  };

  const handleCreateSaleVoucher = async (input: any) => {
    const res = await createSaleVoucher(input);
    if (res.success && res.voucher) {
      addToast(
        'success',
        `Sale Invoice ${res.voucher.invoiceNo} Dispatched`,
        `Dispatched ${res.voucher.totalQuantity} units to ${res.voucher.customerName}. Stock debited.`
      );
    } else {
      addToast('error', 'Sale Failed', res.error);
    }
    return res;
  };

  const handleCreateSaleReturn = async (input: any) => {
    const res = await createSaleReturn(input);
    if (res.success && res.voucher) {
      addToast(
        'success',
        `Return Slip ${res.voucher.returnNo} Recorded`,
        `Restored ${res.voucher.totalQuantity} units into ${res.voucher.warehouseName}.`
      );
    } else {
      addToast('error', 'Return Processing Failed', res.error);
    }
    return res;
  };

  const handleCreateOpeningStock = async (input: any) => {
    const res = await createOpeningStockVoucher(input);
    if (res.success && res.voucher) {
      addToast(
        'success',
        `Opening Stock ${res.voucher.voucherNo} Initialized`,
        `Posted baseline inventory of ${res.voucher.totalQuantity} units.`
      );
    } else {
      addToast('error', 'Opening Stock Failed', res.error);
    }
    return res;
  };

  const handleCreateStockAdjustment = async (input: any) => {
    const res = await createStockAdjustmentVoucher(input);
    if (res.success && res.voucher) {
      addToast(
        'success',
        `Adjustment ${res.voucher.voucherNo} Committed`,
        `Reconciled stock with delta of ${res.voucher.netQuantityDelta} units.`
      );
    } else {
      addToast('error', 'Adjustment Failed', res.error);
    }
    return res;
  };

  const handleCreateProduct = async (input: any) => {
    const res = await createProduct(input);
    if (res.success && res.product) {
      addToast(
        'success',
        `Product ${res.product.sku} Registered`,
        `Added "${res.product.name}" (${res.product.brand}) with initial stock of ${res.product.currentStock} ${res.product.uom}.`
      );
    } else {
      addToast('error', 'Product Creation Failed', res.error);
    }
    return res;
  };

  const handleUpdateProduct = async (id: string, updates: any) => {
    const res = await updateProduct(id, updates);
    if (res.success && res.product) {
      addToast('success', 'Catalog Updated', `Updated product SKU ${res.product.sku}.`);
    } else {
      addToast('error', 'Update Failed', res.error);
    }
    return res;
  };

  const handleDeleteProduct = async (id: string) => {
    const res = await deleteProduct(id);
    if (res.success) {
      addToast('success', 'Product Removed', 'Catalog product deleted successfully.');
    } else {
      addToast('error', 'Cannot Delete Product', res.error);
    }
    return res;
  };

  const handleCreateWarehouse = async (input: any) => {
    const res = await createWarehouse(input);
    if (res.success && res.warehouse) {
      addToast(
        'success',
        `Warehouse ${res.warehouse.code} Registered`,
        `Added "${res.warehouse.name}" (${res.warehouse.city}) as an active storage location.`
      );
    } else {
      addToast('error', 'Warehouse Failed', res.error);
    }
    return res;
  };

  const handleClearData = async () => {
    await clearAllData();
    addToast('info', 'System Reset', 'All inventory data, vouchers, and transactions have been reset.');
  };

  if (!isAuthenticated) {
    return (
      <div className="font-sans">
        <LoginView />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading Ledger System...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Apple-style Navigation Header */}
      <Header
        activeSection={activeSection}
        activeSubOption={activeSubOption}
        onSelectSection={(sec) => setActiveSection(sec)}
        onSelectSubOption={(sub) => setActiveSubOption(sub)}
        onClearData={handleClearData}
      />

      {/* Main Module View Port */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* SECTION 1: PURCHASE */}
        {activeSection === 'purchase' && (
          <>
            {activeSubOption === 'purchase_voucher' && (
              <PurchaseVoucherView
                products={products}
                warehouses={warehouses}
                vouchers={purchaseVouchers}
                onCreateVoucher={handleCreatePurchaseVoucher}
              />
            )}
            {activeSubOption === 'purchase_reports' && (
              <PurchaseReportsView
                products={products}
                warehouses={warehouses}
                purchaseVouchers={purchaseVouchers}
              />
            )}
          </>
        )}

        {/* SECTION 2: SALES */}
        {activeSection === 'sales' && (
          <>
            {activeSubOption === 'sale_voucher' && (
              <SaleVoucherView
                products={products}
                warehouses={warehouses}
                vouchers={saleVouchers}
                onCreateVoucher={handleCreateSaleVoucher}
                getProductStockAtWarehouse={getProductStockAtWarehouse}
              />
            )}
            {activeSubOption === 'sale_return' && (
              <SaleReturnView
                products={products}
                warehouses={warehouses}
                returns={saleReturns}
                onCreateReturn={handleCreateSaleReturn}
              />
            )}
            {activeSubOption === 'sales_reports' && (
              <SalesReportsView
                products={products}
                warehouses={warehouses}
                saleVouchers={saleVouchers}
                saleReturns={saleReturns}
              />
            )}
          </>
        )}

        {/* SECTION 3: INVENTORY */}
        {activeSection === 'inventory' && (
          <>
            {activeSubOption === 'product_info' && (
              <ProductInfoView
                products={products}
                warehouses={warehouses}
                onCreateProduct={handleCreateProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
              />
            )}
            {activeSubOption === 'inventory_voucher' && (
              <InventoryVouchersView
                products={products}
                warehouses={warehouses}
                openingStocks={openingStocks}
                stockAdjustments={stockAdjustments}
                onCreateOpeningStock={handleCreateOpeningStock}
                onCreateStockAdjustment={handleCreateStockAdjustment}
              />
            )}
            {activeSubOption === 'inventory_reports' && (
              <InventoryReportsView
                products={products}
                warehouses={warehouses}
                ledger={ledger}
                getProductStockAtWarehouse={getProductStockAtWarehouse}
              />
            )}
            {activeSubOption === 'location' && (
              <LocationView
                warehouses={warehouses}
                products={products}
                onCreateWarehouse={handleCreateWarehouse}
                getProductStockAtWarehouse={getProductStockAtWarehouse}
              />
            )}
          </>
        )}

        {/* SECTION 4: SETTINGS */}
        {activeSection === 'settings' && <SettingsView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/50 backdrop-blur-md py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Ledger ERP • Compliant with Pakistani Accounting & Tax Standards (PKR Currency)
          </div>
          <div className="font-mono text-[11px]">
            {products.length} Products • {warehouses.length} Warehouses • {ledger.length} Ledger Records
          </div>
        </div>
      </footer>

      {/* Toast Feedback */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
export default App;
