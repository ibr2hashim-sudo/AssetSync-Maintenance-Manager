import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Box,
  Wrench,
  Calendar,
  User as UserIcon,
  Layers,
  Database,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { FirestoreSyncService } from '../services/firestoreSync';

interface PendingSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

interface PendingItem {
  id: string;
  type: string;
  payload: any;
  timestamp: string;
}

export const PendingSyncModal: React.FC<PendingSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadQueue = () => {
    try {
      const queue = StorageService.getPendingQueue();
      setItems(Array.isArray(queue) ? queue : []);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadQueue();
      setSyncStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncStatus({ text: 'جاري رفع العمليات المعلقة ومزامنتها مع السحابة...', type: 'info' });
    try {
      const res = await FirestoreSyncService.pushAllLocalDataToFirestore();
      if (res.success) {
        StorageService.clearPendingQueue();
        loadQueue();
        setSyncStatus({ text: res.message || 'تمت المزامنة ورفع جميع البيانات بنجاح!', type: 'success' });
        if (onSyncComplete) onSyncComplete();
      } else {
        setSyncStatus({ text: res.message || 'تعذرت المزامنة، تأكد من الاتصال', type: 'error' });
      }
    } catch (err: any) {
      setSyncStatus({ text: err?.message || 'حدث خطأ أثناء المزامنة', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearQueue = () => {
    if (window.confirm('هل أنت متأكد من تفريغ قائمة العمليات المعلقة؟ لن يتم التراجع عن البيانات المحلية ولكن ستتوقف محاولات رفعها حتى التعديل القادم.')) {
      StorageService.clearPendingQueue();
      loadQueue();
      if (onSyncComplete) onSyncComplete();
    }
  };

  const getOperationInfo = (item: PendingItem) => {
    const { type, payload } = item;
    switch (type) {
      case 'SAVE_ASSET':
        return {
          title: 'حفظ / تعديل أصل طبي',
          name: payload?.name || payload?.model || 'أصل طبي',
          subtitle: `رمز الأصل: ${payload?.customId || payload?.id || '-'} | القسم: ${payload?.department || '-'}`,
          icon: Box,
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'DELETE_ASSET':
        return {
          title: 'حذف أصل طبي',
          name: payload?.customId || payload?.id || 'أصل محذوف',
          subtitle: 'طلب إزالة الأصل من السجلات',
          icon: Trash2,
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'CREATE_TICKET':
        return {
          title: 'إنشاء تذكرة صيانة',
          name: payload?.ticketNumber || 'تذكرة جديدة',
          subtitle: `الأصل: ${payload?.assetName || payload?.assetCustomId || '-'} | الأولوية: ${payload?.priority || '-'}`,
          icon: Wrench,
          badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'UPDATE_TICKET':
      case 'COMPLETE_TICKET':
        return {
          title: type === 'COMPLETE_TICKET' ? 'إنهاء تذكرة صيانة' : 'تحديث تذكرة صيانة',
          name: payload?.ticketNumber || 'تذكرة صيانة',
          subtitle: `الحالة: ${payload?.status || '-'} | الفني: ${payload?.assignedTechnician || '-'}`,
          icon: Wrench,
          badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'SAVE_PERIODIC':
        return {
          title: 'تسجيل فحص صيانة دورية',
          name: payload?.assetName || payload?.assetCustomId || 'فحص وقائي',
          subtitle: `تاريخ الفحص: ${payload?.inspectionDate || payload?.scheduledDate || '-'} | النتيجة: ${payload?.status || '-'}`,
          icon: Calendar,
          badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        };
      case 'CREATE_AUDIT_SESSION':
      case 'FINALIZE_AUDIT_SESSION':
        return {
          title: type === 'CREATE_AUDIT_SESSION' ? 'بدء جلسة جرد ميداني' : 'اعتماد وإنهاء جلسة جرد',
          name: payload?.sessionNumber || 'جلسة جرد',
          subtitle: `القسم: ${payload?.department || '-'} | إجمالي المطابق: ${payload?.matchedCount || '0'}`,
          icon: Layers,
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        };
      case 'SAVE_USER':
        return {
          title: 'حفظ مستخدم',
          name: payload?.fullName || payload?.username || 'مستخدم جديد',
          subtitle: `الدور: ${payload?.role || '-'}`,
          icon: UserIcon,
          badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
        };
      case 'DELETE_USER':
        return {
          title: 'حذف مستخدم',
          name: payload?.id || 'مستخدم',
          subtitle: 'إزالة حساب من النظام',
          icon: Trash2,
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'BATCH_IMPORT_ASSETS':
        return {
          title: 'استيراد جماعي للأصول',
          name: `استيراد ${payload?.count || ''} أصل`,
          subtitle: 'إضافة سجلات من ملف إكسل أو بيانات سريعة',
          icon: FileSpreadsheet,
          badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
        };
      case 'RENAME_DEPARTMENT':
        return {
          title: 'تعديل اسم قسم',
          name: `${payload?.oldDept} ➔ ${payload?.newDept}`,
          subtitle: 'تحديث مسميات الأقسام في الأصول',
          icon: ArrowUpDown,
          badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
        };
      default:
        return {
          title: 'عملية نظام محلية',
          name: type,
          subtitle: typeof payload === 'object' ? JSON.stringify(payload).slice(0, 50) + '...' : String(payload || ''),
          icon: Database,
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('ar-SA', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-right border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center border border-amber-500/30 shadow-xs">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  قائمة العمليات المعلقة للمزامنة
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {items.length} معلق
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تعديلات تم حفظها محلياً بأمان على جهازك وتنتظر التحديث السحابي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Notification */}
        {syncStatus && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border shrink-0 ${
              syncStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : syncStatus.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {syncStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : syncStatus.type === 'error' ? (
              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            )}
            <span>{syncStatus.text}</span>
          </div>
        )}

        {/* Main List Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-[160px] max-h-[50vh]">
          {items.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">
                  لا توجد أي بيانات معلقة حالياً
                </h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  جميع العمليات والأصول وتذاكر الصيانة متزامنة ومطابقة تماماً بين جهازك وقاعدة البيانات السحابية.
                </p>
              </div>
            </div>
          ) : (
            items.map((item, idx) => {
              const info = getOperationInfo(item);
              const IconComp = info.icon;
              return (
                <div
                  key={item.id || idx}
                  className="p-3 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition-all flex items-start justify-between gap-3 text-right"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${info.badgeColor}`}
                        >
                          {info.title}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {info.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 truncate">
                        {info.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearQueue}
            disabled={items.length === 0 || isSyncing}
            className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-transparent hover:border-rose-200 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="تفريغ قائمة الانتظار"
          >
            تفريغ القائمة
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 text-xs transition-colors"
            >
              إغلاق
            </button>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={items.length === 0 || isSyncing}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة المعلق الآن'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
