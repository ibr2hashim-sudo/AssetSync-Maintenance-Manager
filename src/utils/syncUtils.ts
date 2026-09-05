/**
 * Utility functions to check and format Cloud Firestore synchronization status for items.
 */

export function isItemSynced(item?: { updatedAt?: string; syncedAt?: string } | null): boolean {
  if (!item) return false;
  if (!item.syncedAt) return false;

  // If item has no updatedAt, having syncedAt means it was pushed or pulled
  if (!item.updatedAt) return true;

  try {
    const syncTime = new Date(item.syncedAt).getTime();
    const updateTime = new Date(item.updatedAt).getTime();

    // If sync time is greater than or equal to update time (with 3-second buffer for timestamp clock variance)
    return syncTime >= updateTime - 3000;
  } catch {
    return true;
  }
}

export function formatSyncTimestamp(syncedAt?: string): string {
  if (!syncedAt) return 'لم تتم المزامنة بعد';
  try {
    const d = new Date(syncedAt);
    if (isNaN(d.getTime())) return 'غير محدد';
    return d.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: 'numeric',
      month: 'numeric',
    });
  } catch {
    return 'غير محدد';
  }
}
