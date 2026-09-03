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

/**
 * Resolves a surgical item image (instrument or set) from memory, data URI, or IndexedDB
 */
export async function resolveSurgicalImageUrl(item: {
  imageUrl?: string | null;
  code?: string;
  id?: string;
  setId?: string;
}): Promise<string | null> {
  const { imageUrl, code, id } = item;

  // 1. Direct valid URL
  if (imageUrl && (imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('blob:'))) {
    return imageUrl;
  }

  // 2. Candidate keys
  const keys: string[] = [];
  if (imageUrl && imageUrl.startsWith('idb://')) {
    keys.push(imageUrl.replace('idb://', ''));
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
    if (src && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:'))) {
      return src;
    }
    const candidateKeys = [
      src?.replace('idb://', ''),
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

  const [isLoading, setIsLoading] = useState(!resolvedSrc);

  useEffect(() => {
    let isMounted = true;

    // If direct URI
    if (src && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:'))) {
      setResolvedSrc(src);
      setIsLoading(false);
      onResolved?.(src);
      return;
    }

    const candidateKeys = [
      src?.replace('idb://', ''),
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
