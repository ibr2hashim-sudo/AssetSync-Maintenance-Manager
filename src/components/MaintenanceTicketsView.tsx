import React, { useState, useMemo } from 'react';
import {
  Wrench,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  FileText,
  Download,
  Calendar,
  Building2,
  X,
  User as UserIcon,
  Check,
  Printer,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Asset, MaintenanceTicket, TicketStatus, User } from '../types';
import { StorageService } from '../services/storage';
import { PDFReportGenerator } from '../utils/pdfExport';
import { MaintenanceReportTemplate } from './MaintenanceReportTemplate';

interface MaintenanceTicketsViewProps {
  currentUser: User | null;
  tickets?: MaintenanceTicket[];
  assets?: Asset[];
  onRefresh: () => void;
  openCreateWithAsset?: Asset | null;
  onClearCreateAsset?: () => void;
}

export const MaintenanceTicketsView: React.FC<MaintenanceTicketsViewProps> = ({
  currentUser,
  tickets = [],
  assets = [],
  onRefresh,
  openCreateWithAsset,
  onClearCreateAsset,
}) => {
  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'all' | 'معلق' | 'قيد الصيانة' | 'تم الصيانة'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(!!openCreateWithAsset);
  const [selectedAssetForTicket, setSelectedAssetForTicket] = useState<Asset | null>(openCreateWithAsset || null);

  // Technical Operations & Completion Modals
  const [activeTechOpsTicket, setActiveTechOpsTicket] = useState<MaintenanceTicket | null>(null);
  const [activeCompleteTicket, setActiveCompleteTicket] = useState<MaintenanceTicket | null>(null);
  const [previewTicketForPDF, setPreviewTicketForPDF] = useState<MaintenanceTicket | null>(null);

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const safeTickets = useMemo(() => (Array.isArray(tickets) ? tickets : []), [tickets]);
  const safeAssets = useMemo(() => (Array.isArray(assets) ? assets : []), [assets]);

  // Supervisor department filter for tickets
  const accessibleTickets = useMemo(() => {
    if (currentUser?.role === 'supervisor' && currentUser?.assignedDepartment) {
      return safeTickets.filter((t) => t.mainDepartment && t.mainDepartment.trim() === currentUser.assignedDepartment?.trim());
    }
    return safeTickets;
  }, [safeTickets, currentUser]);

  // Accessible assets for ticket creation
  const accessibleAssets = useMemo(() => {
    if (currentUser?.role === 'supervisor' && currentUser?.assignedDepartment) {
      return safeAssets.filter((a) => a.mainDepartment && a.mainDepartment.trim() === currentUser.assignedDepartment?.trim());
    }
    return safeAssets;
  }, [safeAssets, currentUser]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    let list = accessibleTickets;

    if (activeTab !== 'all') {
      list = list.filter((t) => t.status === activeTab);
    }

    if (selectedDeptFilter !== 'all') {
      list = list.filter((t) => t.mainDepartment.trim() === selectedDeptFilter.trim());
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(q) ||
          t.deviceName.toLowerCase().includes(q) ||
          t.customId.toLowerCase().includes(q) ||
          t.mainDepartment.toLowerCase().includes(q) ||
          t.complaintDescription.toLowerCase().includes(q)
      );
    }

    return list;
  }, [accessibleTickets, activeTab, selectedDeptFilter, searchTerm]);

  // Unique departments for filter
  const departmentsList = useMemo(() => {
    return Array.from(new Set(accessibleTickets.map((t) => t.mainDepartment).filter(Boolean)));
  }, [accessibleTickets]);

  // Count badges
  const pendingCount = accessibleTickets.filter((t) => t.status === 'معلق').length;
  const inProgressCount = accessibleTickets.filter((t) => t.status === 'قيد الصيانة').length;
  const completedCount = accessibleTickets.filter((t) => t.status === 'تم الصيانة').length;

  // Handle Receive Ticket Action
  const handleReceiveTicket = (ticket: MaintenanceTicket) => {
    const techName = currentUser?.fullName || 'فني الصيانة';
    try {
      StorageService.receiveTicket(ticket.id, techName);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'تعذر استلام البلاغ');
    }
  };

  // Handle PDF Export
  const handleExportPDF = async (ticket: MaintenanceTicket) => {
    setPreviewTicketForPDF(ticket);
    setIsExportingPDF(true);

    setTimeout(async () => {
      try {
        await PDFReportGenerator.exportTicketToPDF(ticket, 'pdf-export-container');
      } catch (err: any) {
        alert(`فشل تصدير ملف الـ PDF: ${err?.message || 'خطأ في التصدير'}`);
      } finally {
        setIsExportingPDF(false);
      }
    }, 150);
  };

  return (
    <div className="space-y-6">
      {/* Hidden Container for PDF Rendering */}
      {previewTicketForPDF && (
        <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
          <MaintenanceReportTemplate ticket={previewTicketForPDF} id="pdf-export-container" />
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              طلبات الصيانة وبلاغات الأعطال 🔧
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            دورة حياة الشكوى: تقديم البلاغ • استلام الفني • التقارير الفنية وقطع الغيار • إتمام الإصلاح وتصدير تقرير A4 PDF.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedAssetForTicket(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          تقديم بلاغ صيانة جديد
        </button>
      </div>

      {/* Status Filter Tabs (Red, Yellow, Green notices) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={() => setActiveTab('all')}
          className={`p-3 rounded-xl border text-xs font-bold transition-all text-right flex items-center justify-between ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>كافة البلاغات</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800/20 text-current">
            {accessibleTickets.length}
          </span>
        </button>

        {/* 1. Red Notice Tab */}
        <button
          onClick={() => setActiveTab('معلق')}
          className={`p-3 rounded-xl border text-xs font-bold transition-all text-right flex items-center justify-between ${
            activeTab === 'معلق'
              ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
            طلبات معلقة
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-200 text-red-900 font-bold">
            {pendingCount}
          </span>
        </button>

        {/* 2. Yellow Notice Tab */}
        <button
          onClick={() => setActiveTab('قيد الصيانة')}
          className={`p-3 rounded-xl border text-xs font-bold transition-all text-right flex items-center justify-between ${
            activeTab === 'قيد الصيانة'
              ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            قيد الصيانة
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-200 text-amber-900 font-bold">
            {inProgressCount}
          </span>
        </button>

        {/* 3. Green Notice Tab */}
        <button
          onClick={() => setActiveTab('تم الصيانة')}
          className={`p-3 rounded-xl border text-xs font-bold transition-all text-right flex items-center justify-between ${
            activeTab === 'تم الصيانة'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم الصيانة
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-200 text-emerald-900 font-bold">
            {completedCount}
          </span>
        </button>
      </div>

      {/* Search & Department Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث برقم البلاغ، اسم الجهاز، ID، الوصف..."
            className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {departmentsList.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">القسم:</span>
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">كافة الأقسام</option>
              {departmentsList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tickets List / Cards */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
          <Wrench className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <h3 className="text-sm font-bold text-slate-800">لا توجد بلاغات صيانة مطابقة</h3>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab !== 'all'
              ? `لا توجد بلاغات بحالة "${activeTab}" حالياً.`
              : 'يمكنك تقديم بلاغ عطل لأي جهاز في الأقسام المسجلة.'}
          </p>
          <button
            onClick={() => {
              setSelectedAssetForTicket(null);
              setShowCreateModal(true);
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow transition-colors"
          >
            + تقديم بلاغ صيانة جديد
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => {
            const isPending = ticket.status === 'معلق';
            const isInProgress = ticket.status === 'قيد الصيانة';
            const isCompleted = ticket.status === 'تم الصيانة';

            return (
              <div
                key={ticket.id}
                className={`bg-white rounded-2xl border shadow-sm transition-all overflow-hidden ${
                  isPending
                    ? 'border-red-300 ring-1 ring-red-200/60'
                    : isInProgress
                    ? 'border-amber-300'
                    : 'border-emerald-200'
                }`}
              >
                {/* Top Status Header */}
                <div
                  className={`p-4 flex flex-wrap items-center justify-between gap-3 ${
                    isPending
                      ? 'bg-red-50/70 border-b border-red-100'
                      : isInProgress
                      ? 'bg-amber-50/70 border-b border-amber-100'
                      : 'bg-emerald-50/70 border-b border-emerald-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold shadow-xs flex items-center gap-1.5 ${
                        isPending
                          ? 'bg-red-600 text-white animate-pulse'
                          : isInProgress
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {isPending ? (
                        <AlertOctagon className="w-3.5 h-3.5" />
                      ) : isInProgress ? (
                        <Clock className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {ticket.status}
                    </span>

                    <span className="font-mono font-bold text-xs text-slate-800 bg-white/80 px-2 py-0.5 rounded border">
                      {ticket.ticketNumber}
                    </span>

                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {ticket.complaintDate} ({ticket.complaintTime})
                    </span>
                  </div>

                  {/* Top Right: Submitted by */}
                  <div className="text-xs text-slate-600 font-medium">
                    مقدم البلاغ: <span className="font-bold text-slate-900">{ticket.submittedBy.userName}</span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4">
                  {/* Device & Location Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[11px]">اسم الجهاز:</span>
                      <span className="font-bold text-slate-900 block truncate">{ticket.deviceName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">ID المخصص:</span>
                      <span className="font-mono font-bold text-blue-600 block">{ticket.customId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">القسم:</span>
                      <span className="font-bold text-slate-800 block truncate">
                        {ticket.mainDepartment} {ticket.subDepartment ? `(${ticket.subDepartment})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">الموديل والسيريال:</span>
                      <span className="font-medium text-slate-700 block truncate">
                        {ticket.model || '—'} / {ticket.serialNumber || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Complaint Description */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">وصف العطل والشكوى:</h5>
                    <div className="p-3 rounded-xl bg-red-50/40 border border-red-100 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {ticket.complaintDescription}
                    </div>
                  </div>

                  {/* Technical Operations Timeline & Reports (If in-progress or completed) */}
                  {(isInProgress || isCompleted) && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">بيانات الاستلام:</span>
                          <span className="text-slate-600">
                            استلمه: <span className="font-bold text-slate-900">{ticket.receivedBy}</span> في (
                            {ticket.receivedAt})
                          </span>
                        </div>
                        {isCompleted && (
                          <div className="text-emerald-700 font-bold">
                            المدة المستغرقة: {ticket.repairDuration}
                          </div>
                        )}
                      </div>

                      {/* Technical Operations Reports Box */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="font-bold text-slate-700 block mb-0.5">1. التقرير المبدئي:</span>
                          <p className="text-slate-600 text-[11px]">
                            {ticket.initialReport || '— لم يُسجل بعد —'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="font-bold text-slate-700 block mb-0.5">2. طلب القطع اللازمة:</span>
                          <p className="text-slate-600 text-[11px]">
                            {ticket.requiredParts || '— لا توجد قطع مطلوبة —'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="font-bold text-slate-700 block mb-0.5">3. التقرير النهائي للإصلاح:</span>
                          <p className="text-slate-600 text-[11px]">
                            {ticket.finalReport || '— قيد الإجراء —'}
                          </p>
                        </div>
                      </div>

                      {/* Signatures Preview if Completed */}
                      {isCompleted && (
                        <div className="flex items-center justify-around p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-[11px] text-emerald-900">
                          <div>
                            <span className="text-emerald-700 font-bold block">مشرف القسم:</span>
                            <span>{ticket.supervisorSignature || ticket.submittedBy.userName}</span>
                          </div>
                          <div>
                            <span className="text-emerald-700 font-bold block">الفني المنفذ:</span>
                            <span>{ticket.technicianSignature || ticket.completedBy}</span>
                          </div>
                          <div>
                            <span className="text-emerald-700 font-bold block">مسؤول الصيانة:</span>
                            <span>{ticket.managerSignature || 'مُعتمد'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  {/* PDF Export Button (A4 format) - Admin & Technician Only */}
                  {(currentUser?.role === 'admin' || currentUser?.role === 'technician') ? (
                    <button
                      onClick={() => handleExportPDF(ticket)}
                      disabled={isExportingPDF}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold shadow-xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-red-600" />
                      تصدير تقرير الصيانة PDF (A4)
                    </button>
                  ) : (
                    <div />
                  )}

                  {/* Workflow Transitions (Admin & Technician only) */}
                  {currentUser?.role !== 'supervisor' && (
                    <div className="flex items-center gap-2">
                      {/* Step 1: "تم استلام الشكوى" Button for Pending tickets */}
                      {isPending && (
                        <button
                          onClick={() => handleReceiveTicket(ticket)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md transition-transform hover:scale-105"
                        >
                          <Clock className="w-4 h-4" />
                          تم استلام الشكوى
                        </button>
                      )}

                      {/* Step 2: Update Tech Reports */}
                      {isInProgress && (
                        <>
                          <button
                            onClick={() => setActiveTechOpsTicket(ticket)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            تحديث التقارير الفنية والقطع
                          </button>

                          {/* Step 3: "تم الإصلاح" Button for In-Progress tickets */}
                          <button
                            onClick={() => setActiveCompleteTicket(ticket)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-transform hover:scale-105"
                          >
                            <Check className="w-4 h-4" />
                            تم الإصلاح
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUBMIT NEW MAINTENANCE TICKET */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <CreateTicketModal
          accessibleAssets={accessibleAssets}
          preselectedAsset={selectedAssetForTicket}
          currentUser={currentUser}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedAssetForTicket(null);
            if (onClearCreateAsset) onClearCreateAsset();
          }}
          onCreated={() => {
            setShowCreateModal(false);
            setSelectedAssetForTicket(null);
            if (onClearCreateAsset) onClearCreateAsset();
            onRefresh();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: TECHNICAL OPERATIONS & PARTS REQUEST */}
      {/* ========================================================================= */}
      {activeTechOpsTicket && (
        <TechOpsModal
          ticket={activeTechOpsTicket}
          onClose={() => setActiveTechOpsTicket(null)}
          onSaved={() => {
            setActiveTechOpsTicket(null);
            onRefresh();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: COMPLETE TICKET & SIGNATURES ("تم الإصلاح") */}
      {/* ========================================================================= */}
      {activeCompleteTicket && (
        <CompleteTicketModal
          ticket={activeCompleteTicket}
          currentUser={currentUser}
          onClose={() => setActiveCompleteTicket(null)}
          onCompleted={() => {
            setActiveCompleteTicket(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: CREATE TICKET MODAL
// =========================================================================
interface CreateTicketModalProps {
  accessibleAssets: Asset[];
  preselectedAsset: Asset | null;
  currentUser: User | null;
  onClose: () => void;
  onCreated: () => void;
}

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  accessibleAssets,
  preselectedAsset,
  currentUser,
  onClose,
  onCreated,
}) => {
  const [selectedAssetId, setSelectedAssetId] = useState(preselectedAsset?.id || '');
  const [complaintText, setComplaintText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const selectedAsset = useMemo(() => {
    return accessibleAssets.find((a) => a.id === selectedAssetId) || null;
  }, [accessibleAssets, selectedAssetId]);

  const todayDate = new Date().toISOString().split('T')[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) {
      setErrorMsg('يرجى اختيار الجهاز المراد تقديم بلاغ صيانة له');
      return;
    }
    if (!complaintText.trim()) {
      setErrorMsg('يرجى كتابة وصف الشكوى والعطل');
      return;
    }

    try {
      StorageService.createTicket({
        assetId: selectedAsset.id,
        customId: selectedAsset.customId,
        deviceName: selectedAsset.deviceName,
        mainDepartment: selectedAsset.mainDepartment,
        subDepartment: selectedAsset.subDepartment,
        model: selectedAsset.model,
        serialNumber: selectedAsset.serialNumber,
        complaintDescription: complaintText.trim(),
      });

      onCreated();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تقديم البلاغ');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-right">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-red-600" />
            تقديم بلاغ صيانة جديد
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Select Device */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اختر الجهاز من قائمة الأصول <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              <option value="">— اختر جهازاً من القائمة —</option>
              {accessibleAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.deviceName} ({a.mainDepartment}) - ID: {a.customId}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Auto-filled Fields (Department, Device Name, Model, Date) */}
          {selectedAsset && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">اسم القسم:</span>
                <span className="font-bold text-slate-800">{selectedAsset.mainDepartment}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">اسم الجهاز:</span>
                <span className="font-bold text-slate-800">{selectedAsset.deviceName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">موديل الجهاز:</span>
                <span className="font-bold text-slate-800">{selectedAsset.model || 'غير محدد'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">تاريخ اليوم:</span>
                <span className="font-mono font-bold text-slate-800">{todayDate}</span>
              </div>
            </div>
          )}

          {/* Step 3: Complaint Description Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              كتابة الشكوى ووصف العطل بالتفصيل <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              placeholder="اكتب هنا تفاصيل المشكلة أو العطل الذي يواجه الجهاز، متى بدأ، وأي أعراض غير طبيعية..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/20"
            >
              إرسال البلاغ الآن
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: TECH OPERATIONS MODAL
// =========================================================================
interface TechOpsModalProps {
  ticket: MaintenanceTicket;
  onClose: () => void;
  onSaved: () => void;
}

const TechOpsModal: React.FC<TechOpsModalProps> = ({ ticket, onClose, onSaved }) => {
  const [initialReport, setInitialReport] = useState(ticket.initialReport || '');
  const [requiredParts, setRequiredParts] = useState(ticket.requiredParts || '');
  const [finalReport, setFinalReport] = useState(ticket.finalReport || '');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.updateTicketTechnicalReports(ticket.id, {
      initialReport: initialReport.trim(),
      requiredParts: requiredParts.trim(),
      finalReport: finalReport.trim(),
    });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-right">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            حقول العمليات الفنية والتقارير ({ticket.ticketNumber})
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              1. تقرير مبدئي للصيانة (الفحص والتشخيص):
            </label>
            <textarea
              rows={2}
              value={initialReport}
              onChange={(e) => setInitialReport(e.target.value)}
              placeholder="نتيجة الكشف المبدئي على الجهاز وتحديد سبب المشكلة..."
              className="w-full p-2.5 rounded-xl border border-slate-300"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              2. طلب القطع اللازمة للإصلاح وقطع الغيار:
            </label>
            <textarea
              rows={2}
              value={requiredParts}
              onChange={(e) => setRequiredParts(e.target.value)}
              placeholder="قطع الغيار المطلوبة لتنفيذ أعمال الصيانة (أو لا توجد)..."
              className="w-full p-2.5 rounded-xl border border-slate-300"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              3. التقرير النهائي للإصلاح واختبار الكفاءة:
            </label>
            <textarea
              rows={3}
              value={finalReport}
              onChange={(e) => setFinalReport(e.target.value)}
              placeholder="ما تم إنجازه بالضبط لإصلاح العطل واختبار الجهاز..."
              className="w-full p-2.5 rounded-xl border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow"
            >
              حفظ التقارير الفنية
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: COMPLETE TICKET MODAL ("تم الإصلاح")
// =========================================================================
interface CompleteTicketModalProps {
  ticket: MaintenanceTicket;
  currentUser: User | null;
  onClose: () => void;
  onCompleted: () => void;
}

const CompleteTicketModal: React.FC<CompleteTicketModalProps> = ({
  ticket,
  currentUser,
  onClose,
  onCompleted,
}) => {
  const [finalReport, setFinalReport] = useState(ticket.finalReport || 'تم إصلاح العطل واختبار كفاءة وتشغيل الجهاز بنجاح.');
  const [supervisorSignature, setSupervisorSignature] = useState(ticket.submittedBy.userName || 'مشرف القسم');
  const [technicianSignature, setTechnicianSignature] = useState(currentUser?.fullName || 'فني الصيانة');
  const [managerSignature, setManagerSignature] = useState('مسؤول إدارة الصيانة');

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.completeTicket(ticket.id, {
      completedByName: currentUser?.fullName || 'فني الصيانة',
      finalReport: finalReport.trim(),
      supervisorSignature: supervisorSignature.trim(),
      technicianSignature: technicianSignature.trim(),
      managerSignature: managerSignature.trim(),
    });
    onCompleted();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-right">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            إتمام الصيانة واعتماد إغلاق البلاغ ({ticket.ticketNumber})
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleComplete} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              التقرير النهائي للإصلاح:
            </label>
            <textarea
              required
              rows={3}
              value={finalReport}
              onChange={(e) => setFinalReport(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300"
            />
          </div>

          {/* 3 Signatures */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <h4 className="font-bold text-slate-800">التوقيعات والاعتمادات الرسمية:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">1. توقيع مشرف القسم:</label>
                <input
                  type="text"
                  value={supervisorSignature}
                  onChange={(e) => setSupervisorSignature(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">2. توقيع الفني:</label>
                <input
                  type="text"
                  value={technicianSignature}
                  onChange={(e) => setTechnicianSignature(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">3. توقيع مسؤول الصيانة:</label>
                <input
                  type="text"
                  value={managerSignature}
                  onChange={(e) => setManagerSignature(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
            >
              تأكيد إتمام الإصلاح وتحويل الحالة لأخضر
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
