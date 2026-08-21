import React from 'react';
import {
  Package,
  Wrench,
  Building2,
  Users as UsersIcon,
  AlertOctagon,
  Clock,
  CheckCircle2,
  PlusCircle,
  ArrowLeft,
  FileSpreadsheet,
  RefreshCw,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { Asset, MaintenanceTicket, User, HistoryLog, PeriodicMaintenanceRecord } from '../types';

interface DashboardViewProps {
  currentUser: User | null;
  assets?: Asset[];
  tickets?: MaintenanceTicket[];
  users?: User[];
  periodicRecords?: PeriodicMaintenanceRecord[];
  historyLogs?: HistoryLog[];
  onNavigate: (tab: string) => void;
  onOpenNewTicket?: () => void;
  onOpenNewAsset?: () => void;
  onOpenNewUser?: () => void;
  onOpenImport?: () => void;
  onManualSync?: () => void;
  isSyncing?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  assets = [],
  tickets = [],
  users = [],
  historyLogs = [],
  onNavigate,
  onOpenNewTicket,
  onOpenNewAsset,
  onOpenNewUser,
  onOpenImport,
  onManualSync,
  isSyncing = false,
}) => {
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeTickets = Array.isArray(tickets) ? tickets : [];
  const safeUsers = Array.isArray(users) ? users : [];

  // Filter accessible assets if user is supervisor (Strictly supervisor's assigned department)
  const accessibleAssets =
    currentUser?.role === 'supervisor'
      ? safeAssets.filter(
          (a) =>
            currentUser.assignedDepartment &&
            (a.mainDepartment || '').trim().toLowerCase() === currentUser.assignedDepartment.trim().toLowerCase()
        )
      : safeAssets;

  // Filter accessible tickets if user is supervisor (Strictly supervisor's assigned department)
  const accessibleTickets =
    currentUser?.role === 'supervisor'
      ? safeTickets.filter((t) => {
          const userDept = (currentUser.assignedDepartment || '').trim().toLowerCase();
          if (!userDept) return false;
          const ticketDept = (t.mainDepartment || '').trim().toLowerCase();
          const matchedAsset = safeAssets.find(
            (a) => a.id === t.assetId || (a.customId && a.customId === t.customId)
          );
          const assetDept = (matchedAsset?.mainDepartment || '').trim().toLowerCase();
          return ticketDept === userDept || assetDept === userDept;
        })
      : safeTickets;

  // Compute departments count
  const uniqueDepartments = Array.from(
    new Set(accessibleAssets.map((a) => a.mainDepartment).filter(Boolean))
  );

  // Compute tickets counts based on accessible tickets
  const pendingTickets = accessibleTickets.filter((t) => t.status === 'معلق');
  const inProgressTickets = accessibleTickets.filter((t) => t.status === 'قيد الصيانة');
  const completedTickets = accessibleTickets.filter((t) => t.status === 'تم الصيانة');

  const activeUsersCount = safeUsers.filter((u) => u.isActive !== false).length;

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              {currentUser?.role === 'admin'
                ? 'لوحة تحكم الإدارة الشاملة'
                : currentUser?.role === 'technician'
                ? 'لوحة مهام الفني'
                : `مشرف قسم: ${currentUser?.assignedDepartment || 'القسم'}`}
            </span>
            <span className="text-xs text-slate-400">
              {new Date().toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            مرحباً بك، {currentUser?.fullName} 👋
          </h2>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            نظام متكامل لإدارة العهد والأصول، تتبع دورة بلاغات الصيانة، وجدولة الصيانة الوقائية مع دعم كامل للعمل بدون إنترنت.
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onOpenNewTicket}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <AlertOctagon className="w-4 h-4" />
            تقديم بلاغ عطل
          </button>

          {currentUser?.role === 'admin' && (
            <>
              <button
                onClick={onOpenNewAsset}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <PlusCircle className="w-4 h-4" />
                إضافة أصل جديد
              </button>
              <button
                onClick={onOpenImport}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                title="استيراد وتصدير Excel / CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={onManualSync}
            disabled={isSyncing}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="مزامنة فورية وتحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Urgent Pending Tickets Notice (Red notification) - Admin & Technician only */}
      {(currentUser?.role === 'admin' || currentUser?.role === 'technician') && pendingTickets.length > 0 && (
        <div className="bg-red-50 border-r-4 border-red-500 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0 animate-bounce">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-900">
                يوجد ({pendingTickets.length}) بلاغ صيانة معلق بحاجة للاستلام الفوري!
              </h4>
              <p className="text-xs text-red-700 mt-0.5">
                يرجى من الفنيين الاطلاع على تفاصيل البلاغات والضغط على "تم استلام الشكوى" لبدء أعمال الصيانة.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('tickets')}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold whitespace-nowrap transition-colors"
          >
            عرض البلاغات المعلقة
          </button>
        </div>
      )}

      {/* Statistics Cards (إحصائيات النظام) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            إحصائيات النظام العامة
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Total Departments */}
          <div
            onClick={() => onNavigate('assets')}
            className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">إجمالي الأقسام</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {uniqueDepartments.length}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">قسم رئيسي</span>
            </div>
          </div>

          {/* Total Assets */}
          <div
            onClick={() => onNavigate('assets')}
            className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">إجمالي الأصول</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {accessibleAssets.length}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">جهاز مسجل</span>
            </div>
          </div>

          {/* Pending Maintenance Tickets (Red Badge) */}
          <div
            onClick={() => onNavigate('tickets')}
            className="bg-white p-4 rounded-xl border border-red-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-1 bg-red-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-700">بلاغات صيانة نشطة</span>
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertOctagon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-red-600">
                {pendingTickets.length}
              </span>
              <span className="text-[11px] text-red-500 font-semibold">طلب معلق</span>
            </div>
          </div>

          {/* In Progress Tickets (Yellow Badge) */}
          <div
            onClick={() => onNavigate('tickets')}
            className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700">قيد الصيانة</span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600">
                {inProgressTickets.length}
              </span>
              <span className="text-[11px] text-amber-500 font-semibold">جاري إصلاحه</span>
            </div>
          </div>

          {/* Completed Maintenance Tickets (Green Badge) */}
          <div
            onClick={() => onNavigate('tickets')}
            className="col-span-2 sm:col-span-1 bg-white p-4 rounded-xl border border-emerald-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700">تم الصيانة</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">
                {completedTickets.length}
              </span>
              <span className="text-[11px] text-emerald-500 font-semibold">مكتمل</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Sections Cards (الأقسام الرئيسية) */}
      <div>
        <h3 className="text-base font-bold text-slate-800 mb-3">الأقسام والخدمات الرئيسية</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: إدارة العهد والأصول */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Package className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                إدارة العهد والأصول
              </h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                تصفح الأجهزة حسب الأقسام والأقسام الفرعية، استيراد وتصدير إكسيل، تسجيل التوابع، وربط الصور المجمعة بالـ ID.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                {accessibleAssets.length} أصل مسجل
              </span>
              <button
                onClick={() => onNavigate('assets')}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                الدخول للأصول
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: طلبات الصيانة وبلاغات الأعطال */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition-colors">
                <Wrench className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                طلبات الصيانة وبلاغات الأعطال
              </h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                دورة حياة الشكوى الكاملة: تقديم البلاغ، استلام الفني، تقارير القطع، إتمام الإصلاح، وتصدير تقرير A4 PDF رسمي.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                {pendingTickets.length + inProgressTickets.length} بلاغ نشط
              </span>
              <button
                onClick={() => onNavigate('tickets')}
                className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
              >
                متابعة البلاغات
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: متابعة الصيانة الدورية */}
          {currentUser?.role !== 'supervisor' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Building2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                  متابعة الصيانة الدورية
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  جداول وقائية مخصصة لأنظمة التكييف، عدادات الزيوت والفلاتر، وتغيير بطاريات الأجهزة الطبية والمعدات.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  صيانة وقائية
                </span>
                <button
                  onClick={() => onNavigate('periodic')}
                  className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
                >
                  الجداول الدورية
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Card 4: إدارة المستخدمين (Admin only) */}
          {currentUser?.role === 'admin' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <UsersIcon className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  إدارة المستخدمين والصلاحيات
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  إدارة حسابات الأدمن، الفنيين، ومشرفي الأقسام وتعيين الأقسام الخاصة بكل مشرف والتحكم الكامل بالصلاحيات.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  {activeUsersCount} مستخدم نشط
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onOpenNewUser}
                    className="p-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold"
                    title="إضافة مستخدم جديد"
                  >
                    + إضافة
                  </button>
                  <button
                    onClick={() => onNavigate('users')}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    إدارة
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Maintenance Tickets & Activity History (History is Admin-Only) */}
      <div className={`grid grid-cols-1 ${currentUser?.role === 'admin' ? 'lg:grid-cols-2' : ''} gap-6`}>
        {/* Latest Maintenance Requests */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-500" />
              أحدث بلاغات الصيانة
            </h4>
            <button
              onClick={() => onNavigate('tickets')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              عرض الكل ({accessibleTickets.length})
            </button>
          </div>

          {accessibleTickets.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">لا توجد بلاغات صيانة مسجلة حالياً</p>
              <button
                onClick={onOpenNewTicket}
                className="mt-3 text-xs font-bold text-blue-600 hover:underline"
              >
                + تقديم أول بلاغ عطل
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {accessibleTickets.slice(0, 4).map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => onNavigate('tickets')}
                  className="p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/70 transition-all cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        ticket.status === 'معلق'
                          ? 'bg-red-500 animate-pulse'
                          : ticket.status === 'قيد الصيانة'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {ticket.deviceName}
                        </span>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {ticket.customId}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {ticket.mainDepartment} • {ticket.complaintDescription}
                      </p>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ticket.status === 'معلق'
                          ? 'bg-red-100 text-red-700'
                          : ticket.status === 'قيد الصيانة'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {ticket.status}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{ticket.complaintDate}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent System Activity Logs (Admin Only) */}
        {currentUser?.role === 'admin' && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                سجل العمليات الأخير
              </h4>
              <button
                onClick={() => onNavigate('history')}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                عرض سجل الـ History الكامل
              </button>
            </div>

            {historyLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">لا توجد عمليات مسجلة في السجل بعد</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {historyLogs.slice(0, 4).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50/60 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 truncate">{log.action}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{log.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 truncate">{log.details}</p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>بواسطة: {log.performedBy}</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700 font-medium">
                        {log.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
