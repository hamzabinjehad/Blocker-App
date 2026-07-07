import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import type { Language } from '@/i18n';
import { coachingToneForMood } from '@/services/mood';

const COACHING_STORAGE_KEY = 'daily_coaching_nudge';
const COACHING_TIMESTAMP_KEY = 'daily_coaching_timestamp';
const COACHING_MOOD_KEY = 'daily_coaching_mood';
const COACHING_LANG_KEY = 'daily_coaching_lang';

export interface CoachingStats {
  streak: number;
  level: number;
  blocksYesterday: number;
  cleanHoursYesterday: number;
  recentBadge?: string;
  mood?: string;
}

export async function getDailyCoachingNudge(
  stats: CoachingStats,
  language: Language = 'en',
  forceRefresh = false,
): Promise<string> {
  const [lastTimestamp, lastMood, lastLang] = await Promise.all([
    AsyncStorage.getItem(COACHING_TIMESTAMP_KEY),
    AsyncStorage.getItem(COACHING_MOOD_KEY),
    AsyncStorage.getItem(COACHING_LANG_KEY),
  ]);
  const now = Date.now();
  const cacheFresh =
    !forceRefresh &&
    lastTimestamp &&
    lastMood === (stats.mood ?? '') &&
    lastLang === language &&
    now - Number(lastTimestamp) < 24 * 60 * 60 * 1000;
  if (cacheFresh) {
    const cached = await AsyncStorage.getItem(COACHING_STORAGE_KEY);
    if (cached) return cached;
  }

  const apiKey = Constants.expoConfig?.extra?.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return getOfflineNudge(stats, language);
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
${language === 'ar' ? 'Respond in Modern Standard Arabic.' : 'Respond in English.'}
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
      return getOfflineNudge(stats, language);
    }

    const data = (await response.json()) as { content: Array<{ text: string }> };
    const message = data.content[0]?.text ?? getOfflineNudge(stats, language);

    await AsyncStorage.multiSet([
      [COACHING_STORAGE_KEY, message],
      [COACHING_TIMESTAMP_KEY, String(now)],
      [COACHING_MOOD_KEY, stats.mood ?? ''],
      [COACHING_LANG_KEY, language],
    ]);

    return message;
  } catch {
    return getOfflineNudge(stats, language);
  }
}

const OFFLINE_TIPS_EN = [
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

const OFFLINE_TIPS_AR = [
  `دماغك يعيد تشكيل نفسه حرفياً مع كل يوم نظيف. واصل إعطاءه الإشارة الصحيحة.`,
  `قرار واحد في كل مرة. لا تحتاج أن تلتزم إلى الأبد — الساعة القادمة تكفي.`,
  `الحماية حدٌّ وضعته لنفسك. إبقاؤها مُفعّلة احترامٌ لذاتك.`,
  `الرغبة ستمرّ سواء استجبت لها أم لا. مهمتك الوحيدة أن تنتظرها حتى تمرّ.`,
  `المكاسب الصغيرة تتراكم. عمليات الحجب التي جمعتها دليل على أن النظام يعمل.`,
  `أنت لست عاداتك — أنت من اختار تغييرها. وهذه القصة كلها.`,
  `الزخم حقيقي. كل يوم نظيف يجعل الذي يليه أسهل قليلاً. ثق بالمسار.`,
  `التشتت ليس فشلاً. الحظه، سمّه، ودع الحاجب يقوم بعمله.`,
  `أفضل وقت لتقوية عادة هو حين تبدو سهلة. وثاني أفضل وقت هو الآن.`,
  `التعافي ليس خطاً مستقيماً. اليوم الصعب لا يمحو التقدم الذي بنيته.`,
  `أثبتَّ سابقاً أنك قادر — كل يوم نظيف مضى هو الدليل.`,
  `ما تقاومه بعناد يشتد. دع موجة الرغبة تبلغ ذروتها وتنحسر وحدها.`,
  `نسختك المستقبلية ستشكر نسخة اليوم لأنها ثبتت على الطريق.`,
  `الملل ليس حالة طوارئ. هو مجرد شعور يمكن الانتظار حتى يمضي.`,
  `السبب الذي ثبّت لأجله هذا التطبيق ما يزال قائماً اليوم. تذكّر ما الذي تبنيه.`,
  `التوتر يوقظ الدوائر القديمة. هذا طبيعي. أبقِ بيئتك محمية واعبر الموجة.`,
  `الانتكاسة في الفكرة ليست انتكاسة في الفعل. لاحظ الفكرة ولا تتبعها.`,
  `في كل مرة تركب فيها الرغبة بدل الاستجابة لها، تُضعف المسار القديم قليلاً.`,
  `لا يمكنك أن تفشل خارج التعافي. كل مرة تفتح فيها هذا التطبيق لها قيمة.`,
  `سلسلتك ليست رقماً — إنها سجل عشرات الاختيارات الفردية التي أصبتَ فيها.`,
  `اتخذ أسهل خطوة حماية متاحة الآن. أقفل الهاتف. اخرج للمشي. انتهى.`,
  `قارن نفسك بالشهر الماضي، لا بنسخة مثالية متخيَّلة. الفجوة تضيق بالفعل.`,
  `النوم والطعام يؤثران في المقاومة أكثر من الإرادة. احمِ الأساسيات والباقي يتبع.`,
  `المحفّز ليس هو المشكلة. استجابتك التلقائية له هي ما نغيّره.`,
  `كل صباح صفحة نظيفة. نتيجة الأمس لا تنتقل إلى اليوم.`,
  `الاستمرارية قبل الكمال. احضر كل يوم ولو بشكل ناقص وراقب ما يتراكم.`,
  `الحاجب يحمل العبء الثقيل حتى لا تضطر إرادتك لذلك. دعه يعمل.`,
  `بنيتَ روتيناً بالمصادفة. يمكنك بناء روتين أفضل عن قصد — وأنت تفعل ذلك بالفعل.`,
  `لاحظ ما تشعر به الآن دون حكم. هذه هي الممارسة كلها.`,
  `تسجيل يوم صعب بصدق تقدّمٌ أيضاً. الوعي بالذات أول الخطوات وأصعبها.`,
];

function getDailyOfflineTip(language: Language): string {
  const tips = language === 'ar' ? OFFLINE_TIPS_AR : OFFLINE_TIPS_EN;
  const now = new Date();
  const seed = now.getFullYear() * 1000 + now.getMonth() * 31 + now.getDate();
  return tips[seed % tips.length]!;
}

function getOfflineNudge(stats: CoachingStats, language: Language): string {
  if (language === 'ar') {
    if (stats.mood === 'tempted') {
      return `اجعل الخطوة التالية صغيرة: أبقِ الحماية مُفعّلة عشر دقائق وابتعد عن المحفّز. يكفي أن تكسب هذه النافذة فقط.`;
    }
    if (stats.mood === 'stressed') {
      return `التوتر يرفع صوت العادات القديمة. هدّئ الدقائق القادمة، وأبقِ الحاجب فعّالاً، وامنح نفسك بداية نظيفة.`;
    }
    if (stats.mood === 'bored') {
      return `الملل إشارة لا أمر. اختر فعلاً واحداً بعيداً عن الشاشة ودع الحاجب يتكفل بالضجيج.`;
    }
    if (stats.mood === 'tired') {
      return `الطاقة المنخفضة تحتاج قواعد بسيطة. أبقِ الحماية مُفعّلة واجعل إنهاء الليلة نظيفةً أمراً سهلاً.`;
    }
    if (stats.streak >= 30) {
      return `${stats.streak} يوماً من الثبات. هذا النوع من الاستمرارية يعيد تشكيل العادات في العمق. واصل.`;
    }
    if (stats.streak >= 7) {
      return `أسبوع كامل نظيف! أنت تبني زخماً حقيقياً. كل يوم يجعل الذي يليه أسهل.`;
    }
    if (stats.streak >= 1) {
      return `${stats.streak} من الأيام النظيفة والعدّ مستمر. كل يوم دليل جديد أنك قادر.`;
    }
    return getDailyOfflineTip(language);
  }

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
  return getDailyOfflineTip(language);
}
