import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific databaseId and long polling auto-detection for reliable web/iframe connectivity
function initFirestoreInstance() {
  const dbId = firebaseConfig.firestoreDatabaseId || undefined;
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    }, dbId);
  } catch {
    return getFirestore(app, dbId);
  }
}

export const db = initFirestoreInstance();

/**
 * Validates connection to Firestore on startup as mandated by Firebase integration guidelines
 */
export async function testFirestoreConnection(): Promise<{ ok: boolean; error?: string; isOffline?: boolean; isQuota?: boolean }> {
  try {
    await getDocFromServer(doc(db, 'settings', 'sync_meta'));
    return { ok: true };
  } catch (error: any) {
    const msg = error?.message || String(error || '');
    const isQuota =
      msg.includes('Quota exceeded') ||
      msg.includes('resource-exhausted') ||
      msg.includes('quota metric') ||
      error?.code === 'resource-exhausted';
    const isOffline =
      msg.includes('offline') ||
      msg.includes('unavailable') ||
      error?.code === 'unavailable';

    if (isOffline) {
      console.warn('Firestore operating in local offline mode.');
    } else if (isQuota) {
      console.warn('Firestore daily read quota reached; using local persistence.');
    } else {
      console.error('Firestore connection check:', msg);
    }
    return { ok: false, error: msg, isOffline, isQuota };
  }
}

// Silently test connection on startup
testFirestoreConnection().catch(() => {});

export default app;

