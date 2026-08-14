import React, { useState, useRef, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  Upload,
  Download,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Eye,
  ChevronLeft,
  Building2,
  FolderTree,
  AlertTriangle,
  CheckCircle2,
  X,
  Camera,
  Layers,
  Sparkles,
  Info,
  Wrench,
} from 'lucide-react';
import { Asset, DeviceStatus, ImageImportReport, User } from '../types';
import { StorageService } from '../services/storage';
import { ExcelUtils } from '../utils/excelImportExport';

interface AssetsViewProps {
  currentUser: User | null;
  assets: Asset[];
  onRefresh: () => void;
  onOpenNewTicketForAsset: (asset: Asset) => void;
  openAddModalTrigger?: boolean;
  onResetAddTrigger?: () => void;
}

const DEFAULT_ACCESSORIES_PRESETS = [
  'ECG Cable',
  'SPO2 Sensor',
  'BP Cuff',
  'Bottle',
  '2 Bottle',
  'Power Cable',
  'NIBP Hose',
  'Ground Cable',
  'Sensor Probe',
];

export const AssetsView: React.FC<AssetsViewProps> = ({
  currentUser,
  assets,
  onRefresh,
  onOpenNewTicketForAsset,
}) => {
  // Navigation Hierarchy States
  // null = Main Departments View
  // selectedDept = selected main department string
  // selectedSubDept = selected sub department string
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedSubDept, setSelectedSubDept] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<Asset | null>(null);

  const [showDeptEditModal, setShowDeptEditModal] = useState(false);
  const [editingDeptData, setEditingDeptData] = useState<{ main: string; sub?: string; newName: string } | null>(null);

  const [deleteDeptConfirm, setDeleteDeptConfirm] = useState<{ main: string; sub?: string; count: number } | null>(null);
  const [deleteAssetConfirm, setDeleteAssetConfirm] = useState<Asset | null>(null);

  // Bulk Image Import Modal & Progress
  const [showBulkImageModal, setShowBulkImageModal] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ percent: number; currentFile: string } | null>(null);
  const [bulkReport, setBulkReport] = useState<ImageImportReport | null>(null);

  // Excel Import Status
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'error'; message: string; errors?: string[] } | null>(null);

  // Filter accessible assets for Supervisor (can only see assigned department)
  const accessibleAssets = useMemo(() => {
    if (currentUser?.role === 'supervisor' && currentUser?.assignedDepartment) {
      return assets.filter((a) => a.mainDepartment.trim() === currentUser.assignedDepartment?.trim());
    }
    return assets;
  }, [assets, currentUser]);

  // Group departments & sub-departments
  const departmentsHierarchy = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    accessibleAssets.forEach((a) => {
      const main = a.mainDepartment.trim();
      const sub = a.subDepartment ? a.subDepartment.trim() : main;
      if (!map[main]) {
        map[main] = new Set();
      }
      map[main].add(sub);
    });
    return map;
  }, [accessibleAssets]);

  const mainDepartmentList = useMemo(() => {
    return Object.keys(departmentsHierarchy);
  }, [departmentsHierarchy]);

  // Handle Clicking on a Main Department
  const handleSelectDepartment = (deptName: string) => {
    const subs = Array.from(departmentsHierarchy[deptName] || []);
    // Smart Hierarchy Logic:
    // If sub-department equals main department name or only 1 sub identical to main, go directly to devices
    if (subs.length === 0 || (subs.length === 1 && (subs[0] === deptName || subs[0] === ''))) {
      setSelectedDept(deptName);
      setSelectedSubDept(subs[0] || deptName);
    } else {
      setSelectedDept(deptName);
      setSelectedSubDept(null); // Show sub-departments view first
    }
  };

  // Filtered Assets for the active view
  const currentViewAssets = useMemo(() => {
    let list = accessibleAssets;

    if (selectedDept) {
      list = list.filter((a) => a.mainDepartment.trim() === selectedDept.trim());
    }

    if (selectedSubDept) {
      list = list.filter((a) => {
        const sub = a.subDepartment ? a.subDepartment.trim() : a.mainDepartment.trim();
        return sub === selectedSubDept.trim();
      });
    }

    // Apply Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (a) =>
          a.deviceName.toLowerCase().includes(q) ||
          a.customId.toLowerCase().includes(q) ||
          a.model.toLowerCase().includes(q) ||
          a.serialNumber.toLowerCase().includes(q) ||
          a.manufacturer.toLowerCase().includes(q) ||
          a.custodian.toLowerCase().includes(q) ||
          a.mainDepartment.toLowerCase().includes(q) ||
          a.subDepartment.toLowerCase().includes(q)
      );
    }

    // Apply Status Filter
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }

    return list;
  }, [accessibleAssets, selectedDept, selectedSubDept, searchTerm, statusFilter]);

  // Handle Excel/CSV File Upload
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await ExcelUtils.parseExcelOrCSV(file, assets);
      if (result.importedAssets.length > 0) {
        result.importedAssets.forEach((newAsset) => {
          StorageService.saveAsset(newAsset);
        });
        onRefresh();
      }

      if (result.errorCount === 0) {
        setImportNotice({
          type: 'success',
          message: `تم استيراد (${result.successCount}) جهاز بنجاح دون أي أخطاء!`,
        });
      } else {
        setImportNotice({
          type: result.successCount > 0 ? 'success' : 'error',
          message: `تم استيراد (${result.successCount}) جهاز بنجاح. تعذر استيراد (${result.errorCount}) جهاز لوجود مشاكل في البيانات.`,
          errors: result.errors,
        });
      }
    } catch (err: any) {
      setImportNotice({
        type: 'error',
        message: `فشل استيراد الملف: ${err?.message || 'تأكد من تنسيق ملف Excel/CSV'}`,
      });
    } finally {
      if (excelFileInputRef.current) excelFileInputRef.current.value = '';
    }
  };

  // Handle Bulk Image Upload
  const bulkImageInputRef = useRef<HTMLInputElement>(null);
  const handleBulkImagesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setBulkProgress({ percent: 0, currentFile: files[0].name });
    setShowBulkImageModal(true);

    try {
      const report = await StorageService.processBulkImages(files, (percent, currentFile) => {
        setBulkProgress({ percent, currentFile });
      });
      setBulkReport(report);
      onRefresh();
    } catch (err: any) {
      alert(`خطأ في معالجة الصور: ${err?.message}`);
    } finally {
      setBulkProgress(null);
      if (bulkImageInputRef.current) bulkImageInputRef.current.value = '';
    }
  };

  // Department Deletion Check & Protection
  const handleAttemptDeleteDept = (mainDept: string, subDept?: string) => {
    const check = StorageService.canDeleteDepartment(mainDept, subDept);
    if (!check.allowed) {
      alert(check.message);
      return;
    }
    setDeleteDeptConfirm({ main: mainDept, sub: subDept, count: check.count });
  };

  const confirmDeleteDept = () => {
    if (!deleteDeptConfirm) return;
    // It's empty, so delete is safe
    if (selectedSubDept && deleteDeptConfirm.sub) {
      setSelectedSubDept(null);
    } else if (selectedDept && !deleteDeptConfirm.sub) {
      setSelectedDept(null);
      setSelectedSubDept(null);
    }
    setDeleteDeptConfirm(null);
    onRefresh();
  };

  // Rename Department
  const handleSaveDeptRename = () => {
    if (!editingDeptData || !editingDeptData.newName.trim()) return;
    StorageService.renameDepartment(
      editingDeptData.main,
      editingDeptData.sub ? editingDeptData.main : editingDeptData.newName.trim(),
      editingDeptData.sub,
      editingDeptData.sub ? editingDeptData.newName.trim() : undefined
    );
    if (!editingDeptData.sub && selectedDept === editingDeptData.main) {
      setSelectedDept(editingDeptData.newName.trim());
    } else if (editingDeptData.sub && selectedSubDept === editingDeptData.sub) {
      setSelectedSubDept(editingDeptData.newName.trim());
    }
    setShowDeptEditModal(false);
    setEditingDeptData(null);
    onRefresh();
  };

  // Delete Asset
  const confirmDeleteAsset = () => {
    if (!deleteAssetConfirm) return;
    try {
      StorageService.deleteAsset(deleteAssetConfirm.id);
      setDeleteAssetConfirm(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'تعذر حذف الجهاز');
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={excelFileInputRef}
        onChange={handleExcelImport}
        accept=".csv, .xlsx, .xls"
        className="hidden"
      />
      <input
        type="file"
        ref={bulkImageInputRef}
        onChange={handleBulkImagesSelect}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Header & Main Actions */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              إدارة العهد والأصول 📦
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            سجل شامل لبيانات الأجهزة والعهد الطبية والمكتبية بـ 15 بنداً تفصيلياً مع المطابقة الذكية.
          </p>
        </div>

        {/* Action Buttons (Admin Only for management & imports) */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {currentUser?.role === 'admin' && (
            <>
              <button
                onClick={() => {
                  setEditingAsset(null);
                  setShowAddEditModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                إضافة أصل يدوي
              </button>

              <button
                onClick={() => excelFileInputRef.current?.click()}
                title="استيراد أجهزة من ملف Excel / CSV"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                استيراد Excel
              </button>

              <button
                onClick={() => ExcelUtils.exportAssetsToCSV(accessibleAssets)}
                title="تصدير الأصول إلى ملف CSV UTF-8"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                تصدير CSV
              </button>

              <button
                onClick={() => bulkImageInputRef.current?.click()}
                title="استيراد الصور المجمعة وربطها تلقائياً بالـ ID"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                استيراد الصور المجمعة
              </button>
            </>
          )}
        </div>
      </div>

      {/* Import Notification Banner */}
      {importNotice && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
            importNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm">
              {importNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              {importNotice.message}
            </div>
            {importNotice.errors && importNotice.errors.length > 0 && (
              <div className="max-h-28 overflow-y-auto mt-2 p-2 bg-white/60 rounded border text-[11px] space-y-1 font-mono">
                {importNotice.errors.map((err, i) => (
                  <p key={i} className="text-red-700">
                    • {err}
                  </p>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setImportNotice(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Smart Hierarchy Breadcrumb Navigation */}
      <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-2 overflow-x-auto text-xs">
        <div className="flex items-center gap-1.5 font-medium whitespace-nowrap">
          <button
            onClick={() => {
              setSelectedDept(null);
              setSelectedSubDept(null);
            }}
            className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              !selectedDept
                ? 'bg-white text-blue-600 font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            الأقسام الرئيسية
          </button>

          {selectedDept && (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => setSelectedSubDept(null)}
                className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  selectedDept && !selectedSubDept
                    ? 'bg-white text-blue-600 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                {selectedDept}
              </button>
            </>
          )}

          {selectedSubDept && selectedSubDept !== selectedDept && (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              <span className="px-2 py-1 rounded-lg bg-white text-blue-600 font-bold shadow-sm">
                {selectedSubDept}
              </span>
            </>
          )}
        </div>

        {/* Current Active Location Info */}
        <div className="text-[11px] text-slate-500 hidden sm:block">
          {selectedSubDept
            ? `عرض أجهزة: ${selectedDept} / ${selectedSubDept}`
            : selectedDept
            ? `عرض أقسام ${selectedDept} الفرعية`
            : 'اختر قسماً للدخول إلى أجهزته'}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم، الـ ID، الموديل، السيريال، المستلم..."
            className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">الحالة:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">جميع الحالات ({accessibleAssets.length})</option>
            <option value="شغال">شغال</option>
            <option value="عاطل">عاطل</option>
            <option value="تالف">تالف</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 1: MAIN DEPARTMENTS LIST (When no department selected) */}
      {/* ========================================================================= */}
      {!selectedDept && (
        <div>
          {mainDepartmentList.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">قاعدة بيانات الأصول فارغة</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                يبدأ النظام بدون أي بيانات تجريبية. يمكنك البدء بإضافة أجهزة وأقسام يدوياً أو استيراد ملف Excel/CSV مباشرة.
              </p>
              {currentUser?.role === 'admin' && (
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setEditingAsset(null);
                      setShowAddEditModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors"
                  >
                    + إضافة أول أصل
                  </button>
                  <button
                    onClick={() => excelFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    استيراد ملف Excel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mainDepartmentList.map((deptName) => {
                const deptAssets = accessibleAssets.filter(
                  (a) => a.mainDepartment.trim() === deptName.trim()
                );
                const subs = Array.from(departmentsHierarchy[deptName] || []);
                const faultyCount = deptAssets.filter((a) => a.status === 'عاطل').length;

                return (
                  <div
                    key={deptName}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Building2 className="w-5 h-5" />
                        </div>

                        {/* Admin Action buttons for department: Edit / Delete */}
                        {currentUser?.role === 'admin' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingDeptData({ main: deptName, newName: deptName });
                                setShowDeptEditModal(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="تعديل اسم القسم"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAttemptDeleteDept(deptName);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="مسح القسم"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <h4
                        onClick={() => handleSelectDepartment(deptName)}
                        className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        {deptName}
                      </h4>

                      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                        <span>{deptAssets.length} جهاز</span>
                        <span>•</span>
                        <span>{subs.length} أقسام فرعية</span>
                        {faultyCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-red-600 font-bold">{faultyCount} عاطل</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectDepartment(deptName)}
                      className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors w-full text-right"
                    >
                      <span>تصفح أجهزة القسم</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 1.5: SUB-DEPARTMENTS LIST (When main dept is selected but has multiple subs) */}
      {/* ========================================================================= */}
      {selectedDept && !selectedSubDept && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-600" />
              الأقسام الفرعية التابعة لـ: <span className="text-blue-600">{selectedDept}</span>
            </h3>
            <button
              onClick={() => {
                // Show all devices of this main department
                setSelectedSubDept(selectedDept);
              }}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              عرض كافة أجهزة القسم دفعة واحدة
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Array.from(departmentsHierarchy[selectedDept] || []) as string[]).map((subName: string) => {
              const subAssets = accessibleAssets.filter(
                (a) =>
                  a.mainDepartment.trim() === selectedDept.trim() &&
                  (a.subDepartment ? a.subDepartment.trim() : a.mainDepartment.trim()) === subName.trim()
              );

              return (
                <div
                  key={subName}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <FolderTree className="w-4 h-4" />
                      </div>

                      {/* Admin buttons for sub-dept: Edit / Delete */}
                      {currentUser?.role === 'admin' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDeptData({ main: selectedDept, sub: subName, newName: subName });
                              setShowDeptEditModal(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="تعديل اسم القسم الفرعي"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAttemptDeleteDept(selectedDept, subName);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="مسح القسم الفرعي"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h4
                      onClick={() => setSelectedSubDept(subName)}
                      className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      {subName}
                    </h4>

                    <p className="text-xs text-slate-500 mt-2">
                      يحتوي على <span className="font-bold text-slate-800">{subAssets.length}</span> جهاز
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedSubDept(subName)}
                    className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors w-full text-right"
                  >
                    <span>الدخول لأجهزة القسم الفرعي</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 2: DEVICE LIST (Full Table & Cards with 15 fields) */}
      {/* ========================================================================= */}
      {selectedSubDept && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              قائمة الأجهزة ({currentViewAssets.length} جهاز)
            </h3>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => {
                  setEditingAsset(null);
                  setShowAddEditModal(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة جهاز بهذا القسم
              </button>
            )}
          </div>

          {currentViewAssets.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200/80 shadow-sm text-slate-500 text-xs">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              لا توجد أجهزة مسجلة تطابق التصفية الحالية
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentViewAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Top Image & Status Banner */}
                  <div className="relative h-44 bg-slate-100 flex items-center justify-center overflow-hidden">
                    {asset.imageUrl ? (
                      <img
                        src={asset.imageUrl}
                        alt={asset.deviceName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <ImageIcon className="w-10 h-10 mx-auto mb-1 opacity-40" />
                        <span className="text-[11px]">لا توجد صورة</span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${
                          asset.status === 'شغال'
                            ? 'bg-emerald-500 text-white'
                            : asset.status === 'عاطل'
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-700 text-white'
                        }`}
                      >
                        {asset.status}
                      </span>
                    </div>

                    {/* Custom ID Badge */}
                    <div className="absolute top-3 left-3">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900/80 text-white text-[11px] font-mono font-bold backdrop-blur-xs">
                        ID: {asset.customId}
                      </span>
                    </div>
                  </div>

                  {/* Device Info Body */}
                  <div className="p-4 space-y-2.5 flex-1">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {asset.deviceName}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {asset.mainDepartment} • {asset.subDepartment}
                      </p>
                    </div>

                    {/* Model & Manufacturer & Serial Number */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block">الموديل:</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {asset.model || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">السيريال (S.N):</span>
                        <span className="font-mono font-semibold text-slate-800 truncate block">
                          {asset.serialNumber || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">الشركة:</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {asset.manufacturer || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">مستلم العهدة:</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {asset.custodian || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Quantities & Difference */}
                    <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-blue-50/60 border border-blue-100">
                      <div>
                        <span className="text-slate-500">حالية: </span>
                        <span className="font-bold text-slate-800">{asset.currentQuantity}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">دفترية: </span>
                        <span className="font-bold text-slate-800">{asset.bookQuantity}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">الفارق: </span>
                        <span
                          className={`font-black ${
                            asset.difference < 0
                              ? 'text-red-600'
                              : asset.difference > 0
                              ? 'text-emerald-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {asset.difference > 0 ? `+${asset.difference}` : asset.difference}
                        </span>
                      </div>
                    </div>

                    {/* Accessories pills */}
                    {asset.accessories && asset.accessories.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {asset.accessories.map((acc, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                          >
                            {acc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                    {/* View Details */}
                    <button
                      onClick={() => {
                        setSelectedAssetDetail(asset);
                        setShowDetailModal(true);
                      }}
                      className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-blue-600 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="عرض كامل الـ 15 بنداً"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      التفاصيل
                    </button>

                    {/* Submit Maintenance Ticket */}
                    <button
                      onClick={() => onOpenNewTicketForAsset(asset)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 transition-colors"
                      title="تقديم بلاغ صيانة لهذا الجهاز"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      بلاغ صيانة
                    </button>

                    {/* Admin Edit & Delete */}
                    {currentUser?.role === 'admin' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingAsset(asset);
                            setShowAddEditModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="تعديل بيانات الجهاز"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteAssetConfirm(asset)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="مسح الجهاز"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT ASSET (All 15 Items) */}
      {/* ========================================================================= */}
      {showAddEditModal && (
        <AddEditAssetModal
          asset={editingAsset}
          initialDepartment={selectedDept || ''}
          initialSubDepartment={selectedSubDept || ''}
          existingAssets={assets}
          onClose={() => {
            setShowAddEditModal(false);
            setEditingAsset(null);
          }}
          onSaved={() => {
            setShowAddEditModal(false);
            setEditingAsset(null);
            onRefresh();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSET FULL 15-ITEM DETAIL VIEW */}
      {/* ========================================================================= */}
      {showDetailModal && selectedAssetDetail && (
        <AssetDetailModal
          asset={selectedAssetDetail}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedAssetDetail(null);
          }}
          onOpenTicket={() => {
            const a = selectedAssetDetail;
            setShowDetailModal(false);
            setSelectedAssetDetail(null);
            onOpenNewTicketForAsset(a);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT DEPARTMENT NAME */}
      {/* ========================================================================= */}
      {showDeptEditModal && editingDeptData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {editingDeptData.sub ? 'تعديل اسم القسم الفرعي' : 'تعديل اسم القسم الرئيسي'}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم الجديد:</label>
              <input
                type="text"
                value={editingDeptData.newName}
                onChange={(e) => setEditingDeptData({ ...editingDeptData, newName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowDeptEditModal(false);
                  setEditingDeptData(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveDeptRename}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM DELETE DEPARTMENT */}
      {/* ========================================================================= */}
      {deleteDeptConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">تأكيد مسح القسم</h3>
              <p className="text-xs text-slate-500 mt-1">
                هل أنت متأكد من مسح القسم (
                <span className="font-bold text-slate-800">
                  {deleteDeptConfirm.main}
                  {deleteDeptConfirm.sub ? ` / ${deleteDeptConfirm.sub}` : ''}
                </span>
                )؟
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteDeptConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={confirmDeleteDept}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow"
              >
                تأكيد المسح
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM DELETE ASSET */}
      {/* ========================================================================= */}
      {deleteAssetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">تأكيد مسح الجهاز</h3>
              <p className="text-xs text-slate-500 mt-1">
                هل أنت متأكد من رغبتك في حذف الجهاز (
                <span className="font-bold text-slate-800">{deleteAssetConfirm.deviceName}</span>) ذو الـ ID المخصص (
                <span className="font-mono font-bold text-slate-800">{deleteAssetConfirm.customId}</span>)؟
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteAssetConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={confirmDeleteAsset}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BULK IMAGE IMPORT PROGRESS & FINAL REPORT (Only closes on "موافق") */}
      {/* ========================================================================= */}
      {showBulkImageModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                استيراد الصور المجمعة ومطابقة الـ ID
              </h3>
            </div>

            {/* In Progress */}
            {bulkProgress && (
              <div className="space-y-3 py-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600">جاري المعالجة: {bulkProgress.currentFile}</span>
                  <span className="text-purple-600 font-bold">{bulkProgress.percent}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all duration-200"
                    style={{ width: `${bulkProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Final Comprehensive Report Modal */}
            {bulkReport && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-xs text-slate-500 block">إجمالي الصور</span>
                    <span className="text-xl font-black text-slate-800">{bulkReport.total}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span className="text-xs text-emerald-700 font-bold block">ناجحة</span>
                    <span className="text-xl font-black text-emerald-600">{bulkReport.successful}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                    <span className="text-xs text-red-700 font-bold block">فاشلة</span>
                    <span className="text-xl font-black text-red-600">{bulkReport.failed}</span>
                  </div>
                </div>

                {/* Details Table */}
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y text-xs">
                  {bulkReport.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="font-bold text-slate-800">{item.fileName}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">ID: {item.customId}</span>
                        {item.reason && (
                          <span className="text-[10px] text-red-600 block mt-0.5">{item.reason}</span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          item.status === 'نجاح' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Notice: Only closes on clicking "موافق" */}
                <p className="text-[11px] text-slate-400 text-center">
                  تم حفظ كافة الصور المطابقة بنجاح. اضغط موافق لإغلاق هذا التقرير.
                </p>

                <div className="pt-2 flex justify-center">
                  <button
                    onClick={() => {
                      setShowBulkImageModal(false);
                      setBulkReport(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md transition-colors"
                  >
                    موافق
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: ADD / EDIT ASSET MODAL (15 Items)
// =========================================================================
interface AddEditAssetModalProps {
  asset: Asset | null;
  initialDepartment?: string;
  initialSubDepartment?: string;
  existingAssets: Asset[];
  onClose: () => void;
  onSaved: () => void;
}

const AddEditAssetModal: React.FC<AddEditAssetModalProps> = ({
  asset,
  initialDepartment,
  initialSubDepartment,
  existingAssets,
  onClose,
  onSaved,
}) => {
  const [mainDepartment, setMainDepartment] = useState(asset?.mainDepartment || initialDepartment || '');
  const [subDepartment, setSubDepartment] = useState(asset?.subDepartment || initialSubDepartment || initialDepartment || '');
  const [deviceName, setDeviceName] = useState(asset?.deviceName || '');
  const [customId, setCustomId] = useState(asset?.customId || '');
  const [currentQuantity, setCurrentQuantity] = useState(asset?.currentQuantity ?? 1);
  const [bookQuantity, setBookQuantity] = useState(asset?.bookQuantity ?? 1);
  const [model, setModel] = useState(asset?.model || '');
  const [serialNumber, setSerialNumber] = useState(asset?.serialNumber || '');
  const [manufacturer, setManufacturer] = useState(asset?.manufacturer || '');
  const [accessories, setAccessories] = useState<string[]>(asset?.accessories || []);
  const [newAccInput, setNewAccInput] = useState('');
  const [status, setStatus] = useState<DeviceStatus>(asset?.status || 'شغال');
  const [custodian, setCustodian] = useState(asset?.custodian || '');
  const [notes, setNotes] = useState(asset?.notes || '');
  const [imageUrl, setImageUrl] = useState<string>(asset?.imageUrl || '');

  const [errorMessage, setErrorMessage] = useState('');

  // Camera & Image handling
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const toggleAccessory = (acc: string) => {
    if (accessories.includes(acc)) {
      setAccessories(accessories.filter((a) => a !== acc));
    } else {
      setAccessories([...accessories, acc]);
    }
  };

  const handleAddCustomAccessory = () => {
    if (newAccInput.trim() && !accessories.includes(newAccInput.trim())) {
      setAccessories([...accessories, newAccInput.trim()]);
      setNewAccInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customId.trim()) {
      setErrorMessage('يجب إدخال ID مخصص للجهاز (فريد لا يتكرر)');
      return;
    }

    if (!deviceName.trim()) {
      setErrorMessage('اسم الجهاز مطلوب');
      return;
    }

    if (!mainDepartment.trim()) {
      setErrorMessage('القسم الرئيسي مطلوب');
      return;
    }

    try {
      StorageService.saveAsset({
        id: asset?.id,
        mainDepartment: mainDepartment.trim(),
        subDepartment: (subDepartment.trim() || mainDepartment.trim()),
        deviceName: deviceName.trim(),
        customId: customId.trim(),
        currentQuantity: Number(currentQuantity),
        bookQuantity: Number(bookQuantity),
        model: model.trim(),
        serialNumber: serialNumber.trim(),
        manufacturer: manufacturer.trim(),
        accessories,
        status,
        custodian: custodian.trim(),
        notes: notes.trim(),
        imageUrl,
      });

      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ الجهاز');
    }
  };

  const calculatedDifference = Number(currentQuantity || 0) - Number(bookQuantity || 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8 space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            {asset ? 'تعديل بيانات الجهاز' : 'إضافة أصل / جهاز جديد (15 بنداً)'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {/* 1. القسم الرئيسي */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                1. القسم الرئيسي <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={mainDepartment}
                onChange={(e) => setMainDepartment(e.target.value)}
                placeholder="مثال: العناية المركزة، العمليات، المعمل..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* 2. القسم الفرعي */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                2. القسم الفرعي / الداخلي
              </label>
              <input
                type="text"
                value={subDepartment}
                onChange={(e) => setSubDepartment(e.target.value)}
                placeholder="إذا تطابق مع الرئيسي يتم الدخول مباشرة"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* 4. ID مخصص للجهاز (إدخال يدوي فريد) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                4. ID مخصص للجهاز (فريد لا يتكرر) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="مثال: DEV-101، MED-004..."
                className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-blue-50/40 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* 3. اسم الجهاز */}
            <div className="sm:col-span-2 md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                3. اسم الجهاز <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="مثال: جهاز تنفس صناعي Hamilton، شاشة مراقبة مريض Mindray..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* 5. الكمية الحالية */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">5. الكمية الحالية</label>
              <input
                type="number"
                min="0"
                value={currentQuantity}
                onChange={(e) => setCurrentQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            {/* 6. الكمية الدفترية */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">6. الكمية الدفترية</label>
              <input
                type="number"
                min="0"
                value={bookQuantity}
                onChange={(e) => setBookQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            {/* 7. الفارق (محسوب تلقائياً) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">7. الفارق (تلقائي)</label>
              <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-black text-slate-800">
                {calculatedDifference > 0 ? `+${calculatedDifference}` : calculatedDifference}
              </div>
            </div>

            {/* 8. موديل الجهاز */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">8. موديل الجهاز</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Model / النوع"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            {/* 9. الرقم التسلسلي */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">9. الرقم التسلسلي (S.N)</label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Serial Number"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>

            {/* 10. اسم الشركة المصنعة */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">10. الشركة المصنعة</label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Manufacturer"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            {/* 12. حالة الجهاز */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">12. حالة الجهاز</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DeviceStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
              >
                <option value="شغال">شغال (يعمل بكفاءة)</option>
                <option value="عاطل">عاطل (بحاجة لصيانة)</option>
                <option value="تالف">تالف (خارج الخدمة)</option>
              </select>
            </div>

            {/* 13. مستلم العهدة */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">13. مستلم العهدة</label>
              <input
                type="text"
                value={custodian}
                onChange={(e) => setCustodian(e.target.value)}
                placeholder="اسم الموظف أو رئيس القسم"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            {/* 14. ملاحظات */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">14. ملاحظات</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات إضافية"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          {/* 11. التوابع (Accessories) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              11. التوابع الملحقة بالجهاز
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DEFAULT_ACCESSORIES_PRESETS.map((acc) => {
                const isSelected = accessories.includes(acc);
                return (
                  <button
                    key={acc}
                    type="button"
                    onClick={() => toggleAccessory(acc)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {acc} {isSelected ? '✓' : '+'}
                  </button>
                );
              })}
            </div>

            {/* Custom Accessories Add */}
            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={newAccInput}
                onChange={(e) => setNewAccInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomAccessory();
                  }
                }}
                placeholder="إضافة تابع آخر مخصص..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
              <button
                type="button"
                onClick={handleAddCustomAccessory}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
              >
                إضافة
              </button>
            </div>
          </div>

          {/* 15. صورة الجهاز (كاميرا أو ملف) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              15. صورة الجهاز (التقاط بالكاميرا أو رفع من الهاتف/الكمبيوتر)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageFile}
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleImageFile}
              accept="image/*"
              capture="environment"
              className="hidden"
            />

            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  <img
                    src={imageUrl}
                    alt="معاينة"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white text-[10px]"
                    title="حذف الصورة"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                >
                  <Camera className="w-4 h-4 text-blue-600" />
                  التقاط بالكاميرا
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                >
                  <Upload className="w-4 h-4 text-purple-600" />
                  رفع صورة من الجهاز
                </button>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20"
            >
              {asset ? 'حفظ التعديلات' : 'إضافة الأصل الآن'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: ASSET FULL 15-ITEM DETAIL VIEW MODAL
// =========================================================================
interface AssetDetailModalProps {
  asset: Asset;
  onClose: () => void;
  onOpenTicket: () => void;
}

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ asset, onClose, onOpenTicket }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-8 space-y-5 text-right">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white text-xs font-mono font-bold">
              ID: {asset.customId}
            </span>
            <h3 className="text-base font-bold text-slate-900">{asset.deviceName}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Display */}
        {asset.imageUrl && (
          <div className="h-56 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
            <img
              src={asset.imageUrl}
              alt={asset.deviceName}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* 15 Attributes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">1. القسم الرئيسي:</span>
            <span className="font-bold text-slate-800">{asset.mainDepartment}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">2. القسم الفرعي:</span>
            <span className="font-bold text-slate-800">{asset.subDepartment}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">4. ID المخصص:</span>
            <span className="font-mono font-bold text-blue-600">{asset.customId}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">5. الكمية الحالية:</span>
            <span className="font-bold text-slate-800">{asset.currentQuantity}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">6. الكمية الدفترية:</span>
            <span className="font-bold text-slate-800">{asset.bookQuantity}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">7. الفارق المحسوب:</span>
            <span
              className={`font-black ${
                asset.difference < 0
                  ? 'text-red-600'
                  : asset.difference > 0
                  ? 'text-emerald-600'
                  : 'text-slate-800'
              }`}
            >
              {asset.difference > 0 ? `+${asset.difference}` : asset.difference}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">8. موديل الجهاز:</span>
            <span className="font-bold text-slate-800">{asset.model || '—'}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">9. الرقم التسلسلي (S.N):</span>
            <span className="font-mono font-bold text-slate-800">{asset.serialNumber || '—'}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">10. الشركة المصنعة:</span>
            <span className="font-bold text-slate-800">{asset.manufacturer || '—'}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">12. حالة الجهاز:</span>
            <span
              className={`font-bold ${
                asset.status === 'شغال'
                  ? 'text-emerald-600'
                  : asset.status === 'عاطل'
                  ? 'text-red-600'
                  : 'text-slate-700'
              }`}
            >
              {asset.status}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">13. مستلم العهدة:</span>
            <span className="font-bold text-slate-800">{asset.custodian || '—'}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block text-[11px]">14. ملاحظات:</span>
            <span className="font-bold text-slate-800">{asset.notes || 'لا يوجد'}</span>
          </div>
        </div>

        {/* 11. Accessories list */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <span className="text-slate-500 block text-xs font-bold mb-1.5">11. التوابع المسجلة:</span>
          {asset.accessories && asset.accessories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {asset.accessories.map((acc, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-semibold"
                >
                  {acc}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">لا توجد توابع مسجلة</p>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            onClick={onOpenTicket}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/20"
          >
            <Wrench className="w-4 h-4" />
            تقديم بلاغ صيانة لهذا الجهاز
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
