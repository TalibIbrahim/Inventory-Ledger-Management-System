import React, { useState } from 'react';
import { PasswordPromptModal } from './auth/PasswordPromptModal';
import {
  Boxes,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Package,
  FileSpreadsheet,
  Receipt,
  BarChart3,
  Tag,
  Sliders,
  Scale,
  Building2,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export type MainSection = 'purchase' | 'sales' | 'inventory' | 'settings';

export type SubOption =
  // Purchase
  | 'purchase_voucher'
  | 'purchase_reports'
  // Sales
  | 'sale_voucher'
  | 'sale_return'
  | 'sales_reports'
  // Inventory
  | 'product_info'
  | 'inventory_voucher'
  | 'inventory_reports'
  | 'location';

interface HeaderProps {
  activeSection: MainSection;
  activeSubOption: SubOption;
  onSelectSection: (section: MainSection) => void;
  onSelectSubOption: (subOption: SubOption) => void;
  onClearData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  activeSubOption,
  onSelectSection,
  onSelectSubOption,
  onClearData,
}) => {
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error' | 'offline'>('offline');

  React.useEffect(() => {
    if (window.electronAPI && window.electronAPI.onSyncStatus) {
      window.electronAPI.onSyncStatus((status) => {
        setSyncStatus(status);
      });
    }
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar: Brand & Section Switcher */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-4 border-b border-slate-100">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-600/15 border border-white/40 ring-1 ring-black/5 flex-shrink-0">
              <Boxes className="w-5 h-5 text-white stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  Ledger<span className="text-emerald-600 font-extrabold">ERP</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  PKR Ledger System
                </span>
                
                {/* Sync Status Badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  syncStatus === 'syncing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  syncStatus === 'synced' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  syncStatus === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {syncStatus === 'syncing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                  {syncStatus === 'synced' && <Cloud className="w-3 h-3" />}
                  {syncStatus === 'error' && <AlertCircle className="w-3 h-3" />}
                  {syncStatus === 'offline' && <CloudOff className="w-3 h-3" />}
                  <span className="capitalize">{syncStatus}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Purchase • Sales • Inventory Management (Pakistan Edition)
              </p>
            </div>
          </div>

          {/* Apple-style Primary Section Segmented Control */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-inner">
              <button
                onClick={() => {
                  onSelectSection('purchase');
                  onSelectSubOption('purchase_voucher');
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeSection === 'purchase'
                    ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>1. Purchase</span>
              </button>

              <button
                onClick={() => {
                  onSelectSection('sales');
                  onSelectSubOption('sale_voucher');
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeSection === 'sales'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>2. Sales</span>
              </button>

              <button
                onClick={() => {
                  onSelectSection('inventory');
                  onSelectSubOption('product_info');
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeSection === 'inventory'
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>3. Inventory</span>
              </button>
            </div>

            <button
              onClick={() => onSelectSection('settings')}
              title="Application Settings"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeSection === 'settings'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 bg-white hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              onClick={() => setIsClearModalOpen(true)}
              title="Clear all stored products, vouchers, and ledger records"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-slate-200 shadow-2xs transition-all active:scale-[0.98]"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Clear All Data</span>
            </button>
          </div>
        </div>

        <PasswordPromptModal 
          isOpen={isClearModalOpen}
          onClose={() => setIsClearModalOpen(false)}
          onSuccess={() => {
            onClearData();
            setIsClearModalOpen(false);
          }}
          title="Clear Database"
          description="Are you absolutely sure? This will wipe all data. Enter your master password to authorize this action."
        />

        {/* Bottom bar: Sub-Options Navigator */}
        <div className="py-2.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {activeSection === 'purchase' && (
            <>
              <button
                onClick={() => onSelectSubOption('purchase_voucher')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeSubOption === 'purchase_voucher'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Purchase Voucher (Inventory Input)</span>
              </button>

              <button
                onClick={() => onSelectSubOption('purchase_reports')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeSubOption === 'purchase_reports'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Purchase Reports</span>
              </button>
            </>
          )}

          {activeSection === 'sales' && (
            <>
              <button
                onClick={() => onSelectSubOption('sale_voucher')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeSubOption === 'sale_voucher'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Sale Voucher (Inventory Out)</span>
              </button>

              <button
                onClick={() => onSelectSubOption('sale_return')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeSubOption === 'sale_return'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sale Return (Customer Returns)</span>
              </button>

              <button
                onClick={() => onSelectSubOption('sales_reports')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeSubOption === 'sales_reports'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Sales Reports</span>
              </button>
            </>
          )}

          {activeSection === 'inventory' && (
            <>
              <button
                onClick={() => onSelectSubOption('product_info')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeSubOption === 'product_info'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Product Information</span>
              </button>

              <button
                onClick={() => onSelectSubOption('inventory_voucher')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeSubOption === 'inventory_voucher'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Vouchers (Opening Stock & Adjustment)</span>
              </button>

              <button
                onClick={() => onSelectSubOption('inventory_reports')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeSubOption === 'inventory_reports'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Reports (Balance & Ledger)</span>
              </button>

              <button
                onClick={() => onSelectSubOption('location')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeSubOption === 'location'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Location (Warehouses)</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
