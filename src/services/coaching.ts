import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { coachingToneForMood } from '@/services/mood';

const COACHING_STORAGE_KEY = 'daily_coaching_nudge';
const COACHING_TIMESTAMP_KEY = 'daily_coaching_timestamp';
const COACHING_MOOD_KEY = 'daily_coaching_mood';

export interface CoachingStats {
  streak: number;
  level: number;
  blocksYesterday: number;
  cleanHoursYesterday: number;
  recentBadge?: string;
  mood?: string;
}

export async function getDailyCoachingNudge(stats: CoachingStats): Promise<string> {
  const lastTimestamp = await AsyncStorage.getItem(COACHING_TIMESTAMP_KEY);
  const lastMood = await AsyncStorage.getItem(COACHING_MOOD_KEY);
  const now = Date.now();
  if (lastTimestamp && lastMood === (stats.mood ?? '') && now - Number(lastTimestamp) < 24 * 60 * 60 * 1000) {
    const cached = await AsyncStorage.getItem(COACHING_STORAGE_KEY);
    if (cached) return cached;
  }

  const apiKey = Constants.expoConfig?.extra?.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return getOfflineNudge(stats);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        system: `You are a supportive, non-judgmental digital wellness coach inside a screen time app.
Write a single short coaching message (2-3 sentences max) for the user based on their stats.
Be warm, encouraging, and specific to their numbers. Never be preachy. Focus on progress, not failure.
Use this tone: ${coachingToneForMood(stats.mood)}.
${stats.mood ? `The user recently reported feeling "${stats.mood}".` : ''}
Return plain text only - no formatting, no quotes.`,
        messages: [
          {
            role: 'user',
            content: `User stats: ${stats.streak} day streak, Level ${stats.level},
${stats.blocksYesterday} blocks yesterday, ${stats.cleanHoursYesterday} clean hours yesterday.
${stats.recentBadge ? `They just earned the "${stats.recentBadge}" badge.` : ''}
Write their daily coaching message.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return getOfflineNudge(stats);
    }

    const data = (await response.json()) as { content: Array<{ text: string }> };
    const message = data.content[0]?.text ?? getOfflineNudge(stats);

    await AsyncStorage.setItem(COACHING_STORAGE_KEY, message);
    await AsyncStorage.setItem(COACHING_TIMESTAMP_KEY, String(now));
    await AsyncStorage.setItem(COACHING_MOOD_KEY, stats.mood ?? '');

    return message;
  } catch {
    return getOfflineNudge(stats);
  }
}

function getOfflineNudge(stats: CoachingStats): string {
  if (stats.mood === 'tempted') {
    return `Make the next step small: keep protection on for 10 minutes and move away from the trigger. You only need to win this window.`;
  }
  if (stats.mood === 'stressed') {
    return `Stress makes old habits louder. Slow the next few minutes down, keep the blocker active, and give yourself a clean reset.`;
  }
  if (stats.mood === 'bored') {
    return `Boredom is a cue, not a command. Pick one offline action and let the blocker handle the noisy parts for a while.`;
  }
  if (stats.mood === 'tired') {
    return `Low energy calls for simple rules. Keep protection on and make tonight easy to finish clean.`;
  }
  if (stats.streak >= 30) {
    return `${stats.streak} days strong. That kind of consistency rewires habits at a deep level. Keep going.`;
  }
  if (stats.streak >= 7) {
    return `A full week clean! You're building real momentum. Every day makes the next one easier.`;
  }
  if (stats.streak >= 1) {
    return `${stats.streak} day${stats.streak > 1 ? 's' : ''} clean and counting. Each day is proof you can do this.`;
  }
  return `Today is a fresh start. One clean hour at a time - that's all it takes.`;
}
