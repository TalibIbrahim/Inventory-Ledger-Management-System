import React, { useState, useEffect } from 'react';
import { PasswordPromptModal } from './auth/PasswordPromptModal';
import { CURRENT_APP_VERSION } from './ChangelogModal';
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
  AlertCircle,
  Sparkles,
  Users,
  Calendar,
  Download,
  Trash2,
} from 'lucide-react';

export type MainSection = 'purchase' | 'sales' | 'inventory' | 'settings' | 'trash';

export type SubOption =
  // Purchase
  | 'purchase_voucher'
  | 'purchase_reports'
  // Sales
  | 'sale_voucher'
  | 'customer_accounts'
  | 'monthly_sales'
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
  onOpenChangelog?: () => void;
  trashCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  activeSubOption,
  onSelectSection,
  onSelectSubOption,
  onClearData,
  onOpenChangelog,
  trashCount = 0,
}) => {
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error' | 'offline'>('offline');
  const [syncDetail, setSyncDetail] = useState('Cloud sync is not set up. Add your MongoDB URI in Settings.');
  const [updateStatus, setUpdateStatus] = useState<{
    status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
    version?: string;
    percent?: number;
    message?: string;
  }>({ status: 'idle' });

  useEffect(() => {
    if (window.electronAPI) {
      if (window.electronAPI.getSyncStatus) {
        window.electronAPI.getSyncStatus().then((status) => {
          setSyncStatus(status);
        });
      }
      if (window.electronAPI.onSyncStatus) {
        window.electronAPI.onSyncStatus((status) => {
          setSyncStatus(status);
        });
      }
      const describe = (info: { status: string; lastSyncedAt: string | null; lastError: string | null; configured: boolean }) => {
        if (!info.configured) return 'Cloud sync is not set up. Add your MongoDB URI in Settings.';
        if (info.status === 'error') return `Sync problem: ${info.lastError ?? 'unknown error'}. Your data is safe locally and will sync when the connection is back.`;
        return info.lastSyncedAt ? `Last synced ${new Date(info.lastSyncedAt).toLocaleString()}` : 'Waiting for first sync…';
      };
      window.electronAPI.getSyncInfo?.().then((info) => setSyncDetail(describe(info)));
      window.electronAPI.onSyncInfo?.((info) => setSyncDetail(describe(info)));
      // Listen for auto-updater events
      if (window.electronAPI.onUpdateStatus) {
        window.electronAPI.onUpdateStatus((data) => {
          setUpdateStatus({
            status: data.status === 'not-available' ? 'idle' : data.status as any,
            version: data.version,
            percent: data.percent,
            message: data.message,
          });
        });
      }
    }
  }, []);

  return (
    <>
      {/* ── Auto-Update Banner ───────────────────────────────────────── */}
      {updateStatus.status === 'available' && (
        <div className="sticky top-0 z-50 bg-indigo-600 text-white px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2">
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>Update v{updateStatus.version} found! Starting download…</span>
        </div>
      )}
      {updateStatus.status === 'downloading' && (
        <div className="sticky top-0 z-50 bg-blue-600 text-white px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2">
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>Downloading update v{updateStatus.version}… {updateStatus.percent ?? 0}%</span>
          <div className="w-32 h-1.5 bg-blue-400/40 rounded-full overflow-hidden ml-2">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${updateStatus.percent ?? 0}%` }}
            />
          </div>
        </div>
      )}
      {updateStatus.status === 'ready' && (
        <div className="sticky top-0 z-50 bg-emerald-600 text-white px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-3 shadow-md animate-in slide-in-from-top duration-200">
          <Download className="w-4 h-4" />
          <span>Update v{updateStatus.version} is ready!</span>
          <button
            onClick={() => window.electronAPI?.installUpdate()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-white text-emerald-800 font-bold text-xs shadow-sm hover:bg-emerald-50 active:scale-[0.97] transition-all cursor-pointer ring-1 ring-emerald-700/20"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
            Restart To Update
          </button>
        </div>
      )}
      {updateStatus.status === 'error' && updateStatus.message && (
        <div className="sticky top-0 z-50 bg-slate-800 text-white px-4 py-1.5 text-center text-xs font-medium flex items-center justify-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Update Notice: {updateStatus.message}</span>
          <button
            onClick={() => setUpdateStatus({ status: 'idle' })}
            className="ml-2 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

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
                <span title={syncDetail} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-default ${
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

                {/* What's New v1.0.6 Badge Button */}
                {onOpenChangelog && (
                  <button
                    onClick={onOpenChangelog}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-all cursor-pointer shadow-2xs"
                    title={`What's New in v${CURRENT_APP_VERSION}`}
                  >
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    <span>v{CURRENT_APP_VERSION} What's New</span>
                  </button>
                )}
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
              onClick={() => onSelectSection('trash')}
              title="Vouchers moved to Trash — restore or delete forever"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeSection === 'trash'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 bg-white hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Trash</span>
              {trashCount > 0 && (
                <span className={`px-1.5 rounded-full text-[10px] font-bold ${activeSection === 'trash' ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                  {trashCount}
                </span>
              )}
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeSubOption === 'sale_voucher'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Sale Voucher (Inventory Out)</span>
              </button>

              <button
                onClick={() => onSelectSubOption('customer_accounts')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeSubOption === 'customer_accounts'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Customer Accounts (Credit & Due)</span>
              </button>

              <button
                onClick={() => onSelectSubOption('monthly_sales')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeSubOption === 'monthly_sales'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Monthly Sales Report (Graph & Print)</span>
              </button>

              <button
                onClick={() => onSelectSubOption('sale_return')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeSubOption === 'sales_reports'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Sales Analytics & Margins</span>
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
    </>
  );
};
