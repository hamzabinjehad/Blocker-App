import AsyncStorage from '@react-native-async-storage/async-storage';

export type MoodCheckIn =
  | 'terrible' | 'excellent' | 'bad' | 'great' | 'down' | 'neutral'
  | 'steady' | 'stressed' | 'bored' | 'tempted' | 'tired'; // legacy

const MOOD_STORAGE_KEY = 'mood_check_in';
const MOOD_DATE_STORAGE_KEY = 'mood_check_in_date';
const MOOD_NOTE_KEY = 'mood_check_in_note';
const MOOD_NOTE_DATE_KEY = 'mood_check_in_note_date';

export const moodOptions: Array<{ value: MoodCheckIn; label: string }> = [
  { value: 'terrible', label: 'Terrible' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'bad', label: 'Bad' },
  { value: 'great', label: 'Great' },
  { value: 'down', label: 'Down' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'steady', label: 'Steady' },
  { value: 'stressed', label: 'Stressed' },
  { value: 'bored', label: 'Bored' },
  { value: 'tempted', label: 'Tempted' },
  { value: 'tired', label: 'Tired' },
];

export async function getStoredMood(): Promise<MoodCheckIn> {
  const value = await AsyncStorage.getItem(MOOD_STORAGE_KEY);
  return isMood(value) ? value : 'neutral';
}

export async function getTodaysMood(): Promise<MoodCheckIn | null> {
  const [value, date] = await Promise.all([
    AsyncStorage.getItem(MOOD_STORAGE_KEY),
    AsyncStorage.getItem(MOOD_DATE_STORAGE_KEY),
  ]);
  const today = new Date().toISOString().split('T')[0];
  return date === today && isMood(value) ? value : null;
}

export async function getTodaysMoodNote(): Promise<string | null> {
  const [note, date] = await Promise.all([
    AsyncStorage.getItem(MOOD_NOTE_KEY),
    AsyncStorage.getItem(MOOD_NOTE_DATE_KEY),
  ]);
  const today = new Date().toISOString().split('T')[0];
  return date === today ? note : null;
}

export async function saveMood(mood: MoodCheckIn, note?: string) {
  const today = new Date().toISOString().split('T')[0];
  const pairs: [string, string][] = [
    [MOOD_STORAGE_KEY, mood],
    [MOOD_DATE_STORAGE_KEY, today],
  ];
  if (note !== undefined) {
    pairs.push([MOOD_NOTE_KEY, note], [MOOD_NOTE_DATE_KEY, today]);
  }
  await AsyncStorage.multiSet(pairs);
}

export function isMood(value: unknown): value is MoodCheckIn {
  const valid: MoodCheckIn[] = [
    'terrible', 'excellent', 'bad', 'great', 'down', 'neutral',
    'steady', 'stressed', 'bored', 'tempted', 'tired',
  ];
  return typeof value === 'string' && valid.includes(value as MoodCheckIn);
}

export function coachingToneForMood(mood?: string) {
  switch (mood) {
    case 'stressed':
    case 'bad':
    case 'down':
      return 'calm';
    case 'bored':
      return 'activation';
    case 'tempted':
    case 'terrible':
      return 'urgent_support';
    case 'tired':
      return 'gentle';
    default:
      return 'steady';
  }
}
