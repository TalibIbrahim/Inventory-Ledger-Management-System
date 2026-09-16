import React, { useState, useEffect, useRef } from 'react';
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
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';
import {
  validatePurchaseVoucher,
  type VoucherValidationResult,
} from '../../utils/voucherValidation';
import {
  saveVoucherDraft,
  loadVoucherDraft,
  clearVoucherDraft,
  isPurchaseDraftSubstantive,
  DRAFT_STORAGE_KEYS,
  type PurchaseDraftData,
} from '../../utils/voucherDrafts';

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
  const [validationErrors, setValidationErrors] = useState<VoucherValidationResult | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [lineItems, setLineItems] = useState<FormLineItem[]>([
    {
      productId: products[0]?.id || '',
      quantity: '50',
      unitPrice: products[0]?.purchasePrice.toString() || '1000',
    },
  ]);

  // Open modal with draft recovery check
  const handleOpenModal = () => {
    setErrorMsg('');
    setValidationErrors(null);
    const draft = loadVoucherDraft<PurchaseDraftData>(DRAFT_STORAGE_KEYS.PURCHASE_VOUCHER);
    if (draft && isPurchaseDraftSubstantive(draft)) {
      setSupplierName(draft.supplierName || '');
      setSupplierInvoiceNo(draft.supplierInvoiceNo || '');
      if (draft.warehouseId) setWarehouseId(draft.warehouseId);
      if (draft.date) setDate(draft.date);
      setNotes(draft.notes || '');
      if (draft.recordedBy) setRecordedBy(draft.recordedBy);
      if (draft.lineItems && draft.lineItems.length > 0) {
        setLineItems(draft.lineItems);
      }
      setHasRestoredDraft(true);
    } else {
      setHasRestoredDraft(false);
    }
    setIsModalOpen(true);
  };

  const handleDiscardDraft = () => {
    clearVoucherDraft(DRAFT_STORAGE_KEYS.PURCHASE_VOUCHER);
    setHasRestoredDraft(false);
    setSupplierName('');
    setSupplierInvoiceNo('');
    setWarehouseId(warehouses[0]?.id || '');
    setDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setValidationErrors(null);
    setErrorMsg('');
    setLineItems([
      {
        productId: products[0]?.id || '',
        quantity: '50',
        unitPrice: products[0]?.purchasePrice.toString() || '1000',
      },
    ]);
  };

  // Auto-save form draft whenever modal is open and inputs change
  useEffect(() => {
    if (!isModalOpen) return;
    saveVoucherDraft(DRAFT_STORAGE_KEYS.PURCHASE_VOUCHER, {
      supplierName,
      supplierInvoiceNo,
      warehouseId,
      date,
      notes,
      recordedBy,
      lineItems,
    });
  }, [isModalOpen, supplierName, supplierInvoiceNo, warehouseId, date, notes, recordedBy, lineItems]);

  // Keyboard Shortcuts: Ctrl/Cmd+K to focus search, Escape to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

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

  const handleLineKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === lineItems.length - 1) {
        handleAddLine();
      }
    }
  };

  const handleRemoveLine = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, idx) => idx !== index));
    if (validationErrors?.lineErrors[index]) {
      const updatedLineErrors = { ...validationErrors.lineErrors };
      delete updatedLineErrors[index];
      setValidationErrors({
        ...validationErrors,
        lineErrors: updatedLineErrors,
      });
    }
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

    if (validationErrors?.lineErrors[index]?.productId) {
      const updatedLineErrors = { ...validationErrors.lineErrors };
      if (updatedLineErrors[index]) {
        delete updatedLineErrors[index].productId;
      }
      setValidationErrors({ ...validationErrors, lineErrors: updatedLineErrors });
    }
  };

  const handleQtyChange = (index: number, val: string) => {
    const updated = [...lineItems];
    updated[index].quantity = val;
    setLineItems(updated);

    if (validationErrors?.lineErrors[index]?.quantity) {
      const updatedLineErrors = { ...validationErrors.lineErrors };
      if (updatedLineErrors[index]) {
        delete updatedLineErrors[index].quantity;
      }
      setValidationErrors({ ...validationErrors, lineErrors: updatedLineErrors });
    }
  };

  const handlePriceChange = (index: number, val: string) => {
    const updated = [...lineItems];
    updated[index].unitPrice = val;
    setLineItems(updated);

    if (validationErrors?.lineErrors[index]?.unitPrice) {
      const updatedLineErrors = { ...validationErrors.lineErrors };
      if (updatedLineErrors[index]) {
        delete updatedLineErrors[index].unitPrice;
      }
      setValidationErrors({ ...validationErrors, lineErrors: updatedLineErrors });
    }
  };

  // Quick Date Helpers
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const setQuickDate = (d: string) => {
    setDate(d);
    if (validationErrors?.fieldErrors.date) {
      setValidationErrors({
        ...validationErrors,
        fieldErrors: { ...validationErrors.fieldErrors, date: undefined },
      });
    }
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

    const validation = validatePurchaseVoucher({
      supplierName,
      warehouseId,
      date,
      items: lineItems,
    });

    if (!validation.isValid) {
      setValidationErrors(validation);
      setErrorMsg(validation.generalError || 'Please fix the errors below.');
      return;
    }

    setValidationErrors(null);

    const payloadItems = calculatedLines.map((l) => ({
      productId: l.productId,
      quantity: l.qtyNumber,
      unitPrice: l.priceNumber,
    }));

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
      clearVoucherDraft(DRAFT_STORAGE_KEYS.PURCHASE_VOUCHER);
      setHasRestoredDraft(false);
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

  // Filtered vouchers
  const filteredVouchers = vouchers.filter((v) => {
    if (filterWarehouse !== 'ALL' && v.warehouseId !== filterWarehouse) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesNo = v.voucherNo.toLowerCase().includes(q);
      const matchesSupplier = v.supplierName.toLowerCase().includes(q);
      const matchesItems = v.items.some(
        (i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
      );
      if (!matchesNo && !matchesSupplier && !matchesItems) return false;
    }
    return true;
  });

  const isFiltered = searchQuery.trim() !== '' || filterWarehouse !== 'ALL';

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
          onClick={handleOpenModal}
          className="btn-press flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/25 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          + New Purchase Voucher
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-white/80 shadow-[0_2px_14px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search voucher #, supplier, item... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-14 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 w-full sm:w-auto cursor-pointer"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.city})
              </option>
            ))}
          </select>

          {isFiltered && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterWarehouse('ALL');
              }}
              className="px-2.5 py-2 text-xs text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
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
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        {isFiltered ? 'No Vouchers Found' : 'No Purchase Vouchers Recorded Yet'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 mb-4">
                        {isFiltered
                          ? 'No purchase vouchers match your search keyword or selected warehouse.'
                          : 'Create your first goods receipt voucher to intake inventory into your warehouse.'}
                      </p>
                      {isFiltered ? (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setFilterWarehouse('ALL');
                          }}
                          className="btn-press px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                        >
                          Clear Search Filters
                        </button>
                      ) : (
                        <button
                          onClick={handleOpenModal}
                          className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-all"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>Create First Purchase Voucher</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
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
                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
              {/* Draft Restored Banner */}
              {hasRestoredDraft && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Restored your unsaved draft from a previous session.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:text-amber-950 bg-amber-100/80 hover:bg-amber-200 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Discard Draft</span>
                  </button>
                </div>
              )}

              {/* Top Level Error Alert */}
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
                    onChange={(e) => {
                      setSupplierName(e.target.value);
                      if (validationErrors?.fieldErrors.partyName) {
                        setValidationErrors({
                          ...validationErrors,
                          fieldErrors: { ...validationErrors.fieldErrors, partyName: undefined },
                        });
                      }
                    }}
                    className={`w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-none transition-all ${
                      validationErrors?.fieldErrors.partyName
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 bg-rose-50/10'
                        : 'border-slate-200/80 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10'
                    }`}
                  />
                  {validationErrors?.fieldErrors.partyName && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">
                      {validationErrors.fieldErrors.partyName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Receiving Warehouse Location *
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={warehouseId}
                      onChange={(e) => {
                        setWarehouseId(e.target.value);
                        if (validationErrors?.fieldErrors.warehouseId) {
                          setValidationErrors({
                            ...validationErrors,
                            fieldErrors: { ...validationErrors.fieldErrors, warehouseId: undefined },
                          });
                        }
                      }}
                      className={`w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none cursor-pointer ${
                        validationErrors?.fieldErrors.warehouseId
                          ? 'border-rose-400 focus:border-rose-500'
                          : 'border-slate-200/80 focus:border-emerald-500/60'
                      }`}
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  {validationErrors?.fieldErrors.warehouseId && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">
                      {validationErrors.fieldErrors.warehouseId}
                    </p>
                  )}
                </div>
              </div>

              {/* Second Row: Date & Supplier Bill # */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Date *
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuickDate(todayStr)}
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                          date === todayStr
                            ? 'bg-emerald-100 text-emerald-800 font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDate(yesterdayStr)}
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                          date === yesterdayStr
                            ? 'bg-emerald-100 text-emerald-800 font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Yesterday
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        if (validationErrors?.fieldErrors.date) {
                          setValidationErrors({
                            ...validationErrors,
                            fieldErrors: { ...validationErrors.fieldErrors, date: undefined },
                          });
                        }
                      }}
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

              {/* Line Items Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Purchased Line Items ({lineItems.length})
                    </label>
                    <span className="text-[11px] text-slate-400 ml-2 hidden sm:inline">
                      Press <kbd className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Enter</kbd> to add row
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="btn-press inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    + Add Product Line
                  </button>
                </div>

                <div className="space-y-2.5">
                  {calculatedLines.map((line, idx) => {
                    const lineErr = validationErrors?.lineErrors[idx];

                    return (
                      <div
                        key={idx}
                        style={{ zIndex: 30 - idx }}
                        className={`relative p-3 rounded-2xl border transition-all ${
                          lineErr
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
                            <SearchableSelect
                              options={products.map((p) => ({
                                value: p.id,
                                label: `[${p.sku}] ${p.name}`,
                                subLabel: `${p.brand} • ${p.type} (${p.uom})`,
                              }))}
                              value={line.productId}
                              onChange={(val) => handleProductChange(idx, val)}
                              accentColor="emerald"
                              hasError={Boolean(lineErr?.productId)}
                            />
                            <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500">
                              <span className="truncate">
                                {line.product ? `${line.product.brand} • ${line.product.type}` : 'No product selected'}
                              </span>
                              {line.product && (
                                <span className="font-mono text-slate-400 ml-1">({line.product.uom})</span>
                              )}
                            </div>
                            {lineErr?.productId && (
                              <p className="text-[10px] text-rose-600 mt-0.5 font-medium">
                                {lineErr.productId}
                              </p>
                            )}
                          </div>

                          {/* Quantity */}
                          <div className="col-span-4 sm:col-span-2">
                            <label className="block text-[10px] font-medium text-slate-500 mb-1">Qty In</label>
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) => handleQtyChange(idx, e.target.value)}
                              onKeyDown={(e) => handleLineKeyDown(e, idx)}
                              className={`w-full px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none text-right font-mono ${
                                lineErr?.quantity
                                  ? 'border-red-400 text-red-700 focus:ring-red-500/20'
                                  : 'border-slate-200/80 focus:border-emerald-500'
                              }`}
                            />
                            {lineErr?.quantity && (
                              <p className="text-[10px] text-rose-600 mt-0.5 text-right font-medium">
                                {lineErr.quantity}
                              </p>
                            )}
                          </div>

                          {/* Unit Purchase Price */}
                          <div className="col-span-4 sm:col-span-2">
                            <label className="block text-[10px] font-medium text-slate-500 mb-1">Rate (Rs.)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unitPrice}
                              onChange={(e) => handlePriceChange(idx, e.target.value)}
                              onKeyDown={(e) => handleLineKeyDown(e, idx)}
                              className={`w-full px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none text-right font-mono ${
                                lineErr?.unitPrice
                                  ? 'border-red-400 text-red-700 focus:ring-red-500/20'
                                  : 'border-slate-200/80 focus:border-emerald-500'
                              }`}
                            />
                            {lineErr?.unitPrice && (
                              <p className="text-[10px] text-rose-600 mt-0.5 text-right font-medium">
                                {lineErr.unitPrice}
                              </p>
                            )}
                          </div>

                          {/* Line Total */}
                          <div className="col-span-3 sm:col-span-2 text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-medium">Amount</div>
                            <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                              {formatPKR(line.lineTotal)}
                            </div>
                          </div>

                          {/* Remove button */}
                          <div className="col-span-1 text-center">
                            {lineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

