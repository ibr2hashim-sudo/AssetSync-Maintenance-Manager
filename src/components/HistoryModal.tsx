import React, { useState, useMemo } from 'react';
import {
  History as HistoryIcon,
  Search,
  Trash2,
  X,
  Clock,
  User as UserIcon,
  Filter,
  FileSpreadsheet,
  Layers,
  Wrench,
  Calendar,
  Users,
  RefreshCw,
  Sliders,
  ClipboardCheck,
} from 'lucide-react';
import { HistoryLog } from '../types';
import { StorageService } from '../services/storage';

interface HistoryModalProps {
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<HistoryLog[]>(StorageService.getHistoryLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '—';
    if (typeof ts === 'string') {
      // If already formatted with arabic or standard readable date/time
      if (ts.includes('ص') || ts.includes('م') || /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(ts)) {
        return ts;
      }
      try {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          return d.toLocaleString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });
        }
      } catch {}
    }
    return String(ts);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'أصول':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: Layers,
        };
      case 'صيانة':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: Wrench,
        };
      case 'صيانة دورية':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: Calendar,
        };
      case 'مستخدمين':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: Users,
        };
      case 'مزامنة':
        return {
          bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          icon: RefreshCw,
        };
      case 'جرد':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: ClipboardCheck,
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Sliders,
        };
    }
  };

  const filteredLogs = useMemo(() => {
    let list = logs;

    if (selectedCategoryFilter !== 'all') {
      list = list.filter((l) => l.category === selectedCategoryFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((l) => {
        const user = (l.performedBy || (l as any).userName || '').toLowerCase();
        const action = (l.action || '').toLowerCase();
        const details = (l.details || '').toLowerCase();
        const category = (l.category || '').toLowerCase();
        const ts = (l.timestamp || '').toLowerCase();
        return (
          user.includes(q) ||
          action.includes(q) ||
          details.includes(q) ||
          category.includes(q) ||
          ts.includes(q)
        );
      });
    }

    return list;
  }, [logs, selectedCategoryFilter, searchTerm]);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['المعرف', 'التاريخ والوقت', 'المستخدم', 'الدور', 'التصنيف', 'نوع الإجراء', 'التفاصيل'];
    const rows = logs.map((l) => [
      l.id,
      `"${formatTimestamp(l.timestamp)}"`,
      `"${l.performedBy || (l as any).userName || 'النظام'}"`,
      `"${l.userRole || 'admin'}"`,
      `"${l.category || 'نظام'}"`,
      `"${l.action || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `سجل_العمليات_History_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearHistory = () => {
    if (confirm('هل أنت متأكد من رغبتك في مسح سجل العمليات والـ History بالكامل؟')) {
      localStorage.setItem('hospital_assets_history_logs', JSON.stringify([]));
      setLogs([]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 text-right max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <HistoryIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">سجل العمليات والـ History الكامل</h3>
              <p className="text-xs text-slate-500">توثيق زمني دقيق لكل العمليات والتعديلات والإضافات المنفذة مع الوقت والتاريخ والمستخدم</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالمستخدم، الإجراء، التفاصيل..."
                className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Category Filter */}
            <div className="relative shrink-0">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">كل الأقسام والتصنيفات</option>
                <option value="أصول">الأصول والعهد</option>
                <option value="صيانة">بلاغات الصيانة</option>
                <option value="صيانة دورية">الصيانة الوقائية</option>
                <option value="جرد">عمليات الجرد</option>
                <option value="مستخدمين">المستخدمين</option>
                <option value="مزامنة">المزامنة السحابية</option>
                <option value="نظام">إعدادات النظام</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تصدير السجل (CSV)
            </button>

            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              مسح السجل
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
              <p className="text-xs font-medium">لا توجد عمليات مسجلة تطابق معايير البحث</p>
            </div>
          ) : (
            <table className="w-full text-right text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-3 w-44">التاريخ والوقت</th>
                  <th className="p-3 w-36">المستخدم</th>
                  <th className="p-3 w-28">التصنيف</th>
                  <th className="p-3 w-48">نوع الإجراء</th>
                  <th className="p-3">التفاصيل الكاملة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const badge = getCategoryBadge(log.category);
                  const Icon = badge.icon;
                  const userName = log.performedBy || (log as any).userName || 'النظام';
                  const roleLabel =
                    log.userRole === 'admin'
                      ? 'مدير'
                      : log.userRole === 'technician'
                      ? 'فني'
                      : log.userRole === 'supervisor'
                      ? 'مشرف'
                      : 'مستخدم';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 whitespace-nowrap font-mono text-slate-600 text-[11px] font-medium dir-ltr text-right">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                            {userName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{userName}</span>
                            <span className="text-[10px] text-slate-400">({roleLabel})</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${badge.bg}`}
                        >
                          <Icon className="w-3 h-3" />
                          {log.category || 'نظام'}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-bold text-slate-800 text-xs">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 leading-relaxed text-xs">
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t">
          <span className="font-medium">إجمالي العمليات المسجلة: <strong className="text-slate-900">{filteredLogs.length}</strong></span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors text-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

