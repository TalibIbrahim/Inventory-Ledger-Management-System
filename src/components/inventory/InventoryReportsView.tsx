import React, { useState, useMemo } from 'react';
import type { Product, Warehouse, StockLedgerEntry, VoucherType } from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import { InventoryService } from '../../services/inventoryService';
import {
  Download,
  Search,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Sliders,
  Sparkles,
  Scale,
  History,
} from 'lucide-react';

interface InventoryReportsViewProps {
  products: Product[];
  warehouses: Warehouse[];
  ledger: StockLedgerEntry[];
  getProductStockAtWarehouse: (productId: string, warehouseId?: string) => number;
}

export const InventoryReportsView: React.FC<InventoryReportsViewProps> = ({
  products,
  warehouses,
  ledger,
  getProductStockAtWarehouse,
}) => {
  const [reportType, setReportType] = useState<'balance' | 'ledger'>('balance');

  // Balance Report State
  const [balanceWarehouse, setBalanceWarehouse] = useState('ALL');
  const [balanceSearch, setBalanceSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'HEALTHY'>('ALL');

  // Ledger Report State
  const [ledgerProductFilter, setLedgerProductFilter] = useState('ALL');
  const [ledgerWarehouseFilter, setLedgerWarehouseFilter] = useState('ALL');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ─── 1. BALANCE COMPUTATIONS ────────────────────────────────────────────────
  const productBalances = useMemo(() => {
    return products
      .map((p) => {
        const stock =
          balanceWarehouse === 'ALL'
            ? p.currentStock
            : getProductStockAtWarehouse(p.id, balanceWarehouse);

        const valuation = stock * p.purchasePrice;
        let status: 'HEALTHY' | 'LOW' | 'OUT' = 'HEALTHY';
        if (stock <= 0) status = 'OUT';
        else if (stock <= p.reorderThreshold) status = 'LOW';

        return {
          ...p,
          calculatedStock: stock,
          valuation,
          status,
        };
      })
      .filter((p) => {
        if (stockStatusFilter !== 'ALL' && p.status !== stockStatusFilter) return false;
        if (balanceSearch) {
          const q = balanceSearch.toLowerCase();
          const matchSku = p.sku.toLowerCase().includes(q);
          const matchName = p.name.toLowerCase().includes(q);
          const matchBrand = p.brand.toLowerCase().includes(q);
          if (!matchSku && !matchName && !matchBrand) return false;
        }
        return true;
      });
  }, [products, balanceWarehouse, getProductStockAtWarehouse, stockStatusFilter, balanceSearch]);

  const balanceMetrics = useMemo(() => {
    let totalStock = 0;
    let totalValuation = 0;
    let lowCount = 0;
    let outCount = 0;

    productBalances.forEach((p) => {
      totalStock += p.calculatedStock;
      totalValuation += p.valuation;
      if (p.status === 'LOW') lowCount++;
      if (p.status === 'OUT') outCount++;
    });

    return { totalStock, totalValuation, lowCount, outCount };
  }, [productBalances]);

  // ─── 2. LEDGER COMPUTATIONS ─────────────────────────────────────────────────
  const filteredLedger = useMemo(() => {
    return ledger.filter((entry) => {
      if (ledgerProductFilter !== 'ALL' && entry.productId !== ledgerProductFilter) return false;
      if (ledgerWarehouseFilter !== 'ALL' && entry.warehouseId !== ledgerWarehouseFilter) return false;
      if (ledgerTypeFilter !== 'ALL' && entry.voucherType !== ledgerTypeFilter) return false;
      if (startDate && entry.timestamp.slice(0, 10) < startDate) return false;
      if (endDate && entry.timestamp.slice(0, 10) > endDate) return false;
      if (ledgerSearch) {
        const q = ledgerSearch.toLowerCase();
        const matchNo = entry.voucherNo.toLowerCase().includes(q);
        const matchParty = entry.partyName.toLowerCase().includes(q);
        const matchProd = entry.productName.toLowerCase().includes(q);
        const matchSku = entry.sku.toLowerCase().includes(q);
        if (!matchNo && !matchParty && !matchProd && !matchSku) return false;
      }
      return true;
    });
  }, [
    ledger,
    ledgerProductFilter,
    ledgerWarehouseFilter,
    ledgerTypeFilter,
    startDate,
    endDate,
    ledgerSearch,
  ]);

  // CSV Export Handlers
  const handleExportBalanceCSV = () => {
    const headers = [
      'SKU',
      'Product Name',
      'Brand',
      'Type',
      'UOM',
      'Remaining Stock',
      'Reorder Threshold',
      'Stock Status',
      'Purchase Price (PKR)',
      'Total Valuation (PKR)',
    ];
    const rows = productBalances.map((p) => [
      p.sku,
      p.name,
      p.brand,
      p.type,
      p.uom,
      p.calculatedStock,
      p.reorderThreshold,
      p.status,
      p.purchasePrice,
      p.valuation,
    ]);
    InventoryService.exportToCSV(
      headers,
      rows,
      `inventory_balance_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handleExportLedgerCSV = () => {
    const headers = [
      'Transaction Ref',
      'Date & Time',
      'Voucher Type',
      'Voucher No',
      'Warehouse',
      'SKU',
      'Product Name',
      'Qty In (Debit)',
      'Qty Out (Credit)',
      'Company Running Bal',
      'Location Running Bal',
      'Rate (PKR)',
      'Total Value (PKR)',
      'Party Name',
      'Recorded By',
    ];
    const rows = filteredLedger.map((e) => [
      e.id,
      e.timestamp,
      e.voucherType,
      e.voucherNo,
      e.warehouseName,
      e.sku,
      e.productName,
      e.qtyIn,
      e.qtyOut,
      e.runningBalance,
      e.locationRunningBalance,
      e.rate,
      e.totalValue,
      e.partyName,
      e.recordedBy,
    ]);
    InventoryService.exportToCSV(
      headers,
      rows,
      `stock_ledger_audit_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const renderVoucherBadge = (type: VoucherType) => {
    switch (type) {
      case 'PURCHASE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700">
            <ArrowDownLeft className="w-3 h-3" /> Purchase In
          </span>
        );
      case 'SALE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700">
            <ArrowUpRight className="w-3 h-3" /> Sale Out
          </span>
        );
      case 'SALE_RETURN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700">
            <RotateCcw className="w-3 h-3" /> Return In
          </span>
        );
      case 'OPENING_STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700">
            <Sparkles className="w-3 h-3" /> Opening Stock
          </span>
        );
      case 'STOCK_ADJUSTMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700">
            <Sliders className="w-3 h-3" /> Adjustment
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 mb-1.5">
            <Scale className="w-3.5 h-3.5" />
            <span>Audit & Stock Accounting</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Reports</h1>
          <p className="text-sm text-slate-500">
            View Remaining Stock Balances across warehouses or audit the complete chronological In/Out Ledger.
          </p>
        </div>

        <button
          onClick={reportType === 'balance' ? handleExportBalanceCSV : handleExportLedgerCSV}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-[0.98] transition-all"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export {reportType === 'balance' ? 'Balance' : 'Ledger'} CSV</span>
        </button>
      </div>

      {/* Apple-style Sub-Option Switcher */}
      <div className="p-3 bg-white rounded-2xl border border-black/[0.06] shadow-sm flex items-center justify-between">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setReportType('balance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              reportType === 'balance'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Balance (Inventory Remaining)</span>
          </button>
          <button
            onClick={() => setReportType('ledger')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              reportType === 'ledger'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Ledger (Check In/Out of Each Product)</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block font-mono">
          Strict Debit/Credit Compliance
        </div>
      </div>

      {/* REPORT TYPE 1: BALANCE (INVENTORY REMAINING) */}
      {reportType === 'balance' ? (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Remaining Stock
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
                {balanceMetrics.totalStock.toLocaleString('en-PK')} units
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Asset Valuation (PKR)
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700 mt-2">
                {formatPKR(balanceMetrics.totalValuation)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Low Stock Warnings
              </div>
              <div className="text-2xl font-bold font-mono text-amber-600 mt-2">
                {balanceMetrics.lowCount} items
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-red-600">
                Out of Stock Items
              </div>
              <div className="text-2xl font-bold font-mono text-red-600 mt-2">
                {balanceMetrics.outCount} items
              </div>
            </div>
          </div>

          {/* Balance Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU, product, brand..."
                value={balanceSearch}
                onChange={(e) => setBalanceSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <select
                value={balanceWarehouse}
                onChange={(e) => setBalanceWarehouse(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700"
              >
                <option value="ALL">All Warehouses (Consolidated Total)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.city})
                  </option>
                ))}
              </select>

              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="HEALTHY">In Stock (Healthy)</option>
                <option value="LOW">Low Stock</option>
                <option value="OUT">Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Balance Table */}
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">SKU / Item Name</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-center">UOM</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Reorder Level</th>
                    <th className="py-3 px-4 text-right">Remaining Stock</th>
                    <th className="py-3 px-4 text-right">Unit Rate (PKR)</th>
                    <th className="py-3 px-4 text-right">Total Valuation (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productBalances.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Scale className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium text-slate-500">No inventory balances match your criteria</p>
                      </td>
                    </tr>
                  ) : (
                    productBalances.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-semibold text-slate-900">{p.sku}</div>
                          <div className="text-slate-600 text-xs">{p.name}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">{p.brand}</td>
                        <td className="py-3 px-4 text-slate-500">{p.type}</td>
                        <td className="py-3 px-4 text-center font-medium text-slate-500">{p.uom}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'OUT'
                                ? 'bg-red-50 text-red-700'
                                : p.status === 'LOW'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {p.status === 'OUT' ? 'OUT OF STOCK' : p.status === 'LOW' ? 'LOW STOCK' : 'HEALTHY'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {p.reorderThreshold} {p.uom}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {p.calculatedStock.toLocaleString('en-PK')} {p.uom}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {formatPKR(p.purchasePrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {formatPKR(p.valuation)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* REPORT TYPE 2: LEDGER (CHECK IN/OUT OF EACH PRODUCT) */
        <div className="space-y-4">
          {/* Ledger Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Filter by Product</label>
                <select
                  value={ledgerProductFilter}
                  onChange={(e) => setLedgerProductFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                >
                  <option value="ALL">All Products (Full Ledger)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Warehouse Location</label>
                <select
                  value={ledgerWarehouseFilter}
                  onChange={(e) => setLedgerWarehouseFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
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
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Voucher Transaction Type</label>
                <select
                  value={ledgerTypeFilter}
                  onChange={(e) => setLedgerTypeFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                >
                  <option value="ALL">All Types (Debits & Credits)</option>
                  <option value="PURCHASE">Purchase Voucher (Debit In)</option>
                  <option value="SALE">Sale Voucher (Credit Out)</option>
                  <option value="SALE_RETURN">Sale Return (Debit In)</option>
                  <option value="OPENING_STOCK">Opening Stock (Debit In)</option>
                  <option value="STOCK_ADJUSTMENT">Stock Adjustment (+/-)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Search Keywords</label>
                <input
                  type="text"
                  placeholder="Voucher #, Party, SKU..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4">Voucher Type</th>
                    <th className="py-3 px-4">Voucher Ref #</th>
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-4">Warehouse</th>
                    <th className="py-3 px-4">Party / Counterpart</th>
                    <th className="py-3 px-4 text-right text-emerald-700">In (+ Debit)</th>
                    <th className="py-3 px-4 text-right text-blue-600">Out (- Credit)</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-900">Co. Balance</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-700">Wh. Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium text-slate-500">No ledger entries matched your query</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                          {entry.timestamp.slice(0, 10)}{' '}
                          <span className="text-slate-400">{entry.timestamp.slice(11, 16)}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{renderVoucherBadge(entry.voucherType)}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                          {entry.voucherNo}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-slate-900 font-semibold">{entry.sku}</div>
                          <div className="text-slate-600 text-xs">{entry.productName}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {entry.warehouseName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{entry.partyName}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {entry.qtyIn > 0 ? `+${entry.qtyIn} ${entry.uom}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-blue-600">
                          {entry.qtyOut > 0 ? `-${entry.qtyOut} ${entry.uom}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                          {entry.runningBalance} {entry.uom}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
                          {entry.locationRunningBalance} {entry.uom}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
