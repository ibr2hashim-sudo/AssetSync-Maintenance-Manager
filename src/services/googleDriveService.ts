import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

// Cache the access token in memory (do NOT store in localStorage)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: FirebaseUser | null = null;
let isSigningIn = false;

// SCOPES definition for tracking
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

export const GoogleDriveService = {
  /**
   * Listen to Firebase auth state changes
   */
  initAuth(
    onSuccess?: (user: FirebaseUser, token: string | null) => void,
    onLoggedOut?: () => void
  ) {
    return onAuthStateChanged(auth, async (user) => {
      cachedGoogleUser = user;
      if (user) {
        if (onSuccess) onSuccess(user, cachedAccessToken);
      } else {
        cachedAccessToken = null;
        if (onLoggedOut) onLoggedOut();
      }
    });
  },

  /**
   * Returns current authenticated Google user
   */
  getGoogleUser(): FirebaseUser | null {
    return cachedGoogleUser || auth.currentUser;
  },

  /**
   * Returns current memory cached access token
   */
  getAccessToken(): string | null {
    return cachedAccessToken;
  },

  /**
   * Check if connected to Google Drive with active access token
   */
  isConnected(): boolean {
    return !!(auth.currentUser && cachedAccessToken);
  },

  /**
   * Sign In with Google popup and obtain access token
   */
  async signIn(): Promise<{ user: FirebaseUser; accessToken: string }> {
    try {
      isSigningIn = true;
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('لم يتم استلام مفتاح الصلاحية (Access Token) من Google');
      }
      cachedAccessToken = credential.accessToken;
      cachedGoogleUser = result.user;
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
      throw error;
    } finally {
      isSigningIn = false;
    }
  },

  /**
   * Sign out from Google
   */
  async logout(): Promise<void> {
    await signOut(auth);
    cachedAccessToken = null;
    cachedGoogleUser = null;
  },

  /**
   * Create or locate dedicated folder on Google Drive
   */
  async getOrCreateAppFolder(folderName = 'Hospital_Assets_Management'): Promise<string> {
    const token = cachedAccessToken;
    if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً لتفعيل Google Drive');

    // Search for existing folder
    const query = encodeURIComponent(
      `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    );
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        cachedAccessToken = null;
        throw new Error('انتهت صلاحية جلسة Google، يرجى إعادة تسجيل الدخول بحسابك');
      }
      throw new Error(`تعذر الوصول إلى Google Drive (${res.status})`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create new folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      throw new Error('فشل إنشاء مجلد النظام في Google Drive');
    }

    const createdFolder = await createRes.json();
    return createdFolder.id;
  },

  /**
   * Upload database JSON backup to Google Drive
   */
  async uploadBackupToDrive(
    backupData: any,
    customFileName?: string
  ): Promise<{ fileId: string; fileName: string; webViewLink?: string }> {
    const token = cachedAccessToken;
    if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

    const folderId = await this.getOrCreateAppFolder();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = customFileName || `Assets_System_Backup_${dateStr}.json`;
    const jsonContent = JSON.stringify(backupData, null, 2);

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId],
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonContent +
      closeDelimiter;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      throw new Error(`فشل رفع النسخة الاحتياطية إلى Google Drive (${res.status})`);
    }

    const result = await res.json();
    return {
      fileId: result.id,
      fileName: result.name,
      webViewLink: result.webViewLink,
    };
  },

  /**
   * List all system backups stored on Google Drive
   */
  async listBackupsFromDrive(): Promise<GoogleDriveFile[]> {
    const token = cachedAccessToken;
    if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

    const folderId = await this.getOrCreateAppFolder();
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error('فشل استرجاع قائمة النسخ الاحتياطية من Google Drive');
    }

    const data = await res.json();
    return data.files || [];
  },

  /**
   * Download and parse backup JSON file from Google Drive
   */
  async downloadBackupContent(fileId: string): Promise<any> {
    const token = cachedAccessToken;
    if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error('فشل تنزيل ملف النسخة الاحتياطية من Google Drive');
    }

    return await res.json();
  },

  /**
   * Upload an asset image directly to Google Drive
   */
  async uploadImageToDrive(
    customId: string,
    base64DataUrl: string
  ): Promise<{ fileId: string; webViewLink?: string }> {
    const token = cachedAccessToken;
    if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

    const folderId = await this.getOrCreateAppFolder();
    const cleanBase64 = base64DataUrl.split(',')[1] || base64DataUrl;
    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    const metadata = {
      name: `asset_${customId}_image.jpg`,
      mimeType: 'image/jpeg',
      parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    if (!res.ok) {
      throw new Error(`فشل رفع صورة الجهاز إلى Google Drive (${res.status})`);
    }

    const data = await res.json();
    return {
      fileId: data.id,
      webViewLink: data.webViewLink,
    };
  },
};
