import React, { useState } from 'react';
import type { Product, Warehouse, PurchaseVoucher } from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import {
  PlusCircle,
  FileSpreadsheet,
  Building2,
  Calendar,
  X,
  Trash2,
  Eye,
  CheckCircle2,
  ShoppingBag,
  ArrowDownLeft,
} from 'lucide-react';

interface PurchaseVoucherViewProps {
  products: Product[];
  warehouses: Warehouse[];
  vouchers: PurchaseVoucher[];
  onCreateVoucher: (input: {
    supplierName: string;
    supplierInvoiceNo?: string;
    warehouseId: string;
    date: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    notes?: string;
    recordedBy: string;
  }) => Promise<{ success: boolean; voucher?: PurchaseVoucher; error?: string }>;
}

interface FormLineItem {
  productId: string;
  quantity: string;
  unitPrice: string;
}

export const PurchaseVoucherView: React.FC<PurchaseVoucherViewProps> = ({
  products,
  warehouses,
  vouchers,
  onCreateVoucher,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<PurchaseVoucher | null>(null);

  // Form State
  const [supplierName, setSupplierName] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [recordedBy, setRecordedBy] = useState('Tariq Mehmood');
  const [errorMsg, setErrorMsg] = useState('');

  const [lineItems, setLineItems] = useState<FormLineItem[]>([
    {
      productId: products[0]?.id || '',
      quantity: '50',
      unitPrice: products[0]?.purchasePrice.toString() || '1000',
    },
  ]);

  const handleAddLine = () => {
    const firstProd = products[0];
    setLineItems([
      ...lineItems,
      {
        productId: firstProd?.id || '',
        quantity: '10',
        unitPrice: firstProd?.purchasePrice.toString() || '1000',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, idx) => idx !== index));
  };

  const handleProductChange = (index: number, newProdId: string) => {
    const prod = products.find((p) => p.id === newProdId);
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      productId: newProdId,
      unitPrice: prod ? prod.purchasePrice.toString() : updated[index].unitPrice,
    };
    setLineItems(updated);
  };

  const handleQtyChange = (index: number, val: string) => {
    const updated = [...lineItems];
    updated[index].quantity = val;
    setLineItems(updated);
  };

  const handlePriceChange = (index: number, val: string) => {
    const updated = [...lineItems];
    updated[index].unitPrice = val;
    setLineItems(updated);
  };

  // Calculations
  const calculatedLines = lineItems.map((l) => {
    const prod = products.find((p) => p.id === l.productId);
    const qty = Math.max(0, Number(l.quantity) || 0);
    const price = Math.max(0, Number(l.unitPrice) || 0);
    return {
      ...l,
      product: prod,
      lineTotal: qty * price,
      qtyNumber: qty,
      priceNumber: price,
    };
  });

  const totalVoucherUnits = calculatedLines.reduce((acc, curr) => acc + curr.qtyNumber, 0);
  const totalVoucherAmount = calculatedLines.reduce((acc, curr) => acc + curr.lineTotal, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!supplierName.trim()) {
      setErrorMsg('Please enter the supplier / vendor name.');
      return;
    }

    if (!warehouseId) {
      setErrorMsg('Please select a receiving warehouse location.');
      return;
    }

    const payloadItems = calculatedLines.map((l) => ({
      productId: l.productId,
      quantity: l.qtyNumber,
      unitPrice: l.priceNumber,
    }));

    if (payloadItems.some((i) => i.quantity <= 0)) {
      setErrorMsg('Line item quantities must be greater than 0.');
      return;
    }

    const result = await onCreateVoucher({
      supplierName: supplierName.trim(),
      supplierInvoiceNo: supplierInvoiceNo.trim() || undefined,
      warehouseId,
      date,
      items: payloadItems,
      notes: notes.trim(),
      recordedBy: recordedBy.trim() || 'Tariq Mehmood',
    });

    if (!result.success) {
      setErrorMsg(result.error || 'Failed to save purchase voucher.');
    } else {
      setIsModalOpen(false);
      // Reset
      setSupplierName('');
      setSupplierInvoiceNo('');
      setNotes('');
      setLineItems([
        {
          productId: products[0]?.id || '',
          quantity: '50',
          unitPrice: products[0]?.purchasePrice.toString() || '1000',
        },
      ]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="glass-panel rounded-2xl p-4.5 border border-white/80 shadow-[0_2px_14px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              Purchase Vouchers (Goods Receipt)
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              Inventory Input
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Record supplier deliveries and receive incoming product inventory into specific warehouses
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setIsModalOpen(true);
          }}
          className="btn-press flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/25 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          + New Purchase Voucher
        </button>
      </div>

      {/* Vouchers Table */}
      <div className="glass-panel rounded-2xl border border-white/80 overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200/70 bg-slate-50/70 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Voucher #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Supplier Name</th>
                <th className="py-3 px-4">Receiving Warehouse</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Total Units</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/90 font-sans">
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No Purchase Vouchers Recorded Yet</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create your first purchase voucher to intake goods into inventory.
                    </p>
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                        {v.voucherNo}
                      </span>
                      {v.supplierInvoiceNo && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Ref: {v.supplierInvoiceNo}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-700">
                      {v.date}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {v.supplierName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {v.warehouseName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-xs text-slate-600">
                      {v.items.length} SKUs
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-bold text-emerald-700">
                      +{v.totalQuantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-bold text-slate-900">
                      {formatPKR(v.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedVoucher(v)}
                        className="btn-press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/70 shadow-2xs"
                      >
                        <Eye className="w-3 h-3 text-slate-500" />
                        View Slip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Voucher Modal Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/30 backdrop-blur-md overflow-y-auto">
          <div className="glass-modal relative w-full max-w-3xl rounded-3xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/70 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shadow-2xs">
                  <ArrowDownLeft className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Create Purchase Voucher
                  </h3>
                  <p className="text-xs text-slate-500">Record incoming goods from vendor/supplier</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-press text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs shadow-2xs">
                  {errorMsg}
                </div>
              )}

              {/* Top Row: Supplier & Warehouse */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier / Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pakistan Cables Ltd. / Espressif Karachi"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Receiving Warehouse Location *
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-slate-200/80 rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500/60 cursor-pointer"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.city})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Second Row: Date & Supplier Bill # */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-slate-200/80 rounded-xl pl-8 pr-3 py-2 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier Invoice / Bill # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-PCL-9901"
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Recorded By
                  </label>
                  <input
                    type="text"
                    required
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Purchased Line Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="btn-press inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    + Add Product Line
                  </button>
                </div>

                <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-2">Brand & UOM</th>
                        <th className="py-2.5 px-2 text-right w-24">Qty In</th>
                        <th className="py-2.5 px-2 text-right w-28">Rate (Rs.)</th>
                        <th className="py-2.5 px-3 text-right w-28">Total (Rs.)</th>
                        <th className="py-2.5 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {calculatedLines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3">
                            <select
                              value={line.productId}
                              onChange={(e) => handleProductChange(idx, e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-emerald-500"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.sku} — {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-slate-500">
                            <span className="font-semibold text-slate-700">{line.product?.brand}</span>
                            <span className="text-[11px] text-slate-400 ml-1">({line.product?.uom})</span>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) => handleQtyChange(idx, e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-right font-mono text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unitPrice}
                              onChange={(e) => handlePriceChange(idx, e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-right font-mono text-xs text-slate-900 font-semibold focus:bg-white focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatPKR(line.lineTotal)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {lineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Voucher Total Bar */}
                <div className="flex items-center justify-between p-3.5 mt-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                  <div className="text-xs text-emerald-900 font-medium">
                    Total Inflow Units: <strong className="font-mono text-emerald-800">+{totalVoucherUnits}</strong>
                  </div>
                  <div className="text-xs text-emerald-900 font-medium">
                    Total Voucher Amount:{' '}
                    <strong className="text-base font-mono font-bold text-emerald-800 ml-1">
                      {formatPKR(totalVoucherAmount)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Voucher Notes / Delivery Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Received via TCS cargo, delivery challan verified..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/70">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-press px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-press flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/25"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Commit Purchase to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Slip Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md overflow-y-auto">
          <div className="glass-modal relative w-full max-w-lg rounded-3xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Goods Receipt Slip</span>
                <h3 className="text-lg font-bold text-slate-900 font-mono">{selectedVoucher.voucherNo}</h3>
              </div>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div><strong>Supplier:</strong> {selectedVoucher.supplierName}</div>
              <div><strong>Date:</strong> {selectedVoucher.date}</div>
              <div><strong>Warehouse:</strong> {selectedVoucher.warehouseName}</div>
              <div><strong>Recorded By:</strong> {selectedVoucher.recordedBy}</div>
              {selectedVoucher.supplierInvoiceNo && (
                <div className="col-span-2"><strong>Vendor Invoice #:</strong> {selectedVoucher.supplierInvoiceNo}</div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedVoucher.items.map((line) => (
                    <tr key={line.id}>
                      <td className="p-2">
                        <div className="font-semibold text-slate-900">{line.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{line.sku} • {line.brand}</div>
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-700">+{line.quantity} {line.uom}</td>
                      <td className="p-2 text-right font-mono">{formatPKR(line.unitPrice)}</td>
                      <td className="p-2 text-right font-mono font-bold">{formatPKR(line.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Total Voucher Valuation:</span>
              <span className="text-base font-bold font-mono text-emerald-700">{formatPKR(selectedVoucher.totalAmount)}</span>
            </div>

            {selectedVoucher.notes && (
              <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <strong>Notes:</strong> {selectedVoucher.notes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
