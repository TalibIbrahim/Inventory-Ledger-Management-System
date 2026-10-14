import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { SaleVoucher, SaleReturnVoucher } from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  FileText,
  Printer,
  X,
} from 'lucide-react';

interface CustomerAccountsViewProps {
  saleVouchers: SaleVoucher[];
  saleReturns: SaleReturnVoucher[];
  onRecordPayment: (input: {
    voucherId: string;
    amount: number;
    date?: string;
    paymentMethod: string;
    referenceNo?: string;
    notes?: string;
    recordedBy: string;
  }) => Promise<{ success: boolean; voucher?: SaleVoucher; error?: string }>;
  onRecordAccountPayment: (input: {
    customerName: string;
    amount: number;
    date?: string;
    paymentMethod: string;
    referenceNo?: string;
    notes?: string;
    recordedBy: string;
  }) => Promise<{ success: boolean; paidInvoicesCount: number; error?: string }>;
}

export const CustomerAccountsView: React.FC<CustomerAccountsViewProps> = ({
  saleVouchers,
  saleReturns,
  onRecordPayment,
  onRecordAccountPayment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE' | 'SETTLED'>('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [statementCustomer, setStatementCustomer] = useState<string | null>(null);
  const [paymentModalCustomer, setPaymentModalCustomer] = useState<string | null>(null);
  const [paymentSelectedInvoiceId, setPaymentSelectedInvoiceId] = useState<string>('ALL');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentOfficer, _setPaymentOfficer] = useState<string>('Billing Officer');
  const [paymentError, setPaymentError] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Group vouchers and returns by customer
  const customerMap = useMemo(() => {
    const map = new Map<
      string,
      {
        customerName: string;
        invoices: SaleVoucher[];
        returns: SaleReturnVoucher[];
        totalInvoiced: number;
        totalReturns: number;
        netSales: number;
        totalPaid: number;
        totalDue: number;
        lastActivityDate: string;
        unpaidInvoices: SaleVoucher[];
        overdueCount: number;
      }
    >();

    // Process sales invoices
    saleVouchers.forEach((sv) => {
      const name = sv.customerName.trim();
      const paid = sv.paidAmount ?? (sv.paymentStatus === 'PAYMENT_DUE' ? 0 : sv.totalAmount);
      const due = sv.dueAmount ?? (sv.paymentStatus === 'PAYMENT_DUE' ? sv.totalAmount : 0);
      const isOverdue = due > 0 && sv.dueDate && sv.dueDate < todayStr;

      if (!map.has(name)) {
        map.set(name, {
          customerName: name,
          invoices: [sv],
          returns: [],
          totalInvoiced: sv.totalAmount,
          totalReturns: 0,
          netSales: sv.totalAmount,
          totalPaid: paid,
          totalDue: due,
          lastActivityDate: sv.date,
          unpaidInvoices: due > 0 ? [sv] : [],
          overdueCount: isOverdue ? 1 : 0,
        });
      } else {
        const c = map.get(name)!;
        c.invoices.push(sv);
        c.totalInvoiced += sv.totalAmount;
        c.netSales += sv.totalAmount;
        c.totalPaid += paid;
        c.totalDue += due;
        if (due > 0) c.unpaidInvoices.push(sv);
        if (isOverdue) c.overdueCount += 1;
        if (sv.date > c.lastActivityDate) {
          c.lastActivityDate = sv.date;
        }
      }
    });

    // Process sale returns
    saleReturns.forEach((sr) => {
      const name = sr.customerName.trim();
      if (!map.has(name)) {
        map.set(name, {
          customerName: name,
          invoices: [],
          returns: [sr],
          totalInvoiced: 0,
          totalReturns: sr.totalAmount,
          netSales: -sr.totalAmount,
          totalPaid: 0,
          totalDue: 0,
          lastActivityDate: sr.date,
          unpaidInvoices: [],
          overdueCount: 0,
        });
      } else {
        const c = map.get(name)!;
        c.returns.push(sr);
        c.totalReturns += sr.totalAmount;
        c.netSales -= sr.totalAmount;
        if (sr.date > c.lastActivityDate) {
          c.lastActivityDate = sr.date;
        }
      }
    });

    return map;
  }, [saleVouchers, saleReturns, todayStr]);

  const allCustomers = useMemo(() => {
    return Array.from(customerMap.values()).sort((a, b) => b.totalDue - a.totalDue || b.totalInvoiced - a.totalInvoiced);
  }, [customerMap]);

  // Executive KPIs
  const kpis = useMemo(() => {
    let totalReceivablesDue = 0;
    let totalCashCollected = 0;
    let totalOverdueCount = 0;
    let dueCustomersCount = 0;

    allCustomers.forEach((c) => {
      totalReceivablesDue += c.totalDue;
      totalCashCollected += c.totalPaid;
      totalOverdueCount += c.overdueCount;
      if (c.totalDue > 0) dueCustomersCount++;
    });

    return {
      totalCustomers: allCustomers.length,
      totalReceivablesDue,
      totalCashCollected,
      totalOverdueCount,
      dueCustomersCount,
    };
  }, [allCustomers]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return allCustomers.filter((c) => {
      if (statusFilter === 'DUE' && c.totalDue <= 0) return false;
      if (statusFilter === 'SETTLED' && c.totalDue > 0) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.customerName.toLowerCase().includes(q);
        const matchesInv = c.invoices.some((i) => i.invoiceNo.toLowerCase().includes(q));
        if (!matchesName && !matchesInv) return false;
      }
      return true;
    });
  }, [allCustomers, statusFilter, searchQuery]);

  // Open Payment Recording modal
  const handleOpenPaymentModal = (customerName: string, preferredInvoiceId = 'ALL') => {
    setPaymentModalCustomer(customerName);
    setPaymentSelectedInvoiceId(preferredInvoiceId);
    setPaymentError('');
    setPaymentRef('');
    setPaymentNotes('');
    setPaymentDate(new Date().toISOString().slice(0, 10));

    const cust = customerMap.get(customerName);
    if (cust) {
      if (preferredInvoiceId !== 'ALL') {
        const inv = cust.invoices.find((i) => i.id === preferredInvoiceId);
        const due = inv?.dueAmount ?? (inv?.paymentStatus === 'PAYMENT_DUE' ? inv.totalAmount : 0);
        setPaymentAmount(due > 0 ? due.toString() : '');
      } else {
        setPaymentAmount(cust.totalDue > 0 ? cust.totalDue.toString() : '');
      }
    } else {
      setPaymentAmount('');
    }
  };

  const handleInvoiceSelectInModal = (invId: string) => {
    setPaymentSelectedInvoiceId(invId);
    if (!paymentModalCustomer) return;
    const cust = customerMap.get(paymentModalCustomer);
    if (!cust) return;

    if (invId === 'ALL') {
      setPaymentAmount(cust.totalDue.toString());
    } else {
      const inv = cust.invoices.find((i) => i.id === invId);
      const due = inv?.dueAmount ?? (inv?.paymentStatus === 'PAYMENT_DUE' ? inv.totalAmount : 0);
      setPaymentAmount(due.toString());
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalCustomer) return;
    setPaymentError('');

    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Please enter a valid payment amount greater than Rs. 0.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      if (paymentSelectedInvoiceId === 'ALL') {
        // Allocate across all unpaid invoices
        const res = await onRecordAccountPayment({
          customerName: paymentModalCustomer,
          amount: amt,
          date: paymentDate,
          paymentMethod,
          referenceNo: paymentRef.trim(),
          notes: paymentNotes.trim(),
          recordedBy: paymentOfficer.trim() || 'Billing Officer',
        });
        if (!res.success) {
          setPaymentError(res.error || 'Failed to record account payment.');
          setIsSubmittingPayment(false);
          return;
        }
      } else {
        // Single invoice payment
        const res = await onRecordPayment({
          voucherId: paymentSelectedInvoiceId,
          amount: amt,
          date: paymentDate,
          paymentMethod,
          referenceNo: paymentRef.trim(),
          notes: paymentNotes.trim(),
          recordedBy: paymentOfficer.trim() || 'Billing Officer',
        });
        if (!res.success) {
          setPaymentError(res.error || 'Failed to record invoice payment.');
          setIsSubmittingPayment(false);
          return;
        }
      }

      setPaymentModalCustomer(null);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Customer Ledger Statement Data
  const statementData = useMemo(() => {
    if (!statementCustomer) return null;
    const cust = customerMap.get(statementCustomer);
    if (!cust) return null;

    // Build timeline of events: invoices (+debit), returns (-credit), payments (-credit)
    type LedgerRow = {
      date: string;
      docNo: string;
      description: string;
      debit: number;
      credit: number;
      runningBalance: number;
      type: 'INVOICE' | 'RETURN' | 'PAYMENT';
    };

    const rows: Array<Omit<LedgerRow, 'runningBalance'>> = [];

    cust.invoices.forEach((inv) => {
      rows.push({
        date: inv.date,
        docNo: inv.invoiceNo,
        description: `Dispatched ${inv.totalQuantity} units from ${inv.warehouseName} (${inv.items.map((i) => i.productName).join(', ')})`,
        debit: inv.totalAmount,
        credit: 0,
        type: 'INVOICE',
      });

      // Payments associated with this invoice
      if (inv.paymentHistory && inv.paymentHistory.length > 0) {
        inv.paymentHistory.forEach((p) => {
          rows.push({
            date: p.date,
            docNo: p.referenceNo || `PAY-${p.invoiceNo}`,
            description: `Payment received via ${p.paymentMethod} — ${p.notes || 'Settlement'}`,
            debit: 0,
            credit: p.amount,
            type: 'PAYMENT',
          });
        });
      }
    });

    cust.returns.forEach((ret) => {
      rows.push({
        date: ret.date,
        docNo: ret.returnNo,
        description: `Sale Return credited into ${ret.warehouseName} (${ret.notes || 'Returned items'})`,
        debit: 0,
        credit: ret.totalAmount,
        type: 'RETURN',
      });
    });

    // Sort by date ascending
    rows.sort((a, b) => a.date.localeCompare(b.date));

    let balance = 0;
    const computedRows: LedgerRow[] = rows.map((r) => {
      balance += r.debit - r.credit;
      return {
        ...r,
        runningBalance: balance,
      };
    });

    return {
      customer: cust,
      rows: computedRows,
    };
  }, [statementCustomer, customerMap]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60 mb-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Customer Ledgers & Credit Tracking</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Accounts</h1>
          <p className="text-sm text-slate-500">
            Track deliveries dispatched with payment due, receive incoming client payments, and manage customer credit balances.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Payment Due</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700 font-mono tracking-tight">
              {formatPKR(kpis.totalReceivablesDue)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {kpis.dueCustomersCount} customers have outstanding balances
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cash Collected (Paid)</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-700 font-mono tracking-tight">
              {formatPKR(kpis.totalCashCollected)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Total revenue collected & settled</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Customer Accounts</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {kpis.totalCustomers}
            </div>
            <p className="text-xs text-slate-400 mt-1">Commercial clients recorded in ledger</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue Alerts</span>
            <span className={`p-2 rounded-xl ${kpis.totalOverdueCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono tracking-tight ${kpis.totalOverdueCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {kpis.totalOverdueCount} Invoices
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {kpis.totalOverdueCount > 0 ? 'Exceeded agreed payment due date' : 'All accounts within due window'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search customer, invoice #... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-14 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({allCustomers.length})
            </button>
            <button
              onClick={() => setStatusFilter('DUE')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'DUE'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Payment Due ({kpis.dueCustomersCount})
            </button>
            <button
              onClick={() => setStatusFilter('SETTLED')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'SETTLED'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Settled ({allCustomers.length - kpis.dueCustomersCount})
            </button>
          </div>

          {(searchQuery || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
              className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Customer Accounts Directory Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4 text-center">Invoices</th>
                <th className="py-3.5 px-4 text-right">Total Billed</th>
                <th className="py-3.5 px-4 text-right">Total Paid (Cash)</th>
                <th className="py-3.5 px-4 text-right">Payment Due (Balance)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-3">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">No Customer Accounts Found</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {searchQuery
                          ? 'No customer accounts match your search query.'
                          : 'Customer accounts will be created automatically as sales invoices are generated.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const hasDue = cust.totalDue > 0;
                  const initials = cust.customerName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={cust.customerName} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              hasDue
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {initials || 'C'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{cust.customerName}</div>
                            {cust.overdueCount > 0 && (
                              <div className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{cust.overdueCount} invoice overdue</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-medium">
                          {cust.invoices.length}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-800">
                        {formatPKR(cust.totalInvoiced)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-emerald-700">
                        {formatPKR(cust.totalPaid)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`font-mono font-bold text-sm ${
                            hasDue ? 'text-amber-700' : 'text-slate-400'
                          }`}
                        >
                          {formatPKR(cust.totalDue)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {hasDue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>Payment Due</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Settled</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {cust.lastActivityDate || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {hasDue && (
                            <button
                              onClick={() => handleOpenPaymentModal(cust.customerName)}
                              title="Record received payment for this customer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Record Payment</span>
                            </button>
                          )}
                          <button
                            onClick={() => setStatementCustomer(cust.customerName)}
                            title="View statement and transaction history"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>Ledger</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {paymentModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 to-white">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Accounts Receivable Entry
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">Record Customer Payment</h3>
                <p className="text-xs text-slate-500">
                  Client: <strong>{paymentModalCustomer}</strong>
                </p>
              </div>
              <button
                onClick={() => setPaymentModalCustomer(null)}
                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4 overflow-y-auto">
              {paymentError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Outstanding Due Highlight */}
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-amber-900 uppercase">
                    Total Balance Outstanding
                  </div>
                  <div className="text-lg font-bold font-mono text-amber-800 mt-0.5">
                    {formatPKR(customerMap.get(paymentModalCustomer)?.totalDue || 0)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-amber-700">
                    {customerMap.get(paymentModalCustomer)?.unpaidInvoices.length || 0} unpaid invoices
                  </div>
                </div>
              </div>

              {/* Invoice Allocation Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Allocate Payment Against
                </label>
                <select
                  value={paymentSelectedInvoiceId}
                  onChange={(e) => handleInvoiceSelectInModal(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ALL">
                    ⚡ Auto-Allocate across oldest unpaid invoices (Total: {formatPKR(customerMap.get(paymentModalCustomer)?.totalDue || 0)})
                  </option>
                  {customerMap.get(paymentModalCustomer)?.unpaidInvoices.map((inv) => {
                    const due = inv.dueAmount ?? (inv.paymentStatus === 'PAYMENT_DUE' ? inv.totalAmount : 0);
                    return (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNo} ({inv.date}) — Due: {formatPKR(due)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount Received (PKR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Enter amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Payment Date</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPaymentDate(todayStr)}
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                          paymentDate === todayStr
                            ? 'bg-emerald-100 text-emerald-800 font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentDate(yesterdayStr)}
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                          paymentDate === yesterdayStr
                            ? 'bg-emerald-100 text-emerald-800 font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Yesterday
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Payment Method & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="CASH">Cash on Hand (Driver / Counter)</option>
                    <option value="BANK_TRANSFER">Bank Transfer / Online IBFT</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="ONLINE">Card / POS Portal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reference / Slip # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cheque # 89128 or IBFT-991"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Paid in full upon TCS delivery verification"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalCustomer(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingPayment ? 'Saving...' : 'Confirm Payment Receipt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Statement / Ledger Modal */}
      {statementCustomer && statementData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Customer Account Statement
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">{statementCustomer}</h3>
                <p className="text-xs text-slate-400">
                  Full chronological ledger of invoices, returns, and payment settlements
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Statement</span>
                </button>
                <button
                  onClick={() => setStatementCustomer(null)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div>
                  <div className="text-[11px] text-slate-500 uppercase font-medium">Total Billed</div>
                  <div className="text-sm font-mono font-bold text-slate-800 mt-0.5">
                    {formatPKR(statementData.customer.totalInvoiced)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 uppercase font-medium">Returns Credited</div>
                  <div className="text-sm font-mono font-bold text-amber-700 mt-0.5">
                    {formatPKR(statementData.customer.totalReturns)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 uppercase font-medium">Payments Received</div>
                  <div className="text-sm font-mono font-bold text-emerald-700 mt-0.5">
                    {formatPKR(statementData.customer.totalPaid)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 uppercase font-medium">Current Balance Due</div>
                  <div className="text-base font-mono font-extrabold text-amber-700 mt-0.5">
                    {formatPKR(statementData.customer.totalDue)}
                  </div>
                </div>
              </div>

              {/* Transactions Ledger */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Account Transactions
                </h4>
                <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Doc #</th>
                        <th className="py-2.5 px-3">Transaction Details</th>
                        <th className="py-2.5 px-3 text-right">Debit (Invoice)</th>
                        <th className="py-2.5 px-3 text-right">Credit (Payment/Ret)</th>
                        <th className="py-2.5 px-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statementData.rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No ledger entries found.
                          </td>
                        </tr>
                      ) : (
                        statementData.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{row.date}</td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                              {row.docNo}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 max-w-xs">{row.description}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900">
                              {row.debit > 0 ? formatPKR(row.debit) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-700">
                              {row.credit > 0 ? formatPKR(row.credit) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatPKR(row.runningBalance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-slate-700">
                          Net Outstanding Balance
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                          {formatPKR(statementData.customer.totalInvoiced)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          {formatPKR(statementData.customer.totalPaid + statementData.customer.totalReturns)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-700 text-sm">
                          {formatPKR(statementData.customer.totalDue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-[11px] text-slate-400">
                Official statement generated from Axiom Stock Ledger ERP
              </span>
              <button
                onClick={() => setStatementCustomer(null)}
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
