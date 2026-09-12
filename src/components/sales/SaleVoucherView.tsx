import React, { useState } from 'react';
import type { Product, Warehouse, SaleVoucher } from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import {
  PlusCircle,
  FileText,
  Building2,
  X,
  Trash2,
  Eye,
  TrendingUp,
  ArrowUpRight,
  AlertTriangle,
  Receipt,
  Printer,
} from 'lucide-react';

interface SaleVoucherViewProps {
  products: Product[];
  warehouses: Warehouse[];
  vouchers: SaleVoucher[];
  onCreateVoucher: (input: {
    customerName: string;
    warehouseId: string;
    date: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    notes?: string;
    recordedBy: string;
  }) => Promise<{ success: boolean; voucher?: SaleVoucher; error?: string }>;
  getProductStockAtWarehouse: (productId: string, warehouseId?: string) => number;
}

interface FormLineItem {
  productId: string;
  quantity: string;
  unitPrice: string;
}

export const SaleVoucherView: React.FC<SaleVoucherViewProps> = ({
  products,
  warehouses,
  vouchers,
  onCreateVoucher,
  getProductStockAtWarehouse,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SaleVoucher | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [recordedBy, setRecordedBy] = useState('Kamran Hashmi');
  const [errorMsg, setErrorMsg] = useState('');

  const [lineItems, setLineItems] = useState<FormLineItem[]>([
    {
      productId: products[0]?.id || '',
      quantity: '5',
      unitPrice: products[0]?.salePrice.toString() || '1500',
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
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof FormLineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    // If product changed, update price automatically to its sale price
    if (field === 'productId') {
      const prod = products.find((p) => p.id === value);
      if (prod) {
        updated[index].unitPrice = prod.salePrice.toString();
      }
    }

    setLineItems(updated);
  };

  // Stock check helper for form
  const getLineStockInfo = (productId: string) => {
    const available = getProductStockAtWarehouse(productId, warehouseId);
    const prod = products.find((p) => p.id === productId);
    return { available, uom: prod?.uom || 'pcs', name: prod?.name || '' };
  };

  // Check if any line exceeds warehouse stock
  const hasInsufficientStock = lineItems.some((line) => {
    const qty = Number(line.quantity) || 0;
    const available = getProductStockAtWarehouse(line.productId, warehouseId);
    return qty > available;
  });

  // Calculate live modal total
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

    if (hasInsufficientStock) {
      setErrorMsg('One or more items exceed the stock available at the selected warehouse.');
      return;
    }

    const payload = {
      customerName: customerName.trim(),
      warehouseId,
      date,
      items: lineItems.map((l) => ({
        productId: l.productId,
        quantity: Math.max(1, Number(l.quantity) || 1),
        unitPrice: Math.max(0, Number(l.unitPrice) || 0),
      })),
      notes: notes.trim(),
      recordedBy: recordedBy.trim() || 'Billing Officer',
    };

    const res = await onCreateVoucher(payload);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to generate sale invoice.');
      return;
    }

    // Reset & open invoice slip
    setIsModalOpen(false);
    setCustomerName('');
    setNotes('');
    if (res.voucher) {
      setSelectedInvoice(res.voucher);
    }
  };

  // Filtered invoices
  const filteredVouchers = vouchers.filter((v) => {
    if (filterWarehouse !== 'ALL' && v.warehouseId !== filterWarehouse) return false;
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
  });

  const totalSalesRevenue = vouchers.reduce((acc, v) => acc + v.totalAmount, 0);
  const totalUnitsDispatched = vouchers.reduce((acc, v) => acc + v.totalQuantity, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60 mb-1.5">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Outward Inventory & Sales</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sale Vouchers</h1>
          <p className="text-sm text-slate-500">
            Create sales invoices, deduct physical stock automatically, and maintain customer outward ledgers.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Sale Invoice</span>
        </button>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sales Invoiced</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {formatPKR(totalSalesRevenue)}
            </div>
            <p className="text-xs text-slate-400 mt-1">{vouchers.length} invoices generated</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Units Dispatched</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {totalUnitsDispatched.toLocaleString('en-PK')}
            </div>
            <p className="text-xs text-slate-400 mt-1">Total items deducted from inventory</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Invoice Value</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {formatPKR(vouchers.length > 0 ? totalSalesRevenue / vouchers.length : 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Per commercial invoice</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search invoice #, customer, item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 w-full sm:w-auto"
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

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Dispatch Warehouse</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Total Qty</th>
                <th className="py-3 px-4 text-right">Invoice Amount (PKR)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-500">No sale vouchers recorded</p>
                    <p className="text-xs text-slate-400 mt-0.5">Click "New Sale Invoice" above to create one.</p>
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((sv) => (
                  <tr key={sv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{sv.invoiceNo}</td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{sv.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{sv.customerName}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {sv.warehouseName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        {sv.items.length} lines
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                      {sv.totalQuantity.toLocaleString('en-PK')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-blue-600">
                      {formatPKR(sv.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedInvoice(sv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-[0.98] transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Invoice Slip</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Sale Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Outward Commercial Invoice
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">Create Sale Voucher</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stock will be credited out of the specified warehouse immediately upon posting.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Primary Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer / Client Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indus Engineering Works Ltd"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dispatch Warehouse <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} — {w.city} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recorded By (Officer)</label>
                  <input
                    type="text"
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Dispatch Line Items ({lineItems.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {lineItems.map((line, index) => {
                    const stockInfo = getLineStockInfo(line.productId);
                    const qtyNum = Number(line.quantity) || 0;
                    const isExceeded = qtyNum > stockInfo.available;
                    const priceNum = Number(line.unitPrice) || 0;
                    const lineTotal = qtyNum * priceNum;

                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-2xl border transition-all ${
                          isExceeded
                            ? 'bg-red-50/50 border-red-200'
                            : 'bg-slate-50/80 border-slate-200/80'
                        }`}
                      >
                        <div className="grid grid-cols-12 gap-3 items-center">
                          {/* Product Selection */}
                          <div className="col-span-12 sm:col-span-5">
                            <label className="block text-[10px] font-medium text-slate-500 mb-1">
                              Product Catalog
                            </label>
                            <select
                              value={line.productId}
                              onChange={(e) => handleLineChange(index, 'productId', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  [{p.sku}] {p.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center justify-between text-[11px] mt-1">
                              <span
                                className={`font-mono ${
                                  isExceeded ? 'text-red-600 font-semibold' : 'text-slate-500'
                                }`}
                              >
                                On Hand: {stockInfo.available} {stockInfo.uom}
                              </span>
                              {isExceeded && (
                                <span className="text-red-600 font-medium">Insufficient Stock!</span>
                              )}
                            </div>
                          </div>

                          {/* Quantity */}
                          <div className="col-span-4 sm:col-span-2">
                            <label className="block text-[10px] font-medium text-slate-500 mb-1">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                              className={`w-full px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none text-right font-mono ${
                                isExceeded
                                  ? 'border-red-400 text-red-700 focus:ring-red-500/20'
                                  : 'border-slate-200 focus:ring-blue-500/20'
                              }`}
                            />
                          </div>

                          {/* Unit Sale Price */}
                          <div className="col-span-4 sm:col-span-2">
                            <label className="block text-[10px] font-medium text-slate-500 mb-1">Rate (Rs.)</label>
                            <input
                              type="number"
                              min="0"
                              value={line.unitPrice}
                              onChange={(e) => handleLineChange(index, 'unitPrice', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-right font-mono"
                            />
                          </div>

                          {/* Line Total */}
                          <div className="col-span-3 sm:col-span-2 text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-medium">Amount</div>
                            <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                              {formatPKR(lineTotal)}
                            </div>
                          </div>

                          {/* Remove button */}
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
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total & Notes */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="w-full sm:w-1/2">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Notes / Terms</label>
                  <input
                    type="text"
                    placeholder="e.g. Payment due in 15 days, delivered via TCS"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="text-right sm:ml-auto">
                  <div className="text-xs text-slate-500 font-medium">Grand Invoice Total</div>
                  <div className="text-2xl font-bold font-mono text-blue-600">
                    {formatPKR(formTotalAmount)}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
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
                  disabled={hasInsufficientStock}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                >
                  Generate Invoice & Dispatch Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice Slip Modal */}
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
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
                            <div className="text-[10px] text-slate-400">Brand: {line.brand}</div>
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

              {selectedInvoice.notes && (
                <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Remarks:</span> {selectedInvoice.notes}
                </div>
              )}

              {/* Signature / Audit Footer */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center text-xs text-slate-400">
                <div className="pt-8 border-t border-dashed border-slate-200">
                  <span>Customer Receiver Signature</span>
                </div>
                <div className="pt-8 border-t border-dashed border-slate-200">
                  <span>Authorized Warehouse Dispatcher</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
