import React, { useState, useMemo } from 'react';
import {
  History as HistoryIcon,
  Search,
  Download,
  Trash2,
  X,
  Clock,
  User as UserIcon,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';
import { HistoryLog } from '../types';
import { StorageService } from '../services/storage';

interface HistoryModalProps {
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<HistoryLog[]>(StorageService.getHistoryLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActionFilter, setSelectedActionFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    let list = logs;

    if (selectedActionFilter !== 'all') {
      list = list.filter((l) => l.action.toLowerCase().includes(selectedActionFilter.toLowerCase()));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q) ||
          (l.targetId && l.targetId.toLowerCase().includes(q))
      );
    }

    return list;
  }, [logs, selectedActionFilter, searchTerm]);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['المعرف', 'التاريخ والوقت', 'المستخدم', 'الدور', 'نوع الإجراء', 'التفاصيل', 'معرف الهدف'];
    const rows = logs.map((l) => [
      l.id,
      l.timestamp,
      l.userName,
      l.userRole,
      l.action,
      `"${l.details.replace(/"/g, '""')}"`,
      l.targetId || '',
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
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 text-right max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <HistoryIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">سجل العمليات والـ History الكامل</h3>
              <p className="text-[11px] text-slate-500">توثيق زمني دقيق لكل العمليات والتعديلات والإضافات المنفذة</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث في السجل..."
              className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200"
            />
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
            <div className="p-8 text-center text-slate-400 text-xs">لا توجد عمليات مسجلة</div>
          ) : (
            <table className="w-full text-right text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0">
                <tr>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">المستخدم</th>
                  <th className="p-3">نوع الإجراء</th>
                  <th className="p-3">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 whitespace-nowrap font-mono text-slate-500 text-[11px]">
                      {new Date(log.timestamp).toLocaleString('ar-EG')}
                    </td>
                    <td className="p-3 whitespace-nowrap font-bold text-slate-900">
                      {log.userName}{' '}
                      <span className="text-[10px] font-normal text-slate-500">
                        ({log.userRole === 'admin' ? 'أدمن' : log.userRole === 'technician' ? 'فني' : 'مشرف'})
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 leading-relaxed">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t">
          <span>إجمالي العمليات المسجلة: {filteredLogs.length}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
