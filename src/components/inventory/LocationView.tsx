import React, { useState } from 'react';
import type { Warehouse, Product } from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import {
  Building2,
  PlusCircle,
  MapPin,
  User,
  X,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface LocationViewProps {
  warehouses: Warehouse[];
  products: Product[];
  onCreateWarehouse: (input: Omit<Warehouse, 'id'>) => Promise<{
    success: boolean;
    warehouse?: Warehouse;
    error?: string;
  }>;
  getProductStockAtWarehouse: (productId: string, warehouseId?: string) => number;
}

const COMMON_CITIES = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Sialkot',
  'Peshawar',
  'Quetta',
  'Gujranwala',
];

export const LocationView: React.FC<LocationViewProps> = ({
  warehouses,
  products,
  onCreateWarehouse,
  getProductStockAtWarehouse,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState(COMMON_CITIES[0]);
  const [address, setAddress] = useState('');
  const [manager, setManager] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Expandable warehouse breakdown
  const [expandedWhId, setExpandedWhId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!code.trim() || !name.trim()) {
      setErrorMsg('Warehouse Code and Name are required.');
      return;
    }

    const res = await onCreateWarehouse({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      city: city.trim(),
      address: address.trim() || `${city}, Pakistan`,
      manager: manager.trim() || 'Warehouse Supervisor',
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to create warehouse.');
      return;
    }

    setIsModalOpen(false);
    setCode('');
    setName('');
    setAddress('');
    setManager('');
  };

  // Calculate stock metrics per warehouse
  const getWarehouseStats = (whId: string) => {
    let totalUnits = 0;
    let totalValuation = 0;
    let distinctItems = 0;

    const itemsStored: Array<{ product: Product; stock: number; valuation: number }> = [];

    products.forEach((p) => {
      const stock = getProductStockAtWarehouse(p.id, whId);
      if (stock > 0) {
        distinctItems++;
        totalUnits += stock;
        const val = stock * p.purchasePrice;
        totalValuation += val;
        itemsStored.push({ product: p, stock, valuation: val });
      }
    });

    return { totalUnits, totalValuation, distinctItems, itemsStored };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 mb-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>Warehouse Topology</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Location Management</h1>
          <p className="text-sm text-slate-500">
            Define storage depots, manage branch warehouses across Pakistan, and view location-specific inventory counts.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-sm shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add Warehouse Location</span>
        </button>
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {warehouses.map((wh) => {
          const stats = getWarehouseStats(wh.id);
          const isExpanded = expandedWhId === wh.id;

          return (
            <div
              key={wh.id}
              className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col justify-between transition-all hover:border-slate-300"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {wh.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{wh.name}</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {wh.city}
                  </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1 mt-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{wh.address}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>Lead: {wh.manager}</span>
                  </div>
                </div>

                {/* KPI stats */}
                <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-center">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-semibold">SKUs Stored</div>
                    <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                      {stats.distinctItems}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-semibold">Total Units</div>
                    <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                      {stats.totalUnits.toLocaleString('en-PK')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-semibold">Valuation</div>
                    <div className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                      {formatPKR(stats.totalValuation)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expand Toggle */}
              <div className="pt-3 mt-3 border-t border-slate-100">
                <button
                  onClick={() => setExpandedWhId(isExpanded ? null : wh.id)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  <span>{isExpanded ? 'Hide Stock Breakdown' : 'View Stored Products Breakdown'}</span>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 max-h-48 overflow-y-auto space-y-1.5">
                    {stats.itemsStored.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">
                        No physical stock currently stored at this depot.
                      </p>
                    ) : (
                      stats.itemsStored.map(({ product, stock, valuation }) => (
                        <div
                          key={product.id}
                          className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <span className="font-mono text-[11px] font-semibold text-slate-800">
                              {product.sku}
                            </span>{' '}
                            <span className="text-slate-600">{product.name}</span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="font-bold text-slate-900">
                              {stock} {product.uom}
                            </span>{' '}
                            <span className="text-slate-400">({formatPKR(valuation)})</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Warehouse Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  New Storage Location
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">Add Warehouse</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WH-FSD-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Warehouse Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Faisalabad Industrial Logistics Hub"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                >
                  {COMMON_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Physical Address</label>
                <input
                  type="text"
                  placeholder="e.g. Plot 44-B, Small Industrial Estate, Faisalabad"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Manager / Supervisor</label>
                <input
                  type="text"
                  placeholder="e.g. M. Arshad Khan"
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]"
                >
                  Save Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
