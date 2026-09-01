import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  LayoutDashboard,
  Boxes,
  Wrench,
  Calendar,
  Users,
  History,
  Settings,
  RefreshCw,
  RotateCcw,
  Cloud,
  CloudOff,
  UserCheck,
  AlertOctagon,
  Scissors,
} from 'lucide-react';
import { Asset, MaintenanceTicket, PeriodicMaintenanceRecord, User } from './types';
import { StorageService } from './services/storage';
import { FirestoreSyncService } from './services/firestoreSync';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { AssetsView } from './components/AssetsView';
import { MaintenanceTicketsView } from './components/MaintenanceTicketsView';
import { PeriodicMaintenanceView } from './components/PeriodicMaintenanceView';
import { AuditView } from './components/AuditView';
import { SurgicalSetsView } from './components/SurgicalSetsView';
import { UserManagementView } from './components/UserManagementView';
import { SyncSettingsModal } from './components/SyncSettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { FactoryResetModal } from './components/FactoryResetModal';

type ActiveView = 'dashboard' | 'assets' | 'tickets' | 'periodic' | 'audit' | 'surgical' | 'users';

export default function App() {
  // Global State
  const [currentUser, setCurrentUser] = useState<User | null>(StorageService.getCurrentUser());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [periodicRecords, setPeriodicRecords] = useState<PeriodicMaintenanceRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Active Navigation View
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  // Modal Triggers
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);

  // Cross-view action state (e.g. create ticket for specific asset)
  const [ticketTargetAsset, setTicketTargetAsset] = useState<Asset | null>(null);

  // Reload all data from StorageService
  const reloadData = useCallback(() => {
    setAssets(StorageService.getAssets());
    setTickets(StorageService.getTickets());
    setPeriodicRecords(StorageService.getPeriodicRecords());
    setUsers(StorageService.getUsers());
    setPendingSyncCount(StorageService.getPendingSyncCount());
    setCurrentUser(StorageService.getCurrentUser());
  }, []);

  // Initial load & network listeners
  useEffect(() => {
    reloadData();

    // Start real-time cloud sync across all devices
    FirestoreSyncService.initRealtimeListeners(() => {
      reloadData();
    });

    const handleOnline = () => {
      setIsOnline(true);
      // Trigger auto sync if configured
      const config = StorageService.getSyncConfig();
      if (config.autoSyncEnabled && config.googleSheetWebhookUrl) {
        setIsSyncing(true);
        StorageService.triggerManualSync()
          .then(() => reloadData())
          .catch((e) => console.log('Auto-sync background result:', e))
          .finally(() => setIsSyncing(false));
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [reloadData]);

  // Navigate directly to create ticket for an asset
  const handleCreateTicketForAsset = (asset: Asset) => {
    setTicketTargetAsset(asset);
    setActiveView('tickets');
  };

  // Pending ticket notification count (Only for Admin + Maintenance Technician)
  const isStaffForTicketAlerts = currentUser?.role === 'admin' || currentUser?.role === 'technician';
  const pendingTicketsCount = isStaffForTicketAlerts
    ? tickets.filter((t) => t.status === 'معلق').length
    : 0;

  // 🚪 If no user is logged in, display the Login View as the first screen
  if (!currentUser) {
    return (
      <LoginView
        onLogin={(user) => {
          setCurrentUser(user);
          reloadData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-['Tajawal',sans-serif] text-right" dir="rtl">
      {/* Top Main Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeView}
        setActiveTab={(tab: string) => setActiveView(tab as ActiveView)}
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingSyncCount}
        lastSyncTime={StorageService.getSyncConfig().lastSyncTimestamp}
        onManualSync={() => {
          setIsSyncing(true);
          StorageService.triggerManualSync()
            .then((res) => {
              reloadData();
              alert(res.message);
            })
            .catch((err) => {
              alert(err?.message || 'فشلت المزامنة اليدوية');
            })
            .finally(() => setIsSyncing(false));
        }}
        onOpenHistory={() => setShowHistoryModal(true)}
        onOpenReset={() => setShowFactoryResetModal(true)}
        onOpenSyncSettings={() => setShowSyncModal(true)}
        onLogout={() => {
          StorageService.logout();
          reloadData();
        }}
        ticketPendingCount={pendingTicketsCount}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Role Notice for Supervisor */}
        {currentUser?.role === 'supervisor' && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3.5 flex items-center gap-2 text-xs text-purple-900 shadow-xs">
            <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              أنت مسجل كـ <strong>مشرف قسم</strong> على: <strong>{currentUser.assignedDepartment || 'غير محدد'}</strong> (عرض وتقديم بلاغات قسمك فقط).
            </span>
          </div>
        )}

        {/* Primary View Switcher Navigation Pills */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-xs flex items-center gap-1 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
              activeView === 'dashboard'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            لوحة المؤشرات والإحصائيات
          </button>

          <button
            onClick={() => setActiveView('assets')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
              activeView === 'assets'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Boxes className="w-4 h-4" />
            سجل الأصول والعهد ({assets.length})
          </button>

          <button
            onClick={() => setActiveView('tickets')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
              activeView === 'tickets'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>طلبات الصيانة وبلاغات الأعطال</span>
            {pendingTicketsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-bold animate-pulse">
                {pendingTicketsCount} معلق
              </span>
            )}
          </button>

          {/* Periodic Maintenance (Admin & Tech only) */}
          {currentUser?.role !== 'supervisor' && (
            <button
              onClick={() => setActiveView('periodic')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                activeView === 'periodic'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              الصيانة الدورية والوقائية
            </button>
          )}

          {/* Inventory Audit (Admin & Tech only) */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'technician') && (
            <button
              onClick={() => setActiveView('audit')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                activeView === 'audit'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-4 h-4 text-emerald-400" />
              الجرد والمطابقة
            </button>
          )}

          {/* Surgical Sets & Instruments */}
          <button
            onClick={() => setActiveView('surgical')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
              activeView === 'surgical'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Scissors className="w-4 h-4 text-indigo-400" />
            <span>السيتات والأدوات الجراحية</span>
          </button>

          {/* User Management (Admin only) */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setActiveView('users')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                activeView === 'users'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              إدارة المستخدمين ({users.length})
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* ACTIVE VIEW RENDERING */}
        {/* ========================================================================= */}

        {/* 1. DASHBOARD VIEW */}
        {activeView === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            assets={assets}
            tickets={tickets}
            users={users}
            periodicRecords={periodicRecords}
            historyLogs={StorageService.getHistory()}
            onNavigate={(view) => setActiveView(view as ActiveView)}
            onOpenNewTicket={() => {
              setTicketTargetAsset(null);
              setActiveView('tickets');
            }}
            onOpenNewAsset={() => setActiveView('assets')}
            onOpenNewUser={() => setActiveView('users')}
            onOpenImport={() => setActiveView('assets')}
            onManualSync={() => {
              setIsSyncing(true);
              StorageService.triggerManualSync()
                .then(() => reloadData())
                .finally(() => setIsSyncing(false));
            }}
            isSyncing={isSyncing}
          />
        )}

        {/* 2. ASSET MANAGEMENT VIEW */}
        {activeView === 'assets' && (
          <AssetsView
            currentUser={currentUser}
            assets={assets}
            onRefresh={reloadData}
            onOpenNewTicketForAsset={handleCreateTicketForAsset}
          />
        )}

        {/* 3. MAINTENANCE TICKETS VIEW */}
        {activeView === 'tickets' && (
          <MaintenanceTicketsView
            currentUser={currentUser}
            tickets={tickets}
            assets={assets}
            onRefresh={reloadData}
            openCreateWithAsset={ticketTargetAsset}
            onClearCreateAsset={() => setTicketTargetAsset(null)}
          />
        )}

        {/* 4. PERIODIC MAINTENANCE VIEW */}
        {activeView === 'periodic' && currentUser?.role !== 'supervisor' && (
          <PeriodicMaintenanceView
            currentUser={currentUser}
            assets={assets}
            periodicRecords={periodicRecords}
            onRefresh={reloadData}
          />
        )}

        {/* 5. INVENTORY AUDIT & RECONCILIATION VIEW (Admin & Tech only) */}
        {activeView === 'audit' && (currentUser?.role === 'admin' || currentUser?.role === 'technician') && (
          <AuditView
            currentUser={currentUser}
            assets={assets}
            onRefresh={reloadData}
          />
        )}

        {/* 6. SURGICAL SETS & INSTRUMENTS VIEW */}
        {activeView === 'surgical' && (
          <SurgicalSetsView
            currentUser={currentUser}
            onRefresh={reloadData}
          />
        )}

        {/* 7. USER MANAGEMENT VIEW */}
        {activeView === 'users' && currentUser?.role === 'admin' && (
          <UserManagementView
            currentUser={currentUser}
            users={users}
            assets={assets}
            onRefresh={reloadData}
          />
        )}
      </main>

      {/* ========================================================================= */}
      {/* GLOBAL MODALS */}
      {/* ========================================================================= */}

      {/* Sync Settings Modal */}
      {showSyncModal && (
        <SyncSettingsModal
          currentUser={currentUser}
          onClose={() => setShowSyncModal(false)}
          onRefresh={reloadData}
        />
      )}

      {/* History Log Modal (Admin only) */}
      {showHistoryModal && currentUser?.role === 'admin' && (
        <HistoryModal onClose={() => setShowHistoryModal(false)} />
      )}

      {/* Factory Reset Modal (Admin only) */}
      {showFactoryResetModal && (
        <FactoryResetModal
          onClose={() => setShowFactoryResetModal(false)}
          onResetComplete={() => {
            setShowFactoryResetModal(false);
            reloadData();
            setActiveView('dashboard');
          }}
        />
      )}
    </div>
  );
}
