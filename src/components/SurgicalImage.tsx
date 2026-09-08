import React, { useState, useEffect } from 'react';
import { getImageFromDB } from '../services/storage';

// In-memory cache for zero-latency synchronous re-rendering
const surgicalImageCache = new Map<string, string>();

export function setSurgicalImageCache(key: string, dataUrl: string) {
  if (key && dataUrl) {
    surgicalImageCache.set(key.trim().toLowerCase(), dataUrl);
  }
}

export function getSurgicalImageCache(key: string): string | undefined {
  if (!key) return undefined;
  return surgicalImageCache.get(key.trim().toLowerCase());
}

export function removeSurgicalImageCache(key: string) {
  if (!key) return;
  const k = key.trim().toLowerCase();
  surgicalImageCache.delete(k);
  surgicalImageCache.delete(key.trim());
}

export function purgeSurgicalImageCacheKeys(keys: string[]) {
  keys.forEach((k) => {
    if (!k) return;
    surgicalImageCache.delete(k.trim().toLowerCase());
    surgicalImageCache.delete(k.trim());
  });
}

export function clearSurgicalImageCache() {
  surgicalImageCache.clear();
}

/**
 * Resolves a surgical item image (instrument or set) from memory, data URI, or IndexedDB.
 * Returns null immediately if the item has no image specified.
 */
export async function resolveSurgicalImageUrl(item: {
  imageUrl?: string | null;
  code?: string;
  id?: string;
  setId?: string;
}): Promise<string | null> {
  const { imageUrl, code, id } = item;

  // Strict check: If item has NO imageUrl specified, it has NO image!
  // Never guess, search, or resurrect images for items without an image reference!
  if (!imageUrl || imageUrl.trim() === '') {
    return null;
  }

  // 1. Direct valid URL (base64, http, blob)
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('blob:')) {
    return imageUrl;
  }

  // 2. Resolve from IndexedDB / in-memory cache ONLY when an idb:// reference is present
  const keys: string[] = [];
  if (imageUrl.startsWith('idb://')) {
    const rawKey = imageUrl.replace('idb://', '').trim();
    if (rawKey) keys.push(rawKey);
  } else {
    keys.push(imageUrl.trim());
  }

  if (id) keys.push(`inst_${id}`);
  if (code) {
    keys.push(`code_${code}`);
    keys.push(code);
    keys.push(`set_${id}`);
    keys.push(`set_code_${code}`);
  }

  // Check in-memory cache first
  for (const k of keys) {
    const cached = getSurgicalImageCache(k);
    if (cached) return cached;
  }

  // Check IndexedDB
  for (const k of keys) {
    try {
      const dbData = await getImageFromDB(k);
      if (dbData) {
        setSurgicalImageCache(k, dbData);
        if (code) setSurgicalImageCache(code, dbData);
        return dbData;
      }
    } catch {
      // Continue to next key
    }
  }

  return null;
}

interface SurgicalImageProps {
  src?: string | null;
  code?: string;
  instrumentId?: string;
  setId?: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  fallbackIcon?: React.ReactNode;
  onClick?: () => void;
  title?: string;
  onResolved?: (url: string) => void;
}

export const SurgicalImage: React.FC<SurgicalImageProps> = ({
  src,
  code,
  instrumentId,
  setId,
  alt = 'صورة',
  className = 'w-full h-full object-cover',
  containerClassName = 'w-full h-full flex items-center justify-center relative',
  fallbackIcon,
  onClick,
  title,
  onResolved,
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    // If NO src, this item has NO image! Return null immediately.
    if (!src || src.trim() === '') {
      return null;
    }
    if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:')) {
      return src;
    }
    const targetKey = src.startsWith('idb://') ? src.replace('idb://', '').trim() : src.trim();
    const candidateKeys = [
      targetKey,
      instrumentId ? `inst_${instrumentId}` : '',
      code ? `code_${code}` : '',
      code,
      setId ? `set_${setId}` : '',
    ].filter(Boolean) as string[];

    for (const key of candidateKeys) {
      const cached = getSurgicalImageCache(key);
      if (cached) return cached;
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (!src || src.trim() === '') return false;
    return !resolvedSrc;
  });

  useEffect(() => {
    let isMounted = true;

    // If NO src or empty, immediately clear and stop loading
    if (!src || src.trim() === '') {
      setResolvedSrc(null);
      setIsLoading(false);
      return;
    }

    // If direct URI
    if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:')) {
      setResolvedSrc(src);
      setIsLoading(false);
      onResolved?.(src);
      return;
    }

    const targetKey = src.startsWith('idb://') ? src.replace('idb://', '').trim() : src.trim();
    const candidateKeys = [
      targetKey,
      instrumentId ? `inst_${instrumentId}` : '',
      code ? `code_${code}` : '',
      code,
      setId ? `set_${setId}` : '',
      code ? `set_code_${code}` : '',
    ].filter(Boolean) as string[];

    // Check memory cache
    for (const key of candidateKeys) {
      const cached = getSurgicalImageCache(key);
      if (cached) {
        setResolvedSrc(cached);
        setIsLoading(false);
        onResolved?.(cached);
        return;
      }
    }

    // Query IndexedDB
    setIsLoading(true);
    let found = false;

    (async () => {
      for (const key of candidateKeys) {
        try {
          const dbData = await getImageFromDB(key);
          if (dbData && isMounted) {
            setResolvedSrc(dbData);
            candidateKeys.forEach((k) => setSurgicalImageCache(k, dbData));
            setIsLoading(false);
            onResolved?.(dbData);
            found = true;
            break;
          }
        } catch {
          // ignore
        }
      }

      if (isMounted && !found) {
        setResolvedSrc(null);
        setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [src, code, instrumentId, setId]);

  if (isLoading && !resolvedSrc) {
    return (
      <div className={containerClassName}>
        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  if (!resolvedSrc) {
    return <div className={containerClassName}>{fallbackIcon}</div>;
  }

  return (
    <div className={containerClassName} onClick={onClick} title={title}>
      <img
        src={resolvedSrc}
        alt={alt}
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setResolvedSrc(null)}
      />
    </div>
  );
};
