import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRightLeft,
  PackagePlus,
  Printer,
  Check,
  X,
  Scan,
  Trash2,
  Eye,
  FileSpreadsheet,
  AlertOctagon,
  ShieldCheck,
  Clock,
  MessageSquareQuote,
  Sparkles,
  Layers,
  Box,
  Edit3,
  CheckSquare,
  Square,
  FileText,
  Building,
  UserCheck,
  Camera,
  Barcode,
  Download,
  Loader2,
  Filter,
} from 'lucide-react';
import { Asset, AuditSession, AuditItem, AuditItemStatus, AuditItemAccessory, User } from '../types';
import { StorageService } from '../services/storage';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';
import { PDFReportGenerator } from '../utils/pdfExport';

interface AuditViewProps {
  currentUser: User | null;
  assets?: Asset[];
  onRefresh: () => void;
}

export const AuditView: React.FC<AuditViewProps> = ({
  currentUser,
  assets = [],
  onRefresh,
}) => {
  const [sessions, setSessions] = useState<AuditSession[]>(() => StorageService.getAuditSessions());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // New session modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDept, setNewDept] = useState('all');
  const [newAuditedBy, setNewAuditedBy] = useState(currentUser?.fullName || '');
  const [newNotes, setNewNotes] = useState('');

  // Scanning state
  const [scanCodeInput, setScanCodeInput] = useState('');
  const [scanQuantity, setScanQuantity] = useState<number>(1);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'warning' | 'error' | 'info'; message: string } | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [continuousCameraScan, setContinuousCameraScan] = useState(true);

  // Add Brand New Asset during audit modal state
  const [showAddNewAssetModal, setShowAddNewAssetModal] = useState(false);
  const [newAssetCustomId, setNewAssetCustomId] = useState('');
  const [newAssetDeviceName, setNewAssetDeviceName] = useState('');
  const [newAssetModel, setNewAssetModel] = useState('');
  const [newAssetSerial, setNewAssetSerial] = useState('');
  const [newAssetManufacturer, setNewAssetManufacturer] = useState('');
  const [newAssetMainDept, setNewAssetMainDept] = useState('');
  const [newAssetSubDept, setNewAssetSubDept] = useState('');
  const [newAssetCustodian, setNewAssetCustodian] = useState('');
  const [newAssetQuantity, setNewAssetQuantity] = useState<number>(1);
  const [newAssetAccessoriesInput, setNewAssetAccessoriesInput] = useState('');
  const [newAssetStatus, setNewAssetStatus] = useState<'شغال' | 'عاطل' | 'تالف'>('شغال');
  const [newAssetNotes, setNewAssetNotes] = useState('');
  const [saveToMainAssetsRegistry, setSaveToMainAssetsRegistry] = useState(true);

  // Note editing modal
  const [editingNoteItem, setEditingNoteItem] = useState<{ id: string; customId: string; deviceName: string; note: string } | null>(null);

  // Accessories Checklist modal
  const [editingAccessoriesItem, setEditingAccessoriesItem] = useState<{ id: string; customId: string; deviceName: string; accessories: AuditItemAccessory[] } | null>(null);
  const [newAccessoryName, setNewAccessoryName] = useState('');

  // Finalize confirmation modal
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [applyReconciliation, setApplyReconciliation] = useState(true);

  // Report & Print modal (Landscape) & Department Isolation
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDepartmentFilter, setPrintDepartmentFilter] = useState<string>('all');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfExportError, setPdfExportError] = useState<string | null>(null);

  // Item filters within active session
  const [itemStatusFilter, setItemStatusFilter] = useState<'all' | AuditItemStatus>('all');
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Session search query
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');

  const scanInputRef = useRef<HTMLInputElement>(null);

  // Reload sessions from storage
  const reloadSessions = () => {
    setSessions(StorageService.getAuditSessions());
    onRefresh();
  };

  useEffect(() => {
    setSessions(StorageService.getAuditSessions());
  }, [assets]);

  // Selected session object
  const activeSession = useMemo(() => {
    if (!selectedSessionId) return null;
    return sessions.find((s) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  // Set default print department filter when activeSession changes
  useEffect(() => {
    if (activeSession) {
      if (activeSession.targetDepartment && activeSession.targetDepartment !== 'all') {
        setPrintDepartmentFilter(activeSession.targetDepartment);
      } else {
        setPrintDepartmentFilter('all');
      }
    }
  }, [activeSession?.id, activeSession?.targetDepartment]);

  // All unique departments present in this audit session
  const sessionAuditedDepartments = useMemo(() => {
    if (!activeSession) return [];
    const depts = new Set<string>();
    if (activeSession.targetDepartment && activeSession.targetDepartment !== 'all') {
      depts.add(activeSession.targetDepartment.trim());
    }
    activeSession.items.forEach((item) => {
      if (item.actualDepartment && item.actualDepartment.trim()) {
        depts.add(item.actualDepartment.trim());
      }
      if (item.mainDepartment && item.mainDepartment.trim()) {
        depts.add(item.mainDepartment.trim());
      }
    });
    return Array.from(depts).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [activeSession]);

  // Filtered items to be rendered in the Printable Landscape Report
  const printItems = useMemo(() => {
    if (!activeSession) return [];
    if (printDepartmentFilter && printDepartmentFilter !== 'all') {
      return activeSession.items.filter(
        (i) =>
          (i.actualDepartment && i.actualDepartment.trim() === printDepartmentFilter) ||
          (i.mainDepartment && i.mainDepartment.trim() === printDepartmentFilter)
      );
    }
    return activeSession.items;
  }, [activeSession, printDepartmentFilter]);

  // Dynamic statistics calculated specifically for the audited department in the report
  const printStats = useMemo(() => {
    const totalExpected = printItems.reduce((sum, i) => sum + (i.expectedQuantity || 1), 0);
    const totalMatched = printItems
      .filter((i) => i.status === 'مطابق')
      .reduce((sum, i) => sum + (i.actualQuantity || 1), 0);
    const totalRelocated = printItems
      .filter((i) => i.status === 'منقول')
      .reduce((sum, i) => sum + (i.actualQuantity || 1), 0);
    const totalUnregistered = printItems
      .filter((i) => i.status === 'جديد_غير_مسجل')
      .reduce((sum, i) => sum + (i.actualQuantity || 1), 0);
    const totalMissing = printItems
      .filter((i) => i.status === 'مفقود' || i.status === 'معلق')
      .reduce((sum, i) => sum + (i.expectedQuantity || 1), 0);

    return {
      totalExpected,
      totalMatched,
      totalRelocated,
      totalUnregistered,
      totalMissing,
    };
  }, [printItems]);

  // Handler: Direct Landscape A4 PDF Export
  const handleExportAuditPDF = async () => {
    if (!activeSession) return;
    setIsExportingPdf(true);
    setPdfExportError(null);
    try {
      const deptName =
        printDepartmentFilter !== 'all'
          ? printDepartmentFilter
          : activeSession.targetDepartment !== 'all'
          ? activeSession.targetDepartment
          : 'كافة الأقسام';
      await PDFReportGenerator.exportAuditReportToPDF(activeSession, 'audit-printable-area', deptName);
    } catch (err: any) {
      console.error('Audit PDF Export Failed:', err);
      setPdfExportError(err?.message || 'تعذر تصدير تقرير الجرد كملف PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Unique departments for filter / create
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.mainDepartment && a.mainDepartment.trim()) {
        set.add(a.mainDepartment.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [assets]);

  // Guard: Admin and Technician only
  if (currentUser?.role === 'supervisor') {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <AlertOctagon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">صلاحية الوصول مقيدة</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          صفحة دورات الجرد والمطابقة مخصصة فقط لـ <strong>مدير النظام (الأدمن)</strong> و <strong>فني الصيانة</strong>.
        </p>
      </div>
    );
  }

  // Handle create new audit session
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('يرجى كتابة عنوان أو مسمى لدورة الجرد');
      return;
    }

    if (!currentUser) return;

    const session = StorageService.createAuditSession(
      newTitle,
      newDept,
      currentUser,
      newAuditedBy,
      newNotes
    );

    setShowCreateModal(false);
    setNewTitle('');
    setNewDept('all');
    setNewNotes('');
    reloadSessions();
    setSelectedSessionId(session.id);
  };

  // Handle Barcode / Manual Code Scan
  const handleProcessScannedCode = (codeToProcess: string, qty: number = scanQuantity) => {
    if (!codeToProcess.trim() || !activeSession || !currentUser) return;

    const result = StorageService.scanItemInAuditSession(
      activeSession.id,
      codeToProcess.trim(),
      currentUser
    );

    if (result.success) {
      if (result.isRelocated) {
        setScanFeedback({ type: 'warning', message: result.message });
      } else {
        setScanFeedback({ type: 'success', message: result.message });
      }

      // If user entered a specific scan quantity > 1, update it immediately
      if (result.item && qty > 1) {
        StorageService.updateAuditItemQuantity(activeSession.id, result.item.id, qty);
      }

      setScanCodeInput('');
      setScanQuantity(1);
      reloadSessions();
    } else {
      if (result.isNew) {
        setScanFeedback({ type: 'info', message: result.message });
        setNewAssetCustomId(codeToProcess.trim());
        setNewAssetMainDept(activeSession.targetDepartment !== 'all' ? activeSession.targetDepartment : '');
        setNewAssetQuantity(qty);
        setShowAddNewAssetModal(true);
      } else {
        setScanFeedback({ type: 'error', message: result.message });
      }
    }

    // Refocus scan input
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 100);
  };

  const handleScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanCodeInput.trim()) return;
    handleProcessScannedCode(scanCodeInput, scanQuantity);
  };

  // Handle Camera Scan
  const handleCameraScanResult = (decodedText: string) => {
    handleProcessScannedCode(decodedText, scanQuantity);
  };

  // Handle Add New Asset during audit
  const handleSaveNewAssetDuringAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetCustomId.trim() || !newAssetDeviceName.trim() || !activeSession || !currentUser) {
      alert('يرجى كتابة كود الجهاز واسم الجهاز على الأقل');
      return;
    }

    const accessoriesList = newAssetAccessoriesInput
      .split(/[,،\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const targetDept = newAssetMainDept.trim() || (activeSession.targetDepartment !== 'all' ? activeSession.targetDepartment : 'عام');

    if (saveToMainAssetsRegistry) {
      const res = StorageService.addNewAssetDuringAudit(
        activeSession.id,
        {
          customId: newAssetCustomId.trim(),
          deviceName: newAssetDeviceName.trim(),
          mainDepartment: targetDept,
          subDepartment: newAssetSubDept.trim() || 'عام',
          model: newAssetModel.trim(),
          serialNumber: newAssetSerial.trim(),
          manufacturer: newAssetManufacturer.trim(),
          quantity: Math.max(1, Number(newAssetQuantity || 1)),
          accessories: accessoriesList,
          status: newAssetStatus,
          custodian: newAssetCustodian.trim() || 'غير محدد',
          notes: newAssetNotes.trim() || `أضيف أثناء دورة الجرد (${activeSession.sessionNumber})`,
        },
        currentUser
      );

      if (res.success) {
        setScanFeedback({ type: 'success', message: res.message });
        setShowAddNewAssetModal(false);
        resetNewAssetForm();
        reloadSessions();
      } else {
        alert(res.message);
      }
    } else {
      // Just add to current audit session as unregistered item
      const res = StorageService.addUnregisteredItemToAudit(
        activeSession.id,
        newAssetCustomId.trim(),
        newAssetDeviceName.trim(),
        targetDept,
        newAssetSubDept.trim(),
        newAssetCustodian.trim(),
        currentUser,
        newAssetNotes.trim(),
        newAssetQuantity,
        accessoriesList,
        newAssetModel.trim(),
        newAssetSerial.trim()
      );

      if (res.success) {
        setScanFeedback({ type: 'success', message: res.message });
        setShowAddNewAssetModal(false);
        resetNewAssetForm();
        reloadSessions();
      } else {
        alert(res.message);
      }
    }
  };

  const resetNewAssetForm = () => {
    setNewAssetCustomId('');
    setNewAssetDeviceName('');
    setNewAssetModel('');
    setNewAssetSerial('');
    setNewAssetManufacturer('');
    setNewAssetMainDept('');
    setNewAssetSubDept('');
    setNewAssetCustodian('');
    setNewAssetQuantity(1);
    setNewAssetAccessoriesInput('');
    setNewAssetNotes('');
    setScanCodeInput('');
  };

  const generateAutoAssetCode = () => {
    const prefix = newAssetMainDept ? newAssetMainDept.substring(0, 3).toUpperCase() : 'AST';
    const rand = Math.floor(1000 + Math.random() * 9000);
    setNewAssetCustomId(`${prefix}-${rand}`);
  };

  // Handle Manual Quantity Update
  const handleQuantityChange = (itemId: string, newQty: number) => {
    if (!activeSession) return;
    if (activeSession.status === 'مكتمل_معتمد') {
      alert('الجلسة معتمدة ومغلقة ولا يمكن تعديل كمياتها');
      return;
    }
    const sanitizedQty = Math.max(0, newQty);
    StorageService.updateAuditItemQuantity(activeSession.id, itemId, sanitizedQty);
    reloadSessions();
  };

  // Handle Single Item Status Change
  const handleUpdateItemStatus = (itemId: string, newStatus: AuditItemStatus) => {
    if (!activeSession) return;
    if (activeSession.status === 'مكتمل_معتمد') {
      alert('الجلسة معتمدة ومغلقة ولا يمكن تعديل بنودها');
      return;
    }
    StorageService.updateAuditItemStatus(activeSession.id, itemId, newStatus);
    reloadSessions();
  };

  // Handle Save Note
  const handleSaveNote = () => {
    if (!activeSession || !editingNoteItem) return;
    StorageService.updateAuditItemNote(activeSession.id, editingNoteItem.id, editingNoteItem.note);
    setEditingNoteItem(null);
    reloadSessions();
  };

  // Handle Toggle Accessory Check
  const handleToggleAccessory = (accIndex: number) => {
    if (!editingAccessoriesItem) return;
    const updated = [...editingAccessoriesItem.accessories];
    updated[accIndex] = {
      ...updated[accIndex],
      checked: !updated[accIndex].checked,
    };
    setEditingAccessoriesItem({
      ...editingAccessoriesItem,
      accessories: updated,
    });
  };

  // Handle Add New Accessory to Item
  const handleAddAccessoryToItem = () => {
    if (!editingAccessoriesItem || !newAccessoryName.trim()) return;
    const updated = [
      ...editingAccessoriesItem.accessories,
      { name: newAccessoryName.trim(), checked: true },
    ];
    setEditingAccessoriesItem({
      ...editingAccessoriesItem,
      accessories: updated,
    });
    setNewAccessoryName('');
  };

  // Handle Save Accessories Checklist
  const handleSaveAccessories = () => {
    if (!activeSession || !editingAccessoriesItem) return;
    StorageService.updateAuditItemAccessories(
      activeSession.id,
      editingAccessoriesItem.id,
      editingAccessoriesItem.accessories
    );
    setEditingAccessoriesItem(null);
    reloadSessions();
  };

  // Handle Finalize Session
  const handleFinalizeSession = () => {
    if (!activeSession || !currentUser) return;
    const res = StorageService.finalizeAuditSession(
      activeSession.id,
      applyReconciliation,
      currentUser
    );
    setShowFinalizeModal(false);
    reloadSessions();
    alert(res.message);
  };

  // Handle Delete Session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    if (currentUser.role !== 'admin') {
      alert('عفواً، حذف جلسات الجرد متاح لمدير النظام (الأدمن) فقط');
      return;
    }
    if (window.confirm('هل أنت متأكد من حذف جلسة الجرد هذه بشكل نهائي؟')) {
      StorageService.deleteAuditSession(sessionId, currentUser);
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
      reloadSessions();
    }
  };

  // Export CSV Report with all columns
  const handleExportCSV = () => {
    if (!activeSession) return;

    const headers = [
      '#',
      'كود الجهاز (ID)',
      'اسم الجهاز',
      'الموديل',
      'الرقم التسلسلي (S/N)',
      'القسم المقيد دفترياً',
      'القسم الفعلي المرصود',
      'العهدة المسجلة',
      'العهدة الفعلية',
      'الكمية الدفترية',
      'الكمية الفعلية المحصورة',
      'الفارق',
      'فحص التوابع والملحقات',
      'حالة الجرد',
      'تاريخ ووقت المسح',
      'القائم بالمسح',
      'الملاحظات الفنية',
    ];

    const rows = activeSession.items.map((item, idx) => {
      const expQty = item.expectedQuantity ?? 1;
      const actQty = item.actualQuantity ?? 0;
      const diff = actQty - expQty;

      const accessoriesSummary = (item.accessories || [])
        .map((a) => `${a.name}: ${a.checked ? 'موجود' : 'ناقص'}`)
        .join(' | ') || 'لا توجد توابع';

      return [
        idx + 1,
        item.customId,
        `"${item.deviceName.replace(/"/g, '""')}"`,
        `"${item.model || ''}"`,
        `"${item.serialNumber || ''}"`,
        `"${item.mainDepartment}"`,
        `"${item.actualDepartment || item.mainDepartment}"`,
        `"${item.expectedCustodian || ''}"`,
        `"${item.actualCustodian || item.expectedCustodian || ''}"`,
        expQty,
        actQty,
        diff > 0 ? `+${diff}` : diff,
        `"${accessoriesSummary.replace(/"/g, '""')}"`,
        `"${item.status}"`,
        `"${item.scannedAt || 'لم يتم المسح'}"`,
        `"${item.scannedBy || ''}"`,
        `"${(item.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Audit-Landscape-Report-${activeSession.sessionNumber}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter items in active session
  const filteredItems = useMemo(() => {
    if (!activeSession) return [];
    return activeSession.items.filter((item) => {
      // Status filter
      if (itemStatusFilter !== 'all' && item.status !== itemStatusFilter) {
        return false;
      }
      // Search query
      if (itemSearchQuery.trim()) {
        const q = itemSearchQuery.toLowerCase().trim();
        const matchesCode = item.customId.toLowerCase().includes(q);
        const matchesName = item.deviceName.toLowerCase().includes(q);
        const matchesSerial = (item.serialNumber || '').toLowerCase().includes(q);
        const matchesCustodian = (item.expectedCustodian || '').toLowerCase().includes(q) || (item.actualCustodian || '').toLowerCase().includes(q);
        const matchesDept = (item.mainDepartment || '').toLowerCase().includes(q);
        const matchesNotes = (item.notes || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesSerial && !matchesCustodian && !matchesDept && !matchesNotes) {
          return false;
        }
      }
      return true;
    });
  }, [activeSession, itemStatusFilter, itemSearchQuery]);

  // Filtered session list
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (!sessionSearchQuery.trim()) return true;
      const q = sessionSearchQuery.toLowerCase().trim();
      return (
        s.title.toLowerCase().includes(q) ||
        s.sessionNumber.toLowerCase().includes(q) ||
        s.targetDepartment.toLowerCase().includes(q) ||
        s.auditedBy.toLowerCase().includes(q)
      );
    });
  }, [sessions, sessionSearchQuery]);

  // Status Badge Helper
  const renderStatusBadge = (status: AuditItemStatus) => {
    switch (status) {
      case 'مطابق':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            مطابق ✅
          </span>
        );
      case 'مفقود':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            مفقود / عجز ❌
          </span>
        );
      case 'منقول':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
            أصل منقول 🔄
          </span>
        );
      case 'جديد_غير_مسجل':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <PackagePlus className="w-3.5 h-3.5 text-blue-600" />
            فائض / جديد ➕
          </span>
        );
      case 'معلق':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            معلق
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>الجرد والمطابقة الشاملة للأصول</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                إصدار الجرد المتقدم
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              إدخال الكميات الفعلية، فحص التوابع، إضافة أجهزة جديدة أثناء الجرد، وتصدير التقارير الرسمية بالعرض (Landscape)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {selectedSessionId && (
            <button
              onClick={() => setSelectedSessionId(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              ← قائمة دورات الجرد
            </button>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            بدء دورة جرد جديدة
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SESSIONS LIST (When No Session is Selected) */}
      {/* ========================================================================= */}
      {!selectedSessionId && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sessionSearchQuery}
                onChange={(e) => setSessionSearchQuery(e.target.value)}
                placeholder="البحث في دورات الجرد (الرقم، العنوان، القسم، الفاحص)..."
                className="w-full pl-3 pr-9 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold px-2">
              إجمالي الدورات: {sessions.length}
            </div>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <ClipboardCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">لا توجد دورات جرد حالياً</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                ابدأ بإنشاء دورة جرد جديدة لاختيار قسم معين أو كافة الأقسام، ثم ابدأ بمسح الأجهزة عبر الباركود وإدخال الكميات وفحص التوابع.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                بدء أول دورة جرد
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSessions.map((session) => {
                const completionRate =
                  session.totalExpected > 0
                    ? Math.min(100, Math.round(((session.totalMatched + session.totalRelocated) / session.totalExpected) * 100))
                    : 0;

                const isCompleted = session.status === 'مكتمل_معتمد';

                return (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {session.sessionNumber}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 mt-1.5 group-hover:text-emerald-700 transition-colors">
                            {session.title}
                          </h3>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                          }`}
                        >
                          {isCompleted ? 'مكتمل ومعتمد ✅' : 'قيد الجرد والمطابقة ⏳'}
                        </span>
                      </div>

                      {/* Meta information */}
                      <div className="space-y-1.5 text-xs text-slate-600 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">القسم المستهدف:</span>
                          <span className="font-bold text-slate-800">
                            {session.targetDepartment === 'all' ? 'جميع الأقسام' : session.targetDepartment}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">تاريخ البدء:</span>
                          <span className="font-medium text-slate-700">{session.startDate}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">القائم بالجرد:</span>
                          <span className="font-medium text-slate-700">{session.auditedBy}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1 mb-4">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>نسبة الإنجاز</span>
                          <span>{completionRate}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats Pills Grid */}
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold mb-4">
                        <div className="bg-slate-100 p-1.5 rounded-lg">
                          <div className="text-slate-500">المتوقع</div>
                          <div className="text-slate-800 text-xs mt-0.5">{session.totalExpected}</div>
                        </div>
                        <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                          <div className="text-emerald-700">مطابق</div>
                          <div className="text-emerald-800 text-xs mt-0.5">{session.totalMatched}</div>
                        </div>
                        <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                          <div className="text-amber-700">منقول</div>
                          <div className="text-amber-800 text-xs mt-0.5">{session.totalRelocated}</div>
                        </div>
                        <div className="bg-blue-50 p-1.5 rounded-lg border border-blue-200">
                          <div className="text-blue-700">جديد</div>
                          <div className="text-blue-800 text-xs mt-0.5">{session.totalUnregistered}</div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                      <button
                        onClick={() => setSelectedSessionId(session.id)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {isCompleted ? 'عرض المحضر والتقرير العرضي' : 'متابعة مسح وإدخال الجرد'}
                      </button>

                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          title="حذف جلسة الجرد"
                          className="p-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ACTIVE SESSION WORKSPACE (When a Session is Selected) */}
      {/* ========================================================================= */}
      {activeSession && (
        <div className="space-y-6">
          {/* Active Session Overview Banner */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-lg">
                    {activeSession.sessionNumber}
                  </span>
                  <span
                    className={`text-xs px-3 py-1 rounded-lg font-bold ${
                      activeSession.status === 'مكتمل_معتمد'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-400 text-slate-950 animate-pulse'
                    }`}
                  >
                    {activeSession.status === 'مكتمل_معتمد' ? 'محضر معتمد ومغلق' : 'جلسة جرد نشطة ومفتوحة'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    القسم المستهدف: <strong className="text-white">{activeSession.targetDepartment === 'all' ? 'كافة الأقسام' : activeSession.targetDepartment}</strong>
                  </span>
                </div>

                <h2 className="text-2xl font-black text-white">{activeSession.title}</h2>
                <p className="text-xs text-slate-300">
                  الفاحص المسؤول: <strong>{activeSession.auditedBy}</strong> • بدأت بتاريخ:{' '}
                  <strong>{activeSession.startDate}</strong>
                  {activeSession.completedDate && (
                    <span> • تم الاعتماد في: <strong>{activeSession.completedDate}</strong></span>
                  )}
                  {activeSession.notes && <span> • ملاحظات: {activeSession.notes}</span>}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  طباعة المحضر بالعرض (Landscape PDF)
                </button>

                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  تصدير ملف Excel / CSV
                </button>

                {activeSession.status !== 'مكتمل_معتمد' && (
                  <>
                    <button
                      onClick={() => {
                        resetNewAssetForm();
                        setNewAssetMainDept(activeSession.targetDepartment !== 'all' ? activeSession.targetDepartment : '');
                        setShowAddNewAssetModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all"
                    >
                      <PackagePlus className="w-4 h-4" />
                      إضافة جهاز جديد أثناء الجرد
                    </button>

                    <button
                      onClick={() => setShowFinalizeModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-lg shadow-amber-400/20 transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      اعتماد وإغلاق محضر الجرد
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">إجمالي المتوقع دفترياً</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{activeSession.totalExpected}</div>
              <div className="text-[10px] text-slate-400 mt-1">الأجهزة المقيدة مسبقاً</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
              <div className="text-xs text-emerald-700 font-bold flex items-center justify-between">
                <span>مطابق ومؤكد</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-1">{activeSession.totalMatched}</div>
              <div className="text-[10px] text-emerald-600 mt-1">
                {activeSession.totalExpected > 0
                  ? `${Math.round((activeSession.totalMatched / activeSession.totalExpected) * 100)}% من المستهدف`
                  : '0%'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-200 bg-red-50/30 shadow-xs">
              <div className="text-xs text-red-700 font-bold flex items-center justify-between">
                <span>مفقود / عجز</span>
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-black text-red-700 mt-1">
                {activeSession.status === 'مكتمل_معتمد'
                  ? activeSession.totalMissing
                  : activeSession.items.filter((i) => i.status === 'مفقود' || i.status === 'معلق').length}
              </div>
              <div className="text-[10px] text-red-600 mt-1">
                {activeSession.status === 'مكتمل_معتمد' ? 'تم توثيقه كعجز' : 'لم يتم مسحه بعد'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
              <div className="text-xs text-amber-700 font-bold flex items-center justify-between">
                <span>أصل منقول</span>
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-700 mt-1">{activeSession.totalRelocated}</div>
              <div className="text-[10px] text-amber-600 mt-1">منقول من قسم آخر</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-xs">
              <div className="text-xs text-blue-700 font-bold flex items-center justify-between">
                <span>فائض / أجهزة جديدة</span>
                <PackagePlus className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-700 mt-1">{activeSession.totalUnregistered}</div>
              <div className="text-[10px] text-blue-600 mt-1">تمت إضافتها بالجرد</div>
            </div>
          </div>

          {/* Barcode Scanner & Quick Match Bar (Only when session is open) */}
          {activeSession.status !== 'مكتمل_معتمد' && (
            <div className="bg-white rounded-3xl p-5 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Scan className="w-5 h-5 text-emerald-600" />
                  <span>محطة مسح الباركود والسيريال والتحقق الفوري مع إدخال الكمية</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all hover:scale-105"
                  >
                    <Camera className="w-4 h-4" />
                    مسح بالكاميرا (QR / Barcode)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      resetNewAssetForm();
                      setNewAssetMainDept(activeSession.targetDepartment !== 'all' ? activeSession.targetDepartment : '');
                      setShowAddNewAssetModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة جهاز جديد أثناء الجرد
                  </button>
                </div>
              </div>

              <form onSubmit={handleScanSubmit} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanCodeInput}
                    onChange={(e) => setScanCodeInput(e.target.value)}
                    placeholder="امسح بقارئ الباركود، أو اكتب كود الجهاز (ID) أو الرقم التسلسلي (S.N) واضغط Enter..."
                    className="w-full px-4 py-3 text-sm font-bold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:bg-white focus:border-emerald-600 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                    autoFocus
                  />
                  {scanCodeInput && (
                    <button
                      type="button"
                      onClick={() => setScanCodeInput('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Scan Quantity Input */}
                <div className="flex items-center gap-1.5 bg-slate-50 border-2 border-slate-300 rounded-2xl px-3 py-1.5 sm:w-44 justify-between">
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">الكمية:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setScanQuantity((q) => Math.max(1, q - 1))}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center text-sm"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={scanQuantity}
                      onChange={(e) => setScanQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-center text-sm font-black bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setScanQuantity((q) => q + 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all whitespace-nowrap"
                >
                  تحقق ومطابقة ⏎
                </button>
              </form>

              {/* Supported Identifiers Hint */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <span className="font-semibold text-slate-700">المطابقة التلقائية الذكية تدعم:</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-medium">كود الجهاز ID (مثل DEV-101)</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-medium">الرقم التسلسلي S/N (مثل SN-9988)</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">قارئات الباركود اللاسلكية / السلكية</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">كاميرا الهاتف أو التابلت</span>
              </div>

              {/* Feedback Toast */}
              {scanFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between animate-fadeIn ${
                    scanFeedback.type === 'success'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : scanFeedback.type === 'warning'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : scanFeedback.type === 'info'
                      ? 'bg-blue-100 text-blue-900 border border-blue-300'
                      : 'bg-red-100 text-red-900 border border-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {scanFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {scanFeedback.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    {scanFeedback.type === 'info' && <PackagePlus className="w-4 h-4 text-blue-600" />}
                    {scanFeedback.type === 'error' && <XCircle className="w-4 h-4 text-red-600" />}
                    <span>{scanFeedback.message}</span>
                  </div>
                  <button
                    onClick={() => setScanFeedback(null)}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Items Filter Tabs & Search */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold pb-1 sm:pb-0">
                <button
                  onClick={() => setItemStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                    itemStatusFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  الكل ({activeSession.items.length})
                </button>
                <button
                  onClick={() => setItemStatusFilter('مطابق')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                    itemStatusFilter === 'مطابق'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-emerald-50'
                  }`}
                >
                  مطابق ({activeSession.totalMatched})
                </button>
                <button
                  onClick={() => setItemStatusFilter('معلق')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                    itemStatusFilter === 'معلق'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  معلق ({activeSession.items.filter((i) => i.status === 'معلق').length})
                </button>
                <button
                  onClick={() => setItemStatusFilter('مفقود')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                    itemStatusFilter === 'مفقود'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-600 hover:bg-red-50'
                  }`}
                >
                  مفقود ({activeSession.items.filter((i) => i.status === 'مفقود').length})
                </button>
                <button
                  onClick={() => setItemStatusFilter('منقول')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                    itemStatusFilter === 'منقول'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 hover:bg-amber-50'
                  }`}
                >
                  منقول ({activeSession.totalRelocated})
                </button>
                <button
                  onClick={() => setItemStatusFilter('جديد_غير_مسجل')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                    itemStatusFilter === 'جديد_غير_مسجل'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-blue-50'
                  }`}
                >
                  جديد بالجرد ({activeSession.totalUnregistered})
                </button>
              </div>

              {/* Items Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  placeholder="بحث في الكود، الاسم، السيريال، الملاحظات..."
                  className="w-full pl-3 pr-8 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Audit Items Table with Manual Quantity, Accessories & Note Editing */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">كود الجهاز (ID)</th>
                      <th className="p-3">اسم الجهاز والموديل</th>
                      <th className="p-3">القسم والعهدة</th>
                      <th className="p-3 text-center">الكمية الدفترية</th>
                      <th className="p-3 text-center">الكمية الفعلية (المحصورة)</th>
                      <th className="p-3 text-center">الفارق</th>
                      <th className="p-3 text-center">فحص التوابع والملحقات</th>
                      <th className="p-3 text-center">حالة الجرد</th>
                      <th className="p-3">الملاحظات</th>
                      {activeSession.status !== 'مكتمل_معتمد' && (
                        <th className="p-3 text-center">إجراءات التحقق</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-slate-400 font-medium">
                          لا توجد أجهزة مطابقة للفلتر المحدد
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => {
                        const expectedQty = item.expectedQuantity ?? 1;
                        const actualQty = item.actualQuantity ?? 0;
                        const diff = actualQty - expectedQty;
                        const accessoriesCount = (item.accessories || []).length;
                        const checkedAccessoriesCount = (item.accessories || []).filter((a) => a.checked).length;

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              item.status === 'مطابق'
                                ? 'bg-emerald-50/20'
                                : item.status === 'منقول'
                                ? 'bg-amber-50/20'
                                : item.status === 'جديد_غير_مسجل'
                                ? 'bg-blue-50/20'
                                : item.status === 'مفقود'
                                ? 'bg-red-50/20'
                                : ''
                            }`}
                          >
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-bold font-mono text-slate-800">
                              {item.customId}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{item.deviceName}</div>
                              <div className="text-[10px] text-slate-500 flex flex-wrap gap-2 mt-0.5">
                                {item.model && <span>موديل: {item.model}</span>}
                                {item.serialNumber && (
                                  <span className="font-mono text-slate-400">S/N: {item.serialNumber}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-slate-700">
                              <div className="font-semibold text-slate-800">
                                {item.actualDepartment || item.mainDepartment}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                العهدة: {item.actualCustodian || item.expectedCustodian || 'غير محدد'}
                              </div>
                            </td>

                            {/* Expected Quantity */}
                            <td className="p-3 text-center">
                              <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                {expectedQty}
                              </span>
                            </td>

                            {/* Actual Quantity - Editable input */}
                            <td className="p-3 text-center">
                              {activeSession.status === 'مكتمل_معتمد' ? (
                                <span className="font-mono font-bold text-slate-800 px-2.5 py-1 rounded-lg bg-slate-100">
                                  {actualQty}
                                </span>
                              ) : (
                                <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-xl p-1">
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(item.id, actualQty - 1)}
                                    className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:bg-slate-200 font-bold flex items-center justify-center text-xs border border-slate-200"
                                    title="إنقاص الكمية"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={actualQty}
                                    onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                    className="w-12 text-center text-xs font-black bg-transparent focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(item.id, actualQty + 1)}
                                    className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:bg-slate-200 font-bold flex items-center justify-center text-xs border border-slate-200"
                                    title="زيادة الكمية"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Difference / Variance */}
                            <td className="p-3 text-center">
                              <span
                                className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                                  diff === 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : diff < 0
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            </td>

                            {/* Accessories Inspection Button */}
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingAccessoriesItem({
                                    id: item.id,
                                    customId: item.customId,
                                    deviceName: item.deviceName,
                                    accessories: item.accessories ? [...item.accessories] : [],
                                  })
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors border ${
                                  accessoriesCount === 0
                                    ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    : checkedAccessoriesCount === accessoriesCount
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                <Box className="w-3.5 h-3.5" />
                                {accessoriesCount === 0
                                  ? 'إضافة توابع +'
                                  : `التوابع (${checkedAccessoriesCount}/${accessoriesCount})`}
                              </button>
                            </td>

                            {/* Status Badge */}
                            <td className="p-3 text-center">{renderStatusBadge(item.status)}</td>

                            {/* Notes with Quick Edit */}
                            <td className="p-3 max-w-xs">
                              <div className="flex items-center justify-between gap-1 group/note">
                                <span className="text-slate-700 text-xs truncate">
                                  {item.notes || <span className="text-slate-300 italic">لا توجد ملاحظة</span>}
                                </span>
                                {activeSession.status !== 'مكتمل_معتمد' && (
                                  <button
                                    onClick={() =>
                                      setEditingNoteItem({
                                        id: item.id,
                                        customId: item.customId,
                                        deviceName: item.deviceName,
                                        note: item.notes || '',
                                      })
                                    }
                                    title="إضافة أو تعديل ملاحظة"
                                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            {activeSession.status !== 'مكتمل_معتمد' && (
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {item.status !== 'مطابق' && (
                                    <button
                                      onClick={() => handleUpdateItemStatus(item.id, 'مطابق')}
                                      title="تأكيد ومطابقة يدوية"
                                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {item.status !== 'مفقود' && (
                                    <button
                                      onClick={() => handleUpdateItemStatus(item.id, 'مفقود')}
                                      title="تحديد كـ مفقود / عجز"
                                      className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {item.status !== 'معلق' && (
                                    <button
                                      onClick={() => handleUpdateItemStatus(item.id, 'معلق')}
                                      title="إعادة للوضع المعلق"
                                      className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-300 transition-colors text-[10px] font-bold"
                                    >
                                      تراجع
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL: CREATE AUDIT SESSION */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">بدء دورة جرد جديدة</h3>
                  <p className="text-xs text-slate-500">اختر القسم المستهدف وأنشئ جلسة المطابقة</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  عنوان / مسمى دورة الجرد <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: جرد أجهزة العمليات والطوارئ - الربع الأول 2025"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  القسم المستهدف بالجرد
                </label>
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold"
                >
                  <option value="all">جميع الأقسام (جرد عام شامل للمنشأة)</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      قسم: {dept}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  عند اختيار قسم محدد، سيتم تلقائياً إدراج جميع الأجهزة المسجلة بهذا القسم كأصول متوقعة للتحقق منها.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  القائم بالجرد / الفاحص المسؤول
                </label>
                <input
                  type="text"
                  value={newAuditedBy}
                  onChange={(e) => setNewAuditedBy(e.target.value)}
                  placeholder="اسم الفاحص أو رئيس لجنة الجرد"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ملاحظات أو أهداف الجرد (اختياري)
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={3}
                  placeholder="أية ملاحظات إدارية، رقم قرار التكليف بالجرد..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
                >
                  إنشاء وبدء الجلسة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: ADD BRAND NEW ASSET DURING AUDIT */}
      {/* ========================================================================= */}
      {showAddNewAssetModal && activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-100 text-right space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <PackagePlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">إضافة جهاز جديد أثناء الجرد</h3>
                  <p className="text-xs text-slate-500">
                    تسجيل جهاز تم العثور عليه أثناء الجرد مع الكمية والتوابع وحفظه بالنظام
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddNewAssetModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewAssetDuringAudit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      كود الجهاز (ID / الباركود) <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateAutoAssetCode}
                      className="text-[10px] text-blue-600 hover:underline font-bold"
                    >
                      توليد كود تلقائي ⚡
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newAssetCustomId}
                    onChange={(e) => setNewAssetCustomId(e.target.value)}
                    placeholder="مثال: MED-4021"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    اسم الجهاز / المعدة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newAssetDeviceName}
                    onChange={(e) => setNewAssetDeviceName(e.target.value)}
                    placeholder="مثال: جهاز مراقبة المريض Patient Monitor"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الموديل (Model)</label>
                  <input
                    type="text"
                    value={newAssetModel}
                    onChange={(e) => setNewAssetModel(e.target.value)}
                    placeholder="مثال: IntelliVue MX800"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الرقم التسلسلي (S/N)</label>
                  <input
                    type="text"
                    value={newAssetSerial}
                    onChange={(e) => setNewAssetSerial(e.target.value)}
                    placeholder="Serial Number"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الشركة المصنعة</label>
                  <input
                    type="text"
                    value={newAssetManufacturer}
                    onChange={(e) => setNewAssetManufacturer(e.target.value)}
                    placeholder="الشركة المصنعة"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">القسم الرئيسي</label>
                  <input
                    type="text"
                    value={newAssetMainDept}
                    onChange={(e) => setNewAssetMainDept(e.target.value)}
                    placeholder="القسم"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">القسم الفرعي / الغرفة</label>
                  <input
                    type="text"
                    value={newAssetSubDept}
                    onChange={(e) => setNewAssetSubDept(e.target.value)}
                    placeholder="الغرفة أو الجناح"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">صاحب العهدة المسؤولة</label>
                  <input
                    type="text"
                    value={newAssetCustodian}
                    onChange={(e) => setNewAssetCustodian(e.target.value)}
                    placeholder="اسم المسؤول"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    الكمية الفعلية المحصورة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newAssetQuantity}
                    onChange={(e) => setNewAssetQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none font-bold font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الحالة الفنية</label>
                  <select
                    value={newAssetStatus}
                    onChange={(e) => setNewAssetStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none font-bold"
                  >
                    <option value="شغال">يعمل وبحالة جيدة</option>
                    <option value="عاطل">يحتاج صيانة / عاطل</option>
                    <option value="تالف">تالف / بحاجة شطب</option>
                  </select>
                </div>
              </div>

              {/* Accessories / Attachments Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  التوابع والملحقات (افصل بينها بفواصل أو أسطر)
                </label>
                <input
                  type="text"
                  value={newAssetAccessoriesInput}
                  onChange={(e) => setNewAssetAccessoriesInput(e.target.value)}
                  placeholder="مثال: كابل باور، مجس حرارة، ترولي متنقل، شاحن..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات الفحص</label>
                <textarea
                  value={newAssetNotes}
                  onChange={(e) => setNewAssetNotes(e.target.value)}
                  rows={2}
                  placeholder="أية ملاحظات فنية أو تفاصيل إضافية عن الجهاز..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Option to also register in main assets database */}
              <label className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50 border border-blue-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToMainAssetsRegistry}
                  onChange={(e) => setSaveToMainAssetsRegistry(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-blue-900 block">
                    تسجيل وحفظ الجهاز فوراً في قاعدة الأصول الرئيسية للنظام
                  </span>
                  <span className="text-[11px] text-blue-700 mt-0.5 block">
                    سيتم حفظه في سجل الأصول العام بالإضافة إلى مطابقة وجوده داخل جلسة الجرد الحالية.
                  </span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddNewAssetModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20"
                >
                  إضافة ومطابقة الجهاز الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: ACCESSORIES CHECKLIST INSPECTION */}
      {/* ========================================================================= */}
      {editingAccessoriesItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">فحص التوابع والملحقات</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {editingAccessoriesItem.deviceName} ({editingAccessoriesItem.customId})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingAccessoriesItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] pb-1">
                <span>حدد التوابع المتواجدة والمفحوصة مع الجهاز:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccessoriesItem({
                        ...editingAccessoriesItem,
                        accessories: editingAccessoriesItem.accessories.map((a) => ({ ...a, checked: true })),
                      });
                    }}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    تحديد الكل
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccessoriesItem({
                        ...editingAccessoriesItem,
                        accessories: editingAccessoriesItem.accessories.map((a) => ({ ...a, checked: false })),
                      });
                    }}
                    className="text-red-700 font-bold hover:underline"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>

              {/* Checklist list */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {editingAccessoriesItem.accessories.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-2xl">
                    لا توجد توابع مسجلة مسبقاً لهذا الجهاز. يمكنك إضافة التوابع أدناه.
                  </div>
                ) : (
                  editingAccessoriesItem.accessories.map((acc, index) => (
                    <div
                      key={index}
                      onClick={() => handleToggleAccessory(index)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        acc.checked
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {acc.checked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <span>{acc.name}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md ${acc.checked ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {acc.checked ? 'موجود وسليم ✅' : 'ناقص / مفقود ❌'}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Add on-the-fly accessory */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <input
                  type="text"
                  value={newAccessoryName}
                  onChange={(e) => setNewAccessoryName(e.target.value)}
                  placeholder="اسم ملحق إضافي (مثال: كابل USB، مجس...)"
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-600 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAccessoryToItem();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddAccessoryToItem}
                  className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800"
                >
                  إضافة
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingAccessoriesItem(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAccessories}
                className="px-5 py-2 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
              >
                حفظ فحص التوابع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: EDIT ITEM NOTE */}
      {/* ========================================================================= */}
      {editingNoteItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <MessageSquareQuote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">إضافة / تعديل ملاحظة الفحص</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {editingNoteItem.deviceName} ({editingNoteItem.customId})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingNoteItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Quick Tags */}
              <div>
                <label className="block text-slate-500 text-[11px] mb-1.5 font-bold">
                  قوالب وملاحظات سريعة:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'بحالة ممتازة ويعمل بكفاءة',
                    'يحتاج صيانة دورية ومعايرة',
                    'بدون لوحة بيانات أو سيريال',
                    'التوابع والملحقات غير مكتملة',
                    'نقل مؤقت لهذا القسم',
                    'تالف وبحاجة إلى استبدال',
                    'مقترح للشطب والتكهين',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setEditingNoteItem({
                          ...editingNoteItem,
                          note: editingNoteItem.note ? `${editingNoteItem.note} - ${tag}` : tag,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors border border-slate-200"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  نص الملاحظة:
                </label>
                <textarea
                  value={editingNoteItem.note}
                  onChange={(e) =>
                    setEditingNoteItem({ ...editingNoteItem, note: e.target.value })
                  }
                  rows={4}
                  placeholder="اكتب أية ملاحظات تفصيلية عن حالة الجهاز أثناء الجرد..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingNoteItem(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-5 py-2 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
              >
                حفظ الملاحظة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: FINALIZE AUDIT SESSION */}
      {/* ========================================================================= */}
      {showFinalizeModal && activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">اعتماد وإغلاق محضر الجرد</h3>
                  <p className="text-xs text-slate-500">تأكيد نتائج المطابقة وإغلاق الجلسة</p>
                </div>
              </div>
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900">ملخص نتائج دورة الجرد:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>الأجهزة المتوقعة: <strong>{activeSession.totalExpected}</strong></div>
                  <div className="text-emerald-700 font-bold">المطابق: {activeSession.totalMatched}</div>
                  <div className="text-amber-700 font-bold">المنقول: {activeSession.totalRelocated}</div>
                  <div className="text-blue-700 font-bold">غير المقيد (جديد): {activeSession.totalUnregistered}</div>
                  <div className="text-red-700 font-bold col-span-2">
                    المفقودات / العجز (سيتم توثيقه): {activeSession.items.filter((i) => i.status === 'معلق' || i.status === 'مفقود').length}
                  </div>
                </div>
              </div>

              {/* Toggle reconciliation */}
              <label className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyReconciliation}
                  onChange={(e) => setApplyReconciliation(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-emerald-900 block">
                    تطبيق المطابقة والتسوية آلياً على سجل الأصول الرئيسي
                  </span>
                  <span className="text-[11px] text-emerald-700 mt-0.5 block">
                    سيتم نقل الأجهزة التي تم رصدها بأقسام أخرى، وإضافة الأجهزة الجديدة غير المسجلة، وتحديث حالة المفقودات.
                  </span>
                </div>
              </label>

              <p className="text-[11px] text-slate-500">
                ⚠️ بمجرد الاعتماد، سيتم قفل جلسة الجرد وتوثيقها في سجل العمليات بصيغة غير قابلة للتعديل.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleFinalizeSession}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
              >
                تأكيد واعتماد المحضر الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: OFFICIAL LANDSCAPE PRINTABLE AUDIT REPORT (PDF) */}
      {/* ========================================================================= */}
      {showPrintModal && activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-7xl w-full shadow-2xl border border-slate-100 text-right p-6 space-y-6 max-h-[95vh] overflow-y-auto print-landscape-container print:p-0 print:m-0 print:border-none print:shadow-none">
            {/* Header controls (Hidden when printed) */}
            <div className="space-y-4 pb-4 border-b border-slate-200 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">محضر الجرد والمطابقة المعتمد (بالعرض Landscape)</h3>
                    <p className="text-xs text-slate-500">تم تجهيز التقرير بالوضع العرضي لضمان ظهور جميع الأعمدة والتفاصيل بوضوح وتخصيص القسم المجرود</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportAuditPDF}
                    disabled={isExportingPdf}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white shadow-md flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isExportingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري إنشاء ملف PDF بالعرض...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>تصدير وتحميل PDF (Landscape A4)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة فورية (Print)</span>
                  </button>

                  <button
                    onClick={() => setShowPrintModal(false)}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Department selector / filter toolbar for multi-department sessions */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-700">القسم المراد طباعة تقرير جرده:</span>
                  {activeSession.targetDepartment !== 'all' ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300">
                      {activeSession.targetDepartment} (قسم محدد لجلسة الجرد)
                    </span>
                  ) : (
                    <select
                      value={printDepartmentFilter}
                      onChange={(e) => setPrintDepartmentFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="all">كافة الأقسام المجرودة بالجلسة ({activeSession.items.length} أصل)</option>
                      {sessionAuditedDepartments.map((dept) => {
                        const count = activeSession.items.filter(
                          (i) => (i.actualDepartment || i.mainDepartment) === dept || i.mainDepartment === dept
                        ).length;
                        return (
                          <option key={dept} value={dept}>
                            قسم: {dept} ({count} جهاز/أصل)
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                <div className="text-slate-500 text-[11px]">
                  عدد الأصول المعروضة بالمحضر: <strong className="text-slate-900 font-mono text-xs">{printItems.length}</strong> جهاز
                </div>
              </div>

              {pdfExportError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{pdfExportError}</span>
                </div>
              )}
            </div>

            {/* Printable Content (Styled for Landscape Print) */}
            <div className="space-y-6 text-slate-900 font-['Tajawal']" id="audit-printable-area">
              {/* Report Header */}
              <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-2">
                  <div className="text-right">
                    <div>المملكة العربية السعودية</div>
                    <div>الشؤون الصحية وإدارة الأصول والخدمات الهندسية</div>
                    <div>نظام إدارة الأصول والعهد الفنية المتكامل</div>
                  </div>
                  <div className="text-center">
                    <h1 className="text-2xl font-black text-emerald-800">
                      محضر جرد ومطابقة الأصول والعهد الفنية
                    </h1>
                    <div className="text-xs font-bold text-slate-700 mt-1">
                      {printDepartmentFilter !== 'all'
                        ? `القسم الذي تم جرده: [ ${printDepartmentFilter} ]`
                        : activeSession.targetDepartment !== 'all'
                        ? `القسم الذي تم جرده: [ ${activeSession.targetDepartment} ]`
                        : 'تقرير الجرد الشامل لكافة الأقسام'}
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <div>رقم المحضر: <strong className="text-slate-900">{activeSession.sessionNumber}</strong></div>
                    <div>تاريخ الإصدار: <strong>{new Date().toISOString().split('T')[0]}</strong></div>
                    <div>وقت الطباعة: <strong>{new Date().toLocaleTimeString('ar-SA')}</strong></div>
                  </div>
                </div>
              </div>

              {/* Session Meta */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">عنوان دورة الجرد:</span>
                  <strong className="text-slate-900 text-sm">{activeSession.title}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">القسم الذي تم جرده:</span>
                  <strong className="text-emerald-800 text-sm font-black">
                    {printDepartmentFilter !== 'all'
                      ? printDepartmentFilter
                      : activeSession.targetDepartment === 'all'
                      ? 'كافة الأقسام المشمولة'
                      : activeSession.targetDepartment}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">القائم بالجرد الفني:</span>
                  <strong className="text-slate-900 text-sm">{activeSession.auditedBy}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">حالة المحضر:</span>
                  <strong className="text-emerald-700 text-sm">
                    {activeSession.status === 'مكتمل_معتمد' ? 'معتمد ومغلق ✅' : 'قيد التدقيق والمراجعة ⏳'}
                  </strong>
                </div>
              </div>

              {/* Statistics Matrix (Calculated specifically for the printed department) */}
              <div className="grid grid-cols-5 gap-2 text-center text-xs font-bold">
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-300">
                  <div className="text-slate-600 text-[10px]">المتوقع دفترياً بالقسم</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{printStats.totalExpected}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300">
                  <div className="text-emerald-800 text-[10px]">المطابق الفعلي المرصود</div>
                  <div className="text-lg font-black text-emerald-800 mt-0.5">{printStats.totalMatched}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300">
                  <div className="text-amber-800 text-[10px]">منقول من قسم آخر</div>
                  <div className="text-lg font-black text-amber-800 mt-0.5">{printStats.totalRelocated}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-300">
                  <div className="text-blue-800 text-[10px]">فائض (أجهزة جديدة غير مسجلة)</div>
                  <div className="text-lg font-black text-blue-800 mt-0.5">{printStats.totalUnregistered}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-300">
                  <div className="text-red-800 text-[10px]">العجز والمفقودات</div>
                  <div className="text-lg font-black text-red-800 mt-0.5">{printStats.totalMissing}</div>
                </div>
              </div>

              {/* Complete Expanded Landscape Items Table */}
              <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-right text-[10px] border-collapse">
                  <thead className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2 border-l border-slate-300 w-7 text-center">#</th>
                      <th className="p-2 border-l border-slate-300">كود الأصل (ID)</th>
                      <th className="p-2 border-l border-slate-300">اسم الجهاز والمعدة</th>
                      <th className="p-2 border-l border-slate-300">الموديل</th>
                      <th className="p-2 border-l border-slate-300">الرقم التسلسلي (S/N)</th>
                      <th className="p-2 border-l border-slate-300">القسم الدفتري</th>
                      <th className="p-2 border-l border-slate-300">القسم الفعلي</th>
                      <th className="p-2 border-l border-slate-300">الغرفة / الفرعي</th>
                      <th className="p-2 border-l border-slate-300">صاحب العهدة</th>
                      <th className="p-2 border-l border-slate-300 text-center">كمية دفترية</th>
                      <th className="p-2 border-l border-slate-300 text-center">كمية فعلية</th>
                      <th className="p-2 border-l border-slate-300 text-center">الفارق</th>
                      <th className="p-2 border-l border-slate-300">فحص التوابع والملحقات</th>
                      <th className="p-2 border-l border-slate-300 text-center">الحالة الفنية</th>
                      <th className="p-2 border-l border-slate-300 text-center">نتيجة الجرد</th>
                      <th className="p-2">ملاحظات وتدقيق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printItems.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="p-8 text-center text-slate-500 font-bold text-xs">
                          لا توجد أصول مسجلة لهذا القسم ضمن دورة الجرد الحالية
                        </td>
                      </tr>
                    ) : (
                      printItems.map((item, idx) => {
                        const expQty = item.expectedQuantity ?? 1;
                        const actQty = item.actualQuantity ?? 0;
                        const diff = actQty - expQty;

                        const accessoriesText =
                          (item.accessories || [])
                            .map((a) => `${a.name} (${a.checked ? 'موجود' : 'ناقص'})`)
                            .join('، ') || 'لا توجد توابع';

                        return (
                          <tr
                            key={item.id}
                            className={`text-slate-800 ${
                              idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                            }`}
                          >
                            <td className="p-2 border-l border-slate-200 text-slate-500 font-mono text-center">
                              {idx + 1}
                            </td>
                            <td className="p-2 border-l border-slate-200 font-bold font-mono whitespace-nowrap text-slate-900">
                              {item.customId}
                            </td>
                            <td className="p-2 border-l border-slate-200 font-medium">
                              {item.deviceName}
                            </td>
                            <td className="p-2 border-l border-slate-200 text-slate-600 font-mono">
                              {item.model || '-'}
                            </td>
                            <td className="p-2 border-l border-slate-200 font-mono text-slate-600 whitespace-nowrap">
                              {item.serialNumber || '-'}
                            </td>
                            <td className="p-2 border-l border-slate-200">{item.mainDepartment}</td>
                            <td className="p-2 border-l border-slate-200 font-bold text-emerald-800">
                              {item.actualDepartment || item.mainDepartment}
                            </td>
                            <td className="p-2 border-l border-slate-200 text-slate-600">
                              {item.actualSubDepartment || item.subDepartment || '-'}
                            </td>
                            <td className="p-2 border-l border-slate-200 text-slate-700">
                              {item.actualCustodian || item.expectedCustodian || '-'}
                            </td>
                            <td className="p-2 border-l border-slate-200 text-center font-mono font-bold">
                              {expQty}
                            </td>
                            <td className="p-2 border-l border-slate-200 text-center font-mono font-black text-slate-900">
                              {actQty}
                            </td>
                            <td className="p-2 border-l border-slate-200 text-center font-mono font-bold">
                              {diff === 0 ? (
                                <span className="text-slate-600">0</span>
                              ) : diff > 0 ? (
                                <span className="text-blue-700">+{diff}</span>
                              ) : (
                                <span className="text-red-700">{diff}</span>
                              )}
                            </td>
                            <td className="p-2 border-l border-slate-200 text-[9px] text-slate-700 leading-tight">
                              {accessoriesText}
                            </td>
                            <td className="p-2 border-l border-slate-200 text-center whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  item.actualCondition === 'عاطل'
                                    ? 'bg-red-100 text-red-800'
                                    : item.actualCondition === 'تالف'
                                    ? 'bg-slate-200 text-slate-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {item.actualCondition || 'شغال'}
                              </span>
                            </td>
                            <td className="p-2 border-l border-slate-200 text-center font-bold whitespace-nowrap">
                              {item.status === 'مطابق' ? (
                                <span className="text-emerald-700">مطابق ✅</span>
                              ) : item.status === 'منقول' ? (
                                <span className="text-amber-700">أصل منقول 🔄</span>
                              ) : item.status === 'جديد_غير_مسجل' ? (
                                <span className="text-blue-700">فائض جديد ➕</span>
                              ) : item.status === 'مفقود' ? (
                                <span className="text-red-700">مفقود / عجز ❌</span>
                              ) : (
                                <span className="text-slate-500">معلق</span>
                              )}
                            </td>
                            <td className="p-2 text-slate-600 text-[10px] leading-tight">
                              {item.notes || '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures Area */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-300 text-center text-xs">
                <div className="space-y-6">
                  <div className="font-bold text-slate-800">أمين / لجنة الجرد الفني</div>
                  <div className="text-slate-600 font-semibold">{activeSession.auditedBy}</div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400">التوقيع والاعتماد</div>
                </div>

                <div className="space-y-6">
                  <div className="font-bold text-slate-800">
                    {printDepartmentFilter !== 'all'
                      ? `مشرف قسم ${printDepartmentFilter}`
                      : activeSession.targetDepartment !== 'all'
                      ? `مشرف قسم ${activeSession.targetDepartment}`
                      : 'مشرف القسم المعني'}
                  </div>
                  <div className="text-slate-600 font-semibold">المشرف المسؤول</div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400">التوقيع والاعتماد</div>
                </div>

                <div className="space-y-6">
                  <div className="font-bold text-slate-800">مدير إدارة الأصول والصيانة</div>
                  <div className="text-slate-600 font-semibold">{activeSession.createdBy?.userName || 'مدير الإدارة'}</div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400">الختم والتصديق الرسمي</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode & QR Scanner Modal */}
      <BarcodeCameraScanner
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScanResult}
        title="مسح كود / سيريال الجهاز بالكاميرا"
        continuous={continuousCameraScan}
      />
    </div>
  );
};
