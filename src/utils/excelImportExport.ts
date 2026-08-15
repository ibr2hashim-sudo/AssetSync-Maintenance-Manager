import * as XLSX from 'xlsx';
import { Asset, DeviceStatus } from '../types';

export interface ImportResult {
  successCount: number;
  errorCount: number;
  errors: string[];
  importedAssets: Asset[];
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

  // Export Assets to CSV (UTF-8 with BOM for Excel Arabic)
  static exportAssetsToCSV(assets: Asset[]): void {
    const headers = [
      'القسم الرئيسي',
      'القسم الفرعي',
      'اسم الجهاز',
      'ID مخصص للجهاز',
      'الكمية الحالية',
      'الكمية الدفترية',
      'الفارق',
      'موديل الجهاز',
      'الرقم التسلسلي (Serial Number)',
      'اسم الشركة المصنعة',
      'التوابع',
      'حالة الجهاز',
      'مستلم العهدة',
      'ملاحظات',
    ];

    const rows = assets.map((a) => [
      `"${(a.mainDepartment || '').replace(/"/g, '""')}"`,
      `"${(a.subDepartment || '').replace(/"/g, '""')}"`,
      `"${(a.deviceName || '').replace(/"/g, '""')}"`,
      `"${(a.customId || '').replace(/"/g, '""')}"`,
      a.currentQuantity ?? 0,
      a.bookQuantity ?? 0,
      a.difference ?? 0,
      `"${(a.model || '').replace(/"/g, '""')}"`,
      `"${(a.serialNumber || '').replace(/"/g, '""')}"`,
      `"${(a.manufacturer || '').replace(/"/g, '""')}"`,
      `"${(a.accessories || []).join(' + ').replace(/"/g, '""')}"`,
      `"${(a.status || 'شغال').replace(/"/g, '""')}"`,
      `"${(a.custodian || '').replace(/"/g, '""')}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`,
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

  // Export to standard Excel (.xlsx)
  static exportAssetsToXLSX(assets: Asset[]): void {
    const data = assets.map((a) => ({
      'القسم الرئيسي': a.mainDepartment,
      'القسم الفرعي': a.subDepartment,
      'اسم الجهاز': a.deviceName,
      'ID مخصص للجهاز': a.customId,
      'الكمية الحالية': a.currentQuantity,
      'الكمية الدفترية': a.bookQuantity,
      'الفارق': a.difference,
      'موديل الجهاز': a.model,
      'الرقم التسلسلي (Serial Number)': a.serialNumber,
      'اسم الشركة المصنعة': a.manufacturer,
      'التوابع': (a.accessories || []).join(' + '),
      'حالة الجهاز': a.status,
      'مستلم العهدة': a.custodian,
      'ملاحظات': a.notes,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأصول والعهد');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `سجل_الأصول_والعهد_${dateStr}.xlsx`);
  }

  // Parse Excel / CSV File with Smart Arabic and English Column Mapping
  static async parseExcelOrCSV(file: File, existingAssets: Asset[]): Promise<ImportResult> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const result: ImportResult = {
      successCount: 0,
      errorCount: 0,
      errors: [],
      importedAssets: [],
    };

    const existingIds = new Set(existingAssets.map((a) => a.customId.trim().toLowerCase()));
    const batchNewIds = new Set<string>();

    rows.forEach((row, idx) => {
      const rowNumber = idx + 2; // header is row 1

      // Find values using flexible keys
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

      Object.entries(row).forEach(([colName, colVal]) => {
        const val = String(colVal ?? '').trim();
        const normCol = ExcelUtils.normalizeKey(colName);

        // القسم الرئيسي: القسم / القسم الرئيسي / department / maindepartment
        if (
          normCol === 'القسمالرئيسي' ||
          normCol === 'القسم' ||
          normCol === 'department' ||
          normCol === 'maindepartment' ||
          normCol === 'dept'
        ) {
          mainDept = val;
        }
        // القسم الفرعي: القسم الفرعي / القسم الداخلي / subdepartment / subdept / internaldept
        else if (
          normCol === 'القسمالفرعي' ||
          normCol === 'القسمالداخلي' ||
          normCol === 'subdepartment' ||
          normCol === 'subdept' ||
          normCol === 'internaldepartment'
        ) {
          subDept = val;
        }
        // اسم الجهاز: اسم الجهاز / اسم الأصل / البيان / الوصف / الصنف / الجهاز / devicename / name / assetname / item / description
        else if (
          normCol === 'اسمالجهاز' ||
          normCol === 'اسمالاصل' ||
          normCol === 'الجهاز' ||
          normCol === 'البيان' ||
          normCol === 'الصنف' ||
          normCol === 'الوصف' ||
          normCol === 'اسمالصنف' ||
          normCol === 'devicename' ||
          normCol === 'assetname' ||
          normCol === 'device' ||
          normCol === 'item' ||
          normCol === 'description' ||
          normCol === 'name'
        ) {
          deviceName = val;
        }
        // ID مخصص للجهاز: كود الجهاز / الرقم التعريفي / الباركود / المسلسل / ID / customid / deviceid / assetid / code / tag / barcode
        else if (
          normCol === 'idمخصصللجهاز' ||
          normCol === 'كودالجهاز' ||
          normCol === 'الرقمالتعريفي' ||
          normCol === 'كود' ||
          normCol === 'رمزالجهاز' ||
          normCol === 'الباركود' ||
          normCol === 'باركود' ||
          normCol === 'id' ||
          normCol === 'customid' ||
          normCol === 'deviceid' ||
          normCol === 'assetid' ||
          normCol === 'code' ||
          normCol === 'tag' ||
          normCol === 'tagno' ||
          normCol === 'assetno' ||
          normCol === 'barcode' ||
          normCol === 'رقمكودالجهاز'
        ) {
          customId = val;
        }
        // الكمية الحالية: الكمية الحالية / الكمية / quantity / currentquantity / qty
        else if (
          normCol === 'الكميهالحاليه' ||
          normCol === 'الكميه' ||
          normCol === 'quantity' ||
          normCol === 'currentquantity' ||
          normCol === 'qty'
        ) {
          currentQty = Number(val) || 0;
        }
        // الكمية الدفترية: الكمية الدفترية / الكمية السابقة / bookquantity / previousquantity
        else if (
          normCol === 'الكميهالدفتريه' ||
          normCol === 'الكميهالسابقه' ||
          normCol === 'bookquantity' ||
          normCol === 'previousquantity'
        ) {
          bookQty = Number(val) || 0;
        }
        // موديل الجهاز: موديل الجهاز / الموديل / model / devicemodel
        else if (normCol === 'موديلالجهاز' || normCol === 'الموديل' || normCol === 'model' || normCol === 'devicemodel') {
          model = val;
        }
        // الرقم التسلسلي: الرقم التسلسلي / serialnumber / sn / serial
        else if (
          normCol === 'الرقمالتسلسلي' ||
          normCol === 'serialnumber' ||
          normCol === 'sn' ||
          normCol === 'serial' ||
          normCol === 'الرقمالتسلسليserialnumber'
        ) {
          serialNumber = val;
        }
        // اسم الشركة المصنعة: اسم الشركة / الشركة المصنعة / manufacturer / company / brand
        else if (
          normCol === 'اسمالشركه' ||
          normCol === 'الشركهالمصنعه' ||
          normCol === 'manufacturer' ||
          normCol === 'company' ||
          normCol === 'brand' ||
          normCol === 'اسمالشركهالمصنعه'
        ) {
          manufacturer = val;
        }
        // التوابع: التوابع / accessories / accessory
        else if (normCol === 'التوابع' || normCol === 'accessories' || normCol === 'accessory') {
          accessoriesStr = val;
        }
        // حالة الجهاز: حالة الجهاز / status / state
        else if (normCol === 'حالهالجهاز' || normCol === 'status' || normCol === 'state' || normCol === 'الحاله') {
          statusStr = val;
        }
        // مستلم العهدة: مستلم العهدة / custodian / receiver
        else if (normCol === 'مستلمالعهده' || normCol === 'custodian' || normCol === 'receiver') {
          custodian = val;
        }
        // ملاحظات: ملاحظات / notes / note / remarks
        else if (normCol === 'ملاحظات' || normCol === 'notes' || normCol === 'note' || normCol === 'remarks') {
          notes = val;
        }
      });

      // Validation
      if (!deviceName) {
        result.errorCount++;
        result.errors.push(`السطر ${rowNumber}: حقل اسم الجهاز (أو البيان / الصنف) مفقود في ملف الإكسل`);
        return;
      }

      if (!mainDept) {
        mainDept = 'عام';
      }

      if (!subDept) {
        subDept = mainDept;
      }

      // If customId is empty, auto-generate a smart ID
      if (!customId) {
        customId = `DEV-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 900 + 100)}`;
      }

      const cleanCustomId = customId.trim();
      const lowerCustomId = cleanCustomId.toLowerCase();

      if (existingIds.has(lowerCustomId) || batchNewIds.has(lowerCustomId)) {
        // If duplicated in existing or batch, add auto suffix to avoid collision
        const uniqueCustomId = `${cleanCustomId}-${Math.floor(Math.random() * 900 + 100)}`;
        customId = uniqueCustomId;
      }

      const finalCustomId = customId.trim();
      batchNewIds.add(finalCustomId.toLowerCase());

      // Parse accessories
      let accessoriesList: string[] = [];
      if (accessoriesStr) {
        accessoriesList = accessoriesStr
          .split(/[+,/؛;]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      // Parse status
      let finalStatus: DeviceStatus = 'شغال';
      if (statusStr.includes('عاطل') || statusStr.toLowerCase().includes('faulty')) {
        finalStatus = 'عاطل';
      } else if (statusStr.includes('تالف') || statusStr.toLowerCase().includes('damage')) {
        finalStatus = 'تالف';
      }

      const difference = currentQty - bookQty;
      const now = new Date().toISOString();

      const newAsset: Asset = {
        id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        mainDepartment: mainDept,
        subDepartment: subDept,
        deviceName: deviceName,
        customId: finalCustomId,
        currentQuantity: currentQty,
        bookQuantity: bookQty,
        difference,
        model: model || 'غير محدد',
        serialNumber: serialNumber || 'غير محدد',
        manufacturer: manufacturer || 'غير محدد',
        accessories: accessoriesList,
        status: finalStatus,
        custodian: custodian || 'غير مسجل',
        notes: notes || '',
        createdAt: now,
        updatedAt: now,
      };

      result.importedAssets.push(newAsset);
      result.successCount++;
    });

    return result;
  }
}
