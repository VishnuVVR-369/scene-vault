/**
 * Compact, human "time ago" phrasing for scene/folder timestamps shown around
 * the library. Display-only — it never touches stored data.
 */
export function formatRelativeTime(
  timestamp: number | null | undefined,
  now: number = Date.now(),
): string {
  if (!timestamp) {
    return "never";
  }

  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) {
    return "just now";
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.round(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.round(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  const years = Math.round(days / 365);
  return `${years}y ago`;
}
