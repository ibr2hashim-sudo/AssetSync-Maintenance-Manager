export type UserRole = 'admin' | 'technician' | 'supervisor';

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  assignedDepartment?: string; // For supervisors (مشرف القسم)
  createdAt: string;
  isActive: boolean;
}

export type DeviceStatus = 'شغال' | 'عاطل' | 'تالف';

export interface Asset {
  id: string;
  mainDepartment: string;      // 1. القسم الرئيسي
  subDepartment: string;       // 2. القسم الفرعي
  deviceName: string;          // 3. اسم الجهاز
  customId: string;            // 4. ID مخصص للجهاز (فريد لا يتكرر - إدخال يدوي)
  currentQuantity: number;     // 5. الكمية الحالية
  bookQuantity: number;        // 6. الكمية الدفترية
  difference: number;          // 7. الفارق (محسوب تلقائياً: الحالية - الدفترية)
  model: string;               // 8. موديل الجهاز
  serialNumber: string;        // 9. الرقم التسلسلي
  manufacturer: string;        // 10. اسم الشركة المصنعة
  accessories: string[];       // 11. التوابع (ECG Cable / SPO2 / bp Cuff / Bottle / 2 Bottle / etc)
  status: DeviceStatus;        // 12. حالة الجهاز (شغال / عاطل / تالف)
  custodian: string;           // 13. مستلم العهدة
  notes: string;               // 14. ملاحظات
  imageUrl?: string;           // 15. صورة الجهاز
  createdAt: string;
  updatedAt: string;
}

export type TicketStatus = 'معلق' | 'قيد الصيانة' | 'تم الصيانة';

export interface MaintenanceTicket {
  id: string;
  ticketNumber: string;
  assetId: string;
  customId: string;
  deviceName: string;
  mainDepartment: string;
  subDepartment: string;
  model: string;
  serialNumber?: string;
  complaintDate: string; // YYYY-MM-DD
  complaintTime: string;
  complaintDescription: string;
  submittedBy: {
    userId: string;
    userName: string;
    role: UserRole;
  };
  status: TicketStatus; // معلق (أحمر) -> قيد الصيانة (أصفر) -> تم الصيانة (أخضر)
  receivedAt?: string;
  receivedBy?: string; // الفني المستلم
  initialReport?: string; // تقرير مبدئي للصيانة
  requiredParts?: string; // طلب القطع اللازمة للإصلاح
  finalReport?: string;   // التقرير النهائي للإصلاح
  completedAt?: string;
  completedBy?: string;
  repairDuration?: string; // المدة التي تم إصلاح العطل فيها
  supervisorSignature?: string; // توقيع مشرف القسم
  technicianSignature?: string; // توقيع الفني
  managerSignature?: string;    // توقيع مسؤول الصيانة
  updatedAt: string;
}

export type PeriodicCategory = 'التكييف' | 'الزيوت والفلاتر' | 'البطاريات' | string;

export interface PeriodicMaintenanceRecord {
  id: string;
  category: PeriodicCategory;
  mainDepartment: string;
  subDepartment?: string;
  assetId?: string;
  customId?: string;
  deviceName?: string;
  model?: string;
  serialNumber?: string;
  maintenanceDate: string;
  // التكييف
  workDone?: string; // ما تم عمله
  // الزيوت والفلاتر
  currentMeterReading?: number; // قراءة العداد الحالي
  nextMeterReading?: number;    // قراءة العداد عند التغيير القادم
  intervalKmOrHours?: number;   // الفاصل الزمني
  // البطاريات
  batteryChangeDate?: string;   // تاريخ التغيير
  nextExpectedChangeDate?: string; // تاريخ التغيير القادم
  performedBy: string;
  notes?: string;
  createdAt: string;
}

export interface HistoryLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  performedBy: string;
  userRole: string;
  category: 'أصول' | 'صيانة' | 'صيانة دورية' | 'مستخدمين' | 'مزامنة' | 'نظام' | 'جرد';
}

export type SurgicalSetStatus =
  | 'جاهز للاستخدام'
  | 'قيد التعقيم'
  | 'في العمليات'
  | 'ناقص / يحتاج استكمال'
  | 'صيانة / سن';

export type InstrumentStatus = 'سليم' | 'تالف' | 'مفقود' | 'يحتاج سن' | 'مستبعد';

export interface SurgicalInstrument {
  id: string;
  setId: string;
  setCode?: string;
  setName?: string;
  code: string;                 // e.g. OB-1, OB-2, OB-28
  name: string;                 // e.g. Hohmann Retractor, Plate Bender
  size?: string;                // e.g. Curved, Straight, Toothed, 20cm
  quantity: number;             // Standard expected count
  actualQuantity?: number;      // Counted quantity
  status: InstrumentStatus;     // 'سليم' | 'تالف' | 'مفقود' | 'يحتاج سن' | 'مستبعد'
  notes?: string;
  imageUrl?: string;
  updatedAt?: string;
}

export interface SurgicalSet {
  id: string;
  name: string;                 // e.g. Ortho Big Set
  code: string;                 // e.g. SET-OB-01
  department: string;           // e.g. العمليات / العظام / قسم التعقيم المركزي (CSSD)
  subLocation?: string;         // e.g. رف A-2 / مستودع السيتات المعقمة
  status: SurgicalSetStatus;
  trayNumber?: string;          // e.g. حاوية تعقيم #01
  notes?: string;
  imageUrl?: string;            // Container / Tray image
  instrumentsCount?: number;
  lastSterilizedDate?: string;
  lastAuditDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImageImportReport {
  total: number;
  successful: number;
  failed: number;
  items: {
    fileName: string;
    customId: string;
    status: 'نجاح' | 'فشل';
    reason?: string;
  }[];
}

export interface SyncConfig {
  googleSheetWebhookUrl?: string;
  googleDriveFolderId?: string;
  autoSyncEnabled: boolean;
  lastSyncTimestamp: string | null;
}

export type AuditItemStatus = 'مطابق' | 'مفقود' | 'منقول' | 'جديد_غير_مسجل' | 'معلق';
export type AuditSessionStatus = 'قيد_الجرد' | 'مكتمل_معتمد' | 'ملغي';

export interface AuditItemAccessory {
  name: string;
  checked: boolean;
}

export interface AuditItem {
  id: string;
  assetId?: string;
  customId: string;
  deviceName: string;
  mainDepartment: string;
  subDepartment: string;
  model: string;
  serialNumber: string;
  expectedCustodian: string;
  expectedQuantity: number;
  actualQuantity: number;
  status: AuditItemStatus;
  scannedAt?: string;
  scannedBy?: string;
  notes?: string;
  actualDepartment?: string;
  actualCustodian?: string;
  accessories?: AuditItemAccessory[];
}

export interface AuditSession {
  id: string;
  sessionNumber: string;
  title: string;
  targetDepartment: string; // 'all' or specific mainDepartment
  status: AuditSessionStatus;
  startDate: string;
  completedDate?: string;
  createdBy: {
    userId: string;
    userName: string;
    role: UserRole;
  };
  auditedBy: string;
  notes?: string;
  totalExpected: number;
  totalMatched: number;
  totalMissing: number;
  totalRelocated: number;
  totalUnregistered: number;
  items: AuditItem[];
  createdAt: string;
  updatedAt: string;
}
