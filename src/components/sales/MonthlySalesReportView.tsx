import React, { useState, useMemo } from 'react';
import type { SaleVoucher, SaleReturnVoucher, Product, Warehouse } from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  TrendingUp,
  Receipt,
  CheckCircle2,
  Clock,
  Banknote,
  Building2,
  Eye,
  Coins,
  Package,
  X,
} from 'lucide-react';

interface MonthlySalesReportViewProps {
  products: Product[];
  warehouses: Warehouse[];
  saleVouchers: SaleVoucher[];
  saleReturns: SaleReturnVoucher[];
  onRecordPayment?: (input: {
    voucherId: string;
    amount: number;
    date?: string;
    paymentMethod: string;
    referenceNo?: string;
    notes?: string;
    recordedBy: string;
  }) => Promise<{ success: boolean; voucher?: SaleVoucher; error?: string }>;
}

export const MonthlySalesReportView: React.FC<MonthlySalesReportViewProps> = ({
  products: _products,
  warehouses,
  saleVouchers,
  saleReturns,
  onRecordPayment: _onRecordPayment,
}) => {
  // Determine available months from data or recent 12 months
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    saleVouchers.forEach((v) => {
      if (v.date) set.add(v.date.slice(0, 7));
    });
    saleReturns.forEach((r) => {
      if (r.date) set.add(r.date.slice(0, 7));
    });

    // Also include last 6 calendar months
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      set.add(`${year}-${month}`);
      d.setMonth(d.getMonth() - 1);
    }

    return Array.from(set).sort().reverse();
  }, [saleVouchers, saleReturns]);

  // Selected Month: default to newest month with vouchers, or current month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (availableMonths.length > 0) return availableMonths[0];
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PAID' | 'PAYMENT_DUE'>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<SaleVoucher | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    const newM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newM);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    const newM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newM);
  };

  // Month formatted title
  const monthTitle = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const dateObj = new Date(y, m - 1, 1);
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Previous month string for comparison
  const prevMonthStr = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  // Filtered Vouchers for Selected Month
  const monthVouchers = useMemo(() => {
    return saleVouchers.filter((v) => {
      if (!v.date || !v.date.startsWith(selectedMonth)) return false;
      if (selectedWarehouse !== 'ALL' && v.warehouseId !== selectedWarehouse) return false;
      return true;
    });
  }, [saleVouchers, selectedMonth, selectedWarehouse]);

  // Filtered Returns for Selected Month
  const monthReturns = useMemo(() => {
    return saleReturns.filter((r) => {
      if (!r.date || !r.date.startsWith(selectedMonth)) return false;
      if (selectedWarehouse !== 'ALL' && r.warehouseId !== selectedWarehouse) return false;
      return true;
    });
  }, [saleReturns, selectedMonth, selectedWarehouse]);

  // Previous Month Vouchers (for month-over-month trend comparison)
  const prevMonthVouchers = useMemo(() => {
    return saleVouchers.filter((v) => {
      if (!v.date || !v.date.startsWith(prevMonthStr)) return false;
      if (selectedWarehouse !== 'ALL' && v.warehouseId !== selectedWarehouse) return false;
      return true;
    });
  }, [saleVouchers, prevMonthStr, selectedWarehouse]);

  // Monthly KPIs
  const kpis = useMemo(() => {
    const grossSales = monthVouchers.reduce((acc, v) => acc + v.totalAmount, 0);
    const returnsTotal = monthReturns.reduce((acc, r) => acc + r.totalAmount, 0);
    const netSales = grossSales - returnsTotal;
    const totalUnits = monthVouchers.reduce((acc, v) => acc + v.totalQuantity, 0);

    const paidTotal = monthVouchers.reduce(
      (acc, v) => acc + (v.paidAmount ?? (v.paymentStatus === 'PAYMENT_DUE' ? 0 : v.totalAmount)),
      0
    );
    const dueTotal = monthVouchers.reduce(
      (acc, v) => acc + (v.dueAmount ?? (v.paymentStatus === 'PAYMENT_DUE' ? v.totalAmount : 0)),
      0
    );

    // COGS estimation
    let totalCogs = 0;
    monthVouchers.forEach((sv) => {
      sv.items.forEach((item) => {
        totalCogs += (item.unitCost || 0) * item.quantity;
      });
    });

    const grossProfit = netSales - totalCogs;
    const marginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    // Previous month comparison
    const prevGross = prevMonthVouchers.reduce((acc, v) => acc + v.totalAmount, 0);
    const growthPercent =
      prevGross > 0 ? ((grossSales - prevGross) / prevGross) * 100 : grossSales > 0 ? 100 : 0;

    const uniqueCustomers = new Set(monthVouchers.map((v) => v.customerName)).size;

    return {
      grossSales,
      returnsTotal,
      netSales,
      paidTotal,
      dueTotal,
      totalUnits,
      invoicesCount: monthVouchers.length,
      totalCogs,
      grossProfit,
      marginPercent,
      growthPercent,
      prevGross,
      uniqueCustomers,
    };
  }, [monthVouchers, monthReturns, prevMonthVouchers]);

  // Daily Chart Data for Selected Month (Days 1 to 28/30/31)
  const dailyChartData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const dailyMap = new Map<
      number,
      {
        day: number;
        date: string;
        gross: number;
        paid: number;
        due: number;
        units: number;
        invoicesCount: number;
      }
    >();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      dailyMap.set(day, {
        day,
        date: dayStr,
        gross: 0,
        paid: 0,
        due: 0,
        units: 0,
        invoicesCount: 0,
      });
    }

    monthVouchers.forEach((v) => {
      const day = Number(v.date.slice(8, 10));
      if (dailyMap.has(day)) {
        const entry = dailyMap.get(day)!;
        const paid = v.paidAmount ?? (v.paymentStatus === 'PAYMENT_DUE' ? 0 : v.totalAmount);
        const due = v.dueAmount ?? (v.paymentStatus === 'PAYMENT_DUE' ? v.totalAmount : 0);
        entry.gross += v.totalAmount;
        entry.paid += paid;
        entry.due += due;
        entry.units += v.totalQuantity;
        entry.invoicesCount += 1;
      }
    });

    const list = Array.from(dailyMap.values());
    const maxDailyGross = Math.max(...list.map((d) => d.gross), 1);

    return {
      days: list,
      maxDailyGross,
      daysInMonth,
    };
  }, [monthVouchers, selectedMonth]);

  // Monthly Historical Trend Data (Last 6 Months)
  const historyTrendData = useMemo(() => {
    const monthsToShow = availableMonths.slice(0, 8).reverse();
    const trend = monthsToShow.map((mStr) => {
      const [y, m] = mStr.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
      const vouchers = saleVouchers.filter((v) => v.date && v.date.startsWith(mStr));
      const gross = vouchers.reduce((acc, v) => acc + v.totalAmount, 0);
      const paid = vouchers.reduce(
        (acc, v) => acc + (v.paidAmount ?? (v.paymentStatus === 'PAYMENT_DUE' ? 0 : v.totalAmount)),
        0
      );
      const due = vouchers.reduce(
        (acc, v) => acc + (v.dueAmount ?? (v.paymentStatus === 'PAYMENT_DUE' ? v.totalAmount : 0)),
        0
      );
      return {
        monthKey: mStr,
        label,
        gross,
        paid,
        due,
        invoicesCount: vouchers.length,
      };
    });

    const maxTrendGross = Math.max(...trend.map((t) => t.gross), 1);
    return { trend, maxTrendGross };
  }, [availableMonths, saleVouchers]);

  // Filtered Sales Tracking Table for Selected Month
  const trackedSales = useMemo(() => {
    return monthVouchers
      .filter((v) => {
        if (paymentFilter !== 'ALL') {
          const status = v.paymentStatus || 'PAID';
          if (paymentFilter === 'PAID' && status !== 'PAID') return false;
          if (paymentFilter === 'PAYMENT_DUE' && status === 'PAID') return false;
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchesNo = v.invoiceNo.toLowerCase().includes(q);
          const matchesCust = v.customerName.toLowerCase().includes(q);
          const matchesItems = v.items.some(
            (i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
          );
          if (!matchesNo && !matchesCust && !matchesItems) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [monthVouchers, paymentFilter, searchQuery]);

  // Top Products of the Month
  const topProducts = useMemo(() => {
    const map = new Map<string, { sku: string; name: string; units: number; revenue: number }>();
    monthVouchers.forEach((sv) => {
      sv.items.forEach((item) => {
        const existing = map.get(item.productId);
        if (existing) {
          existing.units += item.quantity;
          existing.revenue += item.totalPrice;
        } else {
          map.set(item.productId, {
            sku: item.sku,
            name: item.productName,
            units: item.quantity,
            revenue: item.totalPrice,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [monthVouchers]);

  // Top Customers of the Month
  const topCustomers = useMemo(() => {
    const map = new Map<string, { customerName: string; invoices: number; revenue: number; due: number }>();
    monthVouchers.forEach((sv) => {
      const existing = map.get(sv.customerName);
      const due = sv.dueAmount ?? (sv.paymentStatus === 'PAYMENT_DUE' ? sv.totalAmount : 0);
      if (existing) {
        existing.invoices += 1;
        existing.revenue += sv.totalAmount;
        existing.due += due;
      } else {
        map.set(sv.customerName, {
          customerName: sv.customerName,
          invoices: 1,
          revenue: sv.totalAmount,
          due,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [monthVouchers]);

  return (
    <div className="space-y-6">
      {/* Top Header & Month Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60 mb-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Monthly Performance & Revenue Audit</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Monthly Sales Report
          </h1>
          <p className="text-sm text-slate-500">
            Interactive daily graphs, quick KPI summaries, proper sale tracking, and official printable audit statements.
          </p>
        </div>

        {/* Month Selector & Print Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-xs">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 flex items-center gap-2 font-semibold text-xs text-slate-800">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>{monthTitle}</span>
            </div>

            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 shadow-xs cursor-pointer"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.city})
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-2xl bg-slate-900 text-white hover:bg-slate-800 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Monthly Report</span>
          </button>
        </div>
      </div>

      {/* Quick Info Cards on Top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Gross Sales */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Gross Sales</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 font-mono tracking-tight">
              {formatPKR(kpis.grossSales)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11px]">
              <span
                className={`font-semibold ${
                  kpis.growthPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {kpis.growthPercent >= 0 ? '+' : ''}
                {kpis.growthPercent.toFixed(1)}%
              </span>
              <span className="text-slate-400">vs prev month</span>
            </div>
          </div>
        </div>

        {/* Net Revenue */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Net Revenue</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-indigo-900 font-mono tracking-tight">
              {formatPKR(kpis.netSales)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Less {formatPKR(kpis.returnsTotal)} returns
            </p>
          </div>
        </div>

        {/* Cash Collected */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Cash Collected</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-700 font-mono tracking-tight">
              {formatPKR(kpis.paidTotal)}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              Paid (Cash on Hand / Cleared)
            </p>
          </div>
        </div>

        {/* Payment Due */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Payment Due</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-amber-700 font-mono tracking-tight">
              {formatPKR(kpis.dueTotal)}
            </div>
            <p className="text-[11px] text-amber-600 font-medium mt-1">
              Receivable from deliveries
            </p>
          </div>
        </div>

        {/* Invoices & Units */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Volume Dispatched</span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 font-mono tracking-tight">
              {kpis.totalUnits.toLocaleString('en-PK')} units
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Across {kpis.invoicesCount} invoices ({kpis.uniqueCustomers} customers)
            </p>
          </div>
        </div>

        {/* Gross Profit & Margin */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Gross Profit</span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-teal-800 font-mono tracking-tight">
              {formatPKR(kpis.grossProfit)}
            </div>
            <p className="text-[11px] text-teal-700 font-semibold mt-1">
              {kpis.marginPercent.toFixed(1)}% Gross Margin
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Daily Sales Graph */}
      <div className="p-6 rounded-3xl bg-white border border-black/[0.06] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Daily Sales Revenue & Collection Curve
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                {monthTitle}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Hover over any daily bar to inspect sales volume, cash collected on hand, and credit due.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-emerald-500" />
              <span className="text-slate-600 font-medium">Cash Collected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-amber-400" />
              <span className="text-slate-600 font-medium">Payment Due</span>
            </div>
          </div>
        </div>

        {/* SVG Daily Chart */}
        <div className="relative pt-6 pb-2">
          <div className="h-56 sm:h-64 flex items-end gap-1 sm:gap-1.5 px-2 border-b border-slate-200">
            {dailyChartData.days.map((item) => {
              const heightPct =
                dailyChartData.maxDailyGross > 0
                  ? Math.max(item.gross > 0 ? 8 : 2, (item.gross / dailyChartData.maxDailyGross) * 100)
                  : 2;

              const paidPct = item.gross > 0 ? (item.paid / item.gross) * 100 : 0;
              const duePct = item.gross > 0 ? (item.due / item.gross) * 100 : 0;
              const isHovered = hoveredDay === item.day;

              return (
                <div
                  key={item.day}
                  onMouseEnter={() => setHoveredDay(item.day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                >
                  {/* Floating Tooltip */}
                  {isHovered && item.gross > 0 && (
                    <div className="absolute bottom-full mb-3 z-30 pointer-events-none p-3 rounded-2xl bg-slate-900 text-white shadow-xl text-left w-48 text-[11px] animate-in fade-in zoom-in-95">
                      <div className="font-bold border-b border-slate-800 pb-1 mb-1.5 flex items-center justify-between">
                        <span>Day {item.day}</span>
                        <span className="text-slate-400">{item.date}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Total Sales:</span>
                          <span className="font-mono font-bold text-white">
                            {formatPKR(item.gross)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-400">
                          <span>Paid (Cash):</span>
                          <span className="font-mono">{formatPKR(item.paid)}</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-400">
                          <span>Payment Due:</span>
                          <span className="font-mono">{formatPKR(item.due)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-slate-300">
                          <span>Invoices: {item.invoicesCount}</span>
                          <span>Units: {item.units}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bar */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-lg transition-all duration-200 overflow-hidden flex flex-col justify-end ${
                      item.gross > 0
                        ? isHovered
                          ? 'ring-2 ring-blue-500 shadow-md'
                          : 'opacity-90 hover:opacity-100'
                        : 'bg-slate-100'
                    }`}
                  >
                    {item.gross > 0 && (
                      <>
                        <div
                          style={{ height: `${duePct}%` }}
                          className="w-full bg-amber-400 transition-all"
                          title={`Due: ${formatPKR(item.due)}`}
                        />
                        <div
                          style={{ height: `${paidPct}%` }}
                          className="w-full bg-emerald-500 transition-all"
                          title={`Paid: ${formatPKR(item.paid)}`}
                        />
                      </>
                    )}
                  </div>

                  {/* Day Label */}
                  <div className="text-[10px] text-slate-400 mt-2 font-mono">
                    {item.day % (dailyChartData.daysInMonth > 28 ? 3 : 2) === 1 ? item.day : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Secondary: Historical Multi-Month Trend */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-700">
              Monthly Historical Volume Trend (Browse Prior Months)
            </span>
            <span className="text-[11px] text-slate-400">
              Click any month bar to jump to its report
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {historyTrendData.trend.map((t) => {
              const isCurrent = t.monthKey === selectedMonth;
              const barHeight =
                historyTrendData.maxTrendGross > 0
                  ? Math.max(t.gross > 0 ? 15 : 5, (t.gross / historyTrendData.maxTrendGross) * 100)
                  : 5;

              return (
                <button
                  key={t.monthKey}
                  type="button"
                  onClick={() => setSelectedMonth(t.monthKey)}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`font-semibold ${isCurrent ? 'text-blue-900 font-bold' : 'text-slate-700'}`}>
                      {t.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {t.invoicesCount} inv
                    </span>
                  </div>
                  <div className="h-8 flex items-end my-1.5">
                    <div
                      style={{ height: `${barHeight}%` }}
                      className={`w-full rounded-md transition-all ${
                        isCurrent ? 'bg-blue-600' : 'bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-900 truncate">
                    {formatPKR(t.gross)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Monthly Sales Breakdown Table (Proper Tracking for Each Sale) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Individual Sale Tracking & Audit Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Every sales invoice recorded in <strong>{monthTitle}</strong> with collection status and line items.
            </p>
          </div>

          {/* Table Filters */}
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search invoice #, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Payments</option>
              <option value="PAID">Paid (Cash on Hand)</option>
              <option value="PAYMENT_DUE">Payment Due (Pending)</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Dispatch Warehouse</th>
                  <th className="py-3 px-4">Dispatched Line Items</th>
                  <th className="py-3 px-4 text-right">Units</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4">Collection Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trackedSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">No sale vouchers found for {monthTitle}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Try selecting a different month from the controls above.
                      </p>
                    </td>
                  </tr>
                ) : (
                  trackedSales.map((sv) => {
                    const isDue = sv.paymentStatus === 'PAYMENT_DUE';
                    const isPartial = sv.paymentStatus === 'PARTIAL';

                    return (
                      <tr key={sv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {sv.invoiceNo}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{sv.date}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{sv.customerName}</td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {sv.warehouseName}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs text-slate-600 truncate" title={sv.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}>
                          {sv.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                          {sv.totalQuantity}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatPKR(sv.totalAmount)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isDue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span>Payment Due</span>
                            </span>
                          ) : isPartial ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <Banknote className="w-3 h-3 text-blue-500" />
                              <span>Partial Due</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Paid ({sv.paymentMethod === 'BANK_TRANSFER' ? 'Bank' : 'Cash'})</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => setSelectedInvoice(sv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Slip</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Performers Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Top Dispatched Products ({monthTitle})
            </h4>
            <span className="text-[11px] text-slate-400">By Revenue</span>
          </div>
          <div className="space-y-2">
            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No products dispatched this month</p>
            ) : (
              topProducts.map((p, idx) => (
                <div
                  key={p.sku}
                  className="p-2.5 rounded-xl bg-slate-50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{p.sku}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900">{formatPKR(p.revenue)}</div>
                    <div className="text-[10px] text-slate-400">{p.units} units sold</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Top Purchasing Clients ({monthTitle})
            </h4>
            <span className="text-[11px] text-slate-400">By Revenue</span>
          </div>
          <div className="space-y-2">
            {topCustomers.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No client orders recorded this month</p>
            ) : (
              topCustomers.map((c, idx) => (
                <div
                  key={c.customerName}
                  className="p-2.5 rounded-xl bg-slate-50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800">{c.customerName}</div>
                      <div className="text-[10px] text-slate-400">{c.invoices} invoices issued</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900">{formatPKR(c.revenue)}</div>
                    {c.due > 0 ? (
                      <div className="text-[10px] font-semibold text-amber-600">
                        {formatPKR(c.due)} due
                      </div>
                    ) : (
                      <div className="text-[10px] text-emerald-600 font-medium">All settled</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Printable Monthly Sales Audit Report Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Official Audit Statement
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  Monthly Sales & Revenue Report — {monthTitle}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 printable-report">
              {/* Formal Document Header */}
              <div className="border-b border-slate-200 pb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    AXIOM STOCK LEDGER & ERP
                  </h2>
                  <p className="text-xs text-slate-500">
                    Compliant Outward Sales, Commercial Invoicing & Credit Ledger Audit
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Reporting Window: <strong>{monthTitle}</strong>
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500 font-mono">
                  <div>Date: {new Date().toISOString().slice(0, 10)}</div>
                  <div>Warehouse: {selectedWarehouse === 'ALL' ? 'All Locations' : selectedWarehouse}</div>
                  <div>Status: Official Executive Copy</div>
                </div>
              </div>

              {/* KPI Summary Block */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  1. Executive Financial Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Gross Invoiced</div>
                    <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                      {formatPKR(kpis.grossSales)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Returns Credited</div>
                    <div className="text-sm font-mono font-bold text-amber-700 mt-0.5">
                      {formatPKR(kpis.returnsTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Cash Collected</div>
                    <div className="text-sm font-mono font-bold text-emerald-700 mt-0.5">
                      {formatPKR(kpis.paidTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Outstanding Due</div>
                    <div className="text-sm font-mono font-bold text-amber-800 mt-0.5">
                      {formatPKR(kpis.dueTotal)}
                    </div>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase">Net Revenue (After Returns)</div>
                    <div className="text-base font-mono font-bold text-blue-700 mt-0.5">
                      {formatPKR(kpis.netSales)}
                    </div>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase">Estimated Gross Margin</div>
                    <div className="text-base font-mono font-bold text-teal-700 mt-0.5">
                      {formatPKR(kpis.grossProfit)} ({kpis.marginPercent.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions Ledger */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  2. Monthly Dispatched Invoices Ledger
                </h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Invoice #</th>
                        <th className="py-2 px-3">Client</th>
                        <th className="py-2 px-3">Warehouse</th>
                        <th className="py-2 px-3 text-right">Units</th>
                        <th className="py-2 px-3 text-right">Gross (PKR)</th>
                        <th className="py-2 px-3 text-right">Collection Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthVouchers.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2 px-3 font-mono text-slate-600">{v.date}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{v.invoiceNo}</td>
                          <td className="py-2 px-3 text-slate-800 font-medium">{v.customerName}</td>
                          <td className="py-2 px-3 text-slate-600">{v.warehouseName}</td>
                          <td className="py-2 px-3 text-right font-mono">{v.totalQuantity}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatPKR(v.totalAmount)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {v.paymentStatus === 'PAYMENT_DUE'
                              ? 'Payment Due'
                              : v.paymentStatus === 'PARTIAL'
                              ? 'Partial Due'
                              : 'Paid'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={4} className="py-2 px-3">Total Monthly Invoices ({monthVouchers.length})</td>
                        <td className="py-2 px-3 text-right font-mono">{kpis.totalUnits}</td>
                        <td className="py-2 px-3 text-right font-mono text-blue-700">
                          {formatPKR(kpis.grossSales)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Sign-off Blocks */}
              <div className="pt-8 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
                <div className="pt-8 border-t border-dashed border-slate-300">
                  <span>Prepared by Accountant</span>
                </div>
                <div className="pt-8 border-t border-dashed border-slate-300">
                  <span>Verified by Audit Officer</span>
                </div>
                <div className="pt-8 border-t border-dashed border-slate-300">
                  <span>Managing Director Approval</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Invoice Slip Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Sales Invoice Document
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                  {selectedInvoice.invoiceNo}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Invoice Date</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedInvoice.date}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Billed To</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedInvoice.customerName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Dispatch Hub</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedInvoice.warehouseName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Billing Officer</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedInvoice.recordedBy}</div>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/60">
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Payment Status</div>
                  <div className="text-xs font-semibold mt-0.5">
                    {selectedInvoice.paymentStatus === 'PAYMENT_DUE' ? (
                      <span className="text-amber-700 font-bold inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Payment Due (Credit Dispatch)
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Paid on Hand ({selectedInvoice.paymentMethod || 'Cash'})
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Received</div>
                    <div className="text-xs font-mono font-semibold text-emerald-700 mt-0.5">
                      {formatPKR(selectedInvoice.paidAmount ?? (selectedInvoice.paymentStatus === 'PAYMENT_DUE' ? 0 : selectedInvoice.totalAmount))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Balance Due</div>
                    <div className="text-xs font-mono font-bold text-amber-700 mt-0.5">
                      {formatPKR(selectedInvoice.dueAmount ?? (selectedInvoice.paymentStatus === 'PAYMENT_DUE' ? selectedInvoice.totalAmount : 0))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Dispatched Line Items
                </h4>
                <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                        <th className="py-2.5 px-3 text-right">Selling Rate</th>
                        <th className="py-2.5 px-3 text-right">Total Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.items.map((line) => (
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
                        <td className="py-2.5 px-3 text-slate-700">Total Net Amount</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                          {selectedInvoice.totalQuantity} units
                        </td>
                        <td></td>
                        <td className="py-2.5 px-3 text-right font-mono text-blue-600 text-sm">
                          {formatPKR(selectedInvoice.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
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
