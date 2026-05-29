import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TriggerSituation = 'boredom' | 'loneliness' | 'stress' | 'late_night' | 'argument' | 'other';

export type RelapseEntry = {
  id: string;
  createdAt: number;
  emotionalState: string;
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
};

type RecoveryState = {
  urgesSurfed: number;
  relapseLogs: RelapseEntry[];
  journalEntries: JournalEntry[];
  activeChallenge: RecoveryChallenge;
};

const STORAGE_KEY = 'recovery_state';

const defaultChallenge: RecoveryChallenge = {
  id: 'night-window',
  title: 'No phone after 10pm for 3 days',
  detail: 'Protect the hours where willpower is usually lower.',
  xp: 100,
  completed: false,
};

const defaultState: RecoveryState = {
  urgesSurfed: 0,
  relapseLogs: [],
  journalEntries: [],
  activeChallenge: defaultChallenge,
};

const triggerLabels: Record<TriggerSituation, string> = {
  boredom: 'boredom',
  loneliness: 'loneliness',
  stress: 'stress',
  late_night: 'late night',
  argument: 'argument',
  other: 'something else',
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
      setState({ ...defaultState, ...(JSON.parse(raw) as Partial<RecoveryState>) });
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
      const nextChallenge =
        current.activeChallenge.id === 'night-window'
          ? {
              id: 'reach-out',
              title: 'Reach out before isolating',
              detail: 'Message one trusted person when loneliness shows up.',
              xp: 100,
              completed: false,
            }
          : defaultChallenge;
      const next = { ...current, activeChallenge: nextChallenge };
      void persist(next);
      return next;
    });
  }, [persist]);

  const topTriggerInsight = useMemo(() => {
    if (state.relapseLogs.length === 0) return 'Your private patterns will appear here after a few logs.';

    const counts = state.relapseLogs.reduce<Record<TriggerSituation, number>>((acc, entry) => {
      acc[entry.trigger] = (acc[entry.trigger] ?? 0) + 1;
      return acc;
    }, {} as Record<TriggerSituation, number>);

    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as TriggerSituation | undefined;
    return top ? `Your strongest pattern right now is ${triggerLabels[top]}. Strengthen that window gently.` : '';
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

export { triggerLabels };
