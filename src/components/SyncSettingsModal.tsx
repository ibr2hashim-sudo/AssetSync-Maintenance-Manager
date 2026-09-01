import React, { useState } from 'react';
import {
  Zap,
  RefreshCw,
  Download,
  Upload,
  X,
  FileSpreadsheet,
  Database,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { FirestoreSyncService } from '../services/firestoreSync';
import { StorageService } from '../services/storage';
import { SurgicalStorageService } from '../services/surgicalStorage';
import { ExcelUtils } from '../utils/excelImportExport';
import { User } from '../types';

interface SyncSettingsModalProps {
  currentUser?: User | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
  currentUser,
  onClose,
  onRefresh,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  // Firestore Cloud Sync State
  const [isPushingFirestore, setIsPushingFirestore] = useState(false);
  const [isPullingFirestore, setIsPullingFirestore] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // File Inputs
  const excelComprehensiveInputRef = React.useRef<HTMLInputElement>(null);

  // Push local data to Firestore
  const handlePushAllToFirestore = async () => {
    setIsPushingFirestore(true);
    setStatusMsg({ text: 'جاري رفع ومزامنة كافة البيانات المحلية إلى السحابة...', type: 'info' });
    try {
      const res = await FirestoreSyncService.pushAllLocalDataToFirestore();
      setStatusMsg({
        text: res.message,
        type: res.success ? 'success' : 'error',
      });
      onRefresh();
    } catch (err: any) {
      setStatusMsg({ text: `خطأ في المزامنة: ${err?.message || 'حدث خطأ غير متوقع'}`, type: 'error' });
    } finally {
      setIsPushingFirestore(false);
    }
  };

  // Pull cloud data to local
  const handlePullAllFromFirestore = async () => {
    setIsPullingFirestore(true);
    setStatusMsg({ text: 'جاري جلب وتحديث قاعدة البيانات بالكامل من السحابة...', type: 'info' });
    try {
      const res = await FirestoreSyncService.pullAllCloudDataToLocal();
      setStatusMsg({
        text: res.message,
        type: res.success ? 'success' : 'error',
      });
      onRefresh();
    } catch (err: any) {
      setStatusMsg({ text: `خطأ في الجلب: ${err?.message || 'حدث خطأ غير متوقع'}`, type: 'error' });
    } finally {
      setIsPullingFirestore(false);
    }
  };

  // Export Comprehensive Excel
  const handleExportComprehensiveExcel = () => {
    try {
      const users = StorageService.getUsers();
      const assets = StorageService.getAssets();
      const tickets = StorageService.getTickets();
      const periodicRecords = StorageService.getPeriodicRecords();
      const history = StorageService.getHistory();
      const surgicalSets = SurgicalStorageService.getSets();
      const surgicalInstruments = SurgicalStorageService.getInstruments();

      ExcelUtils.exportComprehensiveDatabaseToXLSX({
        users,
        assets,
        tickets,
        periodicRecords,
        history,
        surgicalSets,
        surgicalInstruments,
      });

      setStatusMsg({
        text: 'تم إنشاء وتنزيل ملف Excel الشامل (يشمل الأصول، الصيانة، والسيتات الجراحية) بنجاح.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMsg({
        text: `فشل تصدير ملف Excel: ${err?.message || 'حدث خطأ'}`,
        type: 'error',
      });
    }
  };

  // Import Comprehensive Excel
  const handleImportComprehensiveExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMsg({ text: 'جاري قراءة ومعالجة ملف Excel الشامل...', type: 'info' });

    try {
      const existingAssets = StorageService.getAssets();
      const result = await ExcelUtils.parseExcelOrCSV(file, existingAssets);

      if (result.successCount > 0 || (result.importedAssets && result.importedAssets.length > 0)) {
        StorageService.batchImportComprehensiveData({
          assets: result.importedAssets,
          users: result.importedUsers,
          tickets: result.importedTickets,
          periodicRecords: result.importedPeriodic,
        });

        setStatusMsg({
          text: `تم استيراد بيانات ملف Excel بنجاح (${result.successCount} سجل). جاري تحديث ومزامنة السحابة...`,
          type: 'success',
        });

        await FirestoreSyncService.pushAllLocalDataToFirestore();
        onRefresh();
      } else {
        setStatusMsg({
          text: `لم يتم استيراد بيانات من الملف: ${result.errors.join(' - ') || 'الملف فارغ أو غير متطابق'}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMsg({
        text: `فشل استيراد ملف Excel: ${err?.message || 'حدث خطأ غير متوقع'}`,
        type: 'error',
      });
    } finally {
      if (excelComprehensiveInputRef.current) {
        excelComprehensiveInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-right border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Zap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>المزامنة</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                  نشط 🟢
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                مزامنة فورية حية بين كافة الأجهزة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Message Alert */}
        {statusMsg && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : statusMsg.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Section 1: Central Cloud Sync (Visible to Everyone) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100/80 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  قاعدة البيانات السحابية المركزية (Firebase)
                </h4>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-blue-100/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold">حالة الربط السحابي:</span>
              <span className="text-emerald-700 font-bold">متصل ومزامن</span>
            </div>
          </div>

          {/* Action Buttons for Eco Sync */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handlePullAllFromFirestore}
              disabled={isPullingFirestore || isPushingFirestore}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs disabled:opacity-50 text-xs"
            >
              <Download className={`w-4 h-4 ${isPullingFirestore ? 'animate-spin' : ''}`} />
              <span>{isPullingFirestore ? 'جاري التحميل...' : 'جلب وتحديث البيانات'}</span>
            </button>

            <button
              type="button"
              onClick={handlePushAllToFirestore}
              disabled={isPullingFirestore || isPushingFirestore}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold transition-all shadow-xs disabled:opacity-50 text-xs"
            >
              <RefreshCw className={`w-4 h-4 ${isPushingFirestore ? 'animate-spin' : ''}`} />
              <span>{isPushingFirestore ? 'جاري الرفع...' : 'رفع البيانات للسحابة'}</span>
            </button>
          </div>
        </div>

        {/* Section 2: Excel Comprehensive File (Visible to Admin Only) */}
        {isAdmin && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 border border-emerald-100/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">
                      النسخ الاحتياطي لملف Excel الشامل
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-white font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-400" /> للآدمن فقط
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    ملف إكسل متكامل يشمل الأصول، الصيانة، المستخدمين، والسيتات والأدوات الجراحية
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleExportComprehensiveExcel}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs text-xs"
              >
                <Download className="w-4 h-4" />
                <span>تصدير ملف Excel الشامل</span>
              </button>

              <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold cursor-pointer transition-all shadow-xs text-xs">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>استيراد ملف Excel شامل</span>
                <input
                  ref={excelComprehensiveInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportComprehensiveExcel}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 text-xs transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
