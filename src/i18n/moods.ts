import type { MoodCheckIn } from '@/services/mood';
import type { TranslationKey } from './translations';

// Maps a mood value to its label key. The mood service stays UI/language-free;
// components translate at render time.
export function moodLabelKey(mood: MoodCheckIn): TranslationKey {
  return `mood.${mood}` as TranslationKey;
}
