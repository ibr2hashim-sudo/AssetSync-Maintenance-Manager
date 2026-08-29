import * as XLSX from 'xlsx';
import {
  Asset,
  DeviceStatus,
  User,
  MaintenanceTicket,
  PeriodicMaintenanceRecord,
  HistoryLog,
} from '../types';

export interface ImportResult {
  successCount: number;
  errorCount: number;
  errors: string[];
  importedAssets: Asset[];
  importedUsers?: User[];
  importedTickets?: MaintenanceTicket[];
  importedPeriodic?: PeriodicMaintenanceRecord[];
  importedHistory?: HistoryLog[];
  isComprehensive?: boolean;
  sheetsFound?: string[];
}

export interface ComprehensiveDatabaseData {
  users: User[];
  assets: Asset[];
  tickets: MaintenanceTicket[];
  periodicRecords: PeriodicMaintenanceRecord[];
  history: HistoryLog[];
}

export class ExcelUtils {
  // Normalize string for flexible matching
  private static normalizeKey(key: string): string {
    return key
      .toLowerCase()
      .replace(/[\s\-_.:/()]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .trim();
  }

  // =========================================================================
  // 1. Export Comprehensive 6-Sheet Workbook (قاعدة بيانات نظام الاصول والصيانة.xlsx)
  // =========================================================================
  static exportComprehensiveDatabaseToXLSX(data: ComprehensiveDatabaseData): void {
    const wb = XLSX.utils.book_new();

    // -----------------------------------------------------------------------
    // Sheet 1: Users
    // Username | Password | FullName | Role | Department | Status
    // -----------------------------------------------------------------------
    const usersRows = data.users.map((u) => ({
      Username: u.username,
      Password: u.password || '123456',
      FullName: u.fullName,
      Role: u.role,
      Department: u.assignedDepartment || 'جميع الأقسام',
      Status: u.isActive !== false ? 'Active' : 'Inactive',
    }));
    const wsUsers = XLSX.utils.json_to_sheet(usersRows);
    XLSX.utils.book_append_sheet(wb, wsUsers, 'Users');

    // -----------------------------------------------------------------------
    // Sheet 2: Assests
    // القسم | القسم الداخلي | Device Name | Code | الكمية | الكمية الدفترية | الفارق | Model | Serial Number | Company | التوابع | مستلم العهدة | Status | Notes | Image URL
    // -----------------------------------------------------------------------
    const assetsRows = data.assets.map((a) => {
      const currentQty = a.currentQuantity ?? 0;
      const bookQty = a.bookQuantity ?? 0;
      const diff = currentQty - bookQty;

      return {
        'القسم': a.mainDepartment || '',
        'القسم الداخلي': a.subDepartment || a.mainDepartment || '',
        'Device Name': a.deviceName || '',
        'Code': a.customId || '',
        'الكمية': currentQty,
        'الكمية الدفترية': bookQty,
        'الفارق': diff,
        'Model': a.model || '',
        'Serial Number': a.serialNumber || '',
        'Company': a.manufacturer || '',
        'التوابع': (a.accessories || []).join(' + '),
        'مستلم العهدة': a.custodian || '',
        'Status': a.status || 'شغال',
        'Notes': a.notes || '',
        'Image URL': a.imageUrl || '',
      };
    });
    const wsAssets = XLSX.utils.json_to_sheet(assetsRows);
    XLSX.utils.book_append_sheet(wb, wsAssets, 'Assests');

    // -----------------------------------------------------------------------
    // Sheet 3: Maintenance Tickets
    // Ticket ID | Asset ID | Status (Pending, In_Progress, Completed) | Supervisor Name | Complaint Text | Created At | Received At | Technician Name | Initial Report | Required Parts | Final Report | Completed At | Repair Duration | PDF Link
    // -----------------------------------------------------------------------
    const ticketStatusMap: Record<string, string> = {
      'معلق': 'Pending',
      'قيد الصيانة': 'In_Progress',
      'تم الصيانة': 'Completed',
    };

    const ticketsRows = data.tickets.map((t) => ({
      'Ticket ID': t.ticketNumber || t.id,
      'Asset ID': t.customId || t.assetId || '',
      'Status': ticketStatusMap[t.status] || t.status || 'Pending',
      'Supervisor Name': t.submittedBy?.userName || '',
      'Complaint Text': t.complaintDescription || '',
      'Created At': `${t.complaintDate || ''} ${t.complaintTime || ''}`.trim(),
      'Received At': t.receivedAt || '',
      'Technician Name': t.receivedBy || t.completedBy || '',
      'Initial Report': t.initialReport || '',
      'Required Parts': t.requiredParts || '',
      'Final Report': t.finalReport || '',
      'Completed At': t.completedAt || '',
      'Repair Duration': t.repairDuration || '',
      'PDF Link': '',
    }));
    const wsTickets = XLSX.utils.json_to_sheet(ticketsRows);
    XLSX.utils.book_append_sheet(wb, wsTickets, 'Maintenance Tickets');

    // -----------------------------------------------------------------------
    // Sheet 4: Preventive Maintenance
    // Type (AC, Oil, Battery) | Asset ID | Last Service Date | Current Reading | Next Reading | Next Service Date | Notes
    // -----------------------------------------------------------------------
    const periodicRows = data.periodicRecords.map((p) => {
      let typeLabel = p.category;
      if (p.category === 'التكييف') typeLabel = 'AC';
      else if (p.category === 'الزيوت والفلاتر') typeLabel = 'Oil';
      else if (p.category === 'البطاريات') typeLabel = 'Battery';

      return {
        'Type': typeLabel,
        'Asset ID': p.customId || p.assetId || p.deviceName || '',
        'Last Service Date': p.maintenanceDate || p.batteryChangeDate || '',
        'Current Reading': p.currentMeterReading ?? '',
        'Next Reading': p.nextMeterReading ?? '',
        'Next Service Date': p.nextExpectedChangeDate || '',
        'Notes': p.notes || p.workDone || '',
      };
    });
    const wsPeriodic = XLSX.utils.json_to_sheet(periodicRows);
    XLSX.utils.book_append_sheet(wb, wsPeriodic, 'Preventive Maintenance');

    // -----------------------------------------------------------------------
    // Sheet 5: Activity Logs (History)
    // Timestamp | User | Action | Details
    // -----------------------------------------------------------------------
    const formatTs = (ts?: string) => {
      if (!ts) return '';
      if (ts.includes('ص') || ts.includes('م') || /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(ts)) {
        return ts;
      }
      try {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          return d.toLocaleString('ar-EG');
        }
      } catch {}
      return ts;
    };

    const historyRows = data.history.map((h) => ({
      Timestamp: formatTs(h.timestamp),
      User: `${h.performedBy || 'النظام'} (${h.userRole || 'admin'})`,
      Category: h.category || 'نظام',
      Action: h.action,
      Details: h.details,
    }));
    const wsHistory = XLSX.utils.json_to_sheet(historyRows);
    XLSX.utils.book_append_sheet(wb, wsHistory, 'Activity Logs (History)');

    // -----------------------------------------------------------------------
    // Sheet 6: Stats (Read-Only)
    // -----------------------------------------------------------------------
    const totalAssets = data.assets.length;
    const workingAssets = data.assets.filter((a) => a.status === 'شغال').length;
    const faultyAssets = data.assets.filter((a) => a.status === 'عاطل').length;
    const damagedAssets = data.assets.filter((a) => a.status === 'تالف').length;
    const totalCurrentQty = data.assets.reduce((sum, a) => sum + (a.currentQuantity || 0), 0);
    const totalBookQty = data.assets.reduce((sum, a) => sum + (a.bookQuantity || 0), 0);
    const totalDifference = totalCurrentQty - totalBookQty;

    const totalTickets = data.tickets.length;
    const pendingTickets = data.tickets.filter((t) => t.status === 'معلق').length;
    const inProgressTickets = data.tickets.filter((t) => t.status === 'قيد الصيانة').length;
    const completedTickets = data.tickets.filter((t) => t.status === 'تم الصيانة').length;

    const statsRows = [
      { 'المؤشر الإحصائي (Metric)': 'إجمالي الأجهزة والعهد الطبية المسجلة', 'القيمة (Value)': totalAssets },
      { 'المؤشر الإحصائي (Metric)': 'الأجهزة الشغالة (Working)', 'القيمة (Value)': workingAssets },
      { 'المؤشر الإحصائي (Metric)': 'الأجهزة العاطلة (Faulty)', 'القيمة (Value)': faultyAssets },
      { 'المؤشر الإحصائي (Metric)': 'الأجهزة التالفة (Damaged)', 'القيمة (Value)': damagedAssets },
      { 'المؤشر الإحصائي (Metric)': 'إجمالي الكمية الفعلية الحالية', 'القيمة (Value)': totalCurrentQty },
      { 'المؤشر الإحصائي (Metric)': 'إجمالي الكمية الدفترية', 'القيمة (Value)': totalBookQty },
      { 'المؤشر الإحصائي (Metric)': 'الفارق الإجمالي للعهد', 'القيمة (Value)': totalDifference },
      { 'المؤشر الإحصائي (Metric)': 'إجمالي بلاغات الصيانة', 'القيمة (Value)': totalTickets },
      { 'المؤشر الإحصائي (Metric)': 'بلاغات معلقة (Pending)', 'القيمة (Value)': pendingTickets },
      { 'المؤشر الإحصائي (Metric)': 'بلاغات قيد الصيانة (In Progress)', 'القيمة (Value)': inProgressTickets },
      { 'المؤشر الإحصائي (Metric)': 'بلاغات مكتملة (Completed)', 'القيمة (Value)': completedTickets },
      { 'المؤشر الإحصائي (Metric)': 'سجلات الصيانة الدورية (Preventive)', 'القيمة (Value)': data.periodicRecords.length },
      { 'المؤشر الإحصائي (Metric)': 'إجمالي المستخدمين والمشرفين والفنيين', 'القيمة (Value)': data.users.length },
      { 'المؤشر الإحصائي (Metric)': 'تاريخ استخراج التقرير', 'القيمة (Value)': new Date().toLocaleString('ar-EG') },
    ];
    const wsStats = XLSX.utils.json_to_sheet(statsRows);
    XLSX.utils.book_append_sheet(wb, wsStats, 'Stats');

    // Generate binary and download
    const fileName = `قاعدة بيانات نظام الاصول والصيانة.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // =========================================================================
  // 2. Export Assets Only to CSV
  // =========================================================================
  static exportAssetsToCSV(assets: Asset[]): void {
    const headers = [
      'القسم',
      'القسم الداخلي',
      'Device Name',
      'Code',
      'الكمية',
      'الكمية الدفترية',
      'الفارق',
      'Model',
      'Serial Number',
      'Company',
      'التوابع',
      'مستلم العهدة',
      'Status',
      'Notes',
      'Image URL',
    ];

    const rows = assets.map((a) => [
      `"${(a.mainDepartment || '').replace(/"/g, '""')}"`,
      `"${(a.subDepartment || '').replace(/"/g, '""')}"`,
      `"${(a.deviceName || '').replace(/"/g, '""')}"`,
      `"${(a.customId || '').replace(/"/g, '""')}"`,
      a.currentQuantity ?? 0,
      a.bookQuantity ?? 0,
      (a.currentQuantity ?? 0) - (a.bookQuantity ?? 0),
      `"${(a.model || '').replace(/"/g, '""')}"`,
      `"${(a.serialNumber || '').replace(/"/g, '""')}"`,
      `"${(a.manufacturer || '').replace(/"/g, '""')}"`,
      `"${(a.accessories || []).join(' + ').replace(/"/g, '""')}"`,
      `"${(a.custodian || '').replace(/"/g, '""')}"`,
      `"${(a.status || 'شغال').replace(/"/g, '""')}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`,
      `"${(a.imageUrl || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `سجل_الأصول_والعهد_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // 3. Smart Multi-Sheet and Single-Sheet Parser
  // =========================================================================
  static async parseExcelOrCSV(file: File, existingAssets: Asset[]): Promise<ImportResult> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetNames = workbook.SheetNames;

    const result: ImportResult = {
      successCount: 0,
      errorCount: 0,
      errors: [],
      importedAssets: [],
      importedUsers: [],
      importedTickets: [],
      importedPeriodic: [],
      importedHistory: [],
      isComprehensive: false,
      sheetsFound: sheetNames,
    };

    // Check if workbook contains multi-sheet database structure
    const hasUsersSheet = sheetNames.some((n) => ExcelUtils.normalizeKey(n) === 'users' || ExcelUtils.normalizeKey(n) === 'المستخدمين');
    const hasAssetsSheet = sheetNames.some(
      (n) =>
        ExcelUtils.normalizeKey(n) === 'assests' ||
        ExcelUtils.normalizeKey(n) === 'assets' ||
        ExcelUtils.normalizeKey(n) === 'الاصول' ||
        ExcelUtils.normalizeKey(n) === 'العهدولاصول' ||
        ExcelUtils.normalizeKey(n) === 'الاجهزه'
    );
    const hasTicketsSheet = sheetNames.some(
      (n) =>
        ExcelUtils.normalizeKey(n).includes('ticket') ||
        ExcelUtils.normalizeKey(n).includes('صيانه') ||
        ExcelUtils.normalizeKey(n).includes('بلاغات')
    );
    const hasPeriodicSheet = sheetNames.some(
      (n) =>
        ExcelUtils.normalizeKey(n).includes('preventive') ||
        ExcelUtils.normalizeKey(n).includes('دوريه') ||
        ExcelUtils.normalizeKey(n).includes('periodic')
    );

    if (hasUsersSheet || hasAssetsSheet || hasTicketsSheet || hasPeriodicSheet) {
      result.isComprehensive = true;
    }

    // -------------------------------------------------------------------------
    // A. Parse Assets Sheet (or First Sheet)
    // -------------------------------------------------------------------------
    let assetSheetName = sheetNames.find(
      (n) =>
        ExcelUtils.normalizeKey(n) === 'assests' ||
        ExcelUtils.normalizeKey(n) === 'assets' ||
        ExcelUtils.normalizeKey(n) === 'الاصول' ||
        ExcelUtils.normalizeKey(n) === 'الاجهزه'
    );
    if (!assetSheetName) {
      assetSheetName = sheetNames[0];
    }

    const assetSheet = workbook.Sheets[assetSheetName];
    if (assetSheet) {
      const rows: any[] = XLSX.utils.sheet_to_json(assetSheet, { defval: '' });
      const existingIds = new Set(existingAssets.map((a) => a.customId.trim().toLowerCase()));
      const batchNewIds = new Set<string>();

      rows.forEach((row, idx) => {
        const rowNumber = idx + 2;

        let mainDept = '';
        let subDept = '';
        let deviceName = '';
        let customId = '';
        let currentQty = 0;
        let bookQty = 0;
        let model = '';
        let serialNumber = '';
        let manufacturer = '';
        let accessoriesStr = '';
        let statusStr = 'شغال';
        let custodian = '';
        let notes = '';
        let imageUrl = '';

        Object.entries(row).forEach(([colName, colVal]) => {
          const val = String(colVal ?? '').trim();
          const normCol = ExcelUtils.normalizeKey(colName);

          // القسم: القسم / القسم الرئيسي / department / maindepartment
          if (
            normCol === 'القسم' ||
            normCol === 'القسمالرئيسي' ||
            normCol === 'department' ||
            normCol === 'maindepartment' ||
            normCol === 'dept'
          ) {
            mainDept = val;
          }
          // القسم الداخلي: القسم الداخلي / القسم الفرعي / subdepartment / internaldepartment / clinic / room
          else if (
            normCol === 'القسمالداخلي' ||
            normCol === 'القسمالفرعي' ||
            normCol === 'subdepartment' ||
            normCol === 'subdept' ||
            normCol === 'internaldepartment' ||
            normCol === 'العياده' ||
            normCol === 'الغرفه'
          ) {
            subDept = val;
          }
          // Device Name: اسم الجهاز / الجهاز / البيان / الصنف / devicename / item / name
          else if (
            normCol === 'devicename' ||
            normCol === 'اسمالجهاز' ||
            normCol === 'الجهاز' ||
            normCol === 'البيان' ||
            normCol === 'الصنف' ||
            normCol === 'الوصف' ||
            normCol === 'name' ||
            normCol === 'item'
          ) {
            deviceName = val;
          }
          // Code / Asset ID: Code / كود / ID / customid / barcode / كودالجهاز
          else if (
            normCol === 'code' ||
            normCol === 'id' ||
            normCol === 'customid' ||
            normCol === 'assetid' ||
            normCol === 'كود' ||
            normCol === 'كودالجهاز' ||
            normCol === 'الرقمالتعريفي' ||
            normCol === 'باركود'
          ) {
            customId = val;
          }
          // الكمية: الكمية / الكمية الحالية / quantity / currentquantity / qty
          else if (
            normCol === 'الكميه' ||
            normCol === 'الكميهالحاليه' ||
            normCol === 'quantity' ||
            normCol === 'currentquantity' ||
            normCol === 'qty'
          ) {
            currentQty = Number(val) || 0;
          }
          // الكمية الدفترية: الكمية الدفترية / bookquantity
          else if (
            normCol === 'الكميهالدفتريه' ||
            normCol === 'bookquantity' ||
            normCol === 'الكميهالسابقه'
          ) {
            bookQty = Number(val) || 0;
          }
          // Model: Model / موديل / موديل الجهاز / devicemodel
          else if (
            normCol === 'model' ||
            normCol === 'الموديل' ||
            normCol === 'موديلالجهاز'
          ) {
            model = val;
          }
          // Serial Number: Serial Number / الرقم التسلسلي / sn / serial
          else if (
            normCol === 'serialnumber' ||
            normCol === 'sn' ||
            normCol === 'الرقمالتسلسلي' ||
            normCol === 'serial'
          ) {
            serialNumber = val;
          }
          // Company / Manufacturer: Company / الشركة / اسم الشركة المصنعة / manufacturer / brand
          else if (
            normCol === 'company' ||
            normCol === 'الشركه' ||
            normCol === 'الشركهالمصنعه' ||
            normCol === 'اسمالشركهالمصنعه' ||
            normCol === 'manufacturer' ||
            normCol === 'brand'
          ) {
            manufacturer = val;
          }
          // التوابع: التوابع / accessories / accessory
          else if (normCol === 'التوابع' || normCol === 'accessories' || normCol === 'accessory') {
            accessoriesStr = val;
          }
          // مستلم العهدة: مستلم العهدة / custodian / receiver
          else if (normCol === 'مستلمالعهده' || normCol === 'custodian' || normCol === 'receiver') {
            custodian = val;
          }
          // Status: Status / حالة الجهاز / الحالة / state
          else if (normCol === 'status' || normCol === 'حالهالجهاز' || normCol === 'الحاله' || normCol === 'state') {
            statusStr = val;
          }
          // Notes: Notes / ملاحظات / remarks / note
          else if (normCol === 'notes' || normCol === 'ملاحظات' || normCol === 'note') {
            notes = val;
          }
          // Image URL: Image URL / رابط الصورة / صورة الجهاز / image / imageurl
          else if (
            normCol === 'imageurl' ||
            normCol === 'image' ||
            normCol === 'رابطالصوره' ||
            normCol === 'صورهالجهاز' ||
            normCol === 'photo'
          ) {
            imageUrl = val;
          }
        });

        if (!deviceName) {
          result.errorCount++;
          result.errors.push(`السطر ${rowNumber} في صفحة الأصول: اسم الجهاز مفقود`);
          return;
        }

        if (!mainDept && subDept) mainDept = subDept;
        if (!mainDept) mainDept = 'عام';
        if (!subDept) subDept = mainDept;

        if (!customId) {
          customId = `DEV-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 900 + 100)}`;
        }

        const cleanCustomId = customId.trim();
        const lowerCustomId = cleanCustomId.toLowerCase();

        if (existingIds.has(lowerCustomId) || batchNewIds.has(lowerCustomId)) {
          customId = `${cleanCustomId}-${Math.floor(Math.random() * 900 + 100)}`;
        }

        const finalCustomId = customId.trim();
        batchNewIds.add(finalCustomId.toLowerCase());

        let accessoriesList: string[] = [];
        if (accessoriesStr) {
          accessoriesList = accessoriesStr
            .split(/[+,/؛;]/)
            .map((s) => s.trim())
            .filter(Boolean);
        }

        let finalStatus: DeviceStatus = 'شغال';
        if (
          statusStr.includes('عاطل') ||
          statusStr.toLowerCase().includes('faulty') ||
          statusStr.toLowerCase().includes('broken')
        ) {
          finalStatus = 'عاطل';
        } else if (
          statusStr.includes('تالف') ||
          statusStr.toLowerCase().includes('damage') ||
          statusStr.toLowerCase().includes('scrap')
        ) {
          finalStatus = 'تالف';
        }

        const diff = currentQty - bookQty;
        const now = new Date().toISOString();

        const newAsset: Asset = {
          id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          mainDepartment: mainDept,
          subDepartment: subDept,
          deviceName: deviceName,
          customId: finalCustomId,
          currentQuantity: currentQty,
          bookQuantity: bookQty,
          difference: diff,
          model: model || 'غير محدد',
          serialNumber: serialNumber || 'غير محدد',
          manufacturer: manufacturer || 'غير محدد',
          accessories: accessoriesList,
          status: finalStatus,
          custodian: custodian || 'غير مسجل',
          notes: notes || '',
          imageUrl: imageUrl || '',
          createdAt: now,
          updatedAt: now,
        };

        result.importedAssets.push(newAsset);
        result.successCount++;
      });
    }

    // -------------------------------------------------------------------------
    // B. Parse Users Sheet
    // -------------------------------------------------------------------------
    const usersSheetName = sheetNames.find(
      (n) => ExcelUtils.normalizeKey(n) === 'users' || ExcelUtils.normalizeKey(n) === 'المستخدمين'
    );
    if (usersSheetName && workbook.Sheets[usersSheetName]) {
      const uRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[usersSheetName], { defval: '' });
      uRows.forEach((row) => {
        let username = '';
        let password = '';
        let fullName = '';
        let role = 'supervisor';
        let dept = '';
        let status = 'Active';

        Object.entries(row).forEach(([col, val]) => {
          const v = String(val ?? '').trim();
          const nc = ExcelUtils.normalizeKey(col);
          if (nc === 'username' || nc === 'اسمالمستخدم') username = v;
          else if (nc === 'password' || nc === 'كلمهالمرور') password = v;
          else if (nc === 'fullname' || nc === 'الاسمالكامل' || nc === 'الاسم') fullName = v;
          else if (nc === 'role' || nc === 'الدور' || nc === 'الصلاحيه') role = v.toLowerCase();
          else if (nc === 'department' || nc === 'القسم') dept = v;
          else if (nc === 'status' || nc === 'الحاله') status = v;
        });

        if (username) {
          let cleanRole: any = 'supervisor';
          if (role.includes('admin') || role.includes('مدير') || role.includes('ادمن')) cleanRole = 'admin';
          else if (role.includes('tech') || role.includes('فني')) cleanRole = 'technician';

          result.importedUsers?.push({
            id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            username: username.toLowerCase(),
            password: password || '123456',
            fullName: fullName || username,
            role: cleanRole,
            assignedDepartment: dept && dept !== 'جميع الأقسام' ? dept : undefined,
            createdAt: new Date().toISOString(),
            isActive: !status.toLowerCase().includes('inact') && !status.includes('معطل'),
          });
        }
      });
    }

    // -------------------------------------------------------------------------
    // C. Parse Maintenance Tickets Sheet
    // -------------------------------------------------------------------------
    const ticketsSheetName = sheetNames.find(
      (n) =>
        ExcelUtils.normalizeKey(n).includes('ticket') ||
        ExcelUtils.normalizeKey(n).includes('صيانه') ||
        ExcelUtils.normalizeKey(n).includes('بلاغات')
    );
    if (ticketsSheetName && workbook.Sheets[ticketsSheetName]) {
      const tRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[ticketsSheetName], { defval: '' });
      tRows.forEach((row) => {
        let ticketId = '';
        let assetId = '';
        let status = 'معلق';
        let supervisor = '';
        let complaint = '';
        let createdAt = '';
        let receivedAt = '';
        let techName = '';
        let initialRep = '';
        let reqParts = '';
        let finalRep = '';
        let completedAt = '';
        let repairDuration = '';

        Object.entries(row).forEach(([col, val]) => {
          const v = String(val ?? '').trim();
          const nc = ExcelUtils.normalizeKey(col);
          if (nc === 'ticketid' || nc === 'رقمالبلاغ' || nc === 'id') ticketId = v;
          else if (nc === 'assetid' || nc === 'كودالجهاز' || nc === 'idالجهاز') assetId = v;
          else if (nc === 'status' || nc === 'الحاله') status = v;
          else if (nc === 'supervisorname' || nc === 'مشرفالقسم') supervisor = v;
          else if (nc === 'complainttext' || nc === 'نصالشكوي' || nc === 'وصفالعطل') complaint = v;
          else if (nc === 'createdat' || nc === 'تاريخالانشاء') createdAt = v;
          else if (nc === 'receivedat' || nc === 'تاريخالاستلام') receivedAt = v;
          else if (nc === 'technicianname' || nc === 'اسمالفني') techName = v;
          else if (nc === 'initialreport' || nc === 'التقريرالمبدئي') initialRep = v;
          else if (nc === 'requiredparts' || nc === 'القطعالمطلوبه') reqParts = v;
          else if (nc === 'finalreport' || nc === 'التقريرالنهائي') finalRep = v;
          else if (nc === 'completedat' || nc === 'تاريخالاكتمال') completedAt = v;
          else if (nc === 'repairduration' || nc === 'مدهالاصلاح') repairDuration = v;
        });

        if (assetId || complaint) {
          let finalStatus: any = 'معلق';
          const sLower = status.toLowerCase();
          if (sLower.includes('in_progress') || status.includes('قيد')) finalStatus = 'قيد الصيانة';
          else if (sLower.includes('completed') || status.includes('تم')) finalStatus = 'تم الصيانة';

          const matchingAsset = result.importedAssets.find(
            (a) => a.customId === assetId || a.id === assetId
          );

          result.importedTickets?.push({
            id: `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            ticketNumber: ticketId || `TKT-${Math.floor(Math.random() * 9000 + 1000)}`,
            assetId: matchingAsset?.id || assetId,
            customId: assetId,
            deviceName: matchingAsset?.deviceName || 'جهاز طبي',
            mainDepartment: matchingAsset?.mainDepartment || 'عام',
            subDepartment: matchingAsset?.subDepartment || 'عام',
            model: matchingAsset?.model || '',
            serialNumber: matchingAsset?.serialNumber || '',
            complaintDate: createdAt ? createdAt.split(' ')[0] : new Date().toISOString().split('T')[0],
            complaintTime: createdAt ? createdAt.split(' ')[1] || '' : '12:00 م',
            complaintDescription: complaint || 'بلاغ صيانة مسجل من الإكسل',
            submittedBy: {
              userId: 'imported',
              userName: supervisor || 'مشرف القسم',
              role: 'supervisor',
            },
            status: finalStatus,
            receivedAt: receivedAt || undefined,
            receivedBy: techName || undefined,
            initialReport: initialRep || undefined,
            requiredParts: reqParts || undefined,
            finalReport: finalRep || undefined,
            completedAt: completedAt || undefined,
            completedBy: finalStatus === 'تم الصيانة' ? techName : undefined,
            repairDuration: repairDuration || undefined,
            updatedAt: new Date().toISOString(),
          });
        }
      });
    }

    // -------------------------------------------------------------------------
    // D. Parse Preventive Maintenance Sheet
    // -------------------------------------------------------------------------
    const prevSheetName = sheetNames.find(
      (n) =>
        ExcelUtils.normalizeKey(n).includes('preventive') ||
        ExcelUtils.normalizeKey(n).includes('دوريه') ||
        ExcelUtils.normalizeKey(n).includes('periodic')
    );
    if (prevSheetName && workbook.Sheets[prevSheetName]) {
      const pRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[prevSheetName], { defval: '' });
      pRows.forEach((row) => {
        let type = 'التكييف';
        let assetId = '';
        let lastDate = '';
        let curReading = 0;
        let nextReading = 0;
        let nextDate = '';
        let notes = '';

        Object.entries(row).forEach(([col, val]) => {
          const v = String(val ?? '').trim();
          const nc = ExcelUtils.normalizeKey(col);
          if (nc === 'type' || nc === 'النوع' || nc === 'نوعالصيانه') type = v;
          else if (nc === 'assetid' || nc === 'كودالجهاز' || nc === 'id') assetId = v;
          else if (nc === 'lastservicedate' || nc === 'تاريخاخرصيانه') lastDate = v;
          else if (nc === 'currentreading' || nc === 'القراءهالحاليه') curReading = Number(v) || 0;
          else if (nc === 'nextreading' || nc === 'القراءهالقادمه') nextReading = Number(v) || 0;
          else if (nc === 'nextservicedate' || nc === 'تاريخالصيانهالقادم') nextDate = v;
          else if (nc === 'notes' || nc === 'ملاحظات') notes = v;
        });

        let cleanCat = type;
        if (type.toUpperCase() === 'AC' || type.includes('تكييف')) cleanCat = 'التكييف';
        else if (type.toUpperCase() === 'OIL' || type.includes('زيت') || type.includes('فلتر')) cleanCat = 'الزيوت والفلاتر';
        else if (type.toUpperCase() === 'BATTERY' || type.includes('بطار')) cleanCat = 'البطاريات';

        const matchingAsset = result.importedAssets.find(
          (a) => a.customId === assetId || a.id === assetId
        );

        result.importedPeriodic?.push({
          id: `prev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          category: cleanCat,
          mainDepartment: matchingAsset?.mainDepartment || 'عام',
          subDepartment: matchingAsset?.subDepartment,
          assetId: matchingAsset?.id || assetId,
          customId: assetId,
          deviceName: matchingAsset?.deviceName,
          model: matchingAsset?.model,
          serialNumber: matchingAsset?.serialNumber,
          maintenanceDate: lastDate || new Date().toISOString().split('T')[0],
          currentMeterReading: curReading || undefined,
          nextMeterReading: nextReading || undefined,
          batteryChangeDate: cleanCat === 'البطاريات' ? lastDate : undefined,
          nextExpectedChangeDate: cleanCat === 'البطاريات' ? nextDate : undefined,
          performedBy: 'فني الصيانة',
          notes: notes,
          createdAt: new Date().toISOString(),
        });
      });
    }

    return result;
  }
}
