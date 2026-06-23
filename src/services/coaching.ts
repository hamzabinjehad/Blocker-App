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

export async function getDailyCoachingNudge(stats: CoachingStats, forceRefresh = false): Promise<string> {
  const lastTimestamp = await AsyncStorage.getItem(COACHING_TIMESTAMP_KEY);
  const lastMood = await AsyncStorage.getItem(COACHING_MOOD_KEY);
  const now = Date.now();
  if (!forceRefresh && lastTimestamp && lastMood === (stats.mood ?? '') && now - Number(lastTimestamp) < 24 * 60 * 60 * 1000) {
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

const OFFLINE_TIPS = [
  `Your brain is literally rewiring itself each day you stay clean. Keep giving it the right signal.`,
  `One decision at a time. You don't need to commit to forever — just the next hour.`,
  `Protection is a boundary you set for yourself. Keeping it on is an act of self-respect.`,
  `The urge will pass whether you act on it or not. Your only job is to wait it out.`,
  `Small wins compound. The blocks you've racked up are proof that the system is working.`,
  `You are not your habits — you are the one who chose to change them. That's the whole story.`,
  `Momentum is real. Every clean day makes the next one slightly easier. Trust the process.`,
  `Distraction is not failure. Notice it, name it, and let the blocker do its job.`,
  `The best time to strengthen a habit is when it feels easy. The second best is right now.`,
  `Recovery is not linear. A hard day doesn't erase the progress already built in.`,
  `You already proved you can do this — every previous clean day is evidence.`,
  `What you resist persists when you fight it. Let the craving wave peak and fall on its own.`,
  `Your future self will thank today's version of you for staying the course.`,
  `Boredom is not an emergency. It is just a feeling that can be waited through.`,
  `The reason you installed this app is still true today. Remember what you are building toward.`,
  `Stress activates old circuits. That's normal. Keep your environment protected and ride it out.`,
  `A relapse in thought is not a relapse in action. Notice the thought, don't follow it.`,
  `Each time you surf an urge instead of acting on it, you weaken the old pathway a little.`,
  `You cannot fail your way out of recovery. Every session you open this app matters.`,
  `Your streak is not a number — it's a record of dozens of individual choices you made correctly.`,
  `Take the easiest protective action available right now. Lock the phone. Go for a walk. Done.`,
  `Compare yourself to last month, not to some idealized future version. The gap is already closing.`,
  `Sleep and food affect resistance more than willpower does. Protect the basics and the rest follows.`,
  `The trigger is not the problem. Your automatic response to it is what we're changing.`,
  `Every morning is a clean slate. Yesterday's score doesn't carry over.`,
  `Consistency over perfection. Show up imperfectly every day and watch what compounds.`,
  `The blocker is doing the heavy lifting so your willpower doesn't have to. Let it.`,
  `You built a routine by accident. You can build a better one on purpose — and you already are.`,
  `Notice what you're feeling right now without judging it. That's the whole practice.`,
  `Logging a hard day honestly is still progress. Self-awareness is the first and hardest step.`,
];

function getDailyOfflineTip(): string {
  const now = new Date();
  const seed = now.getFullYear() * 1000 + now.getMonth() * 31 + now.getDate();
  return OFFLINE_TIPS[seed % OFFLINE_TIPS.length]!;
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
  return getDailyOfflineTip();
}
