/**
 * Cloud Image Compressor Utility
 * Optimizes images for direct Firestore storage (typically 25KB - 45KB per image).
 * Ensures crisp visual quality while keeping Firestore document sizes minimal (<5% of 1MB limit).
 */

export async function compressImageForCloud(
  source: string | File | Blob,
  maxDimension = 750,
  quality = 0.72
): Promise<string> {
  if (!source) return '';

  return new Promise((resolve) => {
    try {
      // 1. Convert File/Blob to DataURL if needed
      if (typeof source !== 'string') {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            compressDataUrl(reader.result, maxDimension, quality)
              .then(resolve)
              .catch(() => resolve(reader.result as string));
          } else {
            resolve('');
          }
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(source);
        return;
      }

      // 2. If it's already a string
      const str = source.trim();
      if (!str) {
        resolve('');
        return;
      }

      // If it's an idb:// reference or an http URL, return as-is
      if (str.startsWith('idb://') || str.startsWith('http://') || str.startsWith('https://')) {
        resolve(str);
        return;
      }

      // If it's a data URL, compress it
      compressDataUrl(str, maxDimension, quality)
        .then(resolve)
        .catch(() => resolve(str));
    } catch {
      resolve(typeof source === 'string' ? source : '');
    }
  });
}

function compressDataUrl(dataUrl: string, maxDimension: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's already a tiny JPEG data URI (< 40KB), resolve directly
    if (dataUrl.startsWith('data:image/jpeg') && dataUrl.length < 55000) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (!width || !height) {
          resolve(dataUrl);
          return;
        }

        // Calculate aspect ratio scale
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Clean white background behind transparent PNGs to prevent black artifacts
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (err) {
        console.warn('Canvas compression failed, returning original:', err);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      // In case image loading fails, return original dataUrl
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

export function getImageSizeKb(dataUrl: string): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) return 0;
  return Math.round((dataUrl.length * (3 / 4)) / 1024);
}
