import AsyncStorage from '@react-native-async-storage/async-storage';

export type MoodCheckIn = 'steady' | 'stressed' | 'bored' | 'tempted' | 'tired';

const MOOD_STORAGE_KEY = 'mood_check_in';

export const moodOptions: Array<{ value: MoodCheckIn; label: string }> = [
  { value: 'steady', label: 'Steady' },
  { value: 'stressed', label: 'Stressed' },
  { value: 'bored', label: 'Bored' },
  { value: 'tempted', label: 'Tempted' },
  { value: 'tired', label: 'Tired' },
];

export async function getStoredMood(): Promise<MoodCheckIn> {
  const value = await AsyncStorage.getItem(MOOD_STORAGE_KEY);
  return isMood(value) ? value : 'steady';
}

export async function saveMood(mood: MoodCheckIn) {
  await AsyncStorage.setItem(MOOD_STORAGE_KEY, mood);
}

export function isMood(value: unknown): value is MoodCheckIn {
  return typeof value === 'string' && moodOptions.some((option) => option.value === value);
}

export function coachingToneForMood(mood?: string) {
  switch (mood) {
    case 'stressed':
      return 'calm';
    case 'bored':
      return 'activation';
    case 'tempted':
      return 'urgent_support';
    case 'tired':
      return 'gentle';
    default:
      return 'steady';
  }
}
