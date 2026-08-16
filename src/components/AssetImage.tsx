import React, { useState, useEffect } from 'react';
import { ImageIcon, Maximize2, X } from 'lucide-react';
import { getImageFromDB } from '../services/storage';

// Global in-memory cache for ultra-fast instant synchronous rendering
const inMemoryImageCache = new Map<string, string>();

export function setMemoryImageCache(key: string, dataUrl: string) {
  if (key && dataUrl) {
    inMemoryImageCache.set(key.trim().toLowerCase(), dataUrl);
  }
}

export function getFromMemoryImageCache(key: string): string | undefined {
  if (!key) return undefined;
  return inMemoryImageCache.get(key.trim().toLowerCase());
}

/**
 * Transforms Google Drive viewing links into direct thumbnail/embed URLs
 */
export function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // If already a data URI or blob
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Google Drive format: https://drive.google.com/file/d/FILE_ID/view...
  const driveMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1000`;
  }

  // Google Drive format: id=FILE_ID
  const driveIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1] && trimmed.includes('drive.google.com')) {
    return `https://drive.google.com/thumbnail?id=${driveIdMatch[1]}&sz=w1000`;
  }

  return trimmed;
}

interface AssetImageProps {
  src?: string | null;
  customId?: string;
  serialNumber?: string;
  deviceName?: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  fallbackIconClassName?: string;
  showPlaceholderText?: boolean;
  enableLightbox?: boolean;
  onClick?: () => void;
}

export const AssetImage: React.FC<AssetImageProps> = ({
  src,
  customId,
  serialNumber,
  deviceName,
  alt = 'صورة الجهاز',
  className = 'w-full h-full object-cover',
  containerClassName = 'w-full h-full flex items-center justify-center relative bg-slate-100',
  fallbackIconClassName = 'w-10 h-10 text-slate-400 opacity-50',
  showPlaceholderText = true,
  enableLightbox = true,
  onClick,
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    // Initial check from memory cache or direct data URI
    if (src && (src.startsWith('data:') || src.startsWith('http'))) {
      return normalizeImageUrl(src);
    }
    if (customId) {
      const cached = getFromMemoryImageCache(customId);
      if (cached) return cached;
    }
    if (serialNumber) {
      const cached = getFromMemoryImageCache(serialNumber);
      if (cached) return cached;
    }
    return null;
  });

  const [hasError, setHasError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    // 1. Direct valid URL
    if (src && !src.startsWith('idb://')) {
      const normalized = normalizeImageUrl(src);
      if (normalized) {
        setResolvedSrc(normalized);
        if (customId) setMemoryImageCache(customId, normalized);
        return;
      }
    }

    // 2. Check in-memory cache first
    const keysToCheck = [
      src?.replace('idb://', ''),
      customId,
      serialNumber,
    ].filter(Boolean) as string[];

    for (const key of keysToCheck) {
      const cached = getFromMemoryImageCache(key);
      if (cached) {
        setResolvedSrc(cached);
        return;
      }
    }

    // 3. Query IndexedDB asynchronously
    setIsLoading(true);
    const fetchFromDB = async () => {
      try {
        for (const key of keysToCheck) {
          const dbData = await getImageFromDB(key);
          if (dbData && isMounted) {
            setResolvedSrc(dbData);
            setMemoryImageCache(key, dbData);
            if (customId) setMemoryImageCache(customId, dbData);
            setIsLoading(false);
            return;
          }
        }
        if (isMounted) {
          setResolvedSrc(null);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('AssetImage: failed to retrieve from IndexedDB', err);
        if (isMounted) {
          setResolvedSrc(null);
          setIsLoading(false);
        }
      }
    };

    fetchFromDB();

    return () => {
      isMounted = false;
    };
  }, [src, customId, serialNumber]);

  const handleImageClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    if (enableLightbox && resolvedSrc && !hasError) {
      e.stopPropagation();
      setShowLightbox(true);
    }
  };

  return (
    <>
      <div className={containerClassName}>
        {resolvedSrc && !hasError ? (
          <div className="w-full h-full relative group cursor-pointer" onClick={handleImageClick}>
            <img
              src={resolvedSrc}
              alt={alt || deviceName || customId || 'صورة الجهاز'}
              className={className}
              referrerPolicy="no-referrer"
              onError={async () => {
                // If it was an external URL that failed, try fallback to IndexedDB
                if (customId || serialNumber) {
                  const fallback = await getImageFromDB(customId || serialNumber || '');
                  if (fallback) {
                    setResolvedSrc(fallback);
                    return;
                  }
                }
                setHasError(true);
              }}
            />
            {enableLightbox && (
              <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="p-2 rounded-full bg-white/90 text-slate-800 shadow-md transform scale-90 group-hover:scale-100 transition-transform">
                  <Maximize2 className="w-4 h-4" />
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-slate-400 p-2 flex flex-col items-center justify-center">
            <ImageIcon className={fallbackIconClassName} />
            {showPlaceholderText && (
              <span className="text-[11px] mt-1 text-slate-400 font-medium">
                {isLoading ? 'جاري التحميل...' : 'لا توجد صورة'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {showLightbox && resolvedSrc && (
        <div
          className="fixed inset-0 z-[999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                {customId && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white text-xs font-mono font-bold">
                    ID: {customId}
                  </span>
                )}
                <span className="text-sm font-bold truncate max-w-md">
                  {deviceName || alt || 'معاينة صورة الجهاز'}
                </span>
              </div>
              <button
                onClick={() => setShowLightbox(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-[300px]">
              <img
                src={resolvedSrc}
                alt={alt || deviceName || 'صورة الجهاز'}
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
