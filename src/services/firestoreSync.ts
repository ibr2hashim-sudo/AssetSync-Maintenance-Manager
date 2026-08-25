import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Asset, MaintenanceTicket, PeriodicMaintenanceRecord, User, HistoryLog, AuditSession } from '../types';

function cleanForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
}

export class FirestoreSyncService {
  private static isSyncing = false;
  private static isInitialized = false;

  // Real-time listener unsubscribers
  private static unsubscribers: (() => void)[] = [];

  /**
   * Initializes real-time listeners for all main collections
   */
  static initRealtimeListeners(onDataChanged: () => void) {
    if (this.unsubscribers.length > 0) {
      this.unsubscribers.forEach((unsub) => unsub());
      this.unsubscribers = [];
    }

    try {
      // 1. Assets listener
      const unsubAssets = onSnapshot(collection(db, 'assets'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteAssets: Asset[] = [];
          snapshot.forEach((doc) => {
            remoteAssets.push(doc.data() as Asset);
          });
          localStorage.setItem('asset_mgmt_assets', JSON.stringify(remoteAssets));
          onDataChanged();
        }
      }, (error) => console.error('Firestore assets sync error:', error));
      this.unsubscribers.push(unsubAssets);

      // 2. Tickets listener
      const unsubTickets = onSnapshot(collection(db, 'tickets'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteTickets: MaintenanceTicket[] = [];
          snapshot.forEach((doc) => {
            remoteTickets.push(doc.data() as MaintenanceTicket);
          });
          localStorage.setItem('asset_mgmt_tickets', JSON.stringify(remoteTickets));
          onDataChanged();
        }
      }, (error) => console.error('Firestore tickets sync error:', error));
      this.unsubscribers.push(unsubTickets);

      // 3. Periodic Records listener
      const unsubPeriodic = onSnapshot(collection(db, 'periodic_records'), (snapshot) => {
        if (!snapshot.empty) {
          const remotePeriodic: PeriodicMaintenanceRecord[] = [];
          snapshot.forEach((doc) => {
            remotePeriodic.push(doc.data() as PeriodicMaintenanceRecord);
          });
          localStorage.setItem('asset_mgmt_periodic', JSON.stringify(remotePeriodic));
          onDataChanged();
        }
      }, (error) => console.error('Firestore periodic sync error:', error));
      this.unsubscribers.push(unsubPeriodic);

      // 4. Users listener
      const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteUsers: User[] = [];
          snapshot.forEach((doc) => {
            remoteUsers.push(doc.data() as User);
          });
          localStorage.setItem('asset_mgmt_users', JSON.stringify(remoteUsers));
          onDataChanged();
        }
      }, (error) => console.error('Firestore users sync error:', error));
      this.unsubscribers.push(unsubUsers);

      // 5. Audit Sessions listener
      const unsubAudits = onSnapshot(collection(db, 'audit_sessions'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteAudits: AuditSession[] = [];
          snapshot.forEach((doc) => {
            remoteAudits.push(doc.data() as AuditSession);
          });
          localStorage.setItem('asset_mgmt_audit_sessions', JSON.stringify(remoteAudits));
          onDataChanged();
        }
      }, (error) => console.error('Firestore audit sessions sync error:', error));
      this.unsubscribers.push(unsubAudits);

      // 6. Periodic Categories listener
      const unsubCategories = onSnapshot(doc(db, 'settings', 'categories'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && Array.isArray(data.list)) {
            localStorage.setItem('asset_mgmt_periodic_categories', JSON.stringify(data.list));
            onDataChanged();
          }
        }
      }, (error) => console.error('Firestore categories sync error:', error));
      this.unsubscribers.push(unsubCategories);

      // Bootstrap initial sync from Firestore or upload local data if Firestore is empty
      this.bootstrapCloudData();
    } catch (err) {
      console.error('Error starting Firestore listeners:', err);
    }
  }

  /**
   * If Firestore is completely empty and local storage has assets/data, push to Firestore
   * If Firestore has data, pull to local storage
   */
  static async bootstrapCloudData(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      const assetsSnap = await getDocs(collection(db, 'assets'));
      const localAssetsStr = localStorage.getItem('asset_mgmt_assets');
      const localAssets: Asset[] = localAssetsStr ? JSON.parse(localAssetsStr) : [];

      if (assetsSnap.empty && localAssets.length > 0) {
        console.log('Uploading local database to Firestore for initial cloud sync...');
        await this.pushAllLocalDataToFirestore();
      }
    } catch (err) {
      console.error('Bootstrap Firestore error:', err);
    }
  }

  /**
   * Push an individual asset to Firestore
   */
  static async syncAsset(asset: Asset): Promise<void> {
    try {
      const docRef = doc(db, 'assets', asset.id);
      await setDoc(docRef, cleanForFirestore(asset), { merge: true });
    } catch (err) {
      console.error('Error syncing asset to Firestore:', err);
    }
  }

  /**
   * Delete an asset from Firestore
   */
  static async deleteAsset(assetId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'assets', assetId));
    } catch (err) {
      console.error('Error deleting asset from Firestore:', err);
    }
  }

  /**
   * Push an individual ticket to Firestore
   */
  static async syncTicket(ticket: MaintenanceTicket): Promise<void> {
    try {
      const docRef = doc(db, 'tickets', ticket.id);
      await setDoc(docRef, cleanForFirestore(ticket), { merge: true });
    } catch (err) {
      console.error('Error syncing ticket to Firestore:', err);
    }
  }

  /**
   * Delete a ticket from Firestore
   */
  static async deleteTicket(ticketId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'tickets', ticketId));
    } catch (err) {
      console.error('Error deleting ticket from Firestore:', err);
    }
  }

  /**
   * Push an individual periodic record to Firestore
   */
  static async syncPeriodicRecord(record: PeriodicMaintenanceRecord): Promise<void> {
    try {
      const docRef = doc(db, 'periodic_records', record.id);
      await setDoc(docRef, cleanForFirestore(record), { merge: true });
    } catch (err) {
      console.error('Error syncing periodic record to Firestore:', err);
    }
  }

  /**
   * Delete a periodic record from Firestore
   */
  static async deletePeriodicRecord(recordId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'periodic_records', recordId));
    } catch (err) {
      console.error('Error deleting periodic record from Firestore:', err);
    }
  }

  /**
   * Push an audit session to Firestore
   */
  static async syncAuditSession(session: AuditSession): Promise<void> {
    try {
      const docRef = doc(db, 'audit_sessions', session.id);
      await setDoc(docRef, cleanForFirestore(session), { merge: true });
    } catch (err) {
      console.error('Error syncing audit session to Firestore:', err);
    }
  }

  /**
   * Delete an audit session from Firestore
   */
  static async deleteAuditSession(sessionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'audit_sessions', sessionId));
    } catch (err) {
      console.error('Error deleting audit session from Firestore:', err);
    }
  }

  /**
   * Push user to Firestore
   */
  static async syncUser(user: User): Promise<void> {
    try {
      const docRef = doc(db, 'users', user.id);
      await setDoc(docRef, cleanForFirestore(user), { merge: true });
    } catch (err) {
      console.error('Error syncing user to Firestore:', err);
    }
  }

  /**
   * Delete user from Firestore
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err) {
      console.error('Error deleting user from Firestore:', err);
    }
  }

  /**
   * Sync categories list
   */
  static async syncCategories(categories: string[]): Promise<void> {
    try {
      const docRef = doc(db, 'settings', 'categories');
      await setDoc(docRef, { list: categories, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Error syncing categories to Firestore:', err);
    }
  }

  /**
   * Push ALL local data into Firestore in chunks
   */
  static async pushAllLocalDataToFirestore(): Promise<{ success: boolean; message: string }> {
    if (this.isSyncing) return { success: false, message: 'المزامنة جارية بالفعل' };
    this.isSyncing = true;

    try {
      const assetsStr = localStorage.getItem('asset_mgmt_assets');
      const ticketsStr = localStorage.getItem('asset_mgmt_tickets');
      const periodicStr = localStorage.getItem('asset_mgmt_periodic');
      const auditsStr = localStorage.getItem('asset_mgmt_audit_sessions');
      const usersStr = localStorage.getItem('asset_mgmt_users');
      const catStr = localStorage.getItem('asset_mgmt_periodic_categories');

      const assets: Asset[] = assetsStr ? JSON.parse(assetsStr) : [];
      const tickets: MaintenanceTicket[] = ticketsStr ? JSON.parse(ticketsStr) : [];
      const periodic: PeriodicMaintenanceRecord[] = periodicStr ? JSON.parse(periodicStr) : [];
      const audits: AuditSession[] = auditsStr ? JSON.parse(auditsStr) : [];
      const users: User[] = usersStr ? JSON.parse(usersStr) : [];
      const categories: string[] = catStr ? JSON.parse(catStr) : [];

      // Batch push assets in chunks of 250
      for (let i = 0; i < assets.length; i += 250) {
        const batch = writeBatch(db);
        const chunk = assets.slice(i, i + 250);
        chunk.forEach((asset) => {
          const ref = doc(db, 'assets', asset.id);
          batch.set(ref, cleanForFirestore(asset), { merge: true });
        });
        await batch.commit();
      }

      // Batch push tickets
      for (let i = 0; i < tickets.length; i += 250) {
        const batch = writeBatch(db);
        const chunk = tickets.slice(i, i + 250);
        chunk.forEach((ticket) => {
          const ref = doc(db, 'tickets', ticket.id);
          batch.set(ref, cleanForFirestore(ticket), { merge: true });
        });
        await batch.commit();
      }

      // Batch push periodic
      for (let i = 0; i < periodic.length; i += 250) {
        const batch = writeBatch(db);
        const chunk = periodic.slice(i, i + 250);
        chunk.forEach((p) => {
          const ref = doc(db, 'periodic_records', p.id);
          batch.set(ref, cleanForFirestore(p), { merge: true });
        });
        await batch.commit();
      }

      // Batch push audits
      for (let i = 0; i < audits.length; i += 250) {
        const batch = writeBatch(db);
        const chunk = audits.slice(i, i + 250);
        chunk.forEach((a) => {
          const ref = doc(db, 'audit_sessions', a.id);
          batch.set(ref, cleanForFirestore(a), { merge: true });
        });
        await batch.commit();
      }

      // Batch push users
      if (users.length > 0) {
        const batch = writeBatch(db);
        users.forEach((u) => {
          const ref = doc(db, 'users', u.id);
          batch.set(ref, cleanForFirestore(u), { merge: true });
        });
        await batch.commit();
      }

      // Push categories
      if (categories.length > 0) {
        await setDoc(doc(db, 'settings', 'categories'), {
          list: categories,
          updatedAt: new Date().toISOString(),
        });
      }

      this.isSyncing = false;
      return {
        success: true,
        message: `تمت المزامنة السحابية بنجاح (${assets.length} أصل، ${tickets.length} بلاغ، ${periodic.length} صيانة دورية، ${audits.length} جلسة جرد، ${users.length} مستخدم)`,
      };
    } catch (err: any) {
      this.isSyncing = false;
      console.error('Push all data to Firestore failed:', err);
      return { success: false, message: `فشل رفع البيانات: ${err?.message || 'خطأ غير معروف'}` };
    }
  }

  /**
   * Reset / Clear Cloud database
   */
  static async clearAllCloudData(): Promise<void> {
    try {
      const collections = ['assets', 'tickets', 'periodic_records', 'audit_sessions'];
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.error('Error clearing cloud data:', err);
    }
  }
}
