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
import { saveImageToDB } from './storage';
import { Asset } from '../types';

// Initialize Firebase App safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

// Cache the access token in memory
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
  thumbnailLink?: string;
}

export interface DriveImageSyncReport {
  totalFound: number;
  matchedCount: number;
  unmatchedCount: number;
  details: {
    fileName: string;
    assetCode?: string;
    status: 'مطابق ومربوط' | 'لم يتم العثور على كود مطابق';
  }[];
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

  getGoogleUser(): FirebaseUser | null {
    return cachedGoogleUser || auth.currentUser;
  },

  getAccessToken(): string | null {
    return cachedAccessToken;
  },

  isConnected(): boolean {
    return !!(auth.currentUser && cachedAccessToken);
  },

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
      if (error?.code === 'auth/unauthorized-domain') {
        throw new Error('تم تفعيل الصلاحية بنجاح. يرجى تجربة تسجيل الدخول مجدداً أو فتح التطبيق في تبويب جديد.');
      }
      throw error;
    } finally {
      isSigningIn = false;
    }
  },

  async logout(): Promise<void> {
    await signOut(auth);
    cachedAccessToken = null;
    cachedGoogleUser = null;
  },

  /**
   * Locate or create the database folder on Google Drive
   * Checks for 'Hospital Database' first, then 'Hospital_Assets_Management'
   */
  async getOrCreateAppFolder(preferredName = 'Hospital Database'): Promise<string> {
    const token = cachedAccessToken;
    if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً لتفعيل Google Drive');

    // Search for 'Hospital Database' or 'Hospital_Assets_Management'
    const query = encodeURIComponent(
      `(name = '${preferredName}' or name = 'Hospital_Assets_Management' or name = 'Hospital Database') and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
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
        name: preferredName,
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
   * List all files in the Hospital Database folder
   */
  async listFilesInAppFolder(): Promise<GoogleDriveFile[]> {
    const token = cachedAccessToken;
    if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

    const folderId = await this.getOrCreateAppFolder();
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,size,webViewLink,thumbnailLink)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error('فشل استرجاع قائمة الملفات من Google Drive');
    }

    const data = await res.json();
    return data.files || [];
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

    const folderId = await this.getOrCreateAppFolder('Hospital Database');
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
   * Upload Comprehensive Excel file directly to Google Drive
   */
  async uploadExcelToDrive(
    excelBlob: Blob,
    fileName = 'قاعدة بيانات نظام الاصول والصيانة.xlsx'
  ): Promise<{ fileId: string; fileName: string; webViewLink?: string }> {
    const token = cachedAccessToken;
    if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

    const folderId = await this.getOrCreateAppFolder('Hospital Database');

    const metadata = {
      name: fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', excelBlob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    if (!res.ok) {
      throw new Error(`فشل رفع ملف الإكسل إلى Google Drive (${res.status})`);
    }

    const data = await res.json();
    return {
      fileId: data.id,
      fileName: data.name,
      webViewLink: data.webViewLink,
    };
  },

  /**
   * List all system backups stored on Google Drive
   */
  async listBackupsFromDrive(): Promise<GoogleDriveFile[]> {
    const files = await this.listFilesInAppFolder();
    return files.filter((f) => f.mimeType === 'application/json' || f.name.endsWith('.json') || f.name.endsWith('.xlsx'));
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
   * Sync Images directly from the Google Drive 'Hospital Database' folder
   * Matches images by filename/Code against assets
   */
  async syncImagesFromHospitalDatabase(
    assets: Asset[],
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<{ report: DriveImageSyncReport; updatedAssets: Asset[] }> {
    const token = cachedAccessToken;
    if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google أولاً');

    const allFiles = await this.listFilesInAppFolder();
    const imageFiles = allFiles.filter(
      (f) =>
        f.mimeType?.startsWith('image/') ||
        f.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i)
    );

    const report: DriveImageSyncReport = {
      totalFound: imageFiles.length,
      matchedCount: 0,
      unmatchedCount: 0,
      details: [],
    };

    if (imageFiles.length === 0) {
      return { report, updatedAssets: assets };
    }

    // Build map for fast matching by clean code / ID / name
    const cleanStr = (s: string) => s.toLowerCase().replace(/[\s\-_.:/()]/g, '').trim();
    const assetMap = new Map<string, number>();

    assets.forEach((a, idx) => {
      if (a.customId) assetMap.set(cleanStr(a.customId), idx);
      if (a.id) assetMap.set(cleanStr(a.id), idx);
      if (a.serialNumber && a.serialNumber !== 'غير محدد') assetMap.set(cleanStr(a.serialNumber), idx);
      if (a.deviceName) assetMap.set(cleanStr(a.deviceName), idx);
    });

    const updatedAssets = [...assets];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      if (onProgress) {
        onProgress(i + 1, imageFiles.length, file.name);
      }

      // Extract filename without extension
      const rawNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      const cleanedFileName = cleanStr(rawNameWithoutExt);

      let matchedIdx: number | undefined = assetMap.get(cleanedFileName);

      // Also try partial match
      if (matchedIdx === undefined) {
        for (const [key, idx] of assetMap.entries()) {
          if (cleanedFileName.includes(key) || key.includes(cleanedFileName)) {
            matchedIdx = idx;
            break;
          }
        }
      }

      if (matchedIdx !== undefined) {
        const targetAsset = updatedAssets[matchedIdx];
        try {
          // Download image blob from Google Drive
          const imgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (imgRes.ok) {
            const blob = await imgRes.blob();
            // Convert to base64 data URL
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            // Save to IndexedDB
            await saveImageToDB(targetAsset.customId, base64Data);
            if (targetAsset.serialNumber && targetAsset.serialNumber !== 'غير محدد') {
              await saveImageToDB(targetAsset.serialNumber, base64Data);
            }

            // Update asset imageUrl with idb reference or direct thumbnail link
            const directThumbnail = file.id ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000` : `idb://${targetAsset.customId}`;
            updatedAssets[matchedIdx] = {
              ...targetAsset,
              imageUrl: directThumbnail,
              updatedAt: new Date().toISOString(),
            };

            report.matchedCount++;
            report.details.push({
              fileName: file.name,
              assetCode: targetAsset.customId,
              status: 'مطابق ومربوط',
            });
          }
        } catch (e) {
          console.warn(`Failed to download drive image ${file.name}:`, e);
        }
      } else {
        report.unmatchedCount++;
        report.details.push({
          fileName: file.name,
          status: 'لم يتم العثور على كود مطابق',
        });
      }
    }

    return { report, updatedAssets };
  },
};
