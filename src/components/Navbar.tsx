import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  History,
  RotateCcw,
  Shield,
  User as UserIcon,
  LogOut,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Building2,
  Wrench,
  Package,
  Users as UsersIcon,
  ClipboardCheck,
  Zap,
  Scissors,
} from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  currentUser: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  onManualSync: () => void;
  onOpenHistory: () => void;
  onOpenReset: () => void;
  onOpenSyncSettings: () => void;
  onOpenSwitchUser: () => void;
  onLogout: () => void;
  ticketPendingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  isOnline,
  isSyncing,
  pendingCount,
  onManualSync,
  onOpenHistory,
  onOpenReset,
  onOpenSyncSettings,
  onOpenSwitchUser,
  onLogout,
  ticketPendingCount,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'مدير النظام (الأدمن)';
      case 'technician':
        return 'فني الصيانة';
      case 'supervisor':
        return `مشرف قسم (${currentUser?.assignedDepartment || 'غير محدد'})`;
      default:
        return 'مستخدم';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Main Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 text-right focus:outline-none group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  نظام إدارة الأصول والصيانة
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  إدارة العهد • بلاغات الأعطال • الصيانة الدورية
                </p>
              </div>
            </button>
          </div>

          {/* Center Navigation Tabs (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              الرئيسية
            </button>
            <button
              onClick={() => setActiveTab('assets')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'assets'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Package className="w-4 h-4" />
              إدارة العهد والأصول
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 relative ${
                activeTab === 'tickets'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Wrench className="w-4 h-4" />
              طلبات الصيانة
              {(currentUser?.role === 'admin' || currentUser?.role === 'technician') && ticketPendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              )}
            </button>

            {/* Periodic Maintenance: Admin and Technician only */}
            {currentUser?.role !== 'supervisor' && (
              <button
                onClick={() => setActiveTab('periodic')}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'periodic'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                الصيانة الدورية
              </button>
            )}

            {/* Inventory Audit: Admin and Technician only */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'technician') && (
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'audit'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                الجرد والمطابقة
              </button>
            )}

            {/* Surgical Sets & Trays */}
            <button
              onClick={() => setActiveTab('surgical')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'surgical'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Scissors className="w-4 h-4 text-indigo-300" />
              الأدوات الجراحية
            </button>

            {/* User Management: Admin only */}
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'users'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <UsersIcon className="w-4 h-4" />
                المستخدمين
              </button>
            )}
          </nav>

          {/* Right Controls: Sync, History, Reset, User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Offline-First / Sync Indicator */}
            <div className="flex items-center gap-1.5">
              <div
                title={isOnline ? 'متصل بالشبكة (Online)' : 'يعمل بدون اتصال (Offline)'}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  isOnline
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                }`}
              >
                {isOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">متصل</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">بدون إنترنت</span>
                  </>
                )}
                {pendingCount > 0 && (
                  <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                    {pendingCount} معلق
                  </span>
                )}
              </div>

              {/* On-Demand Eco-Sync Button for ALL users */}
              <button
                onClick={onOpenSyncSettings}
                title="النظام الاقتصادي والمزامنة السحابية"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 border border-blue-500/30 transition-all text-xs font-bold shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span className="hidden sm:inline">المزامنة السحابية</span>
              </button>
            </div>

            {/* Admin Extra Tools: History & Factory Reset */}
            {currentUser?.role === 'admin' && (
              <div className="hidden sm:flex items-center gap-1.5 border-r border-slate-700/80 pr-2 mr-1">
                {/* History Log Button */}
                <button
                  onClick={onOpenHistory}
                  title="سجل العمليات (History)"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                >
                  <History className="w-4 h-4" />
                </button>

                {/* Factory Data Reset Button */}
                <button
                  onClick={onOpenReset}
                  title="إعادة ضبط المصنع (Data Reset)"
                  className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-800/40 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* User Profile & Switch Account Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-colors text-right"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-xs">
                  {currentUser?.fullName?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-semibold text-white leading-tight">
                    {currentUser?.fullName}
                  </div>
                  <div className="text-[10px] text-blue-400 font-medium">
                    {getRoleLabel(currentUser?.role)}
                  </div>
                </div>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute left-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 p-2 text-right">
                    <div className="p-2.5 border-b border-slate-800 mb-1">
                      <p className="text-xs text-slate-400">الحساب الحالي</p>
                      <p className="text-sm font-bold text-white mt-0.5">
                        {currentUser?.fullName}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50">
                        {getRoleLabel(currentUser?.role)}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenSwitchUser();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 rounded-lg transition-colors text-right"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      تبديل المستخدم / تسجيل دخول آخر
                    </button>

                    {currentUser?.role === 'admin' && (
                      <>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onOpenHistory();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 rounded-lg transition-colors text-right"
                        >
                          <History className="w-4 h-4 text-slate-400" />
                          سجل العمليات (History)
                        </button>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onOpenReset();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-950/50 rounded-lg transition-colors text-right"
                        >
                          <RotateCcw className="w-4 h-4 text-red-400" />
                          إعادة ضبط المصنع (Data Reset)
                        </button>
                      </>
                    )}

                    <div className="border-t border-slate-800 my-1 pt-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-950/40 rounded-lg transition-colors text-right"
                      >
                        <LogOut className="w-4 h-4 text-amber-400" />
                        تسجيل الخروج (العودة للأدمن الافتراضي)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="lg:hidden flex items-center justify-around py-2 border-t border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400'
            }`}
          >
            الرئيسية
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
              activeTab === 'assets' ? 'bg-blue-600 text-white' : 'text-slate-400'
            }`}
          >
            العهد والأصول
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap relative ${
              activeTab === 'tickets' ? 'bg-blue-600 text-white' : 'text-slate-400'
            }`}
          >
            طلبات الصيانة
            {(currentUser?.role === 'admin' || currentUser?.role === 'technician') && ticketPendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-1" />
            )}
          </button>
          {currentUser?.role !== 'supervisor' && (
            <button
              onClick={() => setActiveTab('periodic')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
                activeTab === 'periodic' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              الصيانة الدورية
            </button>
          )}
          {(currentUser?.role === 'admin' || currentUser?.role === 'technician') && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
                activeTab === 'audit' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              الجرد والمطابقة
            </button>
          )}
          <button
            onClick={() => setActiveTab('surgical')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
              activeTab === 'surgical' ? 'bg-blue-600 text-white' : 'text-slate-400'
            }`}
          >
            الأدوات الجراحية
          </button>
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
                activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              المستخدمين
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
