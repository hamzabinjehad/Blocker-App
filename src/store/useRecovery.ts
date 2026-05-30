import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TriggerSituation = 'boredom' | 'loneliness' | 'stress' | 'late_night' | 'other';

export type EmotionalState = 'steady' | 'stressed' | 'lonely' | 'bored' | 'tired' | 'overwhelmed';

export type RelapseEntry = {
  id: string;
  createdAt: number;
  emotionalState: EmotionalState;
  trigger: TriggerSituation;
  notes: string;
};

export type JournalEntry = {
  id: string;
  createdAt: number;
  text: string;
};

export type RecoveryChallenge = {
  id: string;
  title: string;
  detail: string;
  xp: number;
  completed: boolean;
  weekKey?: string;
  swappedAt?: number;
};

type RecoveryState = {
  urgesSurfed: number;
  relapseLogs: RelapseEntry[];
  journalEntries: JournalEntry[];
  activeChallenge: RecoveryChallenge;
  lifetimeCleanDays: number;
};

const STORAGE_KEY = 'recovery_state';

const defaultChallenge: RecoveryChallenge = {
  id: 'night-window',
  title: 'No phone after 10pm for 3 days',
  detail: 'Protect the hours where willpower is usually lower.',
  xp: 100,
  completed: false,
  weekKey: getWeekKey(),
};

const defaultState: RecoveryState = {
  urgesSurfed: 0,
  relapseLogs: [],
  journalEntries: [],
  activeChallenge: defaultChallenge,
  lifetimeCleanDays: 0,
};

const triggerLabels: Record<TriggerSituation, string> = {
  boredom: 'boredom',
  loneliness: 'loneliness',
  stress: 'stress',
  late_night: 'late night',
  other: 'something else',
};

const emotionalStateLabels: Record<EmotionalState, string> = {
  steady: 'steady',
  stressed: 'stressed',
  lonely: 'lonely',
  bored: 'bored',
  tired: 'tired',
  overwhelmed: 'overwhelmed',
};

export function useRecovery() {
  const [state, setState] = useState<RecoveryState>(defaultState);

  useEffect(() => {
    void loadState();
  }, []);

  const loadState = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<RecoveryState>;
      setState({
        ...defaultState,
        ...parsed,
        relapseLogs: (parsed.relapseLogs ?? []).map((entry) => ({
          ...entry,
          trigger: normalizeTrigger(entry.trigger),
          emotionalState: isEmotionalState(entry.emotionalState) ? entry.emotionalState : 'overwhelmed',
        })),
        activeChallenge: normalizeChallenge(parsed.activeChallenge, parsed.relapseLogs ?? []),
      });
    } catch {
      // Keep the calm defaults when local storage is not available.
    }
  };

  const persist = useCallback(async (next: RecoveryState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Non-critical: coaching state can continue in memory.
    }
  }, []);

  const recordUrgeSurfed = useCallback(() => {
    setState((current) => {
      const next = { ...current, urgesSurfed: current.urgesSurfed + 1 };
      void persist(next);
      return next;
    });
  }, [persist]);

  const addRelapseLog = useCallback(
    (entry: Omit<RelapseEntry, 'id' | 'createdAt'>) => {
      setState((current) => {
        const next = {
          ...current,
          relapseLogs: [
            {
              ...entry,
              id: `relapse-${Date.now()}`,
              createdAt: Date.now(),
            },
            ...current.relapseLogs,
          ].slice(0, 100),
        };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const addJournalEntry = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setState((current) => {
        const next = {
          ...current,
          journalEntries: [
            {
              id: `journal-${Date.now()}`,
              createdAt: Date.now(),
              text: trimmed,
            },
            ...current.journalEntries,
          ].slice(0, 120),
        };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const completeChallenge = useCallback(() => {
    setState((current) => {
      const next = {
        ...current,
        activeChallenge: { ...current.activeChallenge, completed: true },
      };
      void persist(next);
      return next;
    });
  }, [persist]);

  const swapChallenge = useCallback(() => {
    setState((current) => {
      if (current.activeChallenge.swappedAt && isSameWeek(current.activeChallenge.swappedAt, Date.now())) {
        return current;
      }
      const nextChallenge = nextChallengeFor(current.activeChallenge.id, current.relapseLogs, true);
      const next = { ...current, activeChallenge: nextChallenge };
      void persist(next);
      return next;
    });
  }, [persist]);

  const topTriggerInsight = useMemo(() => {
    if (state.relapseLogs.length < 4) return 'Your private patterns will appear here after 4 logs.';

    const recent = state.relapseLogs.slice(0, 4);
    const triggerCounts = recent.reduce<Record<TriggerSituation, number>>((acc, entry) => {
      acc[entry.trigger] = (acc[entry.trigger] ?? 0) + 1;
      return acc;
    }, {} as Record<TriggerSituation, number>);
    const stateCounts = recent.reduce<Partial<Record<EmotionalState, number>>>((acc, entry) => {
      acc[entry.emotionalState] = (acc[entry.emotionalState] ?? 0) + 1;
      return acc;
    }, {});
    const lateNightCount = recent.filter((entry) => {
      const hour = new Date(entry.createdAt).getHours();
      return hour >= 22 || hour < 6 || entry.trigger === 'late_night';
    }).length;

    if (lateNightCount >= 3) return 'Most of your difficult moments happen after 10pm.';

    const topState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0] as [EmotionalState, number] | undefined;
    if (topState && topState[1] >= 3) {
      return `${capitalize(emotionalStateLabels[topState[0]])} appears in ${topState[1]} of your last 4 logs.`;
    }

    const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0] as [TriggerSituation, number] | undefined;
    return topTrigger ? `Your strongest pattern right now is ${triggerLabels[topTrigger[0]]}.` : '';
  }, [state.relapseLogs]);

  return {
    ...state,
    topTriggerInsight,
    recordUrgeSurfed,
    addRelapseLog,
    addJournalEntry,
    completeChallenge,
    swapChallenge,
  };
}

function normalizeChallenge(challenge: RecoveryChallenge | undefined, logs: RelapseEntry[]): RecoveryChallenge {
  if (!challenge || challenge.weekKey !== getWeekKey()) return nextChallengeFor('', logs);
  return challenge;
}

function nextChallengeFor(currentId: string, logs: RelapseEntry[], markSwapped = false): RecoveryChallenge {
  const strongestTrigger = getTopTrigger(logs);
  const candidates: RecoveryChallenge[] = [
    {
      id: 'night-window',
      title: 'No phone after 10pm for 3 days',
      detail: 'Protect the hours where willpower is usually lower.',
      xp: 100,
      completed: false,
      weekKey: getWeekKey(),
      swappedAt: markSwapped ? Date.now() : undefined,
    },
    {
      id: 'urge-surf-twice',
      title: 'Use urge surfing twice',
      detail: 'Practice the tool before the moment gets too loud.',
      xp: 100,
      completed: false,
      weekKey: getWeekKey(),
      swappedAt: markSwapped ? Date.now() : undefined,
    },
    {
      id: 'journal-after-urge',
      title: 'Journal after each urge',
      detail: 'Write one sentence after difficult moments this week.',
      xp: 100,
      completed: false,
      weekKey: getWeekKey(),
      swappedAt: markSwapped ? Date.now() : undefined,
    },
    {
      id: 'reach-out',
      title: strongestTrigger === 'loneliness' ? 'Reach out before isolating' : 'Name the trigger early',
      detail: strongestTrigger === 'loneliness'
        ? 'Message one trusted person when loneliness shows up.'
        : 'Pause once a day and name boredom, stress, or late-night risk.',
      xp: 100,
      completed: false,
      weekKey: getWeekKey(),
      swappedAt: markSwapped ? Date.now() : undefined,
    },
  ];
  return candidates.find((challenge) => challenge.id !== currentId) ?? candidates[0]!;
}

function getTopTrigger(logs: RelapseEntry[]): TriggerSituation | undefined {
  const counts = logs.reduce<Partial<Record<TriggerSituation, number>>>((next, log) => {
    next[log.trigger] = (next[log.trigger] ?? 0) + 1;
    return next;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as TriggerSituation | undefined;
}

function getWeekKey(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day + (day === 0 ? -6 : 1));
  return copy.toISOString().split('T')[0];
}

function isSameWeek(left: number, right: number) {
  return getWeekKey(new Date(left)) === getWeekKey(new Date(right));
}

function isEmotionalState(value: unknown): value is EmotionalState {
  return typeof value === 'string' && value in emotionalStateLabels;
}

function normalizeTrigger(value: unknown): TriggerSituation {
  if (value === 'argument') return 'other';
  return typeof value === 'string' && value in triggerLabels ? (value as TriggerSituation) : 'other';
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export { emotionalStateLabels, triggerLabels };
