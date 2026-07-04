import type { TranslationKey } from './translations';

// Maps a numeric level to its localized name key. Shared by the home hero and
// the progress screen so the two never drift apart.
const LEVEL_NAME_KEYS: TranslationKey[] = [
  'level.starting',
  'level.aware',
  'level.steady',
  'level.resilient',
  'level.grounded',
  'level.strong',
];

export function levelNameKey(level: number): TranslationKey {
  return LEVEL_NAME_KEYS[Math.min(Math.max(0, level), LEVEL_NAME_KEYS.length - 1)] ?? 'level.resilient';
}
