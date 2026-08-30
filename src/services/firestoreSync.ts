import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Asset,
  MaintenanceTicket,
  PeriodicMaintenanceRecord,
  User,
  AuditSession,
  SurgicalSet,
  SurgicalInstrument,
} from '../types';
import { saveImageToDB } from './storage';

function cleanForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
}

interface RecentChange {
  col:
    | 'assets'
    | 'tickets'
    | 'periodic_records'
    | 'audit_sessions'
    | 'users'
    | 'settings'
    | 'surgical_sets'
    | 'surgical_instruments';
  id: string;
  action: 'set' | 'delete';
  timestamp: number;
}

interface SyncMetaDoc {
  version: number;
  lastUpdated: string;
  recentChanges?: RecentChange[];
  assetsCount?: number;
  ticketsCount?: number;
}

const LOCAL_SYNC_STORAGE = {
  LAST_PROCESSED_TS: 'eco_sync_last_processed_ts',
  SAVED_READS_COUNT: 'eco_sync_saved_reads_count',
  INITIALIZED_FLAG: 'eco_sync_initialized_v2',
};

export class FirestoreSyncService {
  private static isSyncing = false;
  private static isInitialized = false;
  private static quotaExceeded = false;
  private static quotaErrorMessage: string | null = null;
  private static metaUnsubscriber: (() => void) | null = null;
  private static onDataChangedCallback: (() => void) | null = null;

  // Track estimated reads saved
  private static sessionSavedReads = 0;

  static isQuotaLimitReached(): boolean {
    return this.quotaExceeded;
  }

  static getQuotaErrorMessage(): string | null {
    return this.quotaErrorMessage;
  }

  static getEstimatedSavedReads(): number {
    const saved = parseInt(localStorage.getItem(LOCAL_SYNC_STORAGE.SAVED_READS_COUNT) || '0', 10);
    return saved + this.sessionSavedReads;
  }

  private static recordSavedReads(count: number) {
    this.sessionSavedReads += count;
    try {
      const current = parseInt(localStorage.getItem(LOCAL_SYNC_STORAGE.SAVED_READS_COUNT) || '0', 10);
      localStorage.setItem(LOCAL_SYNC_STORAGE.SAVED_READS_COUNT, String(current + count));
    } catch {
      // ignore
    }
  }

  private static handleSyncError(context: string, error: any) {
    const errorStr = error?.message || String(error || '');
    if (
      errorStr.includes('Quota exceeded') ||
      errorStr.includes('quota metric') ||
      errorStr.includes('resource-exhausted') ||
      error?.code === 'resource-exhausted'
    ) {
      this.quotaExceeded = true;
      this.quotaErrorMessage = errorStr;
      console.warn(`[Firestore Quota Exceeded]: ${context} - Working in local storage mode.`);
    } else {
      console.error(`Firestore ${context} error:`, error);
    }
  }

  /**
   * Initialize Ultra-Economical Single-Document Real-time Sync
   * Listens ONLY to 'settings/sync_meta' instead of streaming all full collections.
   */
  static initRealtimeListeners(onDataChanged: () => void) {
    this.onDataChangedCallback = onDataChanged;

    if (this.metaUnsubscriber) {
      this.metaUnsubscriber();
      this.metaUnsubscriber = null;
    }

    try {
      // Single Document Listener for the entire system
      const metaDocRef = doc(db, 'settings', 'sync_meta');

      this.metaUnsubscriber = onSnapshot(
        metaDocRef,
        async (snapshot) => {
          if (!snapshot.exists()) {
            // First time setup: bootstrap if necessary
            await this.bootstrapCloudData();
            return;
          }

          const meta = snapshot.data() as SyncMetaDoc;
          await this.processIncomingDeltaChanges(meta);
        },
        (error) => {
          this.handleSyncError('sync_meta listener', error);
        }
      );

      // Verify if client needs initial data load (New Device or fresh browser)
      this.checkAndPerformInitialLoad();
    } catch (err) {
      this.handleSyncError('starting economic listener', err);
    }
  }

  /**
   * Processes targeted delta changes from the meta pulse document
   */
  private static async processIncomingDeltaChanges(meta: SyncMetaDoc): Promise<void> {
    try {
      const lastProcessedTs = parseInt(
        localStorage.getItem(LOCAL_SYNC_STORAGE.LAST_PROCESSED_TS) || '0',
        10
      );

      const recentChanges = Array.isArray(meta.recentChanges) ? meta.recentChanges : [];
      if (recentChanges.length === 0) return;

      // Filter changes that happened after our last local sync
      const pendingChanges = recentChanges.filter((c) => c.timestamp > lastProcessedTs);
      if (pendingChanges.length === 0) return;

      // If pending changes exceed recent changes buffer or too old, perform a full sync
      const oldestBufferedTs = recentChanges[0]?.timestamp || 0;
      if (lastProcessedTs > 0 && lastProcessedTs < oldestBufferedTs) {
        console.log('[Eco-Sync]: Device was offline for a long period. Performing full incremental sync...');
        await this.pullAllCloudDataToLocal();
        return;
      }

      let dataModified = false;
      let highestTs = lastProcessedTs;

      for (const change of pendingChanges) {
        highestTs = Math.max(highestTs, change.timestamp);

        if (change.col === 'assets') {
          dataModified = (await this.applyAssetDelta(change)) || dataModified;
        } else if (change.col === 'tickets') {
          dataModified = (await this.applyTicketDelta(change)) || dataModified;
        } else if (change.col === 'periodic_records') {
          dataModified = (await this.applyPeriodicDelta(change)) || dataModified;
        } else if (change.col === 'audit_sessions') {
          dataModified = (await this.applyAuditDelta(change)) || dataModified;
        } else if (change.col === 'users') {
          dataModified = (await this.applyUserDelta(change)) || dataModified;
        } else if (change.col === 'settings' && change.id === 'categories') {
          dataModified = (await this.applyCategoriesDelta()) || dataModified;
        } else if (change.col === 'surgical_sets') {
          dataModified = (await this.applySurgicalSetDelta(change)) || dataModified;
        } else if (change.col === 'surgical_instruments') {
          dataModified = (await this.applySurgicalInstrumentDelta(change)) || dataModified;
        }
      }

      // Update last processed timestamp
      localStorage.setItem(LOCAL_SYNC_STORAGE.LAST_PROCESSED_TS, String(highestTs || Date.now()));

      // Calculate saved reads (we fetched N documents instead of all hundreds of documents)
      const currentAssetsStr = localStorage.getItem('asset_mgmt_assets');
      const totalLocalAssets = currentAssetsStr ? JSON.parse(currentAssetsStr).length : 50;
      const estimatedSaved = Math.max(0, totalLocalAssets - pendingChanges.length);
      this.recordSavedReads(estimatedSaved);

      if (dataModified && this.onDataChangedCallback) {
        this.onDataChangedCallback();
      }
    } catch (err) {
      this.handleSyncError('delta processing', err);
    }
  }

  // Delta handlers for specific entities
  private static async applyAssetDelta(change: RecentChange): Promise<boolean> {
    try {
      const assetsStr = localStorage.getItem('asset_mgmt_assets');
      const assets: Asset[] = assetsStr ? JSON.parse(assetsStr) : [];

      if (change.action === 'delete') {
        const filtered = assets.filter((a) => a.id !== change.id && a.customId !== change.id);
        localStorage.setItem('asset_mgmt_assets', JSON.stringify(filtered));
        return true;
      } else {
        const snap = await getDoc(doc(db, 'assets', change.id));
        if (snap.exists()) {
          const remoteAsset = snap.data() as Asset;
          const idx = assets.findIndex((a) => a.id === change.id || a.customId === remoteAsset.customId);
          if (idx !== -1) {
            assets[idx] = remoteAsset;
          } else {
            assets.unshift(remoteAsset);
          }
          localStorage.setItem('asset_mgmt_assets', JSON.stringify(assets));
          return true;
        }
      }
    } catch (err) {
      this.handleSyncError('applyAssetDelta', err);
    }
    return false;
  }

  private static async applyTicketDelta(change: RecentChange): Promise<boolean> {
    try {
      const ticketsStr = localStorage.getItem('asset_mgmt_tickets');
      const tickets: MaintenanceTicket[] = ticketsStr ? JSON.parse(ticketsStr) : [];

      if (change.action === 'delete') {
        const filtered = tickets.filter((t) => t.id !== change.id && t.ticketNumber !== change.id);
        localStorage.setItem('asset_mgmt_tickets', JSON.stringify(filtered));
        return true;
      } else {
        const snap = await getDoc(doc(db, 'tickets', change.id));
        if (snap.exists()) {
          const remoteTicket = snap.data() as MaintenanceTicket;
          const idx = tickets.findIndex((t) => t.id === change.id || t.ticketNumber === remoteTicket.ticketNumber);
          if (idx !== -1) {
            tickets[idx] = remoteTicket;
          } else {
            tickets.unshift(remoteTicket);
          }
          localStorage.setItem('asset_mgmt_tickets', JSON.stringify(tickets));
          return true;
        }
      }
    } catch (err) {
      this.handleSyncError('applyTicketDelta', err);
    }
    return false;
  }

  private static async applyPeriodicDelta(change: RecentChange): Promise<boolean> {
    try {
      const recsStr = localStorage.getItem('asset_mgmt_periodic');
      const recs: PeriodicMaintenanceRecord[] = recsStr ? JSON.parse(recsStr) : [];

      if (change.action === 'delete') {
        const filtered = recs.filter((r) => r.id !== change.id);
        localStorage.setItem('asset_mgmt_periodic', JSON.stringify(filtered));
        return true;
      } else {
        const snap = await getDoc(doc(db, 'periodic_records', change.id));
        if (snap.exists()) {
          const remoteRecord = snap.data() as PeriodicMaintenanceRecord;
          const idx = recs.findIndex((r) => r.id === change.id);
          if (idx !== -1) {
            recs[idx] = remoteRecord;
          } else {
            recs.unshift(remoteRecord);
          }
          localStorage.setItem('asset_mgmt_periodic', JSON.stringify(recs));
          return true;
        }
      }
    } catch (err) {
      this.handleSyncError('applyPeriodicDelta', err);
    }
    return false;
  }

  private static async applyAuditDelta(change: RecentChange): Promise<boolean> {
    try {
      const auditsStr = localStorage.getItem('asset_mgmt_audit_sessions');
      const audits: AuditSession[] = auditsStr ? JSON.parse(auditsStr) : [];

      if (change.action === 'delete') {
        const filtered = audits.filter((a) => a.id !== change.id && a.sessionNumber !== change.id);
        localStorage.setItem('asset_mgmt_audit_sessions', JSON.stringify(filtered));
        return true;
      } else {
        const snap = await getDoc(doc(db, 'audit_sessions', change.id));
        if (snap.exists()) {
          const remoteAudit = snap.data() as AuditSession;
          const idx = audits.findIndex((a) => a.id === change.id || a.sessionNumber === remoteAudit.sessionNumber);
          if (idx !== -1) {
            audits[idx] = remoteAudit;
          } else {
            audits.unshift(remoteAudit);
          }
          localStorage.setItem('asset_mgmt_audit_sessions', JSON.stringify(audits));
          return true;
        }
      }
    } catch (err) {
      this.handleSyncError('applyAuditDelta', err);
    }
    return false;
  }

  private static async applyUserDelta(change: RecentChange): Promise<boolean> {
    try {
      const usersStr = localStorage.getItem('asset_mgmt_users');
      const users: User[] = usersStr ? JSON.parse(usersStr) : [];

      if (change.action === 'delete') {
        const filtered = users.filter((u) => u.id !== change.id);
        localStorage.setItem('asset_mgmt_users', JSON.stringify(filtered));
        return true;
      } else {
        const snap = await getDoc(doc(db, 'users', change.id));
        if (snap.exists()) {
          const remoteUser = snap.data() as User;
          const idx = users.findIndex((u) => u.id === change.id || u.username === remoteUser.username);
          if (idx !== -1) {
            users[idx] = remoteUser;
          } else {
            users.push(remoteUser);
          }
          localStorage.setItem('asset_mgmt_users', JSON.stringify(users));
          return true;
        }
      }
    } catch (err) {
      this.handleSyncError('applyUserDelta', err);
    }
    return false;
  }

  private static async applyCategoriesDelta(): Promise<boolean> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'categories'));
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.list)) {
          localStorage.setItem('asset_mgmt_periodic_categories', JSON.stringify(data.list));
          return true;
        }
      }
    } catch (err) {
      this.handleSyncError('applyCategoriesDelta', err);
    }
    return false;
  }

  private static async applySurgicalSetDelta(change: RecentChange): Promise<boolean> {
    try {
      const setsStr = localStorage.getItem('asset_mgmt_surgical_sets');
      const sets: SurgicalSet[] = setsStr ? JSON.parse(setsStr) : [];

      if (change.action === 'delete') {
        const filtered = sets.filter((s) => s.id !== change.id && s.code !== change.id);
        localStorage.setItem('asset_mgmt_surgical_sets', JSON.stringify(filtered));
        return true;
      } else {
        const snap = await getDoc(doc(db, 'surgical_sets', change.id));
        if (snap.exists()) {
          const remoteSet = snap.data() as SurgicalSet;
          const idx = sets.findIndex((s) => s.id === change.id || s.code === remoteSet.code);
          if (idx !== -1) {
            sets[idx] = remoteSet;
          } else {
            sets.unshift(remoteSet);
          }
          localStorage.setItem('asset_mgmt_surgical_sets', JSON.stringify(sets));
          return true;
        }
      }
    } catch (err) {
      this.handleSyncError('applySurgicalSetDelta', err);
    }
    return false;
  }

  private static async applySurgicalInstrumentDelta(change: RecentChange): Promise<boolean> {
    try {
      const instStr = localStorage.getItem('asset_mgmt_surgical_instruments');
      const instruments: SurgicalInstrument[] = instStr ? JSON.parse(instStr) : [];

      if (change.action === 'delete') {
        const filtered = instruments.filter((i) => i.id !== change.id);
        localStorage.setItem('asset_mgmt_surgical_instruments', JSON.stringify(filtered));
        return true;
      } else {
        const snap = await getDoc(doc(db, 'surgical_instruments', change.id));
        if (snap.exists()) {
          const remoteInst = snap.data() as SurgicalInstrument;
          const idx = instruments.findIndex((i) => i.id === change.id);
          if (idx !== -1) {
            instruments[idx] = remoteInst;
          } else {
            instruments.push(remoteInst);
          }
          localStorage.setItem('asset_mgmt_surgical_instruments', JSON.stringify(instruments));

          // Also save image to IndexedDB for offline and fast render if present
          if (remoteInst.imageUrl) {
            try {
              await saveImageToDB(`inst_${remoteInst.id}`, remoteInst.imageUrl);
              await saveImageToDB(`code_${remoteInst.code}`, remoteInst.imageUrl);
            } catch {}
          }

          return true;
        }
      }
    } catch (err) {
      this.handleSyncError('applySurgicalInstrumentDelta', err);
    }
    return false;
  }

  /**
   * Updates the global Sync Meta Pulse doc when a change occurs.
   * Maintains a ring buffer of the last 60 changes.
   */
  private static async emitSyncChange(change: RecentChange): Promise<void> {
    try {
      const metaRef = doc(db, 'settings', 'sync_meta');
      const now = Date.now();
      change.timestamp = now;

      const metaSnap = await getDoc(metaRef);
      let currentChanges: RecentChange[] = [];
      let currentVersion = 1;

      if (metaSnap.exists()) {
        const data = metaSnap.data() as SyncMetaDoc;
        currentChanges = Array.isArray(data.recentChanges) ? data.recentChanges : [];
        currentVersion = (data.version || 1) + 1;
      }

      // Filter out duplicate pending for same doc ID to avoid spamming
      const filtered = currentChanges.filter((c) => !(c.col === change.col && c.id === change.id));
      filtered.push(change);

      // Keep maximum last 60 recent changes to ensure tiny payload
      const trimmed = filtered.slice(-60);

      await setDoc(metaRef, {
        version: currentVersion,
        lastUpdated: new Date().toISOString(),
        recentChanges: trimmed,
      }, { merge: true });

      // Update local timestamp so this client doesn't re-fetch its own write
      localStorage.setItem(LOCAL_SYNC_STORAGE.LAST_PROCESSED_TS, String(now));
    } catch (err) {
      this.handleSyncError('emitSyncChange', err);
    }
  }

  /**
   * Check if a brand new device opened the app and needs initial cloud pull
   */
  private static async checkAndPerformInitialLoad(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      const localAssetsStr = localStorage.getItem('asset_mgmt_assets');
      const localAssets: Asset[] = localAssetsStr ? JSON.parse(localAssetsStr) : [];
      const hasInitToken = localStorage.getItem(LOCAL_SYNC_STORAGE.INITIALIZED_FLAG);

      // If local assets are empty and never initialized on this device, pull all cloud data
      if ((localAssets.length === 0 || !hasInitToken)) {
        await this.pullAllCloudDataToLocal();
        localStorage.setItem(LOCAL_SYNC_STORAGE.INITIALIZED_FLAG, 'true');
      } else {
        // Just record timestamp
        const lastTs = localStorage.getItem(LOCAL_SYNC_STORAGE.LAST_PROCESSED_TS);
        if (!lastTs) {
          localStorage.setItem(LOCAL_SYNC_STORAGE.LAST_PROCESSED_TS, String(Date.now()));
        }
      }
    } catch (err) {
      this.handleSyncError('initial check', err);
    }
  }

  /**
   * Pull all collections to local storage (Only used on new device setup or manual Full Sync)
   */
  static async pullAllCloudDataToLocal(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[Eco-Sync]: Downloading full database snapshot...');

      // 1. Assets
      const assetsSnap = await getDocs(collection(db, 'assets'));
      if (!assetsSnap.empty) {
        const remoteAssets: Asset[] = [];
        assetsSnap.forEach((d) => remoteAssets.push(d.data() as Asset));
        localStorage.setItem('asset_mgmt_assets', JSON.stringify(remoteAssets));
      }

      // 2. Tickets
      const ticketsSnap = await getDocs(collection(db, 'tickets'));
      if (!ticketsSnap.empty) {
        const remoteTickets: MaintenanceTicket[] = [];
        ticketsSnap.forEach((d) => remoteTickets.push(d.data() as MaintenanceTicket));
        localStorage.setItem('asset_mgmt_tickets', JSON.stringify(remoteTickets));
      }

      // 3. Periodic
      const periodicSnap = await getDocs(collection(db, 'periodic_records'));
      if (!periodicSnap.empty) {
        const remotePeriodic: PeriodicMaintenanceRecord[] = [];
        periodicSnap.forEach((d) => remotePeriodic.push(d.data() as PeriodicMaintenanceRecord));
        localStorage.setItem('asset_mgmt_periodic', JSON.stringify(remotePeriodic));
      }

      // 4. Audits
      const auditsSnap = await getDocs(collection(db, 'audit_sessions'));
      if (!auditsSnap.empty) {
        const remoteAudits: AuditSession[] = [];
        auditsSnap.forEach((d) => remoteAudits.push(d.data() as AuditSession));
        localStorage.setItem('asset_mgmt_audit_sessions', JSON.stringify(remoteAudits));
      }

      // 5. Users
      const usersSnap = await getDocs(collection(db, 'users'));
      if (!usersSnap.empty) {
        const remoteUsers: User[] = [];
        usersSnap.forEach((d) => remoteUsers.push(d.data() as User));
        localStorage.setItem('asset_mgmt_users', JSON.stringify(remoteUsers));
      }

      // 6. Categories
      const catSnap = await getDoc(doc(db, 'settings', 'categories'));
      if (catSnap.exists()) {
        const catData = catSnap.data();
        if (catData?.list) {
          localStorage.setItem('asset_mgmt_periodic_categories', JSON.stringify(catData.list));
        }
      }

      // 7. Surgical Sets
      const setsSnap = await getDocs(collection(db, 'surgical_sets'));
      if (!setsSnap.empty) {
        const remoteSets: SurgicalSet[] = [];
        setsSnap.forEach((d) => remoteSets.push(d.data() as SurgicalSet));
        localStorage.setItem('asset_mgmt_surgical_sets', JSON.stringify(remoteSets));
      }

      // 8. Surgical Instruments
      const instSnap = await getDocs(collection(db, 'surgical_instruments'));
      if (!instSnap.empty) {
        const remoteInsts: SurgicalInstrument[] = [];
        instSnap.forEach((d) => {
          const inst = d.data() as SurgicalInstrument;
          remoteInsts.push(inst);
          if (inst.imageUrl) {
            saveImageToDB(`inst_${inst.id}`, inst.imageUrl).catch(() => {});
            saveImageToDB(`code_${inst.code}`, inst.imageUrl).catch(() => {});
          }
        });
        localStorage.setItem('asset_mgmt_surgical_instruments', JSON.stringify(remoteInsts));
      }

      localStorage.setItem(LOCAL_SYNC_STORAGE.LAST_PROCESSED_TS, String(Date.now()));
      localStorage.setItem(LOCAL_SYNC_STORAGE.INITIALIZED_FLAG, 'true');

      if (this.onDataChangedCallback) {
        this.onDataChangedCallback();
      }

      return {
        success: true,
        message: 'تم تحميل وتحديث قاعدة البيانات السحابية بالكامل بنجاح',
      };
    } catch (err: any) {
      this.handleSyncError('pullAllCloudData', err);
      return { success: false, message: `فشل التحميل السحابي: ${err?.message}` };
    }
  }

  /**
   * If Firestore is completely empty and local storage has assets/data, push to Firestore
   */
  static async bootstrapCloudData(): Promise<void> {
    try {
      const metaSnap = await getDoc(doc(db, 'settings', 'sync_meta'));
      if (!metaSnap.exists()) {
        const localAssetsStr = localStorage.getItem('asset_mgmt_assets');
        const localAssets: Asset[] = localAssetsStr ? JSON.parse(localAssetsStr) : [];
        if (localAssets.length > 0) {
          await this.pushAllLocalDataToFirestore();
        } else {
          // Initialize empty meta doc
          await setDoc(doc(db, 'settings', 'sync_meta'), {
            version: 1,
            lastUpdated: new Date().toISOString(),
            recentChanges: [],
          });
        }
      }
    } catch (err) {
      this.handleSyncError('bootstrap', err);
    }
  }

  /**
   * Push an individual asset to Firestore + Emit Sync Pulse
   */
  static async syncAsset(asset: Asset): Promise<void> {
    try {
      const docRef = doc(db, 'assets', asset.id);
      await setDoc(docRef, cleanForFirestore(asset), { merge: true });
      await this.emitSyncChange({
        col: 'assets',
        id: asset.id,
        action: 'set',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('syncAsset', err);
    }
  }

  /**
   * Delete an asset from Firestore + Emit Sync Pulse
   */
  static async deleteAsset(assetId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'assets', assetId));
      await this.emitSyncChange({
        col: 'assets',
        id: assetId,
        action: 'delete',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('deleteAsset', err);
    }
  }

  /**
   * Push an individual ticket to Firestore + Emit Sync Pulse
   */
  static async syncTicket(ticket: MaintenanceTicket): Promise<void> {
    try {
      const docRef = doc(db, 'tickets', ticket.id);
      await setDoc(docRef, cleanForFirestore(ticket), { merge: true });
      await this.emitSyncChange({
        col: 'tickets',
        id: ticket.id,
        action: 'set',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('syncTicket', err);
    }
  }

  /**
   * Delete a ticket from Firestore + Emit Sync Pulse
   */
  static async deleteTicket(ticketId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'tickets', ticketId));
      await this.emitSyncChange({
        col: 'tickets',
        id: ticketId,
        action: 'delete',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('deleteTicket', err);
    }
  }

  /**
   * Push an individual periodic record to Firestore + Emit Sync Pulse
   */
  static async syncPeriodicRecord(record: PeriodicMaintenanceRecord): Promise<void> {
    try {
      const docRef = doc(db, 'periodic_records', record.id);
      await setDoc(docRef, cleanForFirestore(record), { merge: true });
      await this.emitSyncChange({
        col: 'periodic_records',
        id: record.id,
        action: 'set',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('syncPeriodicRecord', err);
    }
  }

  /**
   * Delete a periodic record from Firestore + Emit Sync Pulse
   */
  static async deletePeriodicRecord(recordId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'periodic_records', recordId));
      await this.emitSyncChange({
        col: 'periodic_records',
        id: recordId,
        action: 'delete',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('deletePeriodicRecord', err);
    }
  }

  /**
   * Push an audit session to Firestore + Emit Sync Pulse
   */
  static async syncAuditSession(session: AuditSession): Promise<void> {
    try {
      const docRef = doc(db, 'audit_sessions', session.id);
      await setDoc(docRef, cleanForFirestore(session), { merge: true });
      await this.emitSyncChange({
        col: 'audit_sessions',
        id: session.id,
        action: 'set',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('syncAuditSession', err);
    }
  }

  /**
   * Delete an audit session from Firestore + Emit Sync Pulse
   */
  static async deleteAuditSession(sessionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'audit_sessions', sessionId));
      await this.emitSyncChange({
        col: 'audit_sessions',
        id: sessionId,
        action: 'delete',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('deleteAuditSession', err);
    }
  }

  /**
   * Push user to Firestore + Emit Sync Pulse
   */
  static async syncUser(user: User): Promise<void> {
    try {
      const docRef = doc(db, 'users', user.id);
      await setDoc(docRef, cleanForFirestore(user), { merge: true });
      await this.emitSyncChange({
        col: 'users',
        id: user.id,
        action: 'set',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('syncUser', err);
    }
  }

  /**
   * Delete user from Firestore + Emit Sync Pulse
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', userId));
      await this.emitSyncChange({
        col: 'users',
        id: userId,
        action: 'delete',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('deleteUser', err);
    }
  }

  /**
   * Sync categories list + Emit Sync Pulse
   */
  static async syncCategories(categories: string[]): Promise<void> {
    try {
      const docRef = doc(db, 'settings', 'categories');
      await setDoc(docRef, { list: categories, updatedAt: new Date().toISOString() });
      await this.emitSyncChange({
        col: 'settings',
        id: 'categories',
        action: 'set',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('syncCategories', err);
    }
  }

  /**
   * Push an individual surgical set to Firestore + Emit Sync Pulse
   */
  static async syncSurgicalSet(set: SurgicalSet): Promise<void> {
    try {
      const docRef = doc(db, 'surgical_sets', set.id);
      await setDoc(docRef, cleanForFirestore(set), { merge: true });
      await this.emitSyncChange({
        col: 'surgical_sets',
        id: set.id,
        action: 'set',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('syncSurgicalSet', err);
    }
  }

  /**
   * Delete an individual surgical set from Firestore + Emit Sync Pulse
   */
  static async deleteSurgicalSet(setId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'surgical_sets', setId));
      await this.emitSyncChange({
        col: 'surgical_sets',
        id: setId,
        action: 'delete',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('deleteSurgicalSet', err);
    }
  }

  /**
   * Push an individual surgical instrument to Firestore + Emit Sync Pulse
   */
  static async syncSurgicalInstrument(instrument: SurgicalInstrument): Promise<void> {
    try {
      const docRef = doc(db, 'surgical_instruments', instrument.id);
      await setDoc(docRef, cleanForFirestore(instrument), { merge: true });
      await this.emitSyncChange({
        col: 'surgical_instruments',
        id: instrument.id,
        action: 'set',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('syncSurgicalInstrument', err);
    }
  }

  /**
   * Delete an individual surgical instrument from Firestore + Emit Sync Pulse
   */
  static async deleteSurgicalInstrument(instrumentId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'surgical_instruments', instrumentId));
      await this.emitSyncChange({
        col: 'surgical_instruments',
        id: instrumentId,
        action: 'delete',
        timestamp: Date.now(),
      });
    } catch (err) {
      this.handleSyncError('deleteSurgicalInstrument', err);
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
      const setsStr = localStorage.getItem('asset_mgmt_surgical_sets');
      const instStr = localStorage.getItem('asset_mgmt_surgical_instruments');

      const assets: Asset[] = assetsStr ? JSON.parse(assetsStr) : [];
      const tickets: MaintenanceTicket[] = ticketsStr ? JSON.parse(ticketsStr) : [];
      const periodic: PeriodicMaintenanceRecord[] = periodicStr ? JSON.parse(periodicStr) : [];
      const audits: AuditSession[] = auditsStr ? JSON.parse(auditsStr) : [];
      const users: User[] = usersStr ? JSON.parse(usersStr) : [];
      const categories: string[] = catStr ? JSON.parse(catStr) : [];
      const sets: SurgicalSet[] = setsStr ? JSON.parse(setsStr) : [];
      const instruments: SurgicalInstrument[] = instStr ? JSON.parse(instStr) : [];

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

      // Batch push surgical sets
      if (sets.length > 0) {
        for (let i = 0; i < sets.length; i += 250) {
          const batch = writeBatch(db);
          const chunk = sets.slice(i, i + 250);
          chunk.forEach((s) => {
            const ref = doc(db, 'surgical_sets', s.id);
            batch.set(ref, cleanForFirestore(s), { merge: true });
          });
          await batch.commit();
        }
      }

      // Batch push surgical instruments (with images)
      if (instruments.length > 0) {
        for (let i = 0; i < instruments.length; i += 100) {
          const batch = writeBatch(db);
          const chunk = instruments.slice(i, i + 100);
          chunk.forEach((inst) => {
            const ref = doc(db, 'surgical_instruments', inst.id);
            batch.set(ref, cleanForFirestore(inst), { merge: true });
          });
          await batch.commit();
        }
      }

      // Initialize/Reset Meta Doc
      await setDoc(doc(db, 'settings', 'sync_meta'), {
        version: 1,
        lastUpdated: new Date().toISOString(),
        recentChanges: [],
        assetsCount: assets.length,
        ticketsCount: tickets.length,
      });

      localStorage.setItem(LOCAL_SYNC_STORAGE.LAST_PROCESSED_TS, String(Date.now()));
      localStorage.setItem(LOCAL_SYNC_STORAGE.INITIALIZED_FLAG, 'true');

      this.isSyncing = false;
      return {
        success: true,
        message: `تمت المزامنة السحابية بنجاح (${assets.length} أصل، ${tickets.length} بلاغ، ${sets.length} سيت جراحي، ${instruments.length} أداة جراحية، ${users.length} مستخدم)`,
      };
    } catch (err: any) {
      this.isSyncing = false;
      this.handleSyncError('pushAllLocalDataToFirestore', err);
      return { success: false, message: `فشل رفع البيانات: ${err?.message || 'خطأ غير معروف'}` };
    }
  }

  /**
   * Reset / Clear Cloud database
   */
  static async clearAllCloudData(): Promise<void> {
    try {
      const collections = [
        'assets',
        'tickets',
        'periodic_records',
        'audit_sessions',
        'users',
        'surgical_sets',
        'surgical_instruments',
      ];
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await setDoc(doc(db, 'settings', 'sync_meta'), {
        version: 1,
        lastUpdated: new Date().toISOString(),
        recentChanges: [],
      });
    } catch (err) {
      this.handleSyncError('clearAllCloudData', err);
    }
  }
}
