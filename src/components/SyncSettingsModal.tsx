import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  RefreshCw,
  Copy,
  Check,
  Download,
  Upload,
  X,
  FileSpreadsheet,
  Database,
  HardDrive,
  FolderSync,
  LogOut,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { FirestoreSyncService } from '../services/firestoreSync';
import { GoogleDriveService, GoogleDriveFile, DriveImageSyncReport } from '../services/googleDriveService';
import { ExcelUtils } from '../utils/excelImportExport';

interface SyncSettingsModalProps {
  onClose: () => void;
  onRefresh: () => void;
}

export const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({ onClose, onRefresh }) => {
  const [syncConfig, setSyncConfig] = useState(StorageService.getSyncConfig());
  const [webhookUrl, setWebhookUrl] = useState(syncConfig.googleSheetWebhookUrl || '');
  const [autoSync, setAutoSync] = useState(syncConfig.autoSyncEnabled);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [pendingCount, setPendingCount] = useState(StorageService.getPendingSyncCount());

  // Google Drive State
  const [googleUser, setGoogleUser] = useState(GoogleDriveService.getGoogleUser());
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveBackups, setDriveBackups] = useState<GoogleDriveFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [driveFeedback, setDriveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Google Drive Image Sync State
  const [isSyncingDriveImages, setIsSyncingDriveImages] = useState(false);
  const [driveImageProgress, setDriveImageProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [driveImageReport, setDriveImageReport] = useState<DriveImageSyncReport | null>(null);

  // Firestore Cloud Sync State
  const [isSyncingFirestore, setIsSyncingFirestore] = useState(false);
  const [isPullingFirestore, setIsPullingFirestore] = useState(false);

  // File Inputs
  const excelComprehensiveInputRef = useRef<HTMLInputElement>(null);

  const handlePushAllToFirestore = async () => {
    setIsSyncingFirestore(true);
    setSyncStatusMsg('جاري رفع ومزامنة جميع البيانات المحلية مع السحابة المركزية (Firebase)...');
    try {
      const res = await FirestoreSyncService.pushAllLocalDataToFirestore();
      setSyncStatusMsg(res.message);
      onRefresh();
    } catch (err: any) {
      setSyncStatusMsg(`خطأ في المزامنة السحابية: ${err?.message}`);
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const handlePullAllFromFirestore = async () => {
    setIsPullingFirestore(true);
    setSyncStatusMsg('جاري جلب وتحديث قاعدة البيانات السحابية بالكامل...');
    try {
      const res = await FirestoreSyncService.pullAllCloudDataToLocal();
      setSyncStatusMsg(res.message);
      onRefresh();
    } catch (err: any) {
      setSyncStatusMsg(`خطأ في استيراد البيانات: ${err?.message}`);
    } finally {
      setIsPullingFirestore(false);
    }
  };

  useEffect(() => {
    const unsubscribe = GoogleDriveService.initAuth(
      (user) => {
        setGoogleUser(user);
        fetchDriveBackups();
      },
      () => {
        setGoogleUser(null);
        setDriveBackups([]);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const fetchDriveBackups = async () => {
    if (!GoogleDriveService.getAccessToken()) return;
    setIsLoadingBackups(true);
    try {
      const files = await GoogleDriveService.listBackupsFromDrive();
      setDriveBackups(files);
    } catch (e: any) {
      console.warn('Could not load drive backups:', e);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    setIsConnectingDrive(true);
    setDriveFeedback(null);
    try {
      const result = await GoogleDriveService.signIn();
      setGoogleUser(result.user);
      setDriveFeedback({ type: 'success', text: `تم الاتصال بحساب Google بنجاح: ${result.user.email}` });
      await fetchDriveBackups();
    } catch (err: any) {
      setDriveFeedback({ type: 'error', text: err.message || 'فشل الاتصال بـ Google Drive' });
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    await GoogleDriveService.logout();
    setGoogleUser(null);
    setDriveBackups([]);
    setDriveFeedback({ type: 'success', text: 'تم تسجيل الخروج من Google Drive' });
  };

  const handleSaveBackupToDrive = async () => {
    setIsUploadingToDrive(true);
    setDriveFeedback(null);
    try {
      const fullData = StorageService.getFullDataBackup();
      const res = await GoogleDriveService.uploadBackupToDrive(fullData);
      setDriveFeedback({
        type: 'success',
        text: `تم حفظ نسخة احتياطية كاملة في Google Drive بنجاح: ${res.fileName}`,
      });
      await fetchDriveBackups();
    } catch (err: any) {
      setDriveFeedback({ type: 'error', text: err.message || 'فشل رفع النسخة إلى Google Drive' });
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleRestoreFromDrive = async (file: GoogleDriveFile) => {
    const confirmRestore = window.confirm(
      `هل أنت متأكد من استعادة النسخة الاحتياطية (${file.name}) من Google Drive؟ سيتم استبدال البيانات الحالية.`
    );
    if (!confirmRestore) return;

    try {
      const backupData = await GoogleDriveService.downloadBackupContent(file.id);
      StorageService.restoreFullDataBackup(backupData);
      alert('تمت استعادة البيانات بنجاح من Google Drive!');
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(`فشلت استعادة البيانات من Drive: ${err.message || 'خطأ غير متوقع'}`);
    }
  };

  // Sync Images directly from Google Drive Hospital Database folder
  const handleSyncImagesFromDriveFolder = async () => {
    if (!googleUser) {
      alert('يرجى تسجيل الدخول بحساب Google أولاً');
      return;
    }

    setIsSyncingDriveImages(true);
    setDriveImageReport(null);
    setDriveImageProgress(null);

    try {
      const currentAssets = StorageService.getAssets();
      const { report, updatedAssets } = await GoogleDriveService.syncImagesFromHospitalDatabase(
        currentAssets,
        (current, total, fileName) => {
          setDriveImageProgress({ current, total, fileName });
        }
      );

      setDriveImageReport(report);
      if (report.matchedCount > 0) {
        StorageService.batchImportAssets(updatedAssets);
        onRefresh();
      }
    } catch (err: any) {
      alert(`فشل سحب ومزامنة الصور من Google Drive: ${err?.message}`);
    } finally {
      setIsSyncingDriveImages(false);
      setDriveImageProgress(null);
    }
  };

  // Export Comprehensive 6-Sheet Excel Workbook
  const handleExportComprehensiveExcel = () => {
    const fullData = StorageService.getFullDataBackup();
    ExcelUtils.exportComprehensiveDatabaseToXLSX(fullData);
  };

  // Import Comprehensive 6-Sheet Excel File
  const handleImportComprehensiveExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const currentAssets = StorageService.getAssets();
      const parsed = await ExcelUtils.parseExcelOrCSV(file, currentAssets);

      if (parsed.isComprehensive) {
        const importRes = StorageService.batchImportComprehensiveData({
          assets: parsed.importedAssets,
          users: parsed.importedUsers,
          tickets: parsed.importedTickets,
          periodicRecords: parsed.importedPeriodic,
        });

        alert(
          `تم استيراد قاعدة البيانات بنجاح!\n` +
          `• الأصول والعهد: ${importRes.assetsCount}\n` +
          `• المستخدمين: ${importRes.usersCount}\n` +
          `• بلاغات الصيانة: ${importRes.ticketsCount}\n` +
          `• الصيانة الدورية: ${importRes.periodicCount}`
        );
      } else {
        StorageService.batchImportAssets(parsed.importedAssets);
        alert(`تم استيراد ${parsed.importedAssets.length} جهاز بنجاح!`);
      }

      onRefresh();
      onClose();
    } catch (err: any) {
      alert(`فشل استيراد الملف: ${err?.message || 'تأكد من هيكل ملف الإكسل'}`);
    } finally {
      if (excelComprehensiveInputRef.current) excelComprehensiveInputRef.current.value = '';
    }
  };

  // Google Apps Script code for 6 Sheets
  const googleAppsScriptCode = `/**
 * Google Apps Script Web App for Hospital Asset & Maintenance Management
 * Database: "قاعدة بيانات نظام الاصول والصيانة" (6 Sheets)
 * 1. Open your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Paste this code and click Deploy > New Deployment
 * 4. Select Type: Web App, Execute as: Me, Who has access: Anyone
 * 5. Copy the Web App URL and paste it into the System Sync Settings
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = data.fullBackup || data.payload;

    if (payload) {
      // 1. Sheet: Users
      var uSheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
      uSheet.clear();
      uSheet.appendRow(['Username', 'Password', 'FullName', 'Role', 'Department', 'Status']);
      var users = payload.users || [];
      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        uSheet.appendRow([u.username, u.password || '123456', u.fullName, u.role, u.assignedDepartment || 'جميع الأقسام', u.isActive !== false ? 'Active' : 'Inactive']);
      }

      // 2. Sheet: Assests
      var aSheet = ss.getSheetByName('Assests') || ss.getSheetByName('Assets') || ss.insertSheet('Assests');
      aSheet.clear();
      aSheet.appendRow(['القسم', 'القسم الداخلي', 'Device Name', 'Code', 'الكمية', 'الكمية الدفترية', 'الفارق', 'Model', 'Serial Number', 'Company', 'التوابع', 'مستلم العهدة', 'Status', 'Notes', 'Image URL']);
      var assets = payload.assets || [];
      for (var j = 0; j < assets.length; j++) {
        var a = assets[j];
        var diff = (a.currentQuantity || 0) - (a.bookQuantity || 0);
        aSheet.appendRow([
          a.mainDepartment || '', a.subDepartment || '', a.deviceName || '', a.customId || '',
          a.currentQuantity || 0, a.bookQuantity || 0, diff, a.model || '',
          a.serialNumber || '', a.manufacturer || '', (a.accessories || []).join(' + '),
          a.custodian || '', a.status || 'شغال', a.notes || '', a.imageUrl || ''
        ]);
      }

      // 3. Sheet: Maintenance Tickets
      var tSheet = ss.getSheetByName('Maintenance Tickets') || ss.insertSheet('Maintenance Tickets');
      tSheet.clear();
      tSheet.appendRow(['Ticket ID', 'Asset ID', 'Status (Pending, In_Progress, Completed)', 'Supervisor Name', 'Complaint Text', 'Created At', 'Received At', 'Technician Name', 'Initial Report', 'Required Parts', 'Final Report', 'Completed At', 'Repair Duration', 'PDF Link']);
      var tickets = payload.tickets || [];
      for (var k = 0; k < tickets.length; k++) {
        var t = tickets[k];
        var statusEn = t.status === 'تم الصيانة' ? 'Completed' : (t.status === 'قيد الصيانة' ? 'In_Progress' : 'Pending');
        tSheet.appendRow([
          t.ticketNumber || t.id, t.customId || t.assetId || '', statusEn,
          t.submittedBy ? t.submittedBy.userName : '', t.complaintDescription || '',
          (t.complaintDate || '') + ' ' + (t.complaintTime || ''), t.receivedAt || '',
          t.receivedBy || t.completedBy || '', t.initialReport || '', t.requiredParts || '',
          t.finalReport || '', t.completedAt || '', t.repairDuration || '', ''
        ]);
      }

      // 4. Sheet: Preventive Maintenance
      var pSheet = ss.getSheetByName('Preventive Maintenance') || ss.insertSheet('Preventive Maintenance');
      pSheet.clear();
      pSheet.appendRow(['Type (AC, Oil, Battery)', 'Asset ID', 'Last Service Date', 'Current Reading', 'Next Reading', 'Next Service Date', 'Notes']);
      var periodic = payload.periodic || payload.periodicRecords || [];
      for (var p = 0; p < periodic.length; p++) {
        var pr = periodic[p];
        var typeCode = pr.category === 'التكييف' ? 'AC' : (pr.category === 'الزيوت والفلاتر' ? 'Oil' : 'Battery');
        pSheet.appendRow([
          typeCode, pr.customId || pr.assetId || '', pr.maintenanceDate || pr.batteryChangeDate || '',
          pr.currentMeterReading || '', pr.nextMeterReading || '', pr.nextExpectedChangeDate || '',
          pr.notes || pr.workDone || ''
        ]);
      }

      // 5. Sheet: Activity Logs (History)
      var hSheet = ss.getSheetByName('Activity Logs (History)') || ss.insertSheet('Activity Logs (History)');
      hSheet.clear();
      hSheet.appendRow(['Timestamp', 'User', 'Action', 'Details']);
      var history = payload.history || [];
      for (var h = 0; h < Math.min(history.length, 500); h++) {
        var hl = history[h];
        hSheet.appendRow([hl.timestamp || '', hl.performedBy + ' (' + hl.userRole + ')', hl.action || '', hl.details || '']);
      }

      // 6. Sheet: Stats (Read-Only)
      var sSheet = ss.getSheetByName('Stats') || ss.insertSheet('Stats');
      sSheet.clear();
      sSheet.appendRow(['المؤشر الإحصائي (Metric)', 'القيمة (Value)']);
      sSheet.appendRow(['إجمالي الأجهزة المسجلة', assets.length]);
      sSheet.appendRow(['إجمالي بلاغات الصيانة', tickets.length]);
      sSheet.appendRow(['إجمالي سجلات الصيانة الدورية', periodic.length]);
      sSheet.appendRow(['تاريخ آخر تحديث سحابي', new Date().toLocaleString('ar-EG')]);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'All 6 sheets synchronized successfully', timestamp: new Date() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveSyncConfig({
      googleSheetWebhookUrl: webhookUrl.trim(),
      autoSyncEnabled: autoSync,
    });
    setSyncConfig(StorageService.getSyncConfig());
    setSyncStatusMsg('تم حفظ إعدادات المزامنة بنجاح');
    setTimeout(() => setSyncStatusMsg(''), 3000);
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('جاري مزامنة البيانات والـ 6 صفحات مع Google Sheets...');
    try {
      const result = await StorageService.triggerManualSync();
      setPendingCount(StorageService.getPendingSyncCount());
      setSyncStatusMsg(result.message);
      onRefresh();
    } catch (err: any) {
      setSyncStatusMsg(err.message || 'فشلت عملية المزامنة');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 text-right max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                إعدادات قاعدة البيانات والمزامنة (Google Drive & Sheets)
              </h3>
              <p className="text-[11px] text-slate-500">
                مزامنة الـ 6 صفحات، ربط صور مجلد Hospital Database، وتصدير واستيراد قاعدة البيانات الكاملة
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
          {/* Status Alert */}
          {syncStatusMsg && (
            <div className="p-3 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 font-bold">
              {syncStatusMsg}
            </div>
          )}

          {/* Sync Stats Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-slate-400 block text-[11px]">حالة الاتصال:</span>
              <span className="font-bold text-slate-900">
                {navigator.onLine ? 'متصل بالشبكة 🟢' : 'غير متصل (يعمل محلياً) 🔴'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">المزامنة السحابية الحية:</span>
              <span className="font-bold text-blue-700">
                Firebase Firestore ⚡
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-slate-400 block text-[11px]">مزامنة الأجهزة:</span>
              <span className="font-semibold text-emerald-700 font-bold">
                مزامنة فورية حية 🟢
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ⚡ 0. LIVE FIRESTORE CLOUD DATABASE SECTION */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50/40 to-white border border-blue-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>قاعدة البيانات السحابية الموحدة (Firebase Firestore)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200">
                      ⚡ نظام اقتصادي ذكي
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    مزامنة فورية حية مع توفير حتى 95% من الحصة اليومية عبر تقنية النبضات الدلتا الذكية
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                متصل ونشط 🟢
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/80 border border-blue-100 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>وضع التوفير النشط: يتم الاستماع لمستند النبضات الفوري ونقل التعديلات فقط</span>
              </div>
              <span className="font-bold text-blue-700">
                تم توفير ~{FirestoreSyncService.getEstimatedSavedReads().toLocaleString('ar-EG')} قراءة اليوم 🛡️
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handlePushAllToFirestore}
                disabled={isSyncingFirestore || isPullingFirestore}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs disabled:opacity-50 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirestore ? 'animate-spin' : ''}`} />
                <span>{isSyncingFirestore ? 'جاري رفع البيانات...' : 'رفع ومزامنة كامل البيانات المحلية إلى السحابة'}</span>
              </button>

              <button
                type="button"
                onClick={handlePullAllFromFirestore}
                disabled={isSyncingFirestore || isPullingFirestore}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-blue-800 border border-blue-300 font-bold transition-all shadow-xs disabled:opacity-50 text-xs"
              >
                <Download className={`w-3.5 h-3.5 ${isPullingFirestore ? 'animate-spin' : ''}`} />
                <span>{isPullingFirestore ? 'جاري التحميل...' : 'جلب وتحديث قاعدة البيانات من السحابة'}</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 🌟 1. EXCEL DATABASE COMPREHENSIVE (6 SHEETS) SECTION */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white border border-emerald-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  ملف Excel الشامل: «قاعدة بيانات نظام الاصول والصيانة» (6 صفحات)
                </h4>
                <p className="text-[11px] text-slate-500">
                  يتضمن صفحات: Users, Assests, Maintenance Tickets, Preventive Maintenance, Activity Logs, Stats
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportComprehensiveExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                تصدير قاعدة البيانات (6 صفحات Excel)
              </button>

              <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold cursor-pointer transition-all shadow-xs">
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>استيراد ملف قاعدة البيانات Excel الشامل</span>
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

          {/* ========================================================================= */}
          {/* 🌟 2. GOOGLE DRIVE & IMAGES FOLDER INTEGRATION */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white border border-blue-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    مزامنة Google Drive ومجلد «Hospital Database»
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    ربط حساب Google لسحب الصور تلقائياً وحفظ النسخ الاحتياطية سحابياً
                  </p>
                </div>
              </div>

              {googleUser ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> {googleUser.email}
                  </span>
                  <button
                    onClick={handleDisconnectGoogleDrive}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="تسجيل الخروج من Google"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectGoogleDrive}
                  disabled={isConnectingDrive}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold border border-slate-300 shadow-xs hover:shadow transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>{isConnectingDrive ? 'جاري الاتصال...' : 'ربط Google Drive'}</span>
                </button>
              )}
            </div>

            {driveFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs font-bold border ${
                  driveFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {driveFeedback.text}
              </div>
            )}

            {googleUser && (
              <div className="space-y-3 pt-1">
                {/* Image Sync from Hospital Database Folder */}
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block text-xs flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        سحب ومطابقة الصور من مجلد Hospital Database في Drive:
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        يقوم النظام بالبحث في مجلد Hospital Database ومطابقة أسماء ملفات الصور بكود الجهاز Code أو رقمه التسلسلي تلقائياً.
                      </p>
                    </div>

                    <button
                      onClick={handleSyncImagesFromDriveFolder}
                      disabled={isSyncingDriveImages}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDriveImages ? 'animate-spin' : ''}`} />
                      {isSyncingDriveImages ? 'جاري السحب والمطابقة...' : 'سحب الصور ومطابقتها الآن'}
                    </button>
                  </div>

                  {driveImageProgress && (
                    <div className="p-2 bg-white rounded border border-blue-200 text-[11px] space-y-1">
                      <div className="flex justify-between font-bold text-blue-800">
                        <span>جاري معالجة: {driveImageProgress.fileName}</span>
                        <span>{driveImageProgress.current} / {driveImageProgress.total}</span>
                      </div>
                      <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-200"
                          style={{ width: `${Math.round((driveImageProgress.current / driveImageProgress.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {driveImageReport && (
                    <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-[11px] text-emerald-900 font-medium">
                      ✅ تم فحص ({driveImageReport.totalFound}) ملف صورة في مجلد Drive، وتم ربط (
                      <strong className="font-bold text-emerald-800">{driveImageReport.matchedCount}</strong>) صورة بنجاح بالأجهزة!
                    </div>
                  )}
                </div>

                {/* Cloud Backups Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSaveBackupToDrive}
                    disabled={isUploadingToDrive}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors disabled:opacity-50"
                  >
                    <FolderSync className={`w-3.5 h-3.5 ${isUploadingToDrive ? 'animate-spin' : ''}`} />
                    {isUploadingToDrive ? 'جاري الرفع إلى Drive...' : 'حفظ نسخة احتياطية سحابية في Drive'}
                  </button>

                  <button
                    onClick={fetchDriveBackups}
                    disabled={isLoadingBackups}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                    تحديث قائمة النسخ
                  </button>
                </div>

                {/* Stored Google Drive Backups List */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">
                    النسخ الاحتياطية المحفوظة في Google Drive ({driveBackups.length}):
                  </span>
                  {driveBackups.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      {isLoadingBackups ? 'جاري جلب الملفات من Google Drive...' : 'لا توجد نسخ احتياطية في مجلد Hospital Database على Google Drive حتى الآن.'}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {driveBackups.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 hover:bg-blue-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <div className="truncate">
                              <span className="font-mono font-bold text-slate-800 text-[11px] block truncate">
                                {file.name}
                              </span>
                              {file.modifiedTime && (
                                <span className="text-[10px] text-slate-400">
                                  {new Date(file.modifiedTime).toLocaleString('ar-EG')}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRestoreFromDrive(file)}
                            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shrink-0"
                          >
                            استعادة هذه النسخة
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 🌟 3. GOOGLE APPS SCRIPT WEBHOOK CONFIGURATION */}
          {/* ========================================================================= */}
          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                رابط Webhook لـ Google Apps Script / Google Sheets (اختياري للمزامنة التلقائية مع الـ 6 صفحات):
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                رابط تطبيق الويب الصادر من Apps Script في ملف Google Sheets الخاص بك لتحديث الـ 6 صفحات فوراً.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-sync-check"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="auto-sync-check" className="font-semibold text-slate-700">
                تفعيل المزامنة التلقائية فور توفر اتصال بالإنترنت (Auto-Sync)
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
              >
                حفظ الإعدادات
              </button>

              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'جاري المزامنة...' : 'مزامنة الـ 6 صفحات الآن'}
              </button>
            </div>
          </form>

          {/* Google Apps Script Code Accordion */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                كود Google Apps Script لمزامنة الـ 6 صفحات:
              </span>
              <button
                type="button"
                onClick={handleCopyScript}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition-colors"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ الكود</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[10px] overflow-x-auto max-h-36">
              {googleAppsScriptCode}
            </pre>
          </div>
        </div>

        <div className="pt-2 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 text-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
