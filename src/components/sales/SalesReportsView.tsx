import React, { useState, useMemo } from 'react';
import type { Product, Warehouse, SaleVoucher, SaleReturnVoucher } from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import { InventoryService } from '../../services/inventoryService';
import {
  BarChart3,
  Download,
  Users,
  Package,
  TrendingUp,
  Search,
  Percent,
  Coins,
} from 'lucide-react';

interface SalesReportsViewProps {
  products: Product[];
  warehouses: Warehouse[];
  saleVouchers: SaleVoucher[];
  saleReturns: SaleReturnVoucher[];
}

export const SalesReportsView: React.FC<SalesReportsViewProps> = ({
  products,
  warehouses,
  saleVouchers,
  saleReturns,
}) => {
  const [reportType, setReportType] = useState<'customer' | 'product'>('customer');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return saleVouchers.filter((sv) => {
      if (selectedWarehouse !== 'ALL' && sv.warehouseId !== selectedWarehouse) return false;
      if (startDate && sv.date < startDate) return false;
      if (endDate && sv.date > endDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesNo = sv.invoiceNo.toLowerCase().includes(q);
        const matchesCust = sv.customerName.toLowerCase().includes(q);
        const matchesItems = sv.items.some(
          (i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
        );
        if (!matchesNo && !matchesCust && !matchesItems) return false;
      }
      return true;
    });
  }, [saleVouchers, selectedWarehouse, startDate, endDate, searchQuery]);

  // Filtered Returns
  const filteredReturns = useMemo(() => {
    return saleReturns.filter((sr) => {
      if (selectedWarehouse !== 'ALL' && sr.warehouseId !== selectedWarehouse) return false;
      if (startDate && sr.date < startDate) return false;
      if (endDate && sr.date > endDate) return false;
      return true;
    });
  }, [saleReturns, selectedWarehouse, startDate, endDate]);

  // Overall Financial KPIs
  const kpis = useMemo(() => {
    const grossSales = filteredVouchers.reduce((acc, sv) => acc + sv.totalAmount, 0);
    const returnsTotal = filteredReturns.reduce((acc, sr) => acc + sr.totalAmount, 0);
    const netSales = grossSales - returnsTotal;

    // Estimate COGS
    let totalCogs = 0;
    filteredVouchers.forEach((sv) => {
      sv.items.forEach((item) => {
        const cost = item.unitCost || 0;
        totalCogs += cost * item.quantity;
      });
    });

    const grossProfit = netSales - totalCogs;
    const marginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    const uniqueCustomers = new Set(filteredVouchers.map((sv) => sv.customerName));

    return {
      grossSales,
      returnsTotal,
      netSales,
      totalCogs,
      grossProfit,
      marginPercent,
      customerCount: uniqueCustomers.size,
    };
  }, [filteredVouchers, filteredReturns]);

  // Customer-wise Aggregation
  const customerReports = useMemo(() => {
    const map = new Map<
      string,
      {
        customerName: string;
        invoiceCount: number;
        totalUnits: number;
        grossSales: number;
        returnsTotal: number;
        netSales: number;
        lastOrderDate: string;
      }
    >();

    filteredVouchers.forEach((sv) => {
      const existing = map.get(sv.customerName);
      if (existing) {
        existing.invoiceCount += 1;
        existing.totalUnits += sv.totalQuantity;
        existing.grossSales += sv.totalAmount;
        existing.netSales += sv.totalAmount;
        if (sv.date > existing.lastOrderDate) {
          existing.lastOrderDate = sv.date;
        }
      } else {
        map.set(sv.customerName, {
          customerName: sv.customerName,
          invoiceCount: 1,
          totalUnits: sv.totalQuantity,
          grossSales: sv.totalAmount,
          returnsTotal: 0,
          netSales: sv.totalAmount,
          lastOrderDate: sv.date,
        });
      }
    });

    // Subtract returns
    filteredReturns.forEach((sr) => {
      const existing = map.get(sr.customerName);
      if (existing) {
        existing.returnsTotal += sr.totalAmount;
        existing.netSales -= sr.totalAmount;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.netSales - a.netSales);
  }, [filteredVouchers, filteredReturns]);

  // Product-wise Aggregation
  const productReports = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        sku: string;
        name: string;
        brand: string;
        uom: string;
        unitsSold: number;
        totalRevenue: number;
        totalCost: number;
        grossProfit: number;
        marginPercent: number;
      }
    >();

    filteredVouchers.forEach((sv) => {
      sv.items.forEach((line) => {
        const existing = map.get(line.productId);
        const revenue = line.totalPrice || line.quantity * line.unitPrice;
        const cost = (line.unitCost || 0) * line.quantity;

        if (existing) {
          existing.unitsSold += line.quantity;
          existing.totalRevenue += revenue;
          existing.totalCost += cost;
          existing.grossProfit = existing.totalRevenue - existing.totalCost;
          existing.marginPercent =
            existing.totalRevenue > 0
              ? (existing.grossProfit / existing.totalRevenue) * 100
              : 0;
        } else {
          const prod = products.find((p) => p.id === line.productId);
          const profit = revenue - cost;
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

          map.set(line.productId, {
            productId: line.productId,
            sku: line.sku,
            name: line.productName,
            brand: line.brand || prod?.brand || 'General',
            uom: line.uom || prod?.uom || 'pcs',
            unitsSold: line.quantity,
            totalRevenue: revenue,
            totalCost: cost,
            grossProfit: profit,
            marginPercent: margin,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredVouchers, products]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (reportType === 'customer') {
      const headers = [
        'Customer Name',
        'Invoice Count',
        'Units Sold',
        'Gross Sales (PKR)',
        'Returns Credited (PKR)',
        'Net Sales (PKR)',
        'Last Invoice Date',
      ];
      const rows = customerReports.map((c) => [
        c.customerName,
        c.invoiceCount,
        c.totalUnits,
        c.grossSales,
        c.returnsTotal,
        c.netSales,
        c.lastOrderDate,
      ]);
      InventoryService.exportToCSV(headers, rows, `sales_report_customers_${new Date().toISOString().slice(0, 10)}.csv`);
    } else {
      const headers = [
        'SKU',
        'Product Name',
        'Brand',
        'UOM',
        'Units Sold',
        'Total Revenue (PKR)',
        'Estimated COGS (PKR)',
        'Gross Profit (PKR)',
        'Gross Margin %',
      ];
      const rows = productReports.map((p) => [
        p.sku,
        p.name,
        p.brand,
        p.uom,
        p.unitsSold,
        p.totalRevenue,
        p.totalCost,
        p.grossProfit,
        `${p.marginPercent.toFixed(1)}%`,
      ]);
      InventoryService.exportToCSV(headers, rows, `sales_report_products_${new Date().toISOString().slice(0, 10)}.csv`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60 mb-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Revenue & Margin Analytics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales Reports</h1>
          <p className="text-sm text-slate-500">
            Analyze customer-wise order volume and product-wise profitability with real-time margin calculations.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-[0.98] transition-all"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export {reportType === 'customer' ? 'Customer' : 'Product'} Report</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Sales Revenue</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {formatPKR(kpis.grossSales)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Total outward billings</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Sales (Post-Return)</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {formatPKR(kpis.netSales)}
            </div>
            <p className="text-xs text-amber-600 mt-1">
              -{formatPKR(kpis.returnsTotal)} returned
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Estimated Gross Profit</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {formatPKR(kpis.grossProfit)}
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              {kpis.marginPercent.toFixed(1)}% Gross Margin
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Customers</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {kpis.customerCount} Accounts
            </div>
            <p className="text-xs text-slate-400 mt-1">Ordering in current period</p>
          </div>
        </div>
      </div>

      {/* Segmented Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Apple Segmented Control */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/50">
            <button
              onClick={() => setReportType('customer')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                reportType === 'customer'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customer-wise Sales ({customerReports.length})</span>
            </button>
            <button
              onClick={() => setReportType('product')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                reportType === 'product'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Product-wise Margin Analysis ({productReports.length})</span>
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Date and Warehouse Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Dispatch Warehouse</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
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
            <label className="block text-[11px] font-medium text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Main Report Table */}
      {reportType === 'customer' ? (
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4 text-center">Invoices</th>
                  <th className="py-3 px-4 text-right">Units Sold</th>
                  <th className="py-3 px-4 text-right">Gross Sales (PKR)</th>
                  <th className="py-3 px-4 text-right">Returns (PKR)</th>
                  <th className="py-3 px-4 text-right">Net Revenue (PKR)</th>
                  <th className="py-3 px-4 text-right">Last Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-500">No customer sales data found</p>
                    </td>
                  </tr>
                ) : (
                  customerReports.map((c) => (
                    <tr key={c.customerName} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{c.customerName}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {c.invoiceCount} invoices
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-800">
                        {c.totalUnits.toLocaleString('en-PK')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatPKR(c.grossSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-700">
                        {c.returnsTotal > 0 ? `-${formatPKR(c.returnsTotal)}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-600">
                        {formatPKR(c.netSales)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                        {c.lastOrderDate}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">SKU / Item Name</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4 text-center">UOM</th>
                  <th className="py-3 px-4 text-right">Units Sold</th>
                  <th className="py-3 px-4 text-right">Sales Revenue (PKR)</th>
                  <th className="py-3 px-4 text-right">Est. COGS (PKR)</th>
                  <th className="py-3 px-4 text-right">Gross Profit (PKR)</th>
                  <th className="py-3 px-4 text-center">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productReports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-500">No product sales records</p>
                    </td>
                  </tr>
                ) : (
                  productReports.map((p) => (
                    <tr key={p.productId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900">{p.sku}</div>
                        <div className="text-slate-600 text-xs">{p.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                          {p.brand}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">{p.uom}</td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                        {p.unitsSold.toLocaleString('en-PK')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-blue-600">
                        {formatPKR(p.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {formatPKR(p.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatPKR(p.grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            p.marginPercent >= 25
                              ? 'bg-emerald-50 text-emerald-700'
                              : p.marginPercent > 0
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {p.marginPercent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
