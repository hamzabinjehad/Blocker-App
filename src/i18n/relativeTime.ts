import type { Language } from './translations';

// Compact "5m ago"-style label. Lives outside the string table because it needs
// number interpolation, which the flat t() lookup doesn't support.
export function relativeTimeLabel(language: Language, timestamp: number, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  if (language === 'ar') {
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `قبل ${minutes} د`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `قبل ${hours} س`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'قبل يوم' : `قبل ${days} أيام`;
  }
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
