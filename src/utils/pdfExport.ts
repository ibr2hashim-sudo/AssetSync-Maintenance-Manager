import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { MaintenanceTicket } from '../types';

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
}
