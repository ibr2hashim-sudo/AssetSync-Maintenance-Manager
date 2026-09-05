import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Scissors,
  Layers,
  Search,
  Plus,
  FileSpreadsheet,
  UploadCloud,
  Download,
  FolderArchive,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wrench,
  Trash2,
  Edit,
  Eye,
  Camera,
  Image as ImageIcon,
  Printer,
  ChevronRight,
  Filter,
  Check,
  X,
  RefreshCw,
  Sparkles,
  Info,
  Building2,
  PackageCheck,
  FileDown,
} from 'lucide-react';
import {
  SurgicalSet,
  SurgicalInstrument,
  SurgicalSetStatus,
  InstrumentStatus,
  User,
} from '../types';
import {
  SurgicalService,
  normalizeInstrumentCode,
  extractCodeFromFileName,
} from '../services/surgicalStorage';
import { StorageService } from '../services/storage';
import { SurgicalImage, resolveSurgicalImageUrl } from './SurgicalImage';

interface SurgicalSetsViewProps {
  currentUser: User | null;
  onRefresh?: () => void;
}

export const SurgicalSetsView: React.FC<SurgicalSetsViewProps> = ({
  currentUser,
}) => {
  const [sets, setSets] = useState<SurgicalSet[]>([]);
  const [instruments, setInstruments] = useState<SurgicalInstrument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Active Set being viewed/managed
  const [activeSet, setActiveSet] = useState<SurgicalSet | null>(null);

  // Modals state
  const [showAddSetModal, setShowAddSetModal] = useState(false);
  const [editingSet, setEditingSet] = useState<SurgicalSet | null>(null);
  const [setModalImageUrl, setSetModalImageUrl] = useState<string | null>(null);
  const [showAddInstModal, setShowAddInstModal] = useState(false);
  const [editingInst, setEditingInst] = useState<SurgicalInstrument | null>(null);
  const [instModalImageUrl, setInstModalImageUrl] = useState<string | null>(null);
  const [showBatchImageModal, setShowBatchImageModal] = useState(false);
  const [batchImageTargetSetId, setBatchImageTargetSetId] = useState<string | undefined>(undefined);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState<string>('');
  const [previewTarget, setPreviewTarget] = useState<{
    type: 'set' | 'instrument';
    set?: SurgicalSet;
    instrument?: SurgicalInstrument;
  } | null>(null);

  // Batch Image Import State
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [imageImportProgress, setImageImportProgress] = useState<{
    percent: number;
    currentFile: string;
    currentCount: number;
    totalCount: number;
  } | null>(null);
  const [batchImportReport, setBatchImportReport] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    results: any[];
  } | null>(null);

  // Loading & export states
  const [isExportingZip, setIsExportingZip] = useState(false);

  // File Inputs
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const batchImageInputRef = useRef<HTMLInputElement>(null);
  const singleImageInputRef = useRef<HTMLInputElement>(null);
  const setCoverInputRef = useRef<HTMLInputElement>(null);
  const [targetInstForImage, setTargetInstForImage] = useState<SurgicalInstrument | null>(null);
  const [targetSetForImage, setTargetSetForImage] = useState<SurgicalSet | null>(null);

  // Instrument search & view mode in Active Set
  const [instSearchTerm, setInstSearchTerm] = useState('');
  const [instStatusFilter, setInstStatusFilter] = useState('all');
  const [instViewMode, setInstViewMode] = useState<'table' | 'cards'>('table');

  // Load data
  const loadData = () => {
    // If previously initialized sample set exists, clean it up if it has sample ID
    const rawSets = localStorage.getItem('asset_mgmt_surgical_sets');
    if (rawSets && rawSets.includes('set-ortho-big-01')) {
      const parsedSets = JSON.parse(rawSets);
      const cleanedSets = Array.isArray(parsedSets) ? parsedSets.filter((s: any) => s.id !== 'set-ortho-big-01') : [];
      localStorage.setItem('asset_mgmt_surgical_sets', JSON.stringify(cleanedSets));
      
      const rawInst = localStorage.getItem('asset_mgmt_surgical_instruments');
      if (rawInst && rawInst.includes('set-ortho-big-01')) {
        const parsedInst = JSON.parse(rawInst);
        const cleanedInst = Array.isArray(parsedInst) ? parsedInst.filter((i: any) => i.setId !== 'set-ortho-big-01') : [];
        localStorage.setItem('asset_mgmt_surgical_instruments', JSON.stringify(cleanedInst));
      }
    }

    const s = SurgicalService.getSets();
    const inst = SurgicalService.getInstruments();
    setSets(s);
    setInstruments(inst);
    if (activeSet) {
      const refreshedActive = s.find((x) => x.id === activeSet.id);
      setActiveSet(refreshedActive || null);
    }
  };

  useEffect(() => {
    loadData();
    // Background recovery of any images previously imported and stored in IndexedDB
    SurgicalService.syncAndRecoverInstrumentImages().then((recovered) => {
      if (recovered > 0) {
        const s = SurgicalService.getSets();
        const inst = SurgicalService.getInstruments();
        setSets(s);
        setInstruments(inst);
      }
    });
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalSets = sets.length;
    const totalInsts = instruments.length;
    const readySets = sets.filter((s) => s.status === 'جاهز للاستخدام').length;
    const inSterilization = sets.filter((s) => s.status === 'قيد التعقيم').length;
    const inOR = sets.filter((s) => s.status === 'في العمليات').length;
    const needAttention = instruments.filter(
      (i) => i.status === 'تالف' || i.status === 'مفقود' || i.status === 'يحتاج سن'
    ).length;
    const totalImagesCount = instruments.filter((i) => !!i.imageUrl).length;

    return {
      totalSets,
      totalInsts,
      readySets,
      inSterilization,
      inOR,
      needAttention,
      totalImagesCount,
    };
  }, [sets, instruments]);

  // Filtered Sets
  const filteredSets = useMemo(() => {
    return sets
      .filter((set) => {
        if (selectedDeptFilter !== 'all' && set.department !== selectedDeptFilter) return false;
        if (selectedStatusFilter !== 'all' && set.status !== selectedStatusFilter) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          return (
            set.name.toLowerCase().includes(q) ||
            set.code.toLowerCase().includes(q) ||
            (set.subLocation && set.subLocation.toLowerCase().includes(q)) ||
            (set.trayNumber && set.trayNumber.toLowerCase().includes(q)) ||
            (set.notes && set.notes.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [sets, selectedDeptFilter, selectedStatusFilter, searchTerm]);

  // Filtered Instruments for Active Set
  const activeSetInstruments = useMemo(() => {
    if (!activeSet) return [];
    return instruments.filter((i) => i.setId === activeSet.id);
  }, [instruments, activeSet]);

  const filteredActiveSetInstruments = useMemo(() => {
    return activeSetInstruments.filter((inst) => {
      if (instStatusFilter !== 'all' && inst.status !== instStatusFilter) return false;
      if (instSearchTerm.trim()) {
        const q = instSearchTerm.toLowerCase();
        return (
          inst.code.toLowerCase().includes(q) ||
          inst.name.toLowerCase().includes(q) ||
          (inst.size && inst.size.toLowerCase().includes(q)) ||
          (inst.notes && inst.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [activeSetInstruments, instStatusFilter, instSearchTerm]);

  // Handle Excel Import
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await SurgicalService.importSetsAndInstrumentsFromExcel(file);
      loadData();
      StorageService.addHistoryLog(
        'أصول',
        'استيراد سيت جراحي من إكسل',
        `تم استيراد ${res.instrumentsCreated} أداة جراحية لسيت (${res.setName}) بنجاح`,
        currentUser?.fullName || 'مستخدم',
        currentUser?.role || 'admin'
      );
      alert(`✅ تم استيراد السيت بنجاح!\n• اسم السيت: ${res.setName}\n• عدد الأدوات المضافة: ${res.instrumentsCreated} أداة`);
    } catch (err: any) {
      alert(`❌ فشل استيراد ملف الإكسل: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      if (excelFileInputRef.current) excelFileInputRef.current.value = '';
    }
  };

  // Handle Batch Images Selection & Matching
  const handleBatchImagesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingImages(true);
    setImageImportProgress({
      percent: 0,
      currentFile: files[0].name,
      currentCount: 0,
      totalCount: files.length,
    });

    try {
      const fileList: File[] = Array.from(files);
      const report = await SurgicalService.batchImportImages(
        fileList,
        batchImageTargetSetId,
        (percent, currentFileName, currentCount, totalCount) => {
          setImageImportProgress({
            percent,
            currentFile: currentFileName,
            currentCount,
            totalCount,
          });
        }
      );
      setBatchImportReport(report);
      setShowBatchImageModal(true);
      loadData();

      StorageService.addHistoryLog(
        'أصول',
        'استيراد صور أدوات جراحية',
        `تمت مطابقة وحفظ ${report.matched} صورة من أصل ${report.total} ملف`,
        currentUser?.fullName || 'مستخدم',
        currentUser?.role || 'admin'
      );
    } catch (err: any) {
      alert(`❌ حدث خطأ أثناء معالجة الصور: ${err?.message || ''}`);
    } finally {
      setIsProcessingImages(false);
      setImageImportProgress(null);
      if (batchImageInputRef.current) batchImageInputRef.current.value = '';
    }
  };

  // Open Image Preview (Lightbox) with direct enlargement and edit capability
  const openImagePreview = async (
    type: 'set' | 'instrument',
    item: SurgicalSet | SurgicalInstrument,
    title: string
  ) => {
    setPreviewImageTitle(title);
    if (type === 'set') {
      const s = item as SurgicalSet;
      setPreviewTarget({ type: 'set', set: s });
      const url = await resolveSurgicalImageUrl({ imageUrl: s.imageUrl, setId: s.id, code: s.code });
      setPreviewImageUrl(url || null);
    } else {
      const inst = item as SurgicalInstrument;
      setPreviewTarget({ type: 'instrument', instrument: inst });
      const url = await resolveSurgicalImageUrl({ imageUrl: inst.imageUrl, code: inst.code, id: inst.id });
      setPreviewImageUrl(url || null);
    }
  };

  // Delete image from currently previewed item
  const handleDeletePreviewImage = () => {
    if (!previewTarget) return;
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الصورة؟')) return;

    if (previewTarget.type === 'set' && previewTarget.set) {
      previewTarget.set.imageUrl = undefined;
      SurgicalService.saveSet(previewTarget.set);
      loadData();
      setPreviewImageUrl(null);
      alert('✅ تم حذف صورة غلاف السيت');
    } else if (previewTarget.type === 'instrument' && previewTarget.instrument) {
      previewTarget.instrument.imageUrl = undefined;
      SurgicalService.saveInstrument(previewTarget.instrument);
      loadData();
      setPreviewImageUrl(null);
      alert('✅ تم حذف صورة الأداة');
    }
  };

  // Handle Single Image Upload
  const handleSingleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetInstForImage) return;

    try {
      const base64 = await SurgicalService.fileToBase64(file);
      targetInstForImage.imageUrl = base64;
      SurgicalService.saveInstrument(targetInstForImage);
      loadData();
      // Keep preview updated if preview modal is open
      setPreviewImageUrl(base64);
      alert(`✅ تم تحديث صورة الأداة (${targetInstForImage.code} - ${targetInstForImage.name}) بنجاح`);
    } catch (err: any) {
      alert(`❌ فشل حفظ الصورة: ${err?.message}`);
    } finally {
      setTargetInstForImage(null);
      if (singleImageInputRef.current) singleImageInputRef.current.value = '';
    }
  };

  // Handle Direct Set Cover Image Upload
  const handleSetCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetSetForImage) return;

    try {
      const base64 = await SurgicalService.fileToBase64(file);
      targetSetForImage.imageUrl = base64;
      SurgicalService.saveSet(targetSetForImage);
      loadData();
      // Keep preview updated if preview modal is open
      setPreviewImageUrl(base64);
      alert(`✅ تم تعيين صورة غلاف السيت (${targetSetForImage.name}) بنجاح`);
    } catch (err: any) {
      alert(`❌ فشل تعيين صورة السيت: ${err?.message}`);
    } finally {
      setTargetSetForImage(null);
      if (setCoverInputRef.current) setCoverInputRef.current.value = '';
    }
  };

  // Handle Export ZIP of Images
  const handleExportImagesZip = async (setId?: string) => {
    setIsExportingZip(true);
    try {
      const { blob, count, filename } = await SurgicalService.exportImagesToZip(setId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`✅ تم تصدير ${count} صورة بنجاح في ملف مضغوط (${filename})`);
    } catch (err: any) {
      alert(`⚠️ ${err?.message || 'لا توجد صور لتصديرها'}`);
    } finally {
      setIsExportingZip(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: SurgicalSetStatus) => {
    switch (status) {
      case 'جاهز للاستخدام':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'قيد التعقيم':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'في العمليات':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'ناقص / يحتاج استكمال':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'صيانة / سن':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getInstStatusBadge = (status: InstrumentStatus) => {
    switch (status) {
      case 'سليم':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'تالف':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'مفقود':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'يحتاج سن':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'مستبعد':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={excelFileInputRef}
        onChange={handleExcelImport}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />
      <input
        type="file"
        ref={batchImageInputRef}
        onChange={handleBatchImagesSelected}
        accept="image/*"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={singleImageInputRef}
        onChange={handleSingleImageUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={setCoverInputRef}
        onChange={handleSetCoverUpload}
        accept="image/*"
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* HEADER & HERO BANNER */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 text-right z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
            <Scissors className="w-3.5 h-3.5" />
            <span>نظام إدارة أطقم وسيتات الأدوات الجراحية (CSSD & Trays)</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            السيتات والأدوات الجراحية
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            توثيق كامل لكافة سيتات العمليات، قوائم الفحص والمطابقة الدفترية، استيراد وتصدير ملفات الإكسل، ومطابقة صور الأدوات تلقائياً حسب كود الأداة.
          </p>
        </div>

        {/* Action Buttons in Hero */}
        <div className="flex flex-wrap items-center gap-2.5 z-10 w-full md:w-auto justify-end">
          {/* Add Set */}
          {currentUser?.role !== 'supervisor' && (
            <button
              onClick={() => {
                setEditingSet(null);
                setSetModalImageUrl(null);
                setShowAddSetModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سيت جديد</span>
            </button>
          )}

          {/* Import Excel */}
          <button
            onClick={() => excelFileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
            title="استيراد سيت من جدول إكسل بنفس تنسيق نموذج الجرد"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>استيراد إكسل</span>
          </button>

          {/* Batch Image Import */}
          <button
            onClick={() => {
              setBatchImageTargetSetId(undefined);
              batchImageInputRef.current?.click();
            }}
            disabled={isProcessingImages}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
            title="استيراد صور الأدوات ومطابقتها تلقائياً مع الأكواد (مثل OB-1.jpg)"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isProcessingImages ? 'جارِ المعالجة...' : 'استيراد صور'}</span>
          </button>

          {/* Batch Image Export ZIP */}
          <button
            onClick={() => handleExportImagesZip()}
            disabled={isExportingZip || metrics.totalImagesCount === 0}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="تصدير جميع صور الأدوات في ملف مضغوط ZIP"
          >
            <FolderArchive className="w-4 h-4 text-amber-400" />
            <span>{isExportingZip ? 'جارِ الضغط...' : 'تصدير الصور (ZIP)'}</span>
          </button>

          {/* Export All Sets Excel */}
          <button
            onClick={() => SurgicalService.exportAllSetsToExcel()}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold shadow-sm transition-all cursor-pointer"
            title="تصدير سجل كامل لكافة السيتات والأدوات إلى Excel"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>تصدير الكل (Excel)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* METRICS ROW */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{metrics.totalSets}</div>
            <div className="text-[11px] text-slate-500 font-medium">إجمالي السيتات</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{metrics.totalInsts}</div>
            <div className="text-[11px] text-slate-500 font-medium">إجمالي الأدوات</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{metrics.readySets}</div>
            <div className="text-[11px] text-slate-500 font-medium">سيتات جاهزة</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{metrics.inSterilization}</div>
            <div className="text-[11px] text-slate-500 font-medium">قيد التعقيم</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{metrics.inOR}</div>
            <div className="text-[11px] text-slate-500 font-medium">في العمليات</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{metrics.needAttention}</div>
            <div className="text-[11px] text-slate-500 font-medium">أدوات تحتاج صيانة/سن</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN VIEW: EITHER SETS LIST OR ACTIVE SET DETAIL */}
      {/* ========================================================================= */}
      {!activeSet ? (
        /* ------------------ SETS LIST VIEW ------------------ */
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 w-full md:w-auto flex-1">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث باسم السيت، الكود، الموقع..."
                  className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Status Filter */}
              <div className="shrink-0">
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="all">كل الحالات</option>
                  <option value="جاهز للاستخدام">جاهز للاستخدام</option>
                  <option value="قيد التعقيم">قيد التعقيم</option>
                  <option value="في العمليات">في العمليات</option>
                  <option value="ناقص / يحتاج استكمال">ناقص / يحتاج استكمال</option>
                  <option value="صيانة / سن">صيانة / سن</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium self-end md:self-center">
              عدد السيتات المطابقة: <strong className="text-slate-900">{filteredSets.length}</strong>
            </div>
          </div>

          {/* Sets Cards Grid */}
          {filteredSets.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200/80 text-center space-y-3">
              <Scissors className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">لا توجد سيتات جراحية مسجلة</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                يمكنك إضافة سيت جراحي جديد يدوياً، أو استيراد ملف الإكسل الخاص بقائمة محتويات السيتات مباشرة.
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setEditingSet(null);
                    setSetModalImageUrl(null);
                    setShowAddSetModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  إضافة سيت جديد
                </button>
                <button
                  onClick={() => excelFileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  استيراد من إكسل
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSets.map((set) => {
                const count = instruments.filter((i) => i.setId === set.id).length;
                const imagesCount = instruments.filter((i) => i.setId === set.id && !!i.imageUrl).length;
                const damagedCount = instruments.filter(
                  (i) => i.setId === set.id && (i.status === 'تالف' || i.status === 'مفقود' || i.status === 'يحتاج سن')
                ).length;

                return (
                  <div
                    key={set.id}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                  >
                    <div>
                      {/* Set Card Top Header */}
                      <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            onClick={() => openImagePreview('set', set, `غلاف سيت: ${set.name}`)}
                            className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200/80 shadow-md shadow-blue-500/10 shrink-0 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center cursor-pointer hover:opacity-90 hover:scale-105 transition-all"
                            title="انقر لتكبير ومعاينة صورة غلاف السيت"
                          >
                            <SurgicalImage
                              src={set.imageUrl}
                              setId={set.id}
                              code={set.code}
                              alt={set.name}
                              className="w-full h-full object-cover pointer-events-none"
                              containerClassName="w-full h-full flex items-center justify-center"
                              fallbackIcon={<Layers className="w-6 h-6 text-white" />}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                {set.code}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                                  set.status
                                )}`}
                              >
                                {set.status}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                              {set.name}
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {set.department} {set.subLocation ? `• ${set.subLocation}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Set Statistics & Details */}
                      <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                          <div className="font-mono font-bold text-slate-900 text-sm">{count}</div>
                          <div className="text-[10px] text-slate-500 font-medium">أداة بالسيت</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                          <div className="font-mono font-bold text-indigo-600 text-sm">{imagesCount}</div>
                          <div className="text-[10px] text-slate-500 font-medium">صور الأدوات</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                          <div className={`font-mono font-bold text-sm ${damagedCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {damagedCount}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">تالف / ناقص</div>
                        </div>
                      </div>

                      {/* Notes / Container info */}
                      {set.notes && (
                        <div className="p-4 text-[11px] text-slate-600 bg-white">
                          <span className="font-bold text-slate-700">ملاحظات: </span>
                          {set.notes}
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setActiveSet(set)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>فتح السيت والأدوات ({count})</span>
                      </button>

                      {/* Quick Dropdown / Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setTargetSetForImage(set);
                            setCoverInputRef.current?.click();
                          }}
                          title="تغيير أو اختيار صورة غلاف السيت"
                          className="p-2 rounded-xl bg-white hover:bg-blue-50 text-blue-600 border border-slate-200 transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setBatchImageTargetSetId(set.id);
                            batchImageInputRef.current?.click();
                          }}
                          title="استيراد صور أدوات هذا السيت دفعة واحدة (مطابقة بالأكواد)"
                          className="p-2 rounded-xl bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 transition-colors"
                        >
                          <UploadCloud className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => SurgicalService.exportSetToExcel(set.id)}
                          title="تصدير جدول محتويات السيت إلى Excel"
                          className="p-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-600 border border-slate-200 transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        {currentUser?.role !== 'supervisor' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingSet(set);
                                setSetModalImageUrl(set.imageUrl || null);
                                setShowAddSetModal(true);
                              }}
                              title="تعديل بيانات السيت"
                              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف سيت (${set.name}) وجميع أدواته؟`)) {
                                  SurgicalService.deleteSet(set.id);
                                  loadData();
                                }
                              }}
                              title="حذف السيت"
                              className="p-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ------------------ ACTIVE SET DETAIL & INSTRUMENTS MANAGER ------------------ */
        <div className="space-y-5">
          {/* Top Breadcrumb & Return Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveSet(null)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>العودة لكل السيتات</span>
              </button>
              <div className="h-5 w-[1px] bg-slate-200" />
              
              {/* Set Cover Thumbnail */}
              <div
                onClick={() => openImagePreview('set', activeSet, `غلاف سيت: ${activeSet.name}`)}
                className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 cursor-pointer hover:opacity-90 hover:scale-105 transition-all shadow-xs"
                title="انقر لتكبير ومعاينة صورة غلاف السيت"
              >
                <SurgicalImage
                  src={activeSet.imageUrl}
                  setId={activeSet.id}
                  code={activeSet.code}
                  alt={activeSet.name}
                  className="w-full h-full object-cover pointer-events-none"
                  containerClassName="w-full h-full flex items-center justify-center"
                  fallbackIcon={<Layers className="w-5 h-5 text-white" />}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900">{activeSet.name}</h2>
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                    {activeSet.code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                      activeSet.status
                    )}`}
                  >
                    {activeSet.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeSet.department} {activeSet.subLocation ? `• ${activeSet.subLocation}` : ''} • إجمالي الأدوات: {activeSetInstruments.length} أداة
                </p>
              </div>
            </div>

            {/* Actions for this specific set */}
            <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
              {/* Set Cover Image Button */}
              <button
                onClick={() => {
                  setTargetSetForImage(activeSet);
                  setCoverInputRef.current?.click();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title="تغيير أو اختيار صورة الغلاف الرئيسية لهذا السيت"
              >
                <Camera className="w-4 h-4" />
                <span>صورة غلاف السيت</span>
              </button>

              {/* Checklist / Count Button */}
              <button
                onClick={() => setShowChecklistModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors"
                title="جرد ومطابقة محتويات السيت السريع"
              >
                <PackageCheck className="w-4 h-4" />
                <span>جرد وفحص السيت</span>
              </button>

              {/* Batch Images for this set */}
              <button
                onClick={() => {
                  setBatchImageTargetSetId(activeSet.id);
                  batchImageInputRef.current?.click();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors"
                title="استيراد صور للأدوات داخل هذا السيت ومطابقتها بأكواد الأدوات"
              >
                <UploadCloud className="w-4 h-4" />
                <span>استيراد صور أدوات السيت (بالكود)</span>
              </button>

              {/* Export ZIP of this set */}
              <button
                onClick={() => handleExportImagesZip(activeSet.id)}
                disabled={isExportingZip}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-xs transition-colors"
                title="تصدير كافة صور هذا السيت في ملف مضغوط"
              >
                <FolderArchive className="w-4 h-4 text-amber-400" />
                <span>تصدير الصور (ZIP)</span>
              </button>

              {/* Export Excel for this set */}
              <button
                onClick={() => SurgicalService.exportSetToExcel(activeSet.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors"
                title="تصدير جدول محتويات السيت إلى Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>تصدير Excel</span>
              </button>

              {/* Add Instrument */}
              {currentUser?.role !== 'supervisor' && (
                <button
                  onClick={() => {
                    setEditingInst(null);
                    setInstModalImageUrl(null);
                    setShowAddInstModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة أداة</span>
                </button>
              )}
            </div>
          </div>

          {/* Instruments Filter & Search Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={instSearchTerm}
                  onChange={(e) => setInstSearchTerm(e.target.value)}
                  placeholder="بحث بالكود (مثل OB-1)، الاسم، المقاس..."
                  className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Status Filter */}
              <select
                value={instStatusFilter}
                onChange={(e) => setInstStatusFilter(e.target.value)}
                className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">كل حالات الأدوات</option>
                <option value="سليم">سليم</option>
                <option value="تالف">تالف</option>
                <option value="مفقود">مفقود</option>
                <option value="يحتاج سن">يحتاج سن</option>
                <option value="مستبعد">مستبعد</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setInstViewMode('table')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  instViewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                عرض جدول
              </button>
              <button
                onClick={() => setInstViewMode('cards')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  instViewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                عرض صور وكروت
              </button>
            </div>
          </div>

          {/* Instruments Content */}
          {filteredActiveSetInstruments.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200/80 text-center space-y-2">
              <Scissors className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">لا توجد أدوات مطابقة لمعايير البحث داخل هذا السيت</p>
            </div>
          ) : instViewMode === 'table' ? (
            /* TABLE VIEW */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-700 font-bold">
                    <tr>
                      <th className="p-3 w-16 text-center">الصورة</th>
                      <th className="p-3 w-24">كود الأداة</th>
                      <th className="p-3">اسم الأداة الجراحية</th>
                      <th className="p-3 w-32">النوع / المقاس</th>
                      <th className="p-3 w-20 text-center">الكمية</th>
                      <th className="p-3 w-20 text-center">الدفترية</th>
                      <th className="p-3 w-28 text-center">الحالة</th>
                      <th className="p-3">ملاحظات</th>
                      <th className="p-3 w-28 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredActiveSetInstruments.map((inst) => (
                      <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Image Thumbnail */}
                        <td className="p-2 text-center">
                          <div
                            onClick={() => openImagePreview('instrument', inst, `${inst.code} - ${inst.name}`)}
                            className="inline-block w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-2xs align-middle cursor-pointer hover:scale-105 transition-transform bg-slate-50"
                            title="انقر لتكبير ومعاينة صورة الأداة"
                          >
                            <SurgicalImage
                              src={inst.imageUrl}
                              code={inst.code}
                              instrumentId={inst.id}
                              alt={inst.name}
                              className="w-full h-full object-cover pointer-events-none"
                              containerClassName="w-full h-full flex items-center justify-center bg-slate-50"
                              fallbackIcon={<Scissors className="w-4 h-4 text-slate-400" />}
                            />
                          </div>
                        </td>

                        {/* Code */}
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                            {inst.code}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="p-3 whitespace-nowrap font-bold text-slate-900">
                          {inst.name}
                        </td>

                        {/* Size */}
                        <td className="p-3 whitespace-nowrap text-slate-600 font-medium">
                          {inst.size || '—'}
                        </td>

                        {/* Quantity */}
                        <td className="p-3 whitespace-nowrap text-center font-mono font-bold text-slate-900">
                          {inst.quantity}
                        </td>

                        {/* Actual Quantity */}
                        <td className="p-3 whitespace-nowrap text-center font-mono font-bold text-slate-700">
                          {inst.actualQuantity ?? inst.quantity}
                        </td>

                        {/* Status */}
                        <td className="p-3 whitespace-nowrap text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getInstStatusBadge(
                              inst.status
                            )}`}
                          >
                            {inst.status}
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="p-3 text-slate-500 max-w-xs truncate">
                          {inst.notes || '—'}
                        </td>

                        {/* Actions */}
                        <td className="p-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setTargetInstForImage(inst);
                                singleImageInputRef.current?.click();
                              }}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                              title="تغيير / رفع صورة"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                            {currentUser?.role !== 'supervisor' && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingInst(inst);
                                    setInstModalImageUrl(inst.imageUrl || null);
                                    setShowAddInstModal(true);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
                                  title="تعديل الأداة"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`حذف أداة (${inst.code} - ${inst.name})؟`)) {
                                      SurgicalService.deleteInstrument(inst.id);
                                      loadData();
                                    }
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors"
                                  title="حذف الأداة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* VISUAL PHOTO CARDS GRID VIEW */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredActiveSetInstruments.map((inst) => (
                <div
                  key={inst.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group"
                >
                  <div>
                    {/* Image Box */}
                    <div
                      onClick={() => openImagePreview('instrument', inst, `${inst.code} - ${inst.name}`)}
                      className="aspect-square bg-slate-100 relative overflow-hidden flex items-center justify-center cursor-pointer group/cardimg"
                      title="انقر لتكبير ومعاينة صورة الأداة"
                    >
                      <SurgicalImage
                        src={inst.imageUrl}
                        code={inst.code}
                        instrumentId={inst.id}
                        alt={inst.name}
                        className="w-full h-full object-cover group-hover/cardimg:scale-105 transition-transform pointer-events-none"
                        containerClassName="w-full h-full flex items-center justify-center"
                        fallbackIcon={
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                            <Scissors className="w-7 h-7 mb-1 opacity-50" />
                            <span className="text-[10px] font-bold text-slate-400">معاينة / إضافة</span>
                          </div>
                        }
                      />

                      {/* Code Badge Overlay */}
                      <span className="absolute top-2 right-2 font-mono text-[10px] font-bold bg-slate-900/80 text-white px-2 py-0.5 rounded-md backdrop-blur-xs shadow-xs">
                        {inst.code}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="p-3 space-y-1 text-right">
                      <h4 className="font-bold text-slate-900 text-xs truncate" title={inst.name}>
                        {inst.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {inst.size ? `المقاس: ${inst.size}` : 'مقاس قياسي'} • العدد: {inst.quantity}
                      </p>
                      <div className="pt-1">
                        <span
                          className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-md border ${getInstStatusBadge(
                            inst.status
                          )}`}
                        >
                          {inst.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer buttons */}
                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => {
                        setTargetInstForImage(inst);
                        singleImageInputRef.current?.click();
                      }}
                      className="text-blue-600 hover:underline font-bold text-[10px]"
                    >
                      تغيير الصورة
                    </button>
                    {currentUser?.role !== 'supervisor' && (
                      <button
                        onClick={() => {
                          setEditingInst(inst);
                          setInstModalImageUrl(inst.imageUrl || null);
                          setShowAddInstModal(true);
                        }}
                        className="text-slate-600 hover:text-slate-900 text-[10px]"
                      >
                        تعديل
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMAGE IMPORT PROGRESS BAR */}
      {/* ========================================================================= */}
      {imageImportProgress && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center animate-pulse">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">جاري استيراد ومطابقة الصور</h3>
                  <p className="text-xs text-slate-500">يرجى الانتظار حتى اكتمال معالجة الملفات...</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 truncate max-w-[200px]" title={imageImportProgress.currentFile}>
                  الملف: {imageImportProgress.currentFile}
                </span>
                <span className="text-indigo-600 font-mono text-sm">{imageImportProgress.percent}%</span>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full transition-all duration-200"
                  style={{ width: `${imageImportProgress.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>تمت معالجة {imageImportProgress.currentCount} من أصل {imageImportProgress.totalCount} صورة</span>
                <span className="flex items-center gap-1 text-indigo-600 font-bold">
                  <RefreshCw className="w-3 h-3 animate-spin" /> جاري الحفظ
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BATCH IMAGE IMPORT REPORT */}
      {/* ========================================================================= */}
      {showBatchImageModal && batchImportReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-right max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">تقرير استيراد ومطابقة صور الأدوات</h3>
                  <p className="text-xs text-slate-500">نتيجة المطابقة التلقائية لأسماء ملفات الصور مع أكواد الأدوات</p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchImageModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="text-lg font-black text-slate-900">{batchImportReport.total}</div>
                <div className="text-slate-500 text-[11px]">إجمالي الصور</div>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                <div className="text-lg font-black text-emerald-700">{batchImportReport.matched}</div>
                <div className="text-emerald-700 text-[11px] font-bold">تم ربطها بنجاح</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200">
                <div className="text-lg font-black text-amber-700">{batchImportReport.unmatched}</div>
                <div className="text-amber-700 text-[11px] font-bold">لم يُعثر على كود</div>
              </div>
            </div>

            {/* Results Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5">اسم ملف الصورة</th>
                    <th className="p-2.5">الكود المستخرج</th>
                    <th className="p-2.5">الأداة المطابقة</th>
                    <th className="p-2.5 text-center">النتيجة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchImportReport.results.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-[11px] text-slate-600">{r.fileName}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-900">{r.detectedCode || '—'}</td>
                      <td className="p-2.5 font-medium text-slate-800">
                        {r.matchedInstrumentName ? (
                          <div>
                            <div>{r.matchedInstrumentName}</div>
                            <div className="text-[10px] text-slate-400">{r.matchedSetName}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">لا يوجد تطابق</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {r.success ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[10px] border border-emerald-200">
                            <Check className="w-3 h-3" /> تم الربط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold text-[10px] border border-rose-200">
                            <X className="w-3 h-3" /> فشل
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end pt-2 border-t">
              <button
                onClick={() => setShowBatchImageModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                إغلاق التقرير
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FAST TRAY CHECKLIST & COUNT SHEET */}
      {/* ========================================================================= */}
      {showChecklistModal && activeSet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 text-right max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    ورقة جرد ومطابقة محتويات السيت: {activeSet.name}
                  </h3>
                  <p className="text-xs text-slate-500">فحص وتوثيق اكتمال الأدوات قبل وبعد العمليات / التعقيم</p>
                </div>
              </div>
              <button
                onClick={() => setShowChecklistModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Set Status Changer */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">حالة السيت الحالية:</span>
                <select
                  value={activeSet.status}
                  onChange={(e) => {
                    activeSet.status = e.target.value as SurgicalSetStatus;
                    SurgicalService.saveSet(activeSet);
                    loadData();
                  }}
                  className="py-1.5 px-3 rounded-xl bg-white border border-slate-300 font-bold text-xs"
                >
                  <option value="جاهز للاستخدام">جاهز للاستخدام</option>
                  <option value="قيد التعقيم">قيد التعقيم</option>
                  <option value="في العمليات">في العمليات</option>
                  <option value="ناقص / يحتاج استكمال">ناقص / يحتاج استكمال</option>
                  <option value="صيانة / سن">صيانة / سن</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة ورقة الفحص</span>
                </button>
              </div>
            </div>

            {/* Checklist Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-right text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-3 w-20">الكود</th>
                    <th className="p-3">اسم الأداة الجراحية</th>
                    <th className="p-3 w-24">المقاس</th>
                    <th className="p-3 w-20 text-center">الكمية القياسية</th>
                    <th className="p-3 w-24 text-center">الكمية الفعلية</th>
                    <th className="p-3 w-32 text-center">حالة الأداة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeSetInstruments.map((inst) => (
                    <tr key={inst.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">{inst.code}</td>
                      <td className="p-3 font-bold text-slate-900">{inst.name}</td>
                      <td className="p-3 text-slate-500">{inst.size || '—'}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-900">{inst.quantity}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={inst.actualQuantity ?? inst.quantity}
                          onChange={(e) => {
                            inst.actualQuantity = Number(e.target.value);
                            SurgicalService.saveInstrument(inst);
                            loadData();
                          }}
                          className="w-16 text-center py-1 px-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <select
                          value={inst.status}
                          onChange={(e) => {
                            inst.status = e.target.value as InstrumentStatus;
                            SurgicalService.saveInstrument(inst);
                            loadData();
                          }}
                          className="py-1 px-2 rounded-lg border border-slate-300 font-bold text-[11px]"
                        >
                          <option value="سليم">سليم</option>
                          <option value="تالف">تالف</option>
                          <option value="مفقود">مفقود</option>
                          <option value="يحتاج سن">يحتاج سن</option>
                          <option value="مستبعد">مستبعد</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t text-xs">
              <span className="text-slate-500 font-medium">
                تاريخ الجرد والمطابقة: <strong className="text-slate-900">{new Date().toLocaleDateString('ar-EG')}</strong>
              </span>
              <button
                onClick={() => {
                  activeSet.lastAuditDate = new Date().toISOString().split('T')[0];
                  SurgicalService.saveSet(activeSet);
                  loadData();
                  setShowChecklistModal(false);
                  StorageService.addHistoryLog(
                    'جرد',
                    'جرد ومطابقة سيت جراحي',
                    `تم جرد وتحديث حالة سيت (${activeSet.name})`,
                    currentUser?.fullName || 'مستخدم',
                    currentUser?.role || 'admin'
                  );
                  alert('✅ تم اعتماد وحفظ فحص ومطابقة السيت بنجاح');
                }}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold"
              >
                حفظ واعتماد الجرد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT SURGICAL SET */}
      {/* ========================================================================= */}
      {showAddSetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingSet ? 'تعديل بيانات السيت الجراحي' : 'إضافة سيت جراحي جديد'}
              </h3>
              <button
                onClick={() => setShowAddSetModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('name') as string;
                const code = formData.get('code') as string;
                const department = formData.get('department') as string;
                const subLocation = formData.get('subLocation') as string;
                const trayNumber = formData.get('trayNumber') as string;
                const status = formData.get('status') as SurgicalSetStatus;
                const notes = formData.get('notes') as string;

                if (!name.trim() || !code.trim()) {
                  alert('يرجى كتابة اسم السيت وكود السيت.');
                  return;
                }

                const newSet: SurgicalSet = {
                  id: editingSet ? editingSet.id : `set-${Date.now()}`,
                  name,
                  code,
                  department: department || 'العمليات (OR)',
                  subLocation,
                  trayNumber,
                  status,
                  notes,
                  imageUrl: setModalImageUrl ?? editingSet?.imageUrl,
                  instrumentsCount: editingSet?.instrumentsCount || 0,
                  createdAt: editingSet?.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };

                SurgicalService.saveSet(newSet);
                loadData();
                setShowAddSetModal(false);
              }}
              className="space-y-3 text-xs"
            >
              {/* Set Cover Image Field */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block font-bold text-slate-700 mb-2">صورة غلاف السيت (اختياري)</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-white flex items-center justify-center shrink-0 shadow-2xs">
                    {setModalImageUrl ? (
                      <img src={setModalImageUrl} alt="غلاف السيت" className="w-full h-full object-cover" />
                    ) : (
                      <Layers className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-bold text-xs cursor-pointer border border-slate-200 shadow-2xs transition-colors">
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>{setModalImageUrl ? 'تغيير صورة الغلاف' : 'اختيار صورة من جهازك'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const b64 = await SurgicalService.fileToBase64(f);
                            setSetModalImageUrl(b64);
                          }
                        }}
                      />
                    </label>
                    {setModalImageUrl && (
                      <button
                        type="button"
                        onClick={() => setSetModalImageUrl(null)}
                        className="text-[11px] text-rose-600 font-bold block hover:underline"
                      >
                        إزالة الصورة
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400">ستظهر كصورة رئيسية للسيت في قائمة الأطقم وبطاقة العمليات.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم السيت الجراحي *</label>
                <input
                  name="name"
                  defaultValue={editingSet?.name || ''}
                  placeholder="مثال: Ortho Big Set / سيت عظام كبرى"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">كود السيت / الباركود *</label>
                  <input
                    name="code"
                    defaultValue={editingSet?.code || `SET-${Date.now().toString().slice(-4)}`}
                    placeholder="مثال: SET-OB-01"
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الحاوية / Tray</label>
                  <input
                    name="trayNumber"
                    defaultValue={editingSet?.trayNumber || ''}
                    placeholder="حاوية تعقيم #01"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">القسم الرئيسي</label>
                  <select
                    name="department"
                    defaultValue={editingSet?.department || 'الجراحة العامة'}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  >
                    <option value="الجراحة العامة">الجراحة العامة</option>
                    <option value="الطوارئ">الطوارئ</option>
                    <option value="العمليات (OR)">العمليات (OR)</option>
                    <option value="النساء والتوليد">النساء والتوليد</option>
                    <option value="جراحة العظام">جراحة العظام</option>
                    <option value="جراحة المسالك">جراحة المسالك</option>
                    <option value="قسم التعقيم المركزي (CSSD)">قسم التعقيم المركزي (CSSD)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الموقع / الرف التخزيني</label>
                  <input
                    name="subLocation"
                    defaultValue={editingSet?.subLocation || ''}
                    placeholder="مستودع السيتات المعقمة - رف A1"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">حالة السيت</label>
                <select
                  name="status"
                  defaultValue={editingSet?.status || 'جاهز للاستخدام'}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="جاهز للاستخدام">جاهز للاستخدام</option>
                  <option value="قيد التعقيم">قيد التعقيم</option>
                  <option value="في العمليات">في العمليات</option>
                  <option value="ناقص / يحتاج استكمال">ناقص / يحتاج استكمال</option>
                  <option value="صيانة / سن">صيانة / سن</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات ومواصفات السيت</label>
                <textarea
                  name="notes"
                  defaultValue={editingSet?.notes || ''}
                  rows={2}
                  placeholder="أي تعليمات خاصة بالتعقيم أو محتويات السيت..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddSetModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold"
                >
                  {editingSet ? 'حفظ التعديلات' : 'إضافة السيت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT SINGLE INSTRUMENT */}
      {/* ========================================================================= */}
      {showAddInstModal && activeSet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingInst ? 'تعديل بيانات الأداة الجراحية' : `إضافة أداة إلى (${activeSet.name})`}
              </h3>
              <button
                onClick={() => setShowAddInstModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const code = formData.get('code') as string;
                const name = formData.get('name') as string;
                const size = formData.get('size') as string;
                const quantity = Number(formData.get('quantity')) || 1;
                const actualQuantity = Number(formData.get('actualQuantity')) || quantity;
                const status = formData.get('status') as InstrumentStatus;
                const notes = formData.get('notes') as string;

                if (!code.trim() || !name.trim()) {
                  alert('يرجى إدخال كود الأداة واسمها.');
                  return;
                }

                const newInst: SurgicalInstrument = {
                  id: editingInst ? editingInst.id : `inst-${activeSet.id}-${Date.now()}`,
                  setId: activeSet.id,
                  setCode: activeSet.code,
                  setName: activeSet.name,
                  code,
                  name,
                  size,
                  quantity,
                  actualQuantity,
                  status,
                  notes,
                  imageUrl: instModalImageUrl ?? editingInst?.imageUrl,
                  updatedAt: new Date().toISOString(),
                };

                SurgicalService.saveInstrument(newInst);
                loadData();
                setShowAddInstModal(false);
              }}
              className="space-y-3 text-xs"
            >
              {/* Instrument Image Field */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block font-bold text-slate-700 mb-2">صورة الأداة (اختياري)</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden bg-white flex items-center justify-center shrink-0 shadow-2xs">
                    {instModalImageUrl ? (
                      <img src={instModalImageUrl} alt="صورة الأداة" className="w-full h-full object-cover" />
                    ) : (
                      <Scissors className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-bold text-xs cursor-pointer border border-slate-200 shadow-2xs transition-colors">
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>{instModalImageUrl ? 'تغيير الصورة' : 'اختيار صورة من جهازك'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const b64 = await SurgicalService.fileToBase64(f);
                            setInstModalImageUrl(b64);
                          }
                        }}
                      />
                    </label>
                    {instModalImageUrl && (
                      <button
                        type="button"
                        onClick={() => setInstModalImageUrl(null)}
                        className="text-[11px] text-rose-600 font-bold block hover:underline"
                      >
                        إزالة الصورة
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">كود الأداة *</label>
                  <input
                    name="code"
                    defaultValue={editingInst?.code || ''}
                    placeholder="مثال: OB-1"
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">النوع / المقاس</label>
                  <input
                    name="size"
                    defaultValue={editingInst?.size || ''}
                    placeholder="Curved / 20cm / Toothed"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الأداة الجراحية *</label>
                <input
                  name="name"
                  defaultValue={editingInst?.name || ''}
                  placeholder="Hohmann Retractor / Needle Holder"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الكمية المعيارية بالسيت *</label>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    defaultValue={editingInst?.quantity || 1}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الكمية الدفترية / الفعلية</label>
                  <input
                    name="actualQuantity"
                    type="number"
                    min="0"
                    defaultValue={editingInst?.actualQuantity ?? editingInst?.quantity ?? 1}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">حالة الأداة</label>
                <select
                  name="status"
                  defaultValue={editingInst?.status || 'سليم'}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="سليم">سليم</option>
                  <option value="تالف">تالف</option>
                  <option value="مفقود">مفقود</option>
                  <option value="يحتاج سن">يحتاج سن</option>
                  <option value="مستبعد">مستبعد</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات</label>
                <textarea
                  name="notes"
                  defaultValue={editingInst?.notes || ''}
                  rows={2}
                  placeholder="ملاحظات حول حالة الأداة..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddInstModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold"
                >
                  {editingInst ? 'حفظ التعديلات' : 'إضافة الأداة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMAGE PREVIEW MODAL (LIGHTBOX WITH EDIT & CHANGE CONTROLS) */}
      {/* ========================================================================= */}
      {(previewImageUrl || previewTarget) && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setPreviewImageUrl(null);
            setPreviewTarget(null);
          }}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-5 shadow-2xl space-y-4 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  {previewTarget?.type === 'set' ? <Layers className="w-5 h-5" /> : <Scissors className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{previewImageTitle || 'معاينة الصورة'}</h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {previewTarget?.type === 'set'
                      ? `سيت: ${previewTarget.set?.code || ''}`
                      : `كود الأداة: ${previewTarget?.instrument?.code || ''}`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setPreviewImageUrl(null);
                  setPreviewTarget(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Image Box */}
            <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[260px] max-h-[65vh] relative p-2 shadow-inner">
              {previewImageUrl ? (
                <img
                  src={previewImageUrl}
                  alt={previewImageTitle}
                  className="max-h-[62vh] max-w-full object-contain rounded-xl"
                />
              ) : (
                <div className="text-center py-12 px-4 text-slate-300 space-y-2">
                  <Camera className="w-12 h-12 mx-auto text-slate-500 opacity-60" />
                  <p className="text-sm font-bold text-white">لا توجد صورة مسجلة حتى الآن</p>
                  <p className="text-xs text-slate-400">يمكنك رفع صورة من جهازك بالضغط على الزر أدناه</p>
                </div>
              )}
            </div>

            {/* Action Buttons Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {/* Change or Upload Image */}
                <button
                  type="button"
                  onClick={() => {
                    if (previewTarget?.type === 'set' && previewTarget.set) {
                      setTargetSetForImage(previewTarget.set);
                      setCoverInputRef.current?.click();
                    } else if (previewTarget?.type === 'instrument' && previewTarget.instrument) {
                      setTargetInstForImage(previewTarget.instrument);
                      singleImageInputRef.current?.click();
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{previewImageUrl ? 'تغيير أو تحديث الصورة' : 'اختيار ورفع صورة الآن'}</span>
                </button>

                {/* Delete Image */}
                {previewImageUrl && (
                  <button
                    type="button"
                    onClick={handleDeletePreviewImage}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-colors cursor-pointer"
                    title="حذف هذه الصورة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الصورة</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {previewImageUrl && (
                  <a
                    href={previewImageUrl}
                    download={`${previewImageTitle || 'surgical_image'}.jpg`}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                    title="تنزيل الصورة"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPreviewImageUrl(null);
                    setPreviewTarget(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
