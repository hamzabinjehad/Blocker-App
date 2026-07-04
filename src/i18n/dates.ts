import type { Language } from './translations';

// Manual month/weekday tables. React Native's Hermes engine ships only a
// minimal Intl, so we don't rely on toLocaleDateString(locale) for non-English
// output — we format from these tables instead. Digits stay Western to match
// the rest of the UI (counters, stats), which never localizes numerals.

const WEEKDAYS_LONG: Record<Language, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};

const WEEKDAYS_SHORT: Record<Language, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ar: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
};

const MONTHS_SHORT: Record<Language, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};

function toDate(value: Date | number | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Weekday label for a 0–6 index (0 = Sunday). Used by calendar rows. */
export function weekdayShort(language: Language, dayIndex: number): string {
  return WEEKDAYS_SHORT[language][((dayIndex % 7) + 7) % 7]!;
}

/** "Monday, Jul 3" / "الاثنين، ٣ يوليو" — the home greeting date line. */
export function formatFullDate(value: Date | number | string, language: Language): string {
  const d = toDate(value);
  const weekday = WEEKDAYS_LONG[language][d.getDay()]!;
  const month = MONTHS_SHORT[language][d.getMonth()]!;
  const day = d.getDate();
  return language === 'ar' ? `${weekday}، ${day} ${month}` : `${weekday}, ${month} ${day}`;
}

/** "Jul 3" / "٣ يوليو" — compact date used in journey/progress. */
export function formatShortDate(value: Date | number | string, language: Language): string {
  const d = toDate(value);
  const month = MONTHS_SHORT[language][d.getMonth()]!;
  const day = d.getDate();
  return language === 'ar' ? `${day} ${month}` : `${month} ${day}`;
}
