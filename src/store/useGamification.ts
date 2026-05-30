import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Badge {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
  earnedAt?: number;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  clean: boolean;
  xpEarned: number;
  blocksCount: number;
  freezeUsed?: boolean;
  relapseLogged?: boolean;
  journalWritten?: boolean;
  moodCheckedIn?: boolean;
  urgesSurfed?: number;
}

export interface WeeklyStreak {
  weekStart: string;
  cleanDays: number;
  complete: boolean;
}

export interface MonthlyStreak {
  month: string; // YYYY-MM
  cleanDays: number;
  totalDays: number;
  complete: boolean;
}

export interface WeeklyBlockCount {
  date: string;
  label: string;
  blocks: number;
}

export interface Milestone {
  id: string;
  label: string;
  description: string;
  icon: string;
  requirement: number;
  type: 'streak' | 'blocks' | 'xp' | 'level' | 'urges' | 'clean_hours';
  reached: boolean;
  reachedAt?: number;
  xpReward: number;
}

export interface GamificationState {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  todayCleanHours: number;
  totalCleanHours: number;
  totalBlocksLifetime: number;
  badges: Badge[];
  milestones: Milestone[];
  lastXpAwardedAt: number;
  lastCleanDayRecordedAt: number;
  urgesSurfed: number;
  dayHistory: DayRecord[];
  weeklyStreaks: WeeklyStreak[];
  monthlyStreaks: MonthlyStreak[];
  currentWeekCleanDays: number;
  currentMonthCleanDays: number;
  streakMultiplier: number;
  lastStreakFreezeAt: number;
}

const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000,
  13000, 17000, 22000, 28000, 35000, 45000, 60000, 80000, 100000, 150000,
];

const LEVEL_NAMES = [
  '', 'Newcomer', 'Committed', 'Grounded', 'Aware', 'Aware',
  'Steady', 'Focused', 'Balanced', 'Resilient', 'Resilient',
  'Anchored', 'Clear', 'Brave', 'Strong', 'Strong',
  'Renewed', 'Trusted', 'Whole', 'Free', 'Free',
];

const BADGE_DEFS = [
  { id: 'first_day', label: '1st clean day', icon: 'ðŸŒ±', streakRequired: 1 },
  { id: 'three_day', label: '3-day streak', icon: 'ðŸŒ¿', streakRequired: 3 },
  { id: 'week_warrior', label: '7-day streak', icon: 'ðŸ”¥', streakRequired: 7 },
  { id: 'two_weeks', label: '14-day streak', icon: 'â­', streakRequired: 14 },
  { id: 'month_master', label: '30-day streak', icon: 'ðŸ’Ž', streakRequired: 30 },
  { id: 'quarter_king', label: '90-day streak', icon: 'ðŸ‘‘', streakRequired: 90 },
  { id: 'year_legend', label: '365-day streak', icon: 'ðŸ†', streakRequired: 365 },
  { id: 'centurion', label: '100 blocks', icon: 'ðŸ›¡', blocksRequired: 100 },
  { id: 'five_hundred_blocks', label: '500 blocks', icon: 'ðŸ°', blocksRequired: 500 },
  { id: 'thousand_blocks', label: '1000 blocks', icon: 'âš”ï¸', blocksRequired: 1000 },
  { id: 'level_5', label: 'Level 5', icon: 'âš¡', levelRequired: 5 },
  { id: 'level_10', label: 'Level 10', icon: 'ðŸŒŸ', levelRequired: 10 },
  { id: 'level_15', label: 'Level 15', icon: 'ðŸ’«', levelRequired: 15 },
  { id: 'iron_will', label: '7 urges surfed', icon: 'ðŸ§ ', urgesRequired: 7 },
  { id: 'steel_mind', label: '25 urges surfed', icon: 'ðŸ”®', urgesRequired: 25 },
  { id: 'diamond_focus', label: '100 urges surfed', icon: 'ðŸ’ ', urgesRequired: 100 },
  { id: 'clean_100h', label: '100 clean hours', icon: 'â°', cleanHoursRequired: 100 },
  { id: 'clean_500h', label: '500 clean hours', icon: 'ðŸ•', cleanHoursRequired: 500 },
  { id: 'weekly_perfect', label: 'Perfect week', icon: 'ðŸ“…', weeklyPerfectRequired: 1 },
  { id: 'monthly_perfect', label: 'Perfect month', icon: 'ðŸ—“ï¸', monthlyPerfectRequired: 1 },
] as const;

const RECOVERY_BADGE_DEFS = [
  { id: 'first_block', label: 'First Block', icon: 'shield', blocksRequired: 1 },
  { id: 'first_day', label: 'First clean day', icon: 'check', streakRequired: 1 },
  { id: 'surfer', label: 'Surfer', icon: 'wave', urgesRequired: 10 },
  { id: 'milestone_7', label: '7 days', icon: 'streak', streakRequired: 7 },
  { id: 'milestone_14', label: '14 days', icon: 'streak', streakRequired: 14 },
  { id: 'milestone_30', label: '30 days', icon: 'award', streakRequired: 30 },
  { id: 'sixty_days', label: 'Milestone: 60 days', icon: 'award', streakRequired: 60 },
  { id: 'milestone_90', label: '90 days', icon: 'award', streakRequired: 90 },
  { id: 'milestone_180', label: '180 days', icon: 'award', streakRequired: 180 },
  { id: 'year_legend', label: 'Milestone: 1 year', icon: 'award', streakRequired: 365 },
  { id: 'challenge_complete', label: 'Challenge complete', icon: 'check', challengeCompletionsRequired: 1 },
  { id: 'level_5', label: 'Aware', icon: 'level', levelRequired: 5 },
  { id: 'level_10', label: 'Resilient', icon: 'level', levelRequired: 10 },
  { id: 'level_15', label: 'Strong', icon: 'level', levelRequired: 15 },
  { id: 'clean_100h', label: '100 clean hours', icon: 'clock', cleanHoursRequired: 100 },
  { id: 'clean_500h', label: '500 clean hours', icon: 'clock', cleanHoursRequired: 500 },
] as const;

const MILESTONE_DEFS: Omit<Milestone, 'reached' | 'reachedAt'>[] = [
  { id: 'streak_7', label: '1 Week Clean', description: '7 consecutive clean days', icon: 'ðŸ”¥', requirement: 7, type: 'streak', xpReward: 100 },
  { id: 'streak_14', label: '2 Weeks Clean', description: '14 consecutive clean days', icon: 'â­', requirement: 14, type: 'streak', xpReward: 200 },
  { id: 'streak_30', label: '1 Month Clean', description: '30 consecutive clean days', icon: 'ðŸ’Ž', requirement: 30, type: 'streak', xpReward: 500 },
  { id: 'streak_60', label: '2 Months Clean', description: '60 consecutive clean days', icon: 'ðŸ…', requirement: 60, type: 'streak', xpReward: 1000 },
  { id: 'streak_90', label: '3 Months Clean', description: '90 consecutive clean days', icon: 'ðŸ‘‘', requirement: 90, type: 'streak', xpReward: 2000 },
  { id: 'streak_180', label: '6 Months Clean', description: '180 consecutive clean days', icon: 'ðŸŒŸ', requirement: 180, type: 'streak', xpReward: 5000 },
  { id: 'streak_365', label: '1 Year Clean', description: '365 consecutive clean days', icon: 'ðŸ†', requirement: 365, type: 'streak', xpReward: 10000 },
  { id: 'blocks_50', label: '50 Blocks', description: 'Blocked 50 attempts', icon: 'ðŸ›¡', requirement: 50, type: 'blocks', xpReward: 50 },
  { id: 'blocks_250', label: '250 Blocks', description: 'Blocked 250 attempts', icon: 'ðŸ°', requirement: 250, type: 'blocks', xpReward: 250 },
  { id: 'blocks_1000', label: '1K Blocks', description: 'Blocked 1000 attempts', icon: 'âš”ï¸', requirement: 1000, type: 'blocks', xpReward: 500 },
  { id: 'xp_1000', label: '1K XP', description: 'Earned 1000 XP total', icon: 'âœ¨', requirement: 1000, type: 'xp', xpReward: 0 },
  { id: 'xp_10000', label: '10K XP', description: 'Earned 10000 XP total', icon: 'ðŸ’«', requirement: 10000, type: 'xp', xpReward: 0 },
  { id: 'hours_24', label: '24h Clean', description: '24 total clean hours', icon: 'â°', requirement: 24, type: 'clean_hours', xpReward: 50 },
  { id: 'hours_168', label: '1 Week Hours', description: '168 total clean hours', icon: 'ðŸ•', requirement: 168, type: 'clean_hours', xpReward: 200 },
];

const STORAGE_KEY = 'gamification_state';

function getLevel(xp: number): number {
  return LEVEL_THRESHOLDS.filter((t) => xp >= t).length;
}

function getLevelName(level: number): string {
  return LEVEL_NAMES[level] ?? `Level ${level}`;
}

function xpToNextLevel(xp: number): { current: number; required: number } {
  const level = getLevel(xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]! + 2500;
  return {
    current: xp - currentThreshold,
    required: nextThreshold - currentThreshold,
  };
}

function getStreakMultiplier(streak: number): number {
  if (streak >= 90) return 3.0;
  if (streak >= 30) return 2.5;
  if (streak >= 14) return 2.0;
  if (streak >= 7) return 1.5;
  if (streak >= 3) return 1.25;
  return 1.0;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().split('T')[0];
}

function getMonth(dateStr: string): string {
  return dateStr.substring(0, 7);
}

const defaultState: GamificationState = {
  xp: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  todayCleanHours: 0,
  totalCleanHours: 0,
  totalBlocksLifetime: 0,
  badges: RECOVERY_BADGE_DEFS.map((b) => ({ id: b.id, label: b.label, icon: b.icon, earned: false })),
  milestones: MILESTONE_DEFS.map((m) => ({ ...m, reached: false })),
  lastXpAwardedAt: 0,
  lastCleanDayRecordedAt: 0,
  urgesSurfed: 0,
  dayHistory: [],
  weeklyStreaks: [],
  monthlyStreaks: [],
  currentWeekCleanDays: 0,
  currentMonthCleanDays: 0,
  streakMultiplier: 1.0,
  lastStreakFreezeAt: 0,
};

let sharedState = defaultState;
const listeners = new Set<(state: GamificationState) => void>();

function setSharedState(updater: GamificationState | ((current: GamificationState) => GamificationState)) {
  const next = typeof updater === 'function' ? updater(sharedState) : updater;
  if (next === sharedState) return;
  sharedState = next;
  listeners.forEach((listener) => listener(sharedState));
}

export function useGamification() {
  const [state, setState] = useState<GamificationState>(sharedState);

  useEffect(() => {
    listeners.add(setState);
    void loadState();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const loadState = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GamificationState>;
        setSharedState((current) => ({
          ...current,
          ...parsed,
          dayHistory: (parsed.dayHistory ?? []).map(normalizeDayRecord),
          badges: RECOVERY_BADGE_DEFS.map((def) => {
            const saved = (parsed.badges ?? []).find((b: Badge) => b.id === def.id);
            return {
              id: def.id,
              label: def.label,
              icon: def.icon,
              earned: saved?.earned ?? false,
              earnedAt: saved?.earnedAt,
            };
          }),
          milestones: MILESTONE_DEFS.map((def) => {
            const saved = (parsed.milestones ?? []).find((m: Milestone) => m.id === def.id);
            return {
              ...def,
              reached: saved?.reached ?? false,
              reachedAt: saved?.reachedAt,
            };
          }),
        }));
      }
    } catch {
      // First launch
    }
  };

  const persist = useCallback(async (next: GamificationState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage full
    }
  }, []);

  const awardXP = useCallback(
    (amount: number, _reason: string) => {
      setSharedState((current) => {
        const newXp = current.xp + amount;
        const newLevel = getLevel(newXp);
        const next: GamificationState = {
          ...current,
          xp: newXp,
          level: newLevel,
          lastXpAwardedAt: Date.now(),
          streakMultiplier: getStreakMultiplier(current.currentStreak),
          badges: evaluateBadges(current.badges, { ...current, xp: newXp, level: newLevel }),
          milestones: evaluateMilestones(current.milestones, { ...current, xp: newXp, level: newLevel }),
        };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const markMoodCheckedIn = useCallback(() => {
    setSharedState((current) => {
      const today = getToday();
      const dayHistory = upsertDay(current.dayHistory, today, (day) => ({ ...day, moodCheckedIn: true }));
      const next = { ...current, dayHistory };
      void persist(next);
      return next;
    });
  }, [persist]);

  const recordCleanHour = useCallback(() => {
    setSharedState((current) => {
      const baseXp = 10;
      const multiplied = Math.round(baseXp * current.streakMultiplier);
      const newXp = current.xp + multiplied;
      const newLevel = getLevel(newXp);
      const newTotalHours = current.totalCleanHours + 1;
      const next: GamificationState = {
        ...current,
        xp: newXp,
        level: newLevel,
        todayCleanHours: current.todayCleanHours + 1,
        totalCleanHours: newTotalHours,
        lastXpAwardedAt: Date.now(),
        streakMultiplier: getStreakMultiplier(current.currentStreak),
        badges: evaluateBadges(current.badges, { ...current, xp: newXp, level: newLevel, totalCleanHours: newTotalHours }),
        milestones: evaluateMilestones(current.milestones, { ...current, xp: newXp, level: newLevel, totalCleanHours: newTotalHours }),
      };
      void persist(next);
      return next;
    });
  }, [persist]);

  const recordCleanDay = useCallback(() => {
    setSharedState((current) => {
      const today = getToday();
      const alreadyRecorded = current.dayHistory.some((d) => d.date === today && d.clean);
      if (alreadyRecorded) return current;

      const newStreak = current.currentStreak + 1;
      const streakBonus = newStreak > 0 && newStreak % 7 === 0 ? 100 : 0;
      const monthBonus = newStreak > 0 && newStreak % 30 === 0 ? 500 : 0;
      const multiplier = getStreakMultiplier(newStreak);
      const baseXp = 50 + streakBonus + monthBonus;
      const multiplied = Math.round(baseXp * multiplier);
      const newXp = current.xp + multiplied;
      const newLevel = getLevel(newXp);

      const dayRecord: DayRecord = { date: today, clean: true, xpEarned: multiplied, blocksCount: 0 };
      const newHistory = [...current.dayHistory.slice(-365), dayRecord];

      const weekStart = getWeekStart(today);
      const weekDays = newHistory.filter((d) => d.clean && getWeekStart(d.date) === weekStart).length;
      const currentWeekCleanDays = weekDays;

      const month = getMonth(today);
      const monthDays = newHistory.filter((d) => d.clean && getMonth(d.date) === month).length;
      const currentMonthCleanDays = monthDays;

      let weeklyStreaks = [...current.weeklyStreaks];
      const existingWeek = weeklyStreaks.find((w) => w.weekStart === weekStart);
      if (existingWeek) {
        existingWeek.cleanDays = weekDays;
        existingWeek.complete = weekDays >= 7;
      } else {
        weeklyStreaks = [...weeklyStreaks.slice(-52), { weekStart, cleanDays: weekDays, complete: weekDays >= 7 }];
      }

      let monthlyStreaks = [...current.monthlyStreaks];
      const existingMonth = monthlyStreaks.find((m) => m.month === month);
      const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
      if (existingMonth) {
        existingMonth.cleanDays = monthDays;
        existingMonth.totalDays = daysInMonth;
        existingMonth.complete = monthDays >= daysInMonth;
      } else {
        monthlyStreaks = [...monthlyStreaks.slice(-12), { month, cleanDays: monthDays, totalDays: daysInMonth, complete: monthDays >= daysInMonth }];
      }

      const next: GamificationState = {
        ...current,
        xp: newXp,
        level: newLevel,
        currentStreak: newStreak,
        longestStreak: Math.max(current.longestStreak, newStreak),
        lastCleanDayRecordedAt: Date.now(),
        streakMultiplier: multiplier,
        dayHistory: newHistory,
        weeklyStreaks,
        monthlyStreaks,
        currentWeekCleanDays,
        currentMonthCleanDays,
        badges: evaluateBadges(current.badges, {
          ...current,
          currentStreak: newStreak,
          xp: newXp,
          level: newLevel,
          weeklyStreaks,
          monthlyStreaks,
        }),
        milestones: evaluateMilestones(current.milestones, {
          ...current,
          currentStreak: newStreak,
          xp: newXp,
          level: newLevel,
        }),
      };
      void persist(next);
      return next;
    });
  }, [persist]);

  const recordUrgeSurfed = useCallback(() => {
    setSharedState((current) => {
      const newXp = current.xp + 50;
      const newLevel = getLevel(newXp);
      const newUrges = current.urgesSurfed + 1;
      const today = getToday();
      const dayHistory = upsertDay(current.dayHistory, today, (day) => ({
        ...day,
        urgesSurfed: (day.urgesSurfed ?? 0) + 1,
      }));
      const next: GamificationState = {
        ...current,
        xp: newXp,
        level: newLevel,
        urgesSurfed: newUrges,
        lastXpAwardedAt: Date.now(),
        dayHistory,
        badges: evaluateBadges(current.badges, { ...current, urgesSurfed: newUrges, xp: newXp, level: newLevel }),
        milestones: evaluateMilestones(current.milestones, { ...current, urgesSurfed: newUrges, xp: newXp, level: newLevel }),
      };
      void persist(next);
      return next;
    });
  }, [persist]);

  const recordJournalWritten = useCallback(() => {
    setSharedState((current) => {
      const today = getToday();
      const dayHistory = upsertDay(current.dayHistory, today, (day) => ({ ...day, journalWritten: true }));
      const next = { ...current, dayHistory };
      void persist(next);
      return next;
    });
  }, [persist]);

  const recordBlock = useCallback(() => {
    setSharedState((current) => {
      const newBlocks = current.totalBlocksLifetime + 1;
      const today = getToday();
      const dayHistory = upsertDay(current.dayHistory, today, (day) => ({
        ...day,
        blocksCount: day.blocksCount + 1,
      }));
      const next: GamificationState = {
        ...current,
        totalBlocksLifetime: newBlocks,
        dayHistory,
        badges: evaluateBadges(current.badges, { ...current, totalBlocksLifetime: newBlocks }),
        milestones: evaluateMilestones(current.milestones, { ...current, totalBlocksLifetime: newBlocks }),
      };
      void persist(next);
      return next;
    });
  }, [persist]);

  const resetStreak = useCallback(() => {
    setSharedState((current) => {
      const today = getToday();
      const dayRecord: DayRecord = { date: today, clean: false, xpEarned: 0, blocksCount: 0 };
      const existingToday = current.dayHistory.find((d) => d.date === today);
      const newHistory = existingToday
        ? current.dayHistory.map((d) => (d.date === today ? { ...d, clean: false } : d))
        : [...current.dayHistory.slice(-365), dayRecord];

      const next: GamificationState = {
        ...current,
        currentStreak: 0,
        streakMultiplier: 1.0,
        dayHistory: newHistory,
      };
      void persist(next);
      return next;
    });
  }, [persist]);

  const logRelapse = useCallback((useFreeze: boolean) => {
    setSharedState((current) => {
      const today = getToday();
      const canFreeze = useFreeze && canUseFreeze(current, today);
      const baseXp = 20;
      const newXp = current.xp + baseXp;
      const newLevel = getLevel(newXp);
      const dayHistory = upsertDay(current.dayHistory, today, (day) => ({
        ...day,
        clean: canFreeze ? true : false,
        relapseLogged: true,
        freezeUsed: canFreeze ? true : day.freezeUsed,
        xpEarned: day.xpEarned + baseXp,
      }));
      const next: GamificationState = {
        ...current,
        xp: newXp,
        level: newLevel,
        currentStreak: canFreeze ? current.currentStreak : 0,
        streakMultiplier: canFreeze ? current.streakMultiplier : 1.0,
        lastStreakFreezeAt: canFreeze ? Date.now() : current.lastStreakFreezeAt,
        dayHistory,
        badges: evaluateBadges(current.badges, { ...current, xp: newXp, level: newLevel }),
        milestones: evaluateMilestones(current.milestones, { ...current, xp: newXp, level: newLevel }),
      };
      void persist(next);
      return next;
    });
  }, [persist]);

  const recordChallengeCompleted = useCallback(() => {
    setSharedState((current) => {
      const newXp = current.xp + 100;
      const newLevel = getLevel(newXp);
      const next: GamificationState = {
        ...current,
        xp: newXp,
        level: newLevel,
        badges: evaluateBadges(current.badges, { ...current, xp: newXp, level: newLevel, challengeCompletions: 1 }),
        milestones: evaluateMilestones(current.milestones, { ...current, xp: newXp, level: newLevel }),
      };
      void persist(next);
      return next;
    });
  }, [persist]);

  const perfectWeeksCount = state.weeklyStreaks.filter((w) => w.complete).length;
  const perfectMonthsCount = state.monthlyStreaks.filter((m) => m.complete).length;
  const todayRecord = state.dayHistory.find((day) => day.date === getToday());

  return {
    ...state,
    blocksToday: todayRecord?.blocksCount ?? 0,
    remainingStreakFreezes: monthlyFreezeAvailable(state) ? 1 : 0,
    canUseStreakFreezeToday: canUseFreeze(state, getToday()),
    calendarDays: buildCalendarDays(state.dayHistory),
    weeklyBlockCounts: buildWeeklyBlockCounts(state.dayHistory),
    latestMilestoneBadge: latestMilestoneBadge(state.badges),
    xpProgress: xpToNextLevel(state.xp),
    levelName: getLevelName(state.level),
    perfectWeeksCount,
    perfectMonthsCount,
    awardXP,
    markMoodCheckedIn,
    recordCleanHour,
    recordCleanDay,
    recordUrgeSurfed,
    recordJournalWritten,
    recordBlock,
    logRelapse,
    recordChallengeCompleted,
    resetStreak,
  };
}

function evaluateBadges(badges: Badge[], state: Partial<GamificationState & { weeklyStreaks: WeeklyStreak[]; monthlyStreaks: MonthlyStreak[]; challengeCompletions: number }>): Badge[] {
  return badges.map((badge) => {
    if (badge.earned) return badge;
    const def = RECOVERY_BADGE_DEFS.find((d) => d.id === badge.id);
    if (!def) return badge;
    let earned = false;
    if ('streakRequired' in def) earned = (state.currentStreak ?? 0) >= def.streakRequired;
    if ('blocksRequired' in def) earned = (state.totalBlocksLifetime ?? 0) >= def.blocksRequired;
    if ('levelRequired' in def) earned = (state.level ?? 1) >= def.levelRequired;
    if ('urgesRequired' in def) earned = (state.urgesSurfed ?? 0) >= def.urgesRequired;
    if ('cleanHoursRequired' in def) earned = (state.totalCleanHours ?? 0) >= def.cleanHoursRequired;
    if (hasNumericRequirement(def, 'challengeCompletionsRequired')) {
      earned = (state.challengeCompletions ?? 0) >= def.challengeCompletionsRequired;
    }
    if (hasNumericRequirement(def, 'weeklyPerfectRequired')) {
      earned = (state.weeklyStreaks ?? []).filter((w) => w.complete).length >= def.weeklyPerfectRequired;
    }
    if (hasNumericRequirement(def, 'monthlyPerfectRequired')) {
      earned = (state.monthlyStreaks ?? []).filter((m) => m.complete).length >= def.monthlyPerfectRequired;
    }
    return earned ? { ...badge, earned: true, earnedAt: Date.now() } : badge;
  });
}

function normalizeDayRecord(record: DayRecord): DayRecord {
  return {
    date: record.date,
    clean: Boolean(record.clean),
    xpEarned: Number(record.xpEarned ?? 0),
    blocksCount: Number(record.blocksCount ?? 0),
    freezeUsed: Boolean(record.freezeUsed),
    relapseLogged: Boolean(record.relapseLogged),
    journalWritten: Boolean(record.journalWritten),
    moodCheckedIn: Boolean(record.moodCheckedIn),
    urgesSurfed: Number(record.urgesSurfed ?? 0),
  };
}

function emptyDay(date: string): DayRecord {
  return { date, clean: false, xpEarned: 0, blocksCount: 0 };
}

function upsertDay(days: DayRecord[], date: string, update: (day: DayRecord) => DayRecord) {
  const existing = days.find((day) => day.date === date);
  const nextDay = update(existing ? normalizeDayRecord(existing) : emptyDay(date));
  const without = days.filter((day) => day.date !== date);
  return [...without, nextDay].sort((a, b) => a.date.localeCompare(b.date)).slice(-365);
}

function canUseFreeze(state: GamificationState, today: string) {
  const todayRecord = state.dayHistory.find((day) => day.date === today);
  const usedUrgeTool = (todayRecord?.urgesSurfed ?? 0) > 0;
  return usedUrgeTool && monthlyFreezeAvailable(state);
}

function monthlyFreezeAvailable(state: GamificationState) {
  const lastUsed = Number(state.lastStreakFreezeAt ?? 0);
  return !lastUsed || Date.now() - lastUsed >= 30 * 24 * 60 * 60 * 1000;
}

function buildCalendarDays(dayHistory: DayRecord[]) {
  const byDate = new Map(dayHistory.map((day) => [day.date, normalizeDayRecord(day)]));
  const today = new Date();
  return Array.from({ length: 84 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (83 - index));
    const key = date.toISOString().split('T')[0];
    return byDate.get(key) ?? emptyDay(key);
  });
}

function buildWeeklyBlockCounts(dayHistory: DayRecord[]): WeeklyBlockCount[] {
  const byDate = new Map(dayHistory.map((day) => [day.date, normalizeDayRecord(day)]));
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toISOString().split('T')[0];
    return {
      date: key,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
      blocks: byDate.get(key)?.blocksCount ?? 0,
    };
  });
}

function latestMilestoneBadge(badges: Badge[]) {
  const milestoneIds = ['milestone_7', 'milestone_14', 'milestone_30', 'sixty_days', 'milestone_90', 'milestone_180', 'year_legend'];
  return badges
    .filter((badge) => badge.earned && milestoneIds.includes(badge.id))
    .sort((a, b) => (b.earnedAt ?? 0) - (a.earnedAt ?? 0))[0];
}

function hasNumericRequirement<Key extends string>(def: object, key: Key): def is Record<Key, number> {
  return key in def && typeof (def as Record<Key, unknown>)[key] === 'number';
}

function evaluateMilestones(milestones: Milestone[], state: Partial<GamificationState>): Milestone[] {
  return milestones.map((milestone) => {
    if (milestone.reached) return milestone;
    let value = 0;
    switch (milestone.type) {
      case 'streak': value = state.currentStreak ?? 0; break;
      case 'blocks': value = state.totalBlocksLifetime ?? 0; break;
      case 'xp': value = state.xp ?? 0; break;
      case 'level': value = state.level ?? 1; break;
      case 'urges': value = state.urgesSurfed ?? 0; break;
      case 'clean_hours': value = state.totalCleanHours ?? 0; break;
    }
    if (value >= milestone.requirement) {
      return { ...milestone, reached: true, reachedAt: Date.now() };
    }
    return milestone;
  });
}

export { getLevel, getLevelName, xpToNextLevel, getStreakMultiplier, LEVEL_NAMES, LEVEL_THRESHOLDS };

