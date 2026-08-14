import React, { useState } from 'react';
import {
  Cloud,
  CloudCheck,
  RefreshCw,
  Copy,
  Check,
  Download,
  Upload,
  X,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Database,
} from 'lucide-react';
import { StorageService } from '../services/storage';

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
                إعدادات المزامنة السحابية وقاعدة بيانات Google Sheets
              </h3>
              <p className="text-[11px] text-slate-500">
                الدعم الآلي للعمل بدون إنترنت (Offline-First) والربط مع Google Drive
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

          {/* Configuration Form */}
          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                رابط Webhook لـ Google Apps Script / Google Sheets:
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                رابط تطبيق الويب الصادر من Apps Script في ملف Google Sheets الخاص بك.
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
                {isSyncing ? 'جاري المزامنة...' : 'مزامنة يدوية الآن'}
              </button>
            </div>
          </form>

          {/* Google Apps Script Helper Accordion */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                كود Google Apps Script الجاهز للمزامنة:
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

          {/* Disaster Recovery Backup Export / Restore */}
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
            <div className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-indigo-600" />
              النسخ الاحتياطي المحلي الكامل (JSON Backup):
            </div>
            <p className="text-[11px] text-indigo-900 leading-relaxed">
              يمكنك تصدير قاعدة البيانات بكافة الأصول والطلبات والمستخدمين في ملف JSON أو استعادتها في أي وقت.
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
