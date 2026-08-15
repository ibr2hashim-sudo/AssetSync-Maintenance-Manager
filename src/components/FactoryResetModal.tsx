import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Lock, CheckCircle2 } from 'lucide-react';
import { StorageService } from '../services/storage';

interface FactoryResetModalProps {
  onClose: () => void;
  onResetComplete: () => void;
}

export const FactoryResetModal: React.FC<FactoryResetModalProps> = ({
  onClose,
  onResetComplete,
}) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFactoryReset = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (confirmText.trim() !== 'إعادة ضبط المصنع') {
      setErrorMsg('يرجى كتابة جملة التأكيد "إعادة ضبط المصنع" بدقة للمتابعة');
      return;
    }

    setIsProcessing(true);
    try {
      const res = StorageService.factoryReset(adminPassword.trim());
      if (res.success) {
        alert(res.message || 'تمت إعادة ضبط المصنع بنجاح. تم تصفير كافة البيانات وإعادة الحساب الافتراضي admin.');
        onResetComplete();
      } else {
        setErrorMsg(res.message || 'كلمة مرور الأدمن غير صحيحة');
        setIsProcessing(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء إعادة ضبط البيانات');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">إعادة ضبط المصنع (Factory Reset)</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-1.5 text-xs text-red-800">
          <span className="font-bold block">⚠️ تحذير شديد الأهمية:</span>
          <p className="leading-relaxed">
            سيؤدي هذا الإجراء إلى حذف ومسح كافة الأجهزة الطبية، طلبات الصيانة، سجلات الصيانة الدورية، والحسابات الإضافية نهائياً وإعادة النظام إلى الحالة النظيفة الصفرية الأولية.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-100 text-red-700 rounded-xl text-xs font-bold border border-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleFactoryReset} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              كلمة مرور الأدمن الحالية للتأكيد: <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="أدخل كلمة مرور حساب الأدمن"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              اكتب عبارة التأكيد <span className="text-red-600 font-mono font-bold">"إعادة ضبط المصنع"</span>:
            </label>
            <input
              type="text"
              required
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="إعادة ضبط المصنع"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 disabled:opacity-50"
            >
              {isProcessing ? 'جاري إعادة الضبط...' : 'تأكيد تصفير النظام بالكامل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
