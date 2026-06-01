import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DayRecord } from '@/store/useGamification';

import type { StreakPopupState } from './streakCopy';

type UseDailyStreakPopupInput = {
  currentStreak: number;
  dayHistory: DayRecord[];
  hydrated: boolean;
};

type DailyStreakPopupState = {
  previousStreak: number;
  state: StreakPopupState;
  visible: boolean;
  dismiss: () => void;
};

const LAST_SEEN_DATE_KEY = 'streak_popup_last_seen_date';
const LAST_SEEN_STREAK_KEY = 'streak_popup_last_seen_value';
const LAST_SEEN_STATE_KEY = 'streak_popup_last_seen_state';

export function useDailyStreakPopup({
  currentStreak,
  dayHistory,
  hydrated,
}: UseDailyStreakPopupInput): DailyStreakPopupState {
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<StreakPopupState>('clean');
  const [previousStreak, setPreviousStreak] = useState(currentStreak);
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || visible) return;
    let cancelled = false;

    async function checkPopupState() {
      const today = toDateKey(new Date());
      const todayRecord = dayHistory.find((day) => day.date === today);
      const nextState = inferPopupState(todayRecord, currentStreak);
      if (!nextState) return;
      if (dismissedSignature === popupSignature(today, nextState)) return;

      try {
        const [lastSeenDate, lastSeenStreak, lastSeenState] = await Promise.all([
          AsyncStorage.getItem(LAST_SEEN_DATE_KEY),
          AsyncStorage.getItem(LAST_SEEN_STREAK_KEY),
          AsyncStorage.getItem(LAST_SEEN_STATE_KEY),
        ]);
        if (cancelled) return;

        const lastValue = Number(lastSeenStreak ?? currentStreak);
        const alreadySeenToday = lastSeenDate === today;
        const stateChangedSinceSeen = lastSeenState && lastSeenState !== nextState;
        const streakChangedSinceSeen = Number.isFinite(lastValue) && lastValue !== currentStreak;

        if (alreadySeenToday && !stateChangedSinceSeen) return;
        if (!todayRecord && lastSeenDate && !streakChangedSinceSeen) return;

        setPreviousStreak(previousValueFor(nextState, currentStreak, lastValue));
        setState(nextState);
        setVisible(true);
      } catch {
        if (!cancelled && todayRecord) {
          setPreviousStreak(previousValueFor(nextState, currentStreak, currentStreak));
          setState(nextState);
          setVisible(true);
        }
      }
    }

    void checkPopupState();
    return () => {
      cancelled = true;
    };
  }, [currentStreak, dayHistory, dismissedSignature, hydrated, visible]);

  const dismiss = useCallback(() => {
    const today = toDateKey(new Date());
    setDismissedSignature(popupSignature(today, state));
    setVisible(false);
    void Promise.all([
      AsyncStorage.setItem(LAST_SEEN_DATE_KEY, today),
      AsyncStorage.setItem(LAST_SEEN_STREAK_KEY, String(currentStreak)),
      AsyncStorage.setItem(LAST_SEEN_STATE_KEY, state),
    ]);
  }, [currentStreak, state]);

  return {
    dismiss,
    previousStreak,
    state,
    visible,
  };
}

function inferPopupState(todayRecord: DayRecord | undefined, currentStreak: number): StreakPopupState | null {
  if (todayRecord?.freezeUsed) return 'freeze';
  if (todayRecord?.relapseLogged && !todayRecord.freezeUsed) return 'freshStart';
  if (todayRecord?.clean) return 'clean';
  if (currentStreak > 0) return 'clean';
  return null;
}

function previousValueFor(state: StreakPopupState, currentStreak: number, lastSeenStreak: number) {
  if (state === 'clean') return Number.isFinite(lastSeenStreak) ? Math.max(0, lastSeenStreak) : Math.max(0, currentStreak - 1);
  if (state === 'freshStart') return Number.isFinite(lastSeenStreak) ? Math.max(lastSeenStreak, currentStreak) : currentStreak;
  return currentStreak;
}

function toDateKey(date: Date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().split('T')[0] ?? '';
}

function popupSignature(date: string, state: StreakPopupState) {
  return `${date}:${state}`;
}
