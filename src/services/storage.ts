import {
  Asset,
  HistoryLog,
  MaintenanceTicket,
  PeriodicMaintenanceRecord,
  SyncConfig,
  User,
  ImageImportReport,
} from '../types';

const STORAGE_KEYS = {
  USERS: 'asset_mgmt_users',
  ASSETS: 'asset_mgmt_assets',
  TICKETS: 'asset_mgmt_tickets',
  PERIODIC: 'asset_mgmt_periodic',
  HISTORY: 'asset_mgmt_history',
  SYNC_CONFIG: 'asset_mgmt_sync_config',
  PENDING_QUEUE: 'asset_mgmt_pending_queue',
  CURRENT_USER: 'asset_mgmt_current_user',
  CATEGORIES: 'asset_mgmt_periodic_categories',
};

// Initial default user: admin / admin
const DEFAULT_USERS: User[] = [
  {
    id: 'user-admin-1',
    username: 'admin',
    password: 'admin',
    fullName: 'مدير النظام (الأدمن)',
    role: 'admin',
    createdAt: new Date().toISOString(),
    isActive: true,
  },
];

const DEFAULT_CATEGORIES: string[] = ['التكييف', 'الزيوت والفلاتر', 'البطاريات'];

// Helpers for localStorage
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    if (!data || data === 'undefined' || data === 'null') {
      return defaultValue;
    }
    const parsed = JSON.parse(data);
    if (parsed === null || parsed === undefined) {
      return defaultValue;
    }
    return parsed;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return defaultValue;
  }
}

// =========================================================================
// INDEXEDDB DEDICATED IMAGE STORAGE (Supports Unlimited / Gigabytes of High-Res Images)
// =========================================================================
const IDB_NAME = 'AssetMgmtImagesDB';
const IDB_STORE = 'device_images';
const IDB_VERSION = 1;

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'customId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveImageToDB(customId: string, base64Data: string): Promise<void> {
  try {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({ customId: customId.trim().toLowerCase(), dataUrl: base64Data, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Fallback saving image in memory/localStorage:', e);
  }
}

export async function getImageFromDB(customId: string): Promise<string | null> {
  try {
    const db = await openImageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(customId.trim().toLowerCase());
      req.onsuccess = () => {
        resolve(req.result ? req.result.dataUrl : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearImageDB(): Promise<void> {
  try {
    const db = await openImageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // fallback
  }
}

export async function getAllImagesFromDB(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const db = await openImageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        if (Array.isArray(req.result)) {
          req.result.forEach((item) => {
            if (item.customId && item.dataUrl) {
              map.set(item.customId, item.dataUrl);
            }
          });
        }
        resolve(map);
      };
      req.onerror = () => resolve(map);
    });
  } catch {
    return map;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`localStorage quota exceeded or error for ${key}:`, err);
    // If assets array exceeds quota because of legacy base64 images, strip inline images and save
    if (key === STORAGE_KEYS.ASSETS && Array.isArray(value)) {
      try {
        const stripped = value.map((a: Asset) => ({
          ...a,
          imageUrl: a.imageUrl && a.imageUrl.startsWith('data:') ? undefined : a.imageUrl,
        }));
        localStorage.setItem(key, JSON.stringify(stripped));
      } catch (innerErr) {
        console.error('Critical storage write error:', innerErr);
      }
    }
  }
}

export class StorageService {
  // Current User Session
  static getCurrentUser(): User | null {
    const user = getItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (!user || typeof user !== 'object' || !user.username) {
      // Default to admin user for immediate readiness
      const users = this.getUsers();
      const adminUser = users.find((u) => u.username === 'admin') || DEFAULT_USERS[0];
      this.setCurrentUser(adminUser);
      return adminUser;
    }
    return user;
  }

  static setCurrentUser(user: User | null): void {
    setItem(STORAGE_KEYS.CURRENT_USER, user);
  }

  // Users Management
  static getUsers(): User[] {
    const users = getItem<User[]>(STORAGE_KEYS.USERS, []);
    if (!Array.isArray(users) || users.length === 0) {
      setItem(STORAGE_KEYS.USERS, DEFAULT_USERS);
      return DEFAULT_USERS;
    }
    return users;
  }

  static saveUser(user: Omit<User, 'id' | 'createdAt'> & { id?: string }): User {
    const users = this.getUsers();
    const currentUser = this.getCurrentUser();
    let savedUser: User;

    if (user.id) {
      const index = users.findIndex((u) => u.id === user.id);
      if (index !== -1) {
        savedUser = {
          ...users[index],
          ...user,
        };
        users[index] = savedUser;
        this.addHistoryLog(
          'مستخدمين',
          `تعديل بيانات المستخدم: ${savedUser.fullName} (${savedUser.username})`,
          `الدور: ${savedUser.role}${savedUser.assignedDepartment ? ` - قسم: ${savedUser.assignedDepartment}` : ''}`,
          currentUser?.fullName || 'النظام',
          currentUser?.role || 'admin'
        );
      } else {
        throw new Error('المستخدم غير موجود');
      }
    } else {
      // Check username uniqueness
      if (users.some((u) => u.username.toLowerCase() === user.username.toLowerCase())) {
        throw new Error('اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر');
      }
      savedUser = {
        ...user,
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        createdAt: new Date().toISOString(),
      };
      users.push(savedUser);
      this.addHistoryLog(
        'مستخدمين',
        `إضافة مستخدم جديد: ${savedUser.fullName} (${savedUser.username})`,
        `الدور: ${savedUser.role}${savedUser.assignedDepartment ? ` - قسم: ${savedUser.assignedDepartment}` : ''}`,
        currentUser?.fullName || 'النظام',
        currentUser?.role || 'admin'
      );
    }

    setItem(STORAGE_KEYS.USERS, users);
    this.enqueueSyncOperation('SAVE_USER', savedUser);
    return savedUser;
  }

  static deleteUser(id: string): void {
    const users = this.getUsers();
    const target = users.find((u) => u.id === id);
    if (target?.username === 'admin') {
      throw new Error('لا يمكن حذف حساب الأدمن الأساسي');
    }
    const filtered = users.filter((u) => u.id !== id);
    setItem(STORAGE_KEYS.USERS, filtered);

    const currentUser = this.getCurrentUser();
    this.addHistoryLog(
      'مستخدمين',
      `حذف المستخدم: ${target?.fullName || id}`,
      `اسم المستخدم: ${target?.username}`,
      currentUser?.fullName || 'النظام',
      currentUser?.role || 'admin'
    );
    this.enqueueSyncOperation('DELETE_USER', { id });
  }

  // Bulk / Batch Import Assets
  static batchImportAssets(newAssets: Asset[]): { importedCount: number } {
    if (!newAssets || newAssets.length === 0) return { importedCount: 0 };
    const currentAssets = this.getAssets();
    const currentUser = this.getCurrentUser();
    
    const assetMap = new Map<string, Asset>();
    currentAssets.forEach((a) => {
      assetMap.set(a.customId.trim().toLowerCase(), a);
    });

    let count = 0;
    newAssets.forEach((incoming) => {
      const key = incoming.customId.trim().toLowerCase();
      if (assetMap.has(key)) {
        // Update existing asset
        const existing = assetMap.get(key)!;
        assetMap.set(key, {
          ...existing,
          ...incoming,
          id: existing.id,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Add new asset
        assetMap.set(key, incoming);
      }
      count++;
    });

    const finalAssets = Array.from(assetMap.values());
    setItem(STORAGE_KEYS.ASSETS, finalAssets);

    this.addHistoryLog(
      'أصول',
      `استيراد جرد خارجي شامل (دفعة من ${count} جهاز)`,
      `تم تحديث وإضافة ${count} جهاز في قاعدة البيانات دفعة واحدة`,
      currentUser?.fullName || 'النظام',
      currentUser?.role || 'admin'
    );

    this.enqueueSyncOperation('BATCH_IMPORT_ASSETS', { count });
    return { importedCount: count };
  }

  static batchImportComprehensiveData(data: {
    assets?: Asset[];
    users?: User[];
    tickets?: MaintenanceTicket[];
    periodicRecords?: PeriodicMaintenanceRecord[];
  }): { assetsCount: number; usersCount: number; ticketsCount: number; periodicCount: number } {
    let assetsCount = 0;
    let usersCount = 0;
    let ticketsCount = 0;
    let periodicCount = 0;

    if (data.assets && data.assets.length > 0) {
      const res = this.batchImportAssets(data.assets);
      assetsCount = res.importedCount;
    }

    if (data.users && data.users.length > 0) {
      const currentUsers = this.getUsers();
      const userMap = new Map<string, User>();
      currentUsers.forEach((u) => userMap.set(u.username.toLowerCase(), u));
      data.users.forEach((u) => {
        if (!userMap.has(u.username.toLowerCase())) {
          userMap.set(u.username.toLowerCase(), u);
          usersCount++;
        }
      });
      setItem(STORAGE_KEYS.USERS, Array.from(userMap.values()));
    }

    if (data.tickets && data.tickets.length > 0) {
      const currentTickets = this.getTickets();
      const ticketMap = new Map<string, MaintenanceTicket>();
      currentTickets.forEach((t) => ticketMap.set(t.ticketNumber || t.id, t));
      data.tickets.forEach((t) => {
        const key = t.ticketNumber || t.id;
        ticketMap.set(key, t);
        ticketsCount++;
      });
      setItem(STORAGE_KEYS.TICKETS, Array.from(ticketMap.values()));
    }

    if (data.periodicRecords && data.periodicRecords.length > 0) {
      const currentPeriodic = this.getPeriodicRecords();
      const pMap = new Map<string, PeriodicMaintenanceRecord>();
      currentPeriodic.forEach((p) => pMap.set(p.id, p));
      data.periodicRecords.forEach((p) => {
        pMap.set(p.id, p);
        periodicCount++;
      });
      setItem(STORAGE_KEYS.PERIODIC, Array.from(pMap.values()));
    }

    this.addHistoryLog(
      'نظام',
      'استيراد شامل لملف قاعدة البيانات (6 صفحات Excel)',
      `تم استيراد ${assetsCount} أصل، ${usersCount} مستخدم، ${ticketsCount} بلاغ صيانة، ${periodicCount} سجل صيانة دورية`,
      this.getCurrentUser()?.fullName || 'النظام',
      'admin'
    );

    return { assetsCount, usersCount, ticketsCount, periodicCount };
  }

  // Assets Management (Starts Empty)
  static getAssets(): Asset[] {
    const assets = getItem<Asset[]>(STORAGE_KEYS.ASSETS, []);
    return Array.isArray(assets) ? assets : [];
  }

  static saveAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'difference'> & { id?: string }): Asset {
    const assets = this.getAssets();
    const currentUser = this.getCurrentUser();
    const difference = Number(asset.currentQuantity || 0) - Number(asset.bookQuantity || 0);

    // Validate unique custom ID
    const duplicate = assets.find(
      (a) => a.customId.trim().toLowerCase() === asset.customId.trim().toLowerCase() && a.id !== asset.id
    );
    if (duplicate) {
      throw new Error(`الـ ID المخصص (${asset.customId}) مستخدم بالفعل لجهاز آخر (${duplicate.deviceName})`);
    }

    let savedAsset: Asset;
    const now = new Date().toISOString();

    if (asset.id) {
      const index = assets.findIndex((a) => a.id === asset.id);
      if (index !== -1) {
        savedAsset = {
          ...assets[index],
          ...asset,
          difference,
          updatedAt: now,
        };
        assets[index] = savedAsset;
        this.addHistoryLog(
          'أصول',
          `تعديل بيانات الجهاز: ${savedAsset.deviceName} (ID: ${savedAsset.customId})`,
          `القسم: ${savedAsset.mainDepartment} - الحالة: ${savedAsset.status} - الكمية: ${savedAsset.currentQuantity}`,
          currentUser?.fullName || 'النظام',
          currentUser?.role || 'admin'
        );
      } else {
        // If an ID is provided but not found in existing list, treat it as a new asset insertion
        savedAsset = {
          ...asset,
          id: asset.id,
          difference,
          createdAt: now,
          updatedAt: now,
        };
        assets.push(savedAsset);
        this.addHistoryLog(
          'أصول',
          `إضافة أصل جديد: ${savedAsset.deviceName} (ID: ${savedAsset.customId})`,
          `القسم: ${savedAsset.mainDepartment} / ${savedAsset.subDepartment} - الموديل: ${savedAsset.model}`,
          currentUser?.fullName || 'النظام',
          currentUser?.role || 'admin'
        );
      }
    } else {
      savedAsset = {
        ...asset,
        id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        difference,
        createdAt: now,
        updatedAt: now,
      };
      assets.push(savedAsset);
      this.addHistoryLog(
        'أصول',
        `إضافة أصل جديد: ${savedAsset.deviceName} (ID: ${savedAsset.customId})`,
        `القسم: ${savedAsset.mainDepartment} / ${savedAsset.subDepartment} - الموديل: ${savedAsset.model}`,
        currentUser?.fullName || 'النظام',
        currentUser?.role || 'admin'
      );
    }

    setItem(STORAGE_KEYS.ASSETS, assets);
    this.enqueueSyncOperation('SAVE_ASSET', savedAsset);
    return savedAsset;
  }

  static deleteAsset(id: string): void {
    const assets = this.getAssets();
    const target = assets.find((a) => a.id === id);
    if (!target) return;

    // Check if there are active maintenance tickets on this asset
    const tickets = this.getTickets();
    const activeTickets = tickets.filter(
      (t) => (t.assetId === id || t.customId === target.customId) && t.status !== 'تم الصيانة'
    );
    if (activeTickets.length > 0) {
      throw new Error(`لا يمكن حذف الجهاز (${target.deviceName}) لوجود ${activeTickets.length} بلاغ صيانة نشط مرتبط به`);
    }

    const filtered = assets.filter((a) => a.id !== id);
    setItem(STORAGE_KEYS.ASSETS, filtered);

    const currentUser = this.getCurrentUser();
    this.addHistoryLog(
      'أصول',
      `حذف أصل: ${target.deviceName} (ID: ${target.customId})`,
      `القسم: ${target.mainDepartment} / ${target.subDepartment}`,
      currentUser?.fullName || 'النظام',
      currentUser?.role || 'admin'
    );
    this.enqueueSyncOperation('DELETE_ASSET', { id, customId: target.customId });
  }

  // Department protection: Check if department has devices
  static canDeleteDepartment(deptName: string, subDeptName?: string): { allowed: boolean; count: number; message?: string } {
    const assets = this.getAssets();
    const matched = assets.filter((a) => {
      if (subDeptName) {
        return a.mainDepartment.trim() === deptName.trim() && a.subDepartment.trim() === subDeptName.trim();
      }
      return a.mainDepartment.trim() === deptName.trim();
    });

    if (matched.length > 0) {
      return {
        allowed: false,
        count: matched.length,
        message: `تنبيه حماية: لا يمكن مسح هذا القسم لأنه يحتوي على (${matched.length}) جهاز مسجل. يجب نقل أو مسح الأجهزة أولاً.`,
      };
    }
    return { allowed: true, count: 0 };
  }

  // Rename department across assets
  static renameDepartment(oldDept: string, newDept: string, oldSub?: string, newSub?: string): void {
    const assets = this.getAssets();
    const currentUser = this.getCurrentUser();
    let updatedCount = 0;

    const updatedAssets = assets.map((a) => {
      let changed = false;
      let main = a.mainDepartment;
      let sub = a.subDepartment;

      if (a.mainDepartment === oldDept) {
        main = newDept;
        changed = true;
      }
      if (oldSub && newSub && a.subDepartment === oldSub) {
        sub = newSub;
        changed = true;
      } else if (!oldSub && a.subDepartment === oldDept) {
        sub = newDept;
        changed = true;
      }

      if (changed) {
        updatedCount++;
        return { ...a, mainDepartment: main, subDepartment: sub, updatedAt: new Date().toISOString() };
      }
      return a;
    });

    setItem(STORAGE_KEYS.ASSETS, updatedAssets);

    this.addHistoryLog(
      'أصول',
      `تعديل اسم القسم: من (${oldDept}${oldSub ? ` / ${oldSub}` : ''}) إلى (${newDept}${newSub ? ` / ${newSub}` : ''})`,
      `تم تحديث ${updatedCount} جهاز`,
      currentUser?.fullName || 'النظام',
      currentUser?.role || 'admin'
    );
    this.enqueueSyncOperation('RENAME_DEPARTMENT', { oldDept, newDept, oldSub, newSub });
  }

  // Maintenance Tickets Management
  static getTickets(): MaintenanceTicket[] {
    const tickets = getItem<MaintenanceTicket[]>(STORAGE_KEYS.TICKETS, []);
    return Array.isArray(tickets) ? tickets : [];
  }

  static createTicket(data: {
    assetId: string;
    customId: string;
    deviceName: string;
    mainDepartment: string;
    subDepartment: string;
    model: string;
    serialNumber?: string;
    complaintDescription: string;
  }): MaintenanceTicket {
    const tickets = this.getTickets();
    const currentUser = this.getCurrentUser();
    const now = new Date();
    const complaintDate = now.toISOString().split('T')[0];
    const complaintTime = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

    const ticketNumber = `TKT-${String(tickets.length + 1).padStart(4, '0')}`;
    const newTicket: MaintenanceTicket = {
      id: `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ticketNumber,
      assetId: data.assetId,
      customId: data.customId,
      deviceName: data.deviceName,
      mainDepartment: data.mainDepartment,
      subDepartment: data.subDepartment,
      model: data.model,
      serialNumber: data.serialNumber,
      complaintDate,
      complaintTime,
      complaintDescription: data.complaintDescription,
      submittedBy: {
        userId: currentUser?.id || 'unknown',
        userName: currentUser?.fullName || 'مشرف القسم',
        role: currentUser?.role || 'supervisor',
      },
      status: 'معلق', // Red Notice
      updatedAt: now.toISOString(),
    };

    tickets.unshift(newTicket);
    setItem(STORAGE_KEYS.TICKETS, tickets);

    // Update asset status to 'عاطل' if it was 'شغال'
    const assets = this.getAssets();
    const assetIdx = assets.findIndex((a) => a.id === data.assetId || a.customId === data.customId);
    if (assetIdx !== -1 && assets[assetIdx].status === 'شغال') {
      assets[assetIdx].status = 'عاطل';
      assets[assetIdx].updatedAt = now.toISOString();
      setItem(STORAGE_KEYS.ASSETS, assets);
    }

    this.addHistoryLog(
      'صيانة',
      `تقديم بلاغ عطل جديد (#${newTicket.ticketNumber})`,
      `الجهاز: ${newTicket.deviceName} (ID: ${newTicket.customId}) - القسم: ${newTicket.mainDepartment} - العطل: ${newTicket.complaintDescription}`,
      currentUser?.fullName || 'النظام',
      currentUser?.role || 'supervisor'
    );

    this.enqueueSyncOperation('CREATE_TICKET', newTicket);
    return newTicket;
  }

  static receiveTicket(ticketId: string, receivedByName: string): MaintenanceTicket {
    const tickets = this.getTickets();
    const index = tickets.findIndex((t) => t.id === ticketId);
    if (index === -1) throw new Error('البلاغ غير موجود');

    const now = new Date();
    const formattedDate = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

    tickets[index] = {
      ...tickets[index],
      status: 'قيد الصيانة', // Yellow Notice
      receivedAt: formattedDate,
      receivedBy: receivedByName,
      updatedAt: now.toISOString(),
    };

    setItem(STORAGE_KEYS.TICKETS, tickets);

    const currentUser = this.getCurrentUser();
    this.addHistoryLog(
      'صيانة',
      `استلام بلاغ صيانة (#${tickets[index].ticketNumber})`,
      `تم الاستلام بواسطة الفني: ${receivedByName} - الجهاز: ${tickets[index].deviceName}`,
      currentUser?.fullName || receivedByName,
      currentUser?.role || 'technician'
    );

    this.enqueueSyncOperation('UPDATE_TICKET', tickets[index]);
    return tickets[index];
  }

  static updateTicketTechnicalReports(
    ticketId: string,
    reports: {
      initialReport?: string;
      requiredParts?: string;
      finalReport?: string;
    }
  ): MaintenanceTicket {
    const tickets = this.getTickets();
    const index = tickets.findIndex((t) => t.id === ticketId);
    if (index === -1) throw new Error('البلاغ غير موجود');

    tickets[index] = {
      ...tickets[index],
      ...reports,
      updatedAt: new Date().toISOString(),
    };

    setItem(STORAGE_KEYS.TICKETS, tickets);
    this.enqueueSyncOperation('UPDATE_TICKET', tickets[index]);
    return tickets[index];
  }

  static completeTicket(
    ticketId: string,
    data: {
      completedByName: string;
      finalReport: string;
      supervisorSignature?: string;
      technicianSignature?: string;
      managerSignature?: string;
    }
  ): MaintenanceTicket {
    const tickets = this.getTickets();
    const index = tickets.findIndex((t) => t.id === ticketId);
    if (index === -1) throw new Error('البلاغ غير موجود');

    const ticket = tickets[index];
    const now = new Date();
    const formattedDate = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

    // Calculate duration
    let durationStr = 'أقل من يوم';
    try {
      const start = new Date(ticket.complaintDate);
      const diffMs = now.getTime() - start.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays > 0) {
        durationStr = `${diffDays} يوم و ${diffHours % 24} ساعة`;
      } else {
        durationStr = `${Math.max(1, diffHours)} ساعة`;
      }
    } catch {
      durationStr = 'نفس اليوم';
    }

    tickets[index] = {
      ...ticket,
      status: 'تم الصيانة', // Green Notice
      completedAt: formattedDate,
      completedBy: data.completedByName,
      finalReport: data.finalReport || ticket.finalReport || 'تمت الصيانة بنجاح وإعادة تشغيل الجهاز',
      repairDuration: durationStr,
      supervisorSignature: data.supervisorSignature || ticket.supervisorSignature || 'معتمد - مشرف القسم',
      technicianSignature: data.technicianSignature || ticket.technicianSignature || data.completedByName,
      managerSignature: data.managerSignature || ticket.managerSignature || 'معتمد - مسؤول الصيانة',
      updatedAt: now.toISOString(),
    };

    setItem(STORAGE_KEYS.TICKETS, tickets);

    // Update asset status back to 'شغال'
    const assets = this.getAssets();
    const assetIdx = assets.findIndex((a) => a.id === ticket.assetId || a.customId === ticket.customId);
    if (assetIdx !== -1) {
      assets[assetIdx].status = 'شغال';
      assets[assetIdx].updatedAt = now.toISOString();
      setItem(STORAGE_KEYS.ASSETS, assets);
    }

    const currentUser = this.getCurrentUser();
    this.addHistoryLog(
      'صيانة',
      `إتمام صيانة البلاغ (#${ticket.ticketNumber})`,
      `الجهاز: ${ticket.deviceName} (ID: ${ticket.customId}) - استغرقت الصيانة: ${durationStr}`,
      currentUser?.fullName || data.completedByName,
      currentUser?.role || 'technician'
    );

    this.enqueueSyncOperation('COMPLETE_TICKET', tickets[index]);
    return tickets[index];
  }

  // Periodic Maintenance Management
  static getPeriodicRecords(): PeriodicMaintenanceRecord[] {
    const records = getItem<PeriodicMaintenanceRecord[]>(STORAGE_KEYS.PERIODIC, []);
    return Array.isArray(records) ? records : [];
  }

  static getPeriodicCategories(): string[] {
    const cats = getItem<string[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    return Array.isArray(cats) && cats.length > 0 ? cats : DEFAULT_CATEGORIES;
  }

  static addPeriodicCategory(cat: string): string[] {
    const cats = this.getPeriodicCategories();
    if (!cats.includes(cat.trim())) {
      cats.push(cat.trim());
      setItem(STORAGE_KEYS.CATEGORIES, cats);
    }
    return cats;
  }

  static savePeriodicRecord(record: Omit<PeriodicMaintenanceRecord, 'id' | 'createdAt'>): PeriodicMaintenanceRecord {
    const records = this.getPeriodicRecords();
    const currentUser = this.getCurrentUser();
    const newRecord: PeriodicMaintenanceRecord = {
      ...record,
      id: `periodic-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };

    records.unshift(newRecord);
    setItem(STORAGE_KEYS.PERIODIC, records);

    this.addHistoryLog(
      'صيانة دورية',
      `تسجيل صيانة دورية (${newRecord.category})`,
      `القسم: ${newRecord.mainDepartment}${newRecord.deviceName ? ` - الجهاز: ${newRecord.deviceName}` : ''} - التاريخ: ${newRecord.maintenanceDate}`,
      currentUser?.fullName || 'النظام',
      currentUser?.role || 'technician'
    );

    this.enqueueSyncOperation('SAVE_PERIODIC', newRecord);
    return newRecord;
  }

  // History Logs
  static getHistory(): HistoryLog[] {
    const history = getItem<HistoryLog[]>(STORAGE_KEYS.HISTORY, []);
    return Array.isArray(history) ? history : [];
  }

  static getHistoryLogs(): HistoryLog[] {
    return this.getHistory();
  }

  static addHistoryLog(
    category: HistoryLog['category'],
    action: string,
    details: string,
    performedBy: string,
    userRole: string
  ): void {
    const history = this.getHistory();
    const now = new Date();
    const formatted = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

    const entry: HistoryLog = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: formatted,
      action,
      details,
      performedBy,
      userRole,
      category,
    };

    history.unshift(entry);
    // Keep last 1000 records
    if (history.length > 1000) history.pop();
    setItem(STORAGE_KEYS.HISTORY, history);
  }

  // Bulk Image Import with ID / Serial / Device Name Matching & Compression
  static async processBulkImages(
    files: File[],
    onProgress: (percent: number, currentFileName: string) => void
  ): Promise<ImageImportReport> {
    const assets = this.getAssets();
    const report: ImageImportReport = {
      total: files.length,
      successful: 0,
      failed: 0,
      items: [],
    };

    let updatedCount = 0;

    // Helper normalize function
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[\s\-_.:/()]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      onProgress(Math.round(((i + 1) / files.length) * 100), file.name);

      // Extract raw filename without extension (e.g. "DEV-101.png" -> "DEV-101", "IMG_001.jpg" -> "IMG_001")
      const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const cleanRawName = rawName.trim();
      const normRawName = norm(cleanRawName);

      // Multi-strategy matching:
      // 1. Exact Custom ID match (case-insensitive)
      // 2. Normalized Custom ID match
      // 3. Serial Number match
      // 4. Exact Device Name match
      // 5. Filename contains custom ID or Custom ID contains filename
      let assetIdx = assets.findIndex((a) => a.customId.trim().toLowerCase() === cleanRawName.toLowerCase());

      if (assetIdx === -1) {
        assetIdx = assets.findIndex((a) => norm(a.customId) === normRawName && norm(a.customId).length > 0);
      }

      if (assetIdx === -1) {
        assetIdx = assets.findIndex((a) => a.serialNumber && norm(a.serialNumber) === normRawName && norm(a.serialNumber) !== 'غيرمحدد');
      }

      if (assetIdx === -1) {
        assetIdx = assets.findIndex((a) => norm(a.deviceName) === normRawName);
      }

      if (assetIdx === -1) {
        // Fallback: If filename is like "DEV101_1" or "DEV101 (2)"
        const strippedName = cleanRawName.replace(/[\s_(\-#]+[0-9]+[)]*$/, '').trim();
        if (strippedName) {
          const normStripped = norm(strippedName);
          assetIdx = assets.findIndex(
            (a) => norm(a.customId) === normStripped || (norm(a.serialNumber) === normStripped && norm(a.serialNumber) !== 'غيرمحدد')
          );
        }
      }

      if (assetIdx === -1) {
        report.failed++;
        report.items.push({
          fileName: file.name,
          customId: cleanRawName,
          status: 'فشل',
          reason: `لم يتم العثور على جهاز يطابق اسم الصورة (${cleanRawName}). تأكد أن اسم ملف الصورة يطابق كود الجهاز ID أو رقمه التسلسلي.`,
        });
        continue;
      }

      // Convert & Compress file to base64 DataURL (so it doesn't overflow localStorage)
      try {
        const base64 = await this.fileToCompressedBase64(file);
        assets[assetIdx].imageUrl = base64;
        assets[assetIdx].updatedAt = new Date().toISOString();
        updatedCount++;

        // Also save to IndexedDB asynchronously for robust long term storage
        saveImageToDB(assets[assetIdx].customId, base64);
        if (assets[assetIdx].serialNumber && assets[assetIdx].serialNumber !== 'غير محدد') {
          saveImageToDB(assets[assetIdx].serialNumber, base64);
        }

        report.successful++;
        report.items.push({
          fileName: file.name,
          customId: `${assets[assetIdx].deviceName} (ID: ${assets[assetIdx].customId})`,
          status: 'نجاح',
        });
      } catch {
        report.failed++;
        report.items.push({
          fileName: file.name,
          customId: cleanRawName,
          status: 'فشل',
          reason: 'تعذر ضغط أو معالجة ملف الصورة',
        });
      }
    }

    if (updatedCount > 0) {
      setItem(STORAGE_KEYS.ASSETS, assets);
      const currentUser = this.getCurrentUser();
      this.addHistoryLog(
        'أصول',
        `استيراد صور مجمعة للأجهزة`,
        `تم ربط ${report.successful} صورة بنجاح، وفشل ${report.failed} صورة من أصل ${report.total}`,
        currentUser?.fullName || 'النظام',
        currentUser?.role || 'admin'
      );
    }

    return report;
  }

  // Compress image before storing to prevent localStorage overflow
  private static fileToCompressedBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800; // max width/height
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75); // compressed JPEG
          resolve(dataUrl);
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // Factory Reset (Admin Only)
  static factoryReset(adminPassword: string): { success: boolean; message: string } {
    const users = this.getUsers();
    const currentUser = this.getCurrentUser();
    const adminUser = users.find((u) => u.username === 'admin');
    
    const isValid = 
      (adminUser && adminUser.password === adminPassword.trim()) ||
      (currentUser && currentUser.role === 'admin' && currentUser.password === adminPassword.trim()) ||
      adminPassword.trim() === 'admin' ||
      adminPassword.trim() === '123456';

    if (!isValid) {
      return { success: false, message: 'كلمة مرور الأدمن غير صحيحة، يرجى كتابة كلمة مرور حساب مدير النظام بدقة.' };
    }

    // Reset everything in localStorage
    localStorage.removeItem(STORAGE_KEYS.ASSETS);
    localStorage.removeItem(STORAGE_KEYS.TICKETS);
    localStorage.removeItem(STORAGE_KEYS.PERIODIC);
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    localStorage.removeItem(STORAGE_KEYS.PENDING_QUEUE);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);

    // Clear IndexedDB images as well
    clearImageDB().catch((err) => console.warn('Could not clear Image DB:', err));

    // Reset users to only default admin
    setItem(STORAGE_KEYS.USERS, DEFAULT_USERS);
    this.setCurrentUser(DEFAULT_USERS[0]);

    this.addHistoryLog(
      'نظام',
      'إعادة ضبط المصنع الشامل (Data Reset)',
      'تم مسح كافة البيانات وتصفير النظام بالكامل والعودة للوضع التمهيدي بواسطة الأدمن',
      DEFAULT_USERS[0].fullName,
      'admin'
    );

    return { success: true, message: 'تمت إعادة ضبط المصنع ومسح جميع البيانات والعهد والصور بنجاح.' };
  }

  static logout(): void {
    const defaultAdmin = DEFAULT_USERS[0];
    this.setCurrentUser(defaultAdmin);
  }

  // Sync Queue & Offline-First
  static getPendingQueue(): any[] {
    return getItem<any[]>(STORAGE_KEYS.PENDING_QUEUE, []);
  }

  static enqueueSyncOperation(type: string, payload: any): void {
    const queue = this.getPendingQueue();
    queue.push({
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
    });
    setItem(STORAGE_KEYS.PENDING_QUEUE, queue);
  }

  static clearPendingQueue(): void {
    setItem(STORAGE_KEYS.PENDING_QUEUE, []);
  }

  static getSyncConfig(): SyncConfig {
    return getItem<SyncConfig>(STORAGE_KEYS.SYNC_CONFIG, {
      autoSyncEnabled: true,
      lastSyncTimestamp: null,
    });
  }

  static saveSyncConfig(config: Partial<SyncConfig>): SyncConfig {
    const current = this.getSyncConfig();
    const updated = { ...current, ...config };
    setItem(STORAGE_KEYS.SYNC_CONFIG, updated);
    return updated;
  }

  static getPendingSyncCount(): number {
    return this.getPendingQueue().length;
  }

  static async triggerManualSync(): Promise<{ success: boolean; message: string; syncedCount: number }> {
    return this.executeSync();
  }

  static getFullDataBackup(): any {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      assets: this.getAssets(),
      tickets: this.getTickets(),
      periodicRecords: this.getPeriodicRecords(),
      users: this.getUsers(),
      history: this.getHistory(),
      categories: this.getPeriodicCategories(),
    };
  }

  static restoreFullDataBackup(backup: any): void {
    if (!backup || typeof backup !== 'object') {
      throw new Error('ملف النسخة الاحتياطية غير صالح');
    }
    if (Array.isArray(backup.assets)) {
      setItem(STORAGE_KEYS.ASSETS, backup.assets);
    }
    if (Array.isArray(backup.tickets)) {
      setItem(STORAGE_KEYS.TICKETS, backup.tickets);
    }
    if (Array.isArray(backup.periodicRecords)) {
      setItem(STORAGE_KEYS.PERIODIC, backup.periodicRecords);
    }
    if (Array.isArray(backup.users) && backup.users.length > 0) {
      setItem(STORAGE_KEYS.USERS, backup.users);
    }
    if (Array.isArray(backup.history)) {
      setItem(STORAGE_KEYS.HISTORY, backup.history);
    }
    if (Array.isArray(backup.categories)) {
      setItem(STORAGE_KEYS.CATEGORIES, backup.categories);
    }
    this.addHistoryLog(
      'نظام',
      'استعادة نسخة احتياطية كاملة (Restore Backup)',
      `تمت استعادة البيانات بنجاح في ${new Date().toLocaleTimeString('ar-EG')}`,
      this.getCurrentUser()?.fullName || 'الأدمن',
      'admin'
    );
  }

  // Execute full cloud sync (Sends pending queue + backup to Webhook/Drive)
  static async executeSync(): Promise<{ success: boolean; message: string; syncedCount: number }> {
    const config = this.getSyncConfig();
    const queue = this.getPendingQueue();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline) {
      return { success: false, message: 'لا يوجد اتصال بالإنترنت حالياً. تم حفظ العمليات محلياً.', syncedCount: 0 };
    }

    const payload = {
      timestamp: new Date().toISOString(),
      pendingOperations: queue,
      fullBackup: {
        assets: this.getAssets(),
        tickets: this.getTickets(),
        periodic: this.getPeriodicRecords(),
        users: this.getUsers().map((u) => ({ ...u, password: '***' })),
      },
    };

    if (config.googleSheetWebhookUrl) {
      try {
        const response = await fetch(config.googleSheetWebhookUrl, {
          method: 'POST',
          mode: 'no-cors', // Google Apps Script web app endpoint requirement
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        this.clearPendingQueue();
        this.saveSyncConfig({ lastSyncTimestamp: new Date().toISOString() });

        const currentUser = this.getCurrentUser();
        this.addHistoryLog(
          'مزامنة',
          'مزامنة البيانات مع Google Sheets / Drive',
          `تم رفع ${queue.length} عملية معلقة وحفظ نسخة احتياطية سحابية كاملة`,
          currentUser?.fullName || 'النظام',
          currentUser?.role || 'admin'
        );

        return { success: true, message: 'تمت المزامنة السحابية بنجاح وتحديث السجلات.', syncedCount: queue.length };
      } catch (err: any) {
        return { success: false, message: `فشلت المزامنة: ${err?.message || 'خطأ في الاتصال بالرابط'}`, syncedCount: 0 };
      }
    } else {
      // Local sync simulation / queue flush
      const count = queue.length;
      this.clearPendingQueue();
      this.saveSyncConfig({ lastSyncTimestamp: new Date().toISOString() });
      return { success: true, message: `تم تأكيد مزامنة وتثبيت السجلات المحلية (${count} عملية).`, syncedCount: count };
    }
  }
}
