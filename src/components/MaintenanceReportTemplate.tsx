import React from 'react';
import { MaintenanceTicket } from '../types';
import { Shield, Wrench, CheckCircle2, FileText } from 'lucide-react';

interface MaintenanceReportTemplateProps {
  ticket: MaintenanceTicket;
  id?: string;
}

export const MaintenanceReportTemplate: React.FC<MaintenanceReportTemplateProps> = ({
  ticket,
  id = 'maintenance-report-pdf-template',
}) => {
  return (
    <div
      id={id}
      dir="rtl"
      className="bg-white text-slate-900 p-8 max-w-[210mm] min-h-[297mm] mx-auto text-right font-['Tajawal',sans-serif] border border-slate-300 shadow-none leading-normal"
      style={{ boxSizing: 'border-box' }}
    >
      {/* Official Header */}
      <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-black text-slate-900">قسم الهندسة الطبية وإدارة الصيانة</h2>
          <p className="text-xs font-semibold text-slate-600">نظام إدارة الأصول والعهد وبلاغات الأعطال</p>
          <p className="text-[11px] text-slate-500">سجل الصيانة الشامل وتوثيق الإصلاحات الفنية</p>
        </div>

        <div className="text-left space-y-1">
          <div className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded">
            {ticket.ticketNumber}
          </div>
          <p className="text-[11px] text-slate-500">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
        </div>
      </div>

      {/* Main Title Banner */}
      <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 text-center mb-6">
        <h1 className="text-base font-black text-slate-900">
          تقرير فني لإنجاز صيانة وإصلاح عطل
        </h1>
        <span
          className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold ${
            ticket.status === 'تم الصيانة'
              ? 'bg-emerald-100 text-emerald-800'
              : ticket.status === 'قيد الصيانة'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          حالة البلاغ: {ticket.status}
        </span>
      </div>

      {/* Section 1: Device and Location Information */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-900 bg-slate-200 px-3 py-1 rounded mb-2 flex items-center gap-1.5">
          <span>أولاً: بيانات الجهاز وموقع العهدة</span>
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="w-1/4 p-2 bg-slate-50 font-bold border-l border-slate-300">القسم الرئيسي:</td>
              <td className="w-1/4 p-2 border-l border-slate-300">{ticket.mainDepartment}</td>
              <td className="w-1/4 p-2 bg-slate-50 font-bold border-l border-slate-300">القسم الفرعي / الداخلي:</td>
              <td className="w-1/4 p-2">{ticket.subDepartment || ticket.mainDepartment}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="p-2 bg-slate-50 font-bold border-l border-slate-300">اسم الجهاز:</td>
              <td className="p-2 font-bold text-slate-900 border-l border-slate-300">{ticket.deviceName}</td>
              <td className="p-2 bg-slate-50 font-bold border-l border-slate-300">ID المخصص للجهاز:</td>
              <td className="p-2 font-mono font-bold text-blue-800">{ticket.customId}</td>
            </tr>
            <tr>
              <td className="p-2 bg-slate-50 font-bold border-l border-slate-300">الموديل (Model):</td>
              <td className="p-2 border-l border-slate-300">{ticket.model || '—'}</td>
              <td className="p-2 bg-slate-50 font-bold border-l border-slate-300">الرقم التسلسلي (S.N):</td>
              <td className="p-2 font-mono">{ticket.serialNumber || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 2: Complaint Information */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-900 bg-slate-200 px-3 py-1 rounded mb-2">
          ثانياً: تفاصيل بلاغ العطل والشكوى
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-xs mb-2">
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="w-1/4 p-2 bg-slate-50 font-bold border-l border-slate-300">تاريخ الشكوى:</td>
              <td className="w-1/4 p-2 border-l border-slate-300">{ticket.complaintDate}</td>
              <td className="w-1/4 p-2 bg-slate-50 font-bold border-l border-slate-300">وقت البلاغ:</td>
              <td className="w-1/4 p-2">{ticket.complaintTime}</td>
            </tr>
            <tr>
              <td className="p-2 bg-slate-50 font-bold border-l border-slate-300">مقدم البلاغ:</td>
              <td colSpan={3} className="p-2">
                {ticket.submittedBy.userName} ({ticket.submittedBy.role === 'supervisor' ? 'مشرف القسم' : 'إدارة'})
              </td>
            </tr>
          </tbody>
        </table>
        <div className="p-3 border border-slate-300 rounded bg-slate-50 text-xs">
          <span className="font-bold block mb-1 text-slate-700">وصف الشكوى والعطل المرصود:</span>
          <p className="text-slate-900 whitespace-pre-wrap">{ticket.complaintDescription}</p>
        </div>
      </div>

      {/* Section 3: Technical Operations Lifecycle */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-900 bg-slate-200 px-3 py-1 rounded mb-2">
          ثالثاً: الإجراءات والعمليات الفنية
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-xs mb-3">
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="w-1/4 p-2 bg-slate-50 font-bold border-l border-slate-300">تاريخ ووقت الاستلام:</td>
              <td className="w-1/4 p-2 border-l border-slate-300">{ticket.receivedAt || 'قيد الانتظار'}</td>
              <td className="w-1/4 p-2 bg-slate-50 font-bold border-l border-slate-300">الفني المستلم:</td>
              <td className="w-1/4 p-2 font-bold">{ticket.receivedBy || 'لم يُحدد بعد'}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="p-2 bg-slate-50 font-bold border-l border-slate-300">تاريخ إتمام الصيانة:</td>
              <td className="p-2 border-l border-slate-300">{ticket.completedAt || '—'}</td>
              <td className="p-2 bg-slate-50 font-bold border-l border-slate-300">المدة المستغرقة للإصلاح:</td>
              <td className="p-2 font-bold text-blue-900">{ticket.repairDuration || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* Technical Reports Boxes */}
        <div className="space-y-2 text-xs">
          <div className="p-2.5 border border-slate-300 rounded bg-white">
            <span className="font-bold text-slate-800 block mb-0.5">1. التقرير المبدئي للصيانة (الفحص والتشخيص):</span>
            <p className="text-slate-700">{ticket.initialReport || 'تم فحص الجهاز وتشخيص المشكلة'}</p>
          </div>

          <div className="p-2.5 border border-slate-300 rounded bg-white">
            <span className="font-bold text-slate-800 block mb-0.5">2. طلب القطع اللازمة للإصلاح وقطع الغيار:</span>
            <p className="text-slate-700">{ticket.requiredParts || 'لا توجد قطع غيار مطلوبة / تم الإصلاح بالقطع المتوفرة'}</p>
          </div>

          <div className="p-2.5 border border-slate-300 rounded bg-white">
            <span className="font-bold text-slate-800 block mb-0.5">3. التقرير النهائي للإصلاح واختبار الكفاءة:</span>
            <p className="text-slate-700">{ticket.finalReport || 'تمت الصيانة بنجاح واختبار كفاءة الجهاز وتشغيله بأمان'}</p>
          </div>
        </div>
      </div>

      {/* Section 4: Signatures Section (3 Official Signatures) */}
      <div className="mt-8 pt-4 border-t-2 border-slate-900">
        <h4 className="text-xs font-bold text-slate-900 mb-4 text-center">
          الاعتمادات والتوقيعات الرسمية للتوثيق
        </h4>
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          {/* Signature 1: Supervisor */}
          <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
            <span className="font-bold block text-slate-800">مشرف القسم</span>
            <span className="text-[10px] text-slate-500 block mb-6">استلام الجهاز بحالة سليمة</span>
            <div className="font-serif italic text-blue-900 font-bold border-b border-dashed border-slate-400 pb-1">
              {ticket.supervisorSignature || ticket.submittedBy.userName}
            </div>
          </div>

          {/* Signature 2: Technician */}
          <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
            <span className="font-bold block text-slate-800">فني الصيانة المنفذ</span>
            <span className="text-[10px] text-slate-500 block mb-6">تنفيذ أعمال الصيانة والفحص</span>
            <div className="font-serif italic text-blue-900 font-bold border-b border-dashed border-slate-400 pb-1">
              {ticket.technicianSignature || ticket.completedBy || ticket.receivedBy || 'الفني المختص'}
            </div>
          </div>

          {/* Signature 3: Maintenance Manager */}
          <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
            <span className="font-bold block text-slate-800">مسؤول إدارة الصيانة</span>
            <span className="text-[10px] text-slate-500 block mb-6">اعتماد إغلاق البلاغ</span>
            <div className="font-serif italic text-blue-900 font-bold border-b border-dashed border-slate-400 pb-1">
              {ticket.managerSignature || 'مُعتمد رسمياً'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
