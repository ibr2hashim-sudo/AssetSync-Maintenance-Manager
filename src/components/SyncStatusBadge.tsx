import React, { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';
import { isItemSynced, formatSyncTimestamp } from '../utils/syncUtils';

interface SyncStatusBadgeProps {
  item?: { updatedAt?: string; syncedAt?: string } | null;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'pill' | 'icon-only' | 'inline';
  onSyncNow?: () => Promise<boolean | void> | void;
  className?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  item,
  size = 'sm',
  variant = 'pill',
  onSyncNow,
  className = '',
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const synced = isItemSynced(item);

  const handleSyncClick = async (e: React.MouseEvent) => {
    if (!onSyncNow || isSyncing) return;
    e.stopPropagation();
    try {
      setIsSyncing(true);
      await onSyncNow();
    } finally {
      setIsSyncing(false);
    }
  };

  const tooltipText = isSyncing
    ? 'جاري الرفع والمزامنة بالسحابة الآن...'
    : synced
    ? `✅ تم الرفع والمزامنة مع السحابة (${formatSyncTimestamp(item?.syncedAt)})`
    : '⏳ بانتظار المزامنة السحابية (انقر للمزامنة الفورية)';

  // Icon sizing
  const iconSize = size === 'xs' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  if (variant === 'icon-only') {
    return (
      <button
        type="button"
        onClick={handleSyncClick}
        disabled={!onSyncNow || isSyncing}
        title={tooltipText}
        className={`inline-flex items-center justify-center rounded-lg p-1 transition-all ${
          onSyncNow ? 'cursor-pointer hover:bg-slate-100 active:scale-95' : 'cursor-default'
        } ${className}`}
      >
        {isSyncing ? (
          <RefreshCw className={`${iconSize} text-blue-600 animate-spin`} />
        ) : synced ? (
          <span className="relative flex items-center justify-center">
            <Cloud className={`${iconSize} text-emerald-600`} />
            <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
          </span>
        ) : (
          <span className="relative flex items-center justify-center">
            <CloudOff className={`${iconSize} text-amber-500`} />
            <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-white animate-pulse" />
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSyncClick}
      disabled={!onSyncNow || isSyncing}
      title={tooltipText}
      className={`inline-flex items-center gap-1.5 font-bold rounded-full transition-all border shrink-0 ${
        size === 'xs'
          ? 'px-2 py-0.5 text-[10px]'
          : size === 'md'
          ? 'px-3 py-1 text-xs'
          : 'px-2.5 py-0.5 text-[11px]'
      } ${
        isSyncing
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : synced
          ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80'
          : 'bg-amber-50/90 text-amber-700 border-amber-200 hover:bg-amber-100/80'
      } ${onSyncNow ? 'cursor-pointer' : 'cursor-default'} ${className}`}
    >
      {isSyncing ? (
        <>
          <RefreshCw className={`${iconSize} animate-spin text-blue-600`} />
          <span>جاري المزامنة...</span>
        </>
      ) : synced ? (
        <>
          <Cloud className={`${iconSize} text-emerald-600`} />
          <span className="hidden sm:inline">مُزامن بالسحابة</span>
          <span className="sm:hidden">سحابي</span>
          <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
        </>
      ) : (
        <>
          <CloudOff className={`${iconSize} text-amber-500`} />
          <span className="hidden sm:inline">بانتظار الرفع</span>
          <span className="sm:hidden">معلق</span>
        </>
      )}
    </button>
  );
};
