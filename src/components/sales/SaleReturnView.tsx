import React, { useState } from 'react';
import type { Product, Warehouse, SaleReturnVoucher } from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import {
  RotateCcw,
  PlusCircle,
  Building2,
  X,
  Trash2,
  Eye,
  AlertTriangle,
  FileCheck2,
  ArrowDownLeft,
} from 'lucide-react';

interface SaleReturnViewProps {
  products: Product[];
  warehouses: Warehouse[];
  returns: SaleReturnVoucher[];
  onCreateReturn: (input: {
    customerName: string;
    originalInvoiceNo?: string;
    warehouseId: string;
    date: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number; reason: string }>;
    notes?: string;
    recordedBy: string;
  }) => Promise<{ success: boolean; voucher?: SaleReturnVoucher; error?: string }>;
}

interface ReturnLineItem {
  productId: string;
  quantity: string;
  unitPrice: string;
  reason: string;
}

const COMMON_RETURN_REASONS = [
  'Defective / Damaged in Transit',
  'Incorrect Product Spec',
  'Customer Surplus / Over-ordered',
  'Quality Test Rejection',
  'Commercial Return',
];

export const SaleReturnView: React.FC<SaleReturnViewProps> = ({
  products,
  warehouses,
  returns,
  onCreateReturn,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SaleReturnVoucher | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [recordedBy, setRecordedBy] = useState('Zubair Ahmed');
  const [errorMsg, setErrorMsg] = useState('');

  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([
    {
      productId: products[0]?.id || '',
      quantity: '2',
      unitPrice: products[0]?.salePrice.toString() || '1500',
      reason: 'Defective / Damaged in Transit',
    },
  ]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('ALL');

  const handleAddLine = () => {
    const firstProd = products[0];
    setLineItems([
      ...lineItems,
      {
        productId: firstProd?.id || '',
        quantity: '1',
        unitPrice: firstProd?.salePrice.toString() || '1000',
        reason: 'Customer Surplus / Over-ordered',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof ReturnLineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'productId') {
      const prod = products.find((p) => p.id === value);
      if (prod) {
        updated[index].unitPrice = prod.salePrice.toString();
      }
    }

    setLineItems(updated);
  };

  const formTotalAmount = lineItems.reduce((acc, line) => {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    return acc + qty * price;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim()) {
      setErrorMsg('Customer name is required.');
      return;
    }

    const payload = {
      customerName: customerName.trim(),
      originalInvoiceNo: originalInvoiceNo.trim() || undefined,
      warehouseId,
      date,
      items: lineItems.map((l) => ({
        productId: l.productId,
        quantity: Math.max(1, Number(l.quantity) || 1),
        unitPrice: Math.max(0, Number(l.unitPrice) || 0),
        reason: l.reason.trim(),
      })),
      notes: notes.trim(),
      recordedBy: recordedBy.trim() || 'Inventory Supervisor',
    };

    const res = await onCreateReturn(payload);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to process sale return.');
      return;
    }

    setIsModalOpen(false);
    setCustomerName('');
    setOriginalInvoiceNo('');
    setNotes('');
    if (res.voucher) {
      setSelectedReturn(res.voucher);
    }
  };

  const filteredReturns = returns.filter((r) => {
    if (filterWarehouse !== 'ALL' && r.warehouseId !== filterWarehouse) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesNo = r.returnNo.toLowerCase().includes(q);
      const matchesCust = r.customerName.toLowerCase().includes(q);
      const matchesInv = r.originalInvoiceNo?.toLowerCase().includes(q);
      const matchesItems = r.items.some(
        (i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
      );
      if (!matchesNo && !matchesCust && !matchesInv && !matchesItems) return false;
    }
    return true;
  });

  const totalReturnAmount = returns.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalUnitsRestored = returns.reduce((acc, r) => acc + r.totalQuantity, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60 mb-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Customer Return Inward</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sale Returns</h1>
          <p className="text-sm text-slate-500">
            Accept returned goods from customers, log defect reasons, and restore inventory counts with full audit tracking.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white font-medium text-sm shadow-sm hover:bg-amber-700 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Sale Return</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Returns Credited</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <RotateCcw className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {formatPKR(totalReturnAmount)}
            </div>
            <p className="text-xs text-slate-400 mt-1">{returns.length} return slips recorded</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Restored Stock Units</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {totalUnitsRestored.toLocaleString('en-PK')}
            </div>
            <p className="text-xs text-slate-400 mt-1">Returned physical items added back</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Return Incident Rate</span>
            <span className="p-2 rounded-xl bg-slate-50 text-slate-600">
              <FileCheck2 className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {returns.length} Cases
            </div>
            <p className="text-xs text-slate-400 mt-1">Audit verified vouchers</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search return #, customer, invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 w-full sm:w-auto"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Return Slips Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Return Slip No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Receiving Warehouse</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Restored Qty</th>
                <th className="py-3 px-4 text-right">Refund Value (PKR)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RotateCcw className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-500">No sale return records found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Customer returns will be listed here.</p>
                  </td>
                </tr>
              ) : (
                filteredReturns.map((sr) => (
                  <tr key={sr.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {sr.returnNo}
                      {sr.originalInvoiceNo && (
                        <div className="text-[10px] text-slate-400 font-sans">
                          Ref: {sr.originalInvoiceNo}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{sr.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{sr.customerName}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {sr.warehouseName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        {sr.items.length} lines
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700">
                      +{sr.totalQuantity.toLocaleString('en-PK')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-amber-700">
                      {formatPKR(sr.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedReturn(sr)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-amber-800 bg-amber-50 hover:bg-amber-100 active:scale-[0.98] transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-700" />
                        <span>View Slip</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Sale Return Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                  Return Intake & Stock Restoration
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">Create Sale Return Voucher</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Items will be debited back into warehouse stock, increasing on-hand quantities.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indus Engineering Works Ltd"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Original Invoice Ref # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-0001"
                    value={originalInvoiceNo}
                    onChange={(e) => setOriginalInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Intake Receiving Warehouse <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} — {w.city} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Return Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recorded By</label>
                  <input
                    type="text"
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Returned Items ({lineItems.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {lineItems.map((line, index) => {
                    const qtyNum = Number(line.quantity) || 0;
                    const priceNum = Number(line.unitPrice) || 0;
                    const lineTotal = qtyNum * priceNum;

                    return (
                      <div
                        key={index}
                        className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 space-y-2"
                      >
                        <div className="grid grid-cols-12 gap-3 items-center">
                          <div className="col-span-12 sm:col-span-4">
                            <label className="block text-[10px] font-medium text-slate-500 mb-1">
                              Returned Product
                            </label>
                            <select
                              value={line.productId}
                              onChange={(e) => handleLineChange(index, 'productId', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  [{p.sku}] {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-4 sm:col-span-2">
                            <label className="block text-[10px] font-medium text-slate-500 mb-1">Return Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-right font-mono"
                            />
                          </div>

                          <div className="col-span-4 sm:col-span-2">
                            <label className="block text-[10px] font-medium text-slate-500 mb-1">Refund Rate (Rs.)</label>
                            <input
                              type="number"
                              min="0"
                              value={line.unitPrice}
                              onChange={(e) => handleLineChange(index, 'unitPrice', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-right font-mono"
                            />
                          </div>

                          <div className="col-span-3 sm:col-span-3 text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-medium">Refund Amount</div>
                            <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                              {formatPKR(lineTotal)}
                            </div>
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(index)}
                              disabled={lineItems.length <= 1}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Return Reason row */}
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1">
                            Specific Return Reason
                          </label>
                          <select
                            value={line.reason}
                            onChange={(e) => handleLineChange(index, 'reason', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-700"
                          >
                            {COMMON_RETURN_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total & Remarks */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="w-full sm:w-1/2">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Return Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Inspected by QA team, items accepted back"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div className="text-right sm:ml-auto">
                  <div className="text-xs text-slate-500 font-medium">Total Credit Value</div>
                  <div className="text-2xl font-bold font-mono text-amber-700">
                    {formatPKR(formTotalAmount)}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-amber-600 text-white shadow-sm hover:bg-amber-700 active:scale-[0.98] transition-all"
                >
                  Confirm Return & Restore Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Return Slip Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                  Customer Return Credit Slip
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                  {selectedReturn.returnNo}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Return Date</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedReturn.date}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Customer</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedReturn.customerName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Intake Warehouse</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{selectedReturn.warehouseName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-medium">Original Invoice</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5 font-mono">
                    {selectedReturn.originalInvoiceNo || 'N/A'}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Restored Products
                </h4>
                <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3 text-right">Restored Qty</th>
                        <th className="py-2.5 px-3 text-right">Rate (PKR)</th>
                        <th className="py-2.5 px-3 text-right">Total (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReturn.items.map((line) => (
                        <tr key={line.id}>
                          <td className="py-2.5 px-3">
                            <div className="font-mono text-slate-900 font-medium">{line.sku}</div>
                            <div className="text-slate-600">{line.productName}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-medium">
                              {line.reason}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-700">
                            +{line.quantity} {line.uom}
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
                        <td colSpan={2} className="py-2.5 px-3 text-slate-700">Total Credit Issued</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          +{selectedReturn.totalQuantity}
                        </td>
                        <td></td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-700 text-sm">
                          {formatPKR(selectedReturn.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedReturn.notes && (
                <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Notes:</span> {selectedReturn.notes}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedReturn(null)}
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
