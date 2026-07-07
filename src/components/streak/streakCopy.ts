import type { TranslationKey } from '@/i18n';

export type StreakPopupState = 'clean' | 'freeze' | 'freshStart';

// Copy lives as translation keys; the popup translates at render time so the
// same state machine serves both languages.

export function getStreakStatusKey(state: StreakPopupState): TranslationKey {
  switch (state) {
    case 'freeze':
      return 'streak.statusProtected';
    case 'freshStart':
      return 'streak.statusFresh';
    case 'clean':
    default:
      return 'streak.statusActive';
  }
}

export function getStreakButtonKey(state: StreakPopupState): TranslationKey {
  return state === 'freshStart' ? 'streak.buttonFresh' : 'progress.continue';
}

export function getStreakMotivationKey(streak: number, state: StreakPopupState): TranslationKey {
  if (state === 'freshStart') return 'streak.motivationFresh';
  if (state === 'freeze') return 'streak.motivationFreeze';
  if (streak <= 0) return 'streak.motivation0';
  if (streak === 1) return 'streak.motivation1';
  if (streak < 7) return 'streak.motivationUnder7';
  if (streak === 7) return 'streak.motivation7';
  if (streak < 30) return 'streak.motivationUnder30';
  if (streak < 60) return 'streak.motivationUnder60';
  if (streak < 90) return 'streak.motivationUnder90';
  return 'streak.motivation90';
}
