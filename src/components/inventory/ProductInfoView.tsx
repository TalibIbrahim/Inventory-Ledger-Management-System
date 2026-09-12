import React, { useState } from 'react';
import type { Product, Warehouse } from '../../types/inventory';
import { formatPKR } from '../../utils/currency';
import {
  Package,
  PlusCircle,
  Search,
  Trash2,
  Edit2,
  AlertTriangle,
  X,
  Tag,
  LayoutGrid,
  List,
  PackageCheck,
} from 'lucide-react';

interface ProductInfoViewProps {
  products: Product[];
  warehouses: Warehouse[];
  onCreateProduct: (
    input: Omit<Product, 'id' | 'currentStock' | 'createdAt' | 'updatedAt'> & {
      initialStock?: number;
      initialWarehouseId?: string;
    }
  ) => Promise<{ success: boolean; product?: Product; error?: string }>;
  onUpdateProduct: (
    id: string,
    updates: Partial<Omit<Product, 'id' | 'currentStock' | 'createdAt'>>
  ) => Promise<{ success: boolean; product?: Product; error?: string }>;
  onDeleteProduct: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const COMMON_BRANDS = ['Siemens', 'Packages Ltd', 'Espressif', 'Pakistan Cables', 'Misumi', 'General'];
const COMMON_TYPES = ['Electronics', 'Industrial Hardware', 'Packaging', 'Electrical', 'Raw Materials'];
const COMMON_UOMS = ['pcs', 'kg', 'boxes', 'meters', 'rolls', 'liters', 'packs'];

export const ProductInfoView: React.FC<ProductInfoViewProps> = ({
  products,
  warehouses,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBrand, setFilterBrand] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState(COMMON_BRANDS[0]);
  const [customBrand, setCustomBrand] = useState('');
  const [type, setType] = useState(COMMON_TYPES[0]);
  const [customType, setCustomType] = useState('');
  const [uom, setUom] = useState('pcs');
  const [initialStock, setInitialStock] = useState('0');
  const [initialWarehouseId, setInitialWarehouseId] = useState(warehouses[0]?.id || '');
  const [purchasePrice, setPurchasePrice] = useState('500');
  const [salePrice, setSalePrice] = useState('750');
  const [reorderThreshold, setReorderThreshold] = useState('20');
  const [formError, setFormError] = useState('');

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Delete Confirmation State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Unique Brands & Types from current products
  const uniqueBrands = Array.from(new Set([...COMMON_BRANDS, ...products.map((p) => p.brand)])).sort();
  const uniqueTypes = Array.from(new Set([...COMMON_TYPES, ...products.map((p) => p.type)])).sort();

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const resolvedBrand = brand === 'OTHER' ? customBrand.trim() : brand;
    const resolvedType = type === 'OTHER' ? customType.trim() : type;

    if (!sku.trim() || !name.trim()) {
      setFormError('SKU and Product Name are required.');
      return;
    }

    const res = await onCreateProduct({
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      brand: resolvedBrand || 'General',
      type: resolvedType || 'General',
      uom: uom.trim() || 'pcs',
      initialStock: Math.max(0, Number(initialStock) || 0),
      initialWarehouseId: initialWarehouseId || warehouses[0]?.id,
      purchasePrice: Math.max(0, Number(purchasePrice) || 0),
      salePrice: Math.max(0, Number(salePrice) || 0),
      reorderThreshold: Math.max(0, Number(reorderThreshold) || 0),
    });

    if (!res.success) {
      setFormError(res.error || 'Failed to create product.');
      return;
    }

    // Reset Form
    setIsAddModalOpen(false);
    setSku('');
    setName('');
    setCustomBrand('');
    setCustomType('');
    setInitialStock('0');
    setPurchasePrice('500');
    setSalePrice('750');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const res = await onUpdateProduct(editingProduct.id, {
      name: editingProduct.name,
      brand: editingProduct.brand,
      type: editingProduct.type,
      uom: editingProduct.uom,
      purchasePrice: editingProduct.purchasePrice,
      salePrice: editingProduct.salePrice,
      reorderThreshold: editingProduct.reorderThreshold,
    });

    if (!res.success) {
      alert(res.error || 'Failed to update product.');
      return;
    }

    setEditingProduct(null);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setDeleteError('');

    const res = await onDeleteProduct(productToDelete.id);
    if (!res.success) {
      setDeleteError(res.error || 'Could not delete product.');
      return;
    }

    setProductToDelete(null);
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    if (filterBrand !== 'ALL' && p.brand !== filterBrand) return false;
    if (filterType !== 'ALL' && p.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSku = p.sku.toLowerCase().includes(q);
      const matchesName = p.name.toLowerCase().includes(q);
      const matchesBrand = p.brand.toLowerCase().includes(q);
      if (!matchesSku && !matchesName && !matchesBrand) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & New Product Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60 mb-1.5">
            <Tag className="w-3.5 h-3.5" />
            <span>Master Catalog</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Product Information</h1>
          <p className="text-sm text-slate-500">
            Define and manage products with manufacturer brand, category type, UOM, and standardized rates.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError('');
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and View Switcher Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search SKU, product name, brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
          >
            <option value="ALL">All Brands ({uniqueBrands.length})</option>
            {uniqueBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
          >
            <option value="ALL">All Types</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Grid / Table switch */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/50">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Product Content Display */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">UOM</th>
                  <th className="py-3 px-4 text-right">Purchase (PKR)</th>
                  <th className="py-3 px-4 text-right">Sale Price (PKR)</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-500">No products found</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isLow = p.currentStock <= p.reorderThreshold && p.currentStock > 0;
                    const isOut = p.currentStock <= 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{p.sku}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{p.name}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                            {p.brand}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{p.type}</td>
                        <td className="py-3 px-4 text-center font-medium text-slate-500">{p.uom}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {formatPKR(p.purchasePrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-blue-600">
                          {formatPKR(p.salePrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <span
                            className={`inline-flex items-center gap-1 font-bold ${
                              isOut
                                ? 'text-red-600'
                                : isLow
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {p.currentStock.toLocaleString('en-PK')} {p.uom}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setEditingProduct(p)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit Product"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteError('');
                                setProductToDelete(p);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const isLow = p.currentStock <= p.reorderThreshold && p.currentStock > 0;
            const isOut = p.currentStock <= 0;

            return (
              <div
                key={p.id}
                className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {p.sku}
                      </span>
                      <h3 className="font-bold text-slate-900 mt-1.5 text-sm">{p.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingProduct(p)}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError('');
                          setProductToDelete(p);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 my-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                      Brand: {p.brand}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]">
                      {p.type}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px]">
                      UOM: {p.uom}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Purchase / Sale</div>
                    <div className="font-mono text-slate-700 mt-0.5 font-medium">
                      {formatPKR(p.purchasePrice)} / <span className="text-blue-600">{formatPKR(p.salePrice)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase">Current Stock</div>
                    <div
                      className={`font-mono font-bold mt-0.5 ${
                        isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-700'
                      }`}
                    >
                      {p.currentStock.toLocaleString('en-PK')} {p.uom}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  Master Inventory Item
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">Add New Product</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SKU Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SKU-ELE-05"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3-Phase Industrial Breaker"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Brand & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {COMMON_BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="OTHER">Other (Custom Brand)...</option>
                  </select>
                  {brand === 'OTHER' && (
                    <input
                      type="text"
                      placeholder="Enter custom brand name"
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      className="w-full mt-2 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type / Category</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {COMMON_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="OTHER">Other (Custom Type)...</option>
                  </select>
                  {type === 'OTHER' && (
                    <input
                      type="text"
                      placeholder="Enter custom type"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      className="w-full mt-2 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  )}
                </div>
              </div>

              {/* UOM, Prices, Reorder Threshold */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UOM</label>
                  <select
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  >
                    {COMMON_UOMS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Rate</label>
                  <input
                    type="number"
                    min="0"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Price</label>
                  <input
                    type="number"
                    min="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    value={reorderThreshold}
                    onChange={(e) => setReorderThreshold(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-right"
                  />
                </div>
              </div>

              {/* Initial Stock Quantity & Storage Depot Section */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-indigo-600 text-white">
                      <PackageCheck className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-bold text-slate-900 tracking-tight">
                      Initial On-Hand Stock Quantity
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                    Auto-Post to Ledger
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Initial Quantity ({uom})
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={initialStock}
                        onChange={(e) => setInitialStock(e.target.value)}
                        className="w-full pl-3 pr-14 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-slate-900"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-indigo-600 uppercase pointer-events-none">
                        {uom}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Specify opening count in <span className="font-semibold text-indigo-600">{uom}</span> (e.g. 100).
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Target Storage Warehouse
                    </label>
                    <div className="relative">
                      <select
                        value={initialWarehouseId}
                        onChange={(e) => setInitialWarehouseId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.city})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Warehouse depot where this initial stock will be placed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] transition-all"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  Update Catalog Item
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                  {editingProduct.sku}
                </h3>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={editingProduct.brand}
                    onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <input
                    type="text"
                    value={editingProduct.type}
                    onChange={(e) => setEditingProduct({ ...editingProduct, type: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UOM</label>
                  <input
                    type="text"
                    value={editingProduct.uom}
                    onChange={(e) => setEditingProduct({ ...editingProduct, uom: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Rate</label>
                  <input
                    type="number"
                    value={editingProduct.purchasePrice}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        purchasePrice: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Price</label>
                  <input
                    type="number"
                    value={editingProduct.salePrice}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        salePrice: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-right"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-black/[0.08] shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">Delete Product</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong>{productToDelete.name}</strong> ({productToDelete.sku})?
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
