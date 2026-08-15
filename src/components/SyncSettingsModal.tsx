import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { GoogleDriveService, GoogleDriveFile } from '../services/googleDriveService';

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

  // Apps Script code for Google Sheets integration
  const googleAppsScriptCode = `/**
 * Google Apps Script Web App for Hospital Asset Management
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
    
    // Process full sync or queue updates
    if (data.action === 'FULL_BACKUP' && data.payload) {
      var assetsSheet = ss.getSheetByName('Assets') || ss.insertSheet('Assets');
      assetsSheet.clear();
      
      var headers = ['ID', 'القسم الرئيسي', 'القسم الفرعي', 'اسم الجهاز', 'الموديل', 'الرقم التسلسلي', 'تاريخ التوريد', 'تاريخ انتهاء الضمان', 'الشركة الموردة', 'رقم هاتف المورد', 'اسم الوكيل', 'هاتف الوكيل', 'الحالة الفنية', 'ملاحظات', 'آخر تحديث'];
      assetsSheet.appendRow(headers);
      
      var assets = data.payload.assets || [];
      for (var i = 0; i < assets.length; i++) {
        var a = assets[i];
        assetsSheet.appendRow([
          a.customId, a.mainDepartment, a.subDepartment || '', a.deviceName,
          a.model || '', a.serialNumber || '', a.supplyDate || '',
          a.warrantyEndDate || '', a.supplierCompany || '', a.supplierPhone || '',
          a.agentName || '', a.agentPhone || '', a.technicalStatus || '',
          a.notes || '', a.updatedAt || ''
        ]);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Data synced successfully', timestamp: new Date() }))
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
    setSyncStatusMsg('جاري مزامنة البيانات والعمليات المعلقة...');
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

  // Full Database JSON Backup Export
  const handleExportBackupJSON = () => {
    const data = StorageService.getFullDataBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `نسخة_احتياطية_كاملة_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Full Database JSON Backup Import
  const handleImportBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        StorageService.restoreFullDataBackup(json);
        alert('تم استعادة النسخة الاحتياطية بنجاح!');
        onRefresh();
        onClose();
      } catch (err: any) {
        alert('الملف غير صالح أو تالف');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-right max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                إعدادات المزامنة السحابية و Google Drive
              </h3>
              <p className="text-[11px] text-slate-500">
                مزامنة وحفظ النسخ الاحتياطية سحابياً ومشاركتها مع كافة الأجهزة
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
              <span className="text-slate-400 block text-[11px]">العمليات المعلقة:</span>
              <span
                className={`font-bold font-mono ${
                  pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {pendingCount} عملية بانتظار المزامنة
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-slate-400 block text-[11px]">آخر مزامنة ناجحة:</span>
              <span className="font-semibold text-slate-700">
                {syncConfig.lastSyncTimestamp
                  ? new Date(syncConfig.lastSyncTimestamp).toLocaleTimeString('ar-EG')
                  : 'لم تتم بعد'}
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 🌟 GOOGLE DRIVE INTEGRATION SECTION */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white border border-blue-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">مزامنة وحفظ Google Drive</h4>
                  <p className="text-[11px] text-slate-500">حفظ سحابي لبيانات الأجهزة والصور على حسابك في Google</p>
                </div>
              </div>

              {googleUser ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> متصل
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSaveBackupToDrive}
                    disabled={isUploadingToDrive}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors disabled:opacity-50"
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
                    تحديث القائمة
                  </button>
                </div>

                {/* Stored Google Drive Backups List */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">
                    النسخ الاحتياطية المحفوظة في Google Drive ({driveBackups.length}):
                  </span>
                  {driveBackups.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      {isLoadingBackups ? 'جاري جلب الملفات من Google Drive...' : 'لا توجد نسخ احتياطية في مجلد النظام على Google Drive حتى الآن.'}
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

          {/* Configuration Form for Google Sheets Webhook */}
          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                رابط Webhook لـ Google Apps Script / Google Sheets (اختياري):
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                رابط تطبيق الويب الصادر من Apps Script في ملف Google Sheets الخاص بك للتسجيل الفوري في الجداول.
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
                {isSyncing ? 'جاري المزامنة...' : 'مزامنة السجلات الآن'}
              </button>
            </div>
          </form>

          {/* Google Apps Script Helper Accordion */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                كود Google Apps Script لمزامنة الجداول:
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

          {/* Disaster Recovery Backup Export / Restore (Local File) */}
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
            <div className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-indigo-600" />
              النسخ الاحتياطي اليدوي على الجهاز (JSON File):
            </div>
            <p className="text-[11px] text-indigo-900 leading-relaxed">
              تحميل ملف نسخة احتياطية مباشرة على جهاز الكمبيوتر الخاص بك لاستعادته دون الحاجة للإنترنت.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleExportBackupJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 font-bold transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                تحميل نسخة احتياطية (JSON)
              </button>

              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>استعادة من ملف JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackupJSON}
                  className="hidden"
                />
              </label>
            </div>
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
