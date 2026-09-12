import React, { useState, useMemo } from 'react';
import type { Product, Warehouse, PurchaseVoucher } from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import { InventoryService } from '../../services/inventoryService';
import {
  FileText,
  Download,
  Building2,
  Users,
  Search,
  Eye,
  X,
  PackageCheck,
  TrendingUp,
  ReceiptText,
} from 'lucide-react';

interface PurchaseReportsViewProps {
  products: Product[];
  warehouses: Warehouse[];
  purchaseVouchers: PurchaseVoucher[];
}

export const PurchaseReportsView: React.FC<PurchaseReportsViewProps> = ({
  products,
  warehouses,
  purchaseVouchers,
}) => {
  const [activeTab, setActiveTab] = useState<'vouchers' | 'products'>('vouchers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedVoucher, setSelectedVoucher] = useState<PurchaseVoucher | null>(null);

  // Extract unique suppliers
  const suppliers = useMemo(() => {
    const set = new Set<string>();
    purchaseVouchers.forEach((pv) => {
      if (pv.supplierName) set.add(pv.supplierName);
    });
    return Array.from(set).sort();
  }, [purchaseVouchers]);

  // Filtered vouchers
  const filteredVouchers = useMemo(() => {
    return purchaseVouchers.filter((pv) => {
      if (selectedSupplier !== 'ALL' && pv.supplierName !== selectedSupplier) return false;
      if (selectedWarehouse !== 'ALL' && pv.warehouseId !== selectedWarehouse) return false;
      if (startDate && pv.date < startDate) return false;
      if (endDate && pv.date > endDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesNo = pv.voucherNo.toLowerCase().includes(q);
        const matchesSupplier = pv.supplierName.toLowerCase().includes(q);
        const matchesInv = pv.supplierInvoiceNo?.toLowerCase().includes(q);
        const matchesItems = pv.items.some(
          (item) => item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)
        );
        if (!matchesNo && !matchesSupplier && !matchesInv && !matchesItems) return false;
      }
      return true;
    });
  }, [purchaseVouchers, selectedSupplier, selectedWarehouse, startDate, endDate, searchQuery]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalSpend = 0;
    let totalUnits = 0;
    const uniqueSuppliers = new Set<string>();

    filteredVouchers.forEach((pv) => {
      totalSpend += pv.totalAmount;
      totalUnits += pv.totalQuantity;
      uniqueSuppliers.add(pv.supplierName);
    });

    const avgVoucherValue = filteredVouchers.length > 0 ? totalSpend / filteredVouchers.length : 0;

    return {
      totalSpend,
      totalUnits,
      uniqueSuppliersCount: uniqueSuppliers.size,
      vouchersCount: filteredVouchers.length,
      avgVoucherValue,
    };
  }, [filteredVouchers]);

  // Product-wise aggregation
  const productPurchaseSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        product: Product | undefined;
        sku: string;
        name: string;
        brand: string;
        uom: string;
        totalQty: number;
        totalSpend: number;
        voucherCount: number;
        lastPurchaseDate: string;
      }
    >();

    filteredVouchers.forEach((pv) => {
      pv.items.forEach((item) => {
        const existing = map.get(item.productId);
        const itemSpend = item.totalPrice || item.quantity * item.unitPrice;
        if (existing) {
          existing.totalQty += item.quantity;
          existing.totalSpend += itemSpend;
          existing.voucherCount += 1;
          if (pv.date > existing.lastPurchaseDate) {
            existing.lastPurchaseDate = pv.date;
          }
        } else {
          const prod = products.find((p) => p.id === item.productId);
          map.set(item.productId, {
            product: prod,
            sku: item.sku,
            name: item.productName,
            brand: item.brand,
            uom: item.uom,
            totalQty: item.quantity,
            totalSpend: itemSpend,
            voucherCount: 1,
            lastPurchaseDate: pv.date,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [filteredVouchers, products]);

  // Export CSV
  const handleExportCSV = () => {
    if (activeTab === 'vouchers') {
      const headers = ['Voucher No', 'Date', 'Supplier', 'Warehouse', 'Supplier Inv #', 'Total Items', 'Total Qty', 'Total Amount (PKR)', 'Recorded By'];
      const rows = filteredVouchers.map((pv) => [
        pv.voucherNo,
        pv.date,
        pv.supplierName,
        pv.warehouseName,
        pv.supplierInvoiceNo || '-',
        pv.items.length,
        pv.totalQuantity,
        pv.totalAmount,
        pv.recordedBy,
      ]);
      InventoryService.exportToCSV(headers, rows, `purchase_report_vouchers_${new Date().toISOString().slice(0, 10)}.csv`);
    } else {
      const headers = ['SKU', 'Product Name', 'Brand', 'UOM', 'Purchased Qty', 'Avg Unit Rate (PKR)', 'Total Spend (PKR)', 'Order Count', 'Last Purchase Date'];
      const rows = productPurchaseSummary.map((row) => [
        row.sku,
        row.name,
        row.brand,
        row.uom,
        row.totalQty,
        (row.totalSpend / row.totalQty).toFixed(2),
        row.totalSpend,
        row.voucherCount,
        row.lastPurchaseDate,
      ]);
      InventoryService.exportToCSV(headers, rows, `purchase_report_products_${new Date().toISOString().slice(0, 10)}.csv`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 mb-1.5">
            <ReceiptText className="w-3.5 h-3.5" />
            <span>Procurement Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchase Reports</h1>
          <p className="text-sm text-slate-500">
            Comprehensive audit reports on inward inventory shipments, supplier spending, and product procurement.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-[0.98] transition-all"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Purchase Spend</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {formatPKR(summaryMetrics.totalSpend)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Across {summaryMetrics.vouchersCount} vouchers</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Units Received</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <PackageCheck className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {summaryMetrics.totalUnits.toLocaleString('en-PK')}
            </div>
            <p className="text-xs text-slate-400 mt-1">Physical stock inward</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Suppliers</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {summaryMetrics.uniqueSuppliersCount}
            </div>
            <p className="text-xs text-slate-400 mt-1">Vendors invoiced</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Voucher Value</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <ReceiptText className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {formatPKR(summaryMetrics.avgVoucherValue)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Per inward consignment</p>
          </div>
        </div>
      </div>

      {/* Segmented View Switcher & Filters */}
      <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Apple-style Segmented Control */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/50">
            <button
              onClick={() => setActiveTab('vouchers')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'vouchers'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Voucher-wise Detail ({filteredVouchers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'products'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Product Procurement Summary ({productPurchaseSummary.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search voucher, supplier, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Filter by Supplier</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
            >
              <option value="ALL">All Suppliers ({suppliers.length})</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Receiving Warehouse</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
            />
          </div>
        </div>

        {(selectedSupplier !== 'ALL' || selectedWarehouse !== 'ALL' || startDate || endDate || searchQuery) && (
          <div className="flex items-center justify-between text-xs pt-2 text-slate-500 border-t border-slate-100">
            <span>Filtered view showing {activeTab === 'vouchers' ? filteredVouchers.length : productPurchaseSummary.length} results</span>
            <button
              onClick={() => {
                setSelectedSupplier('ALL');
                setSelectedWarehouse('ALL');
                setStartDate('');
                setEndDate('');
                setSearchQuery('');
              }}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'vouchers' ? (
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Total Qty</th>
                  <th className="py-3 px-4 text-right">Total Amount (PKR)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-500">No purchase vouchers found</p>
                      <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filters or date range.</p>
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((pv) => (
                    <tr key={pv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        {pv.voucherNo}
                        {pv.supplierInvoiceNo && (
                          <div className="text-[10px] text-slate-400 font-sans">
                            Inv: {pv.supplierInvoiceNo}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{pv.date}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{pv.supplierName}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {pv.warehouseName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {pv.items.length} lines
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                        {pv.totalQuantity.toLocaleString('en-PK')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                        {formatPKR(pv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedVoucher(pv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Product-wise Aggregation Table */
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">SKU / Item</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4 text-center">UOM</th>
                  <th className="py-3 px-4 text-right">Purchased Qty</th>
                  <th className="py-3 px-4 text-right">Avg Unit Rate (PKR)</th>
                  <th className="py-3 px-4 text-right">Total Spend (PKR)</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">Last Purchase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productPurchaseSummary.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <PackageCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-500">No product purchase data found</p>
                    </td>
                  </tr>
                ) : (
                  productPurchaseSummary.map((item) => {
                    const avgRate = item.totalQty > 0 ? item.totalSpend / item.totalQty : 0;
                    return (
                      <tr key={item.sku} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-medium text-slate-900">{item.sku}</div>
                          <div className="text-slate-600 font-medium text-xs">{item.name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                            {item.brand}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500 font-medium">{item.uom}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                          {item.totalQty.toLocaleString('en-PK')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {formatPKR(avgRate)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                          {formatPKR(item.totalSpend)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[11px]">
                            {item.voucherCount} shipments
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                          {item.lastPurchaseDate}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Voucher Inspection Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  Inward Inventory Voucher
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                  {selectedVoucher.voucherNo}
                </h3>
              </div>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Date</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedVoucher.date}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Supplier</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedVoucher.supplierName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Warehouse</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedVoucher.warehouseName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Recorded By</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedVoucher.recordedBy}</div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Received Line Items
                </h4>
                <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Rate</th>
                        <th className="py-2.5 px-3 text-right">Line Total (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedVoucher.items.map((line) => (
                        <tr key={line.id}>
                          <td className="py-2.5 px-3">
                            <div className="font-mono text-slate-900 font-medium">{line.sku}</div>
                            <div className="text-slate-600">{line.productName}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {line.quantity} {line.uom}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatPKR(line.unitPrice)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatPKR(line.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold">
                      <tr>
                        <td className="py-2.5 px-3 text-slate-700">Total</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                          {selectedVoucher.totalQuantity}
                        </td>
                        <td></td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-sm">
                          {formatPKR(selectedVoucher.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedVoucher.notes && (
                <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Notes:</span> {selectedVoucher.notes}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedVoucher(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
