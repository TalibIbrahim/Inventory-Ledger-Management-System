import React, { useState } from 'react';
import type {
  Product,
  Warehouse,
  OpeningStockVoucher,
  StockAdjustmentVoucher,
} from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import {
  PlusCircle,
  Building2,
  X,
  Trash2,
  Eye,
  Sliders,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';

interface InventoryVouchersViewProps {
  products: Product[];
  warehouses: Warehouse[];
  openingStocks: OpeningStockVoucher[];
  stockAdjustments: StockAdjustmentVoucher[];
  onCreateOpeningStock: (input: {
    warehouseId: string;
    date: string;
    items: Array<{ productId: string; quantity: number; unitCost: number }>;
    notes?: string;
    recordedBy: string;
  }) => Promise<{ success: boolean; voucher?: OpeningStockVoucher; error?: string }>;
  onCreateStockAdjustment: (input: {
    warehouseId: string;
    date: string;
    adjustmentType: 'INCREASE' | 'DECREASE' | 'WRITE_OFF' | 'RECONCILIATION';
    items: Array<{ productId: string; changeQty: number; unitCost?: number; reason: string }>;
    notes?: string;
    recordedBy: string;
  }) => Promise<{ success: boolean; voucher?: StockAdjustmentVoucher; error?: string }>;
}

interface OpeningLineItem {
  productId: string;
  quantity: string;
  unitCost: string;
}

interface AdjustmentLineItem {
  productId: string;
  changeQty: string;
  unitCost: string;
  reason: string;
}

export const InventoryVouchersView: React.FC<InventoryVouchersViewProps> = ({
  products,
  warehouses,
  openingStocks,
  stockAdjustments,
  onCreateOpeningStock,
  onCreateStockAdjustment,
}) => {
  const [subCategory, setSubCategory] = useState<'opening' | 'adjustment'>('opening');

  // Modal Controls
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedOpening, setSelectedOpening] = useState<OpeningStockVoucher | null>(null);
  const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustmentVoucher | null>(null);

  // Opening Stock Form State
  const [osWarehouseId, setOsWarehouseId] = useState(warehouses[0]?.id || '');
  const [osDate, setOsDate] = useState(new Date().toISOString().slice(0, 10));
  const [osNotes, setOsNotes] = useState('');
  const [osRecordedBy, setOsRecordedBy] = useState('Admin Supervisor');
  const [osError, setOsError] = useState('');
  const [osLines, setOsLines] = useState<OpeningLineItem[]>([
    {
      productId: products[0]?.id || '',
      quantity: '100',
      unitCost: products[0]?.purchasePrice.toString() || '1000',
    },
  ]);

  // Stock Adjustment Form State
  const [saWarehouseId, setSaWarehouseId] = useState(warehouses[0]?.id || '');
  const [saDate, setSaDate] = useState(new Date().toISOString().slice(0, 10));
  const [saType, setSaType] = useState<'INCREASE' | 'DECREASE' | 'WRITE_OFF' | 'RECONCILIATION'>('RECONCILIATION');
  const [saNotes, setSaNotes] = useState('');
  const [saRecordedBy, setSaRecordedBy] = useState('Chief Auditor');
  const [saError, setSaError] = useState('');
  const [saLines, setSaLines] = useState<AdjustmentLineItem[]>([
    {
      productId: products[0]?.id || '',
      changeQty: '5',
      unitCost: products[0]?.purchasePrice.toString() || '1000',
      reason: 'Physical count variance',
    },
  ]);

  // Handle Opening Stock Form
  const handleAddOsLine = () => {
    const firstProd = products[0];
    setOsLines([
      ...osLines,
      {
        productId: firstProd?.id || '',
        quantity: '50',
        unitCost: firstProd?.purchasePrice.toString() || '1000',
      },
    ]);
  };

  const handleOsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOsError('');

    const payload = {
      warehouseId: osWarehouseId,
      date: osDate,
      items: osLines.map((l) => ({
        productId: l.productId,
        quantity: Math.max(1, Number(l.quantity) || 1),
        unitCost: Math.max(0, Number(l.unitCost) || 0),
      })),
      notes: osNotes.trim(),
      recordedBy: osRecordedBy.trim() || 'Admin Supervisor',
    };

    const res = await onCreateOpeningStock(payload);
    if (!res.success) {
      setOsError(res.error || 'Failed to post opening stock.');
      return;
    }

    setIsOpeningModalOpen(false);
    setOsNotes('');
    if (res.voucher) setSelectedOpening(res.voucher);
  };

  // Handle Stock Adjustment Form
  const handleAddSaLine = () => {
    const firstProd = products[0];
    setSaLines([
      ...saLines,
      {
        productId: firstProd?.id || '',
        changeQty: saType === 'DECREASE' || saType === 'WRITE_OFF' ? '-5' : '5',
        unitCost: firstProd?.purchasePrice.toString() || '1000',
        reason: saType === 'WRITE_OFF' ? 'Damaged / Scrapped' : 'Audit adjustment',
      },
    ]);
  };

  const handleSaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaError('');

    const payload = {
      warehouseId: saWarehouseId,
      date: saDate,
      adjustmentType: saType,
      items: saLines.map((l) => {
        let qty = Number(l.changeQty) || 0;
        // Ensure negative if type is write_off or decrease
        if ((saType === 'WRITE_OFF' || saType === 'DECREASE') && qty > 0) {
          qty = -qty;
        }
        return {
          productId: l.productId,
          changeQty: qty,
          unitCost: Math.max(0, Number(l.unitCost) || 0),
          reason: l.reason.trim() || 'Stock reconciliation',
        };
      }),
      notes: saNotes.trim(),
      recordedBy: saRecordedBy.trim() || 'Chief Auditor',
    };

    const res = await onCreateStockAdjustment(payload);
    if (!res.success) {
      setSaError(res.error || 'Failed to post stock adjustment.');
      return;
    }

    setIsAdjustmentModalOpen(false);
    setSaNotes('');
    if (res.voucher) setSelectedAdjustment(res.voucher);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200/60 mb-1.5">
            <Sliders className="w-3.5 h-3.5" />
            <span>Inventory Vouchers</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vouchers Management</h1>
          <p className="text-sm text-slate-500">
            Initialize baseline inventory with Opening Stock or perform audited reconciliations via Stock Adjustments.
          </p>
        </div>

        {/* Action Button depending on sub-category */}
        {subCategory === 'opening' ? (
          <button
            onClick={() => {
              setOsError('');
              setIsOpeningModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm shadow-sm hover:bg-purple-700 active:scale-[0.98] transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Opening Stock Voucher</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setSaError('');
              setIsAdjustmentModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Stock Adjustment</span>
          </button>
        )}
      </div>

      {/* Sub-Category Switcher */}
      <div className="p-3 bg-white rounded-2xl border border-black/[0.06] shadow-sm flex items-center justify-between">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setSubCategory('opening')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subCategory === 'opening'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Opening Stock ({openingStocks.length})</span>
          </button>
          <button
            onClick={() => setSubCategory('adjustment')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subCategory === 'adjustment'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Stock Adjustment ({stockAdjustments.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          All changes are immediately reflected in the central ledger
        </div>
      </div>

      {/* View 1: Opening Stock Vouchers */}
      {subCategory === 'opening' ? (
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Location Warehouse</th>
                  <th className="py-3 px-4 text-center">Items Initialized</th>
                  <th className="py-3 px-4 text-right">Total Units</th>
                  <th className="py-3 px-4 text-right">Asset Valuation (PKR)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {openingStocks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-500">No opening stock vouchers</p>
                      <p className="text-xs text-slate-400 mt-0.5">Initialize opening stock balances for warehouses.</p>
                    </td>
                  </tr>
                ) : (
                  openingStocks.map((os) => (
                    <tr key={os.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{os.voucherNo}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{os.date}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {os.warehouseName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium text-[11px]">
                          {os.items.length} products
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                        {os.totalQuantity.toLocaleString('en-PK')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-purple-700">
                        {formatPKR(os.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedOpening(os)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
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
        /* View 2: Stock Adjustment Vouchers */
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4 text-center">Adjustment Category</th>
                  <th className="py-3 px-4 text-center">Items Affected</th>
                  <th className="py-3 px-4 text-right">Net Qty Delta</th>
                  <th className="py-3 px-4 text-right">Valuation Impact (PKR)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Sliders className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-500">No stock adjustment vouchers</p>
                      <p className="text-xs text-slate-400 mt-0.5">Post reconciliations or write-offs here.</p>
                    </td>
                  </tr>
                ) : (
                  stockAdjustments.map((sa) => {
                    const isPositive = sa.netQuantityDelta >= 0;
                    return (
                      <tr key={sa.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{sa.voucherNo}</td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{sa.date}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {sa.warehouseName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {sa.adjustmentType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 font-medium">
                          {sa.items.length} items
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold ${
                            isPositive ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? `+${sa.netQuantityDelta}` : sa.netQuantityDelta}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                          {formatPKR(sa.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedAdjustment(sa)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
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
      )}

      {/* Opening Stock Modal */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                  Initial Inventory Input
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">Opening Stock Voucher</h3>
              </div>
              <button
                onClick={() => setIsOpeningModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOsSubmit} className="p-6 overflow-y-auto space-y-4">
              {osError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{osError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Warehouse</label>
                  <select
                    value={osWarehouseId}
                    onChange={(e) => setOsWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.city})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={osDate}
                    onChange={(e) => setOsDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recorded By</label>
                  <input
                    type="text"
                    value={osRecordedBy}
                    onChange={(e) => setOsRecordedBy(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Opening Stock Items
                  </span>
                  <button
                    type="button"
                    onClick={handleAddOsLine}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-purple-600 bg-purple-50 hover:bg-purple-100"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {osLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 grid grid-cols-12 gap-3 items-center"
                    >
                      <div className="col-span-6">
                        <SearchableSelect
                          options={products.map((p) => ({
                            value: p.id,
                            label: `[${p.sku}] ${p.name}`,
                            subLabel: `${p.brand} • ${p.type} (${p.uom})`,
                          }))}
                          value={line.productId}
                          onChange={(value) => {
                            const updated = [...osLines];
                            updated[idx].productId = value;
                            const p = products.find((prod) => prod.id === value);
                            if (p) updated[idx].unitCost = p.purchasePrice.toString();
                            setOsLines(updated);
                          }}
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          placeholder="Quantity"
                          value={line.quantity}
                          onChange={(e) => {
                            const updated = [...osLines];
                            updated[idx].quantity = e.target.value;
                            setOsLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono text-right"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Unit Cost"
                          value={line.unitCost}
                          onChange={(e) => {
                            const updated = [...osLines];
                            updated[idx].unitCost = e.target.value;
                            setOsLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono text-right"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          disabled={osLines.length <= 1}
                          onClick={() => setOsLines(osLines.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Audit Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Fiscal year baseline stock intake"
                  value={osNotes}
                  onChange={(e) => setOsNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpeningModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700"
                >
                  Post Opening Stock Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  Audited Variance & Write-off
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">Stock Adjustment Voucher</h3>
              </div>
              <button
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaSubmit} className="p-6 overflow-y-auto space-y-4">
              {saError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{saError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Warehouse</label>
                  <select
                    value={saWarehouseId}
                    onChange={(e) => setSaWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Adjustment Type</label>
                  <select
                    value={saType}
                    onChange={(e) => setSaType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="RECONCILIATION">Reconciliation (Variance)</option>
                    <option value="WRITE_OFF">Write-Off (Damaged / Scrap)</option>
                    <option value="DECREASE">Decrease (Shortage)</option>
                    <option value="INCREASE">Increase (Surplus)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={saDate}
                    onChange={(e) => setSaDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Auditor</label>
                  <input
                    type="text"
                    value={saRecordedBy}
                    onChange={(e) => setSaRecordedBy(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Adjustment items */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Adjustment Items
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSaLine}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {saLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 grid grid-cols-12 gap-3 items-center"
                    >
                      <div className="col-span-5">
                        <SearchableSelect
                          options={products.map((p) => ({
                            value: p.id,
                            label: `[${p.sku}] ${p.name}`,
                            subLabel: `${p.brand} • ${p.type} (${p.uom})`,
                          }))}
                          value={line.productId}
                          onChange={(value) => {
                            const updated = [...saLines];
                            updated[idx].productId = value;
                            setSaLines(updated);
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Delta (+/-)"
                          value={line.changeQty}
                          onChange={(e) => {
                            const updated = [...saLines];
                            updated[idx].changeQty = e.target.value;
                            setSaLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono text-right"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Audit reason..."
                          value={line.reason}
                          onChange={(e) => {
                            const updated = [...saLines];
                            updated[idx].reason = e.target.value;
                            setSaLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          disabled={saLines.length <= 1}
                          onClick={() => setSaLines(saLines.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">General Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly physical audit count adjustment"
                  value={saNotes}
                  onChange={(e) => setSaNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Post Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Opening Slip Inspection Modal */}
      {selectedOpening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border border-black/[0.08] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="text-xs uppercase font-semibold text-purple-600">Opening Stock Voucher</div>
                <h3 className="text-lg font-mono font-bold text-slate-900">{selectedOpening.voucherNo}</h3>
              </div>
              <button onClick={() => setSelectedOpening(null)} className="p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div><strong>Warehouse:</strong> {selectedOpening.warehouseName}</div>
              <div><strong>Date:</strong> {selectedOpening.date}</div>
              <div><strong>Recorded By:</strong> {selectedOpening.recordedBy}</div>
            </div>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit Cost</th>
                    <th className="p-2 text-right">Total (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedOpening.items.map((i) => (
                    <tr key={i.id}>
                      <td className="p-2 font-medium">{i.productName} ({i.sku})</td>
                      <td className="p-2 text-right font-mono">{i.quantity} {i.uom}</td>
                      <td className="p-2 text-right font-mono">{formatPKR(i.unitCost)}</td>
                      <td className="p-2 text-right font-mono font-semibold">{formatPKR(i.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedOpening(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Slip Inspection Modal */}
      {selectedAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border border-black/[0.08] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="text-xs uppercase font-semibold text-indigo-600">Stock Adjustment Voucher</div>
                <h3 className="text-lg font-mono font-bold text-slate-900">{selectedAdjustment.voucherNo}</h3>
              </div>
              <button onClick={() => setSelectedAdjustment(null)} className="p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div><strong>Warehouse:</strong> {selectedAdjustment.warehouseName}</div>
              <div><strong>Type:</strong> {selectedAdjustment.adjustmentType}</div>
              <div><strong>Date:</strong> {selectedAdjustment.date}</div>
              <div><strong>Auditor:</strong> {selectedAdjustment.recordedBy}</div>
            </div>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2">Reason</th>
                    <th className="p-2 text-right">Delta</th>
                    <th className="p-2 text-right">Value Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedAdjustment.items.map((i) => (
                    <tr key={i.id}>
                      <td className="p-2 font-medium">{i.productName} ({i.sku})</td>
                      <td className="p-2 text-slate-500">{i.reason}</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {i.changeQty > 0 ? `+${i.changeQty}` : i.changeQty} {i.uom}
                      </td>
                      <td className="p-2 text-right font-mono font-semibold">{formatPKR(i.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAdjustment(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 text-white"
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
