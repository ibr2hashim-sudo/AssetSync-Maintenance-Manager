import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { MaintenanceTicket, AuditSession } from '../types';

export class PDFReportGenerator {
  static async exportTicketToPDF(ticket: MaintenanceTicket, elementId: string): Promise<void> {
    const reportElement = document.getElementById(elementId);
    if (!reportElement) {
      throw new Error('تعذر العثور على عنصر التقرير لطباعة الـ PDF');
    }

    // Save previous styling
    const originalDisplay = reportElement.style.display;
    reportElement.style.display = 'block';

    try {
      const canvas = await html2canvas(reportElement, {
        scale: 2, // High resolution for A4
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / (imgWidth / 2.83465), pdfHeight / (imgHeight / 2.83465));

      const finalWidth = (imgWidth / 2.83465) * ratio;
      const finalHeight = (imgHeight / 2.83465) * ratio;
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = 5;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

      // File name format required: اسم القسم - ID الجهاز - تاريخ اليوم
      const cleanDept = (ticket.mainDepartment || 'قسم').replace(/[/\\?%*:|"<>]/g, '-');
      const cleanId = (ticket.customId || 'ID').replace(/[/\\?%*:|"<>]/g, '-');
      const dateStr = ticket.complaintDate || new Date().toISOString().split('T')[0];

      const fileName = `${cleanDept} - ${cleanId} - ${dateStr}.pdf`;
      pdf.save(fileName);
    } finally {
      reportElement.style.display = originalDisplay;
    }
  }

  /**
   * Export Audit Session Report as Landscape A4 PDF
   */
  static async exportAuditReportToPDF(
    session: AuditSession,
    elementId: string,
    departmentName?: string
  ): Promise<void> {
    const reportElement = document.getElementById(elementId);
    if (!reportElement) {
      throw new Error('تعذر العثور على محضر الجرد لطباعة الـ PDF');
    }

    try {
      const canvas = await html2canvas(reportElement, {
        scale: 2, // 2x high resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1400, // Ensure wide landscape layout is captured
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // ~297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // ~210mm
      const margin = 6; // 6mm margin
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;

      // Calculate total height in mm at printable width
      const totalImgHeightMm = (canvas.height * printableWidth) / canvas.width;

      if (totalImgHeightMm <= printableHeight) {
        // Single landscape page
        pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, totalImgHeightMm);
      } else {
        // Multi-page landscape slicing
        let heightLeftMm = totalImgHeightMm;
        let positionMm = margin;

        pdf.addImage(imgData, 'PNG', margin, positionMm, printableWidth, totalImgHeightMm);
        heightLeftMm -= printableHeight;

        while (heightLeftMm > 0) {
          positionMm -= printableHeight;
          pdf.addPage('a4', 'landscape');
          pdf.addImage(imgData, 'PNG', margin, positionMm, printableWidth, totalImgHeightMm);
          heightLeftMm -= printableHeight;
        }
      }

      // Safe file name: محضر جرد - رقم الجلسة - اسم القسم - تاريخ اليوم
      const cleanDept = (departmentName || session.targetDepartment || 'كافة الأقسام').replace(
        /[/\\?%*:|"<>]/g,
        '-'
      );
      const cleanSessionNum = (session.sessionNumber || 'AUDIT').replace(/[/\\?%*:|"<>]/g, '-');
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `محضر جرد - ${cleanSessionNum} - ${cleanDept} - ${dateStr}.pdf`;

      pdf.save(fileName);
    } catch (err: any) {
      console.error('Audit PDF Export error:', err);
      throw new Error(err?.message || 'حدث خطأ أثناء تصدير ملف الـ PDF');
    }
  }
}

