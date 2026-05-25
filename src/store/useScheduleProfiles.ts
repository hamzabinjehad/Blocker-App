import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ActiveScheduleState, ScheduleProfile, StrictnessLevel } from '@/types/blocker';

const STORAGE_KEY = 'schedule_profiles';

function generateId(): string {
  return `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const defaultProfiles: ScheduleProfile[] = [
  {
    id: 'bedtime',
    label: 'Bedtime',
    icon: 'weather-night',
    strictness: 'lockdown',
    enabled: false,
    startMinutes: 22 * 60,
    endMinutes: 6 * 60,
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    overrides: {
      adultFilteringEnabled: true,
      safeSearchEnforced: true,
      socialMediaBlocked: true,
      appSuspensionEnabled: true,
      behaviorProtectionEnabled: true,
      focusModeEnabled: true,
    },
  },
  {
    id: 'school',
    label: 'School',
    icon: 'school',
    strictness: 'high',
    enabled: false,
    startMinutes: 8 * 60,
    endMinutes: 15 * 60,
    daysOfWeek: [1, 2, 3, 4, 5],
    overrides: {
      adultFilteringEnabled: true,
      safeSearchEnforced: true,
      socialMediaBlocked: true,
      appSuspensionEnabled: true,
      behaviorProtectionEnabled: true,
    },
  },
  {
    id: 'freetime',
    label: 'Free Time',
    icon: 'gamepad-variant',
    strictness: 'low',
    enabled: false,
    startMinutes: 15 * 60,
    endMinutes: 20 * 60,
    daysOfWeek: [6, 7],
    overrides: {
      adultFilteringEnabled: true,
      safeSearchEnforced: false,
      socialMediaBlocked: false,
      appSuspensionEnabled: false,
      behaviorProtectionEnabled: true,
    },
  },
];

function getCurrentMinuteOfWeek(): { minuteOfDay: number; dayOfWeek: number } {
  const now = new Date();
  return {
    minuteOfDay: now.getHours() * 60 + now.getMinutes(),
    dayOfWeek: now.getDay() === 0 ? 7 : now.getDay(),
  };
}

function isProfileActiveNow(profile: ScheduleProfile): boolean {
  if (!profile.enabled) return false;
  const { minuteOfDay, dayOfWeek } = getCurrentMinuteOfWeek();
  if (!profile.daysOfWeek.includes(dayOfWeek)) return false;

  if (profile.startMinutes < profile.endMinutes) {
    return minuteOfDay >= profile.startMinutes && minuteOfDay < profile.endMinutes;
  }
  return minuteOfDay >= profile.startMinutes || minuteOfDay < profile.endMinutes;
}

function findNextTransition(profiles: ScheduleProfile[]): {
  nextAt: number | null;
  nextLabel: string | null;
} {
  const enabled = profiles.filter((p) => p.enabled);
  if (enabled.length === 0) return { nextAt: null, nextLabel: null };

  const { minuteOfDay, dayOfWeek } = getCurrentMinuteOfWeek();
  let earliest = Infinity;
  let label: string | null = null;

  for (const profile of enabled) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDay = ((dayOfWeek - 1 + dayOffset) % 7) + 1;
      if (!profile.daysOfWeek.includes(checkDay)) continue;

      let minutesUntil: number;
      if (dayOffset === 0) {
        minutesUntil = profile.startMinutes - minuteOfDay;
        if (minutesUntil <= 0) minutesUntil += 7 * 24 * 60;
      } else {
        minutesUntil = dayOffset * 24 * 60 + (profile.startMinutes - minuteOfDay);
      }

      if (minutesUntil > 0 && minutesUntil < earliest) {
        earliest = minutesUntil;
        label = profile.label;
      }
    }
  }

  return {
    nextAt: earliest < Infinity ? Date.now() + earliest * 60_000 : null,
    nextLabel: label,
  };
}

const STRICTNESS_PRIORITY: Record<StrictnessLevel, number> = {
  off: 0,
  low: 1,
  moderate: 2,
  high: 3,
  lockdown: 4,
};

function resolveActiveState(profiles: ScheduleProfile[]): ActiveScheduleState {
  const active = profiles.filter(isProfileActiveNow);
  const { nextAt, nextLabel } = findNextTransition(profiles);

  if (active.length === 0) {
    return {
      activeProfileId: null,
      activeProfileLabel: null,
      currentStrictness: 'off',
      nextTransitionAt: nextAt,
      nextProfileLabel: nextLabel,
      manualOverrideActive: false,
      manualOverrideExpiresAt: null,
    };
  }

  const highest = active.reduce((a, b) =>
    STRICTNESS_PRIORITY[a.strictness] >= STRICTNESS_PRIORITY[b.strictness] ? a : b,
  );

  return {
    activeProfileId: highest.id,
    activeProfileLabel: highest.label,
    currentStrictness: highest.strictness,
    nextTransitionAt: nextAt,
    nextProfileLabel: nextLabel,
    manualOverrideActive: false,
    manualOverrideExpiresAt: null,
  };
}

export function useScheduleProfiles() {
  const [profiles, setProfiles] = useState<ScheduleProfile[]>(defaultProfiles);
  const [activeState, setActiveState] = useState<ActiveScheduleState>(resolveActiveState(defaultProfiles));
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const parsed = JSON.parse(raw) as ScheduleProfile[];
        setProfiles(parsed);
        setActiveState(resolveActiveState(parsed));
      }
    });
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActiveState(resolveActiveState(profiles));
    }, 60_000);
    return () => clearInterval(intervalRef.current);
  }, [profiles]);

  const persist = useCallback(async (next: ScheduleProfile[]) => {
    setProfiles(next);
    setActiveState(resolveActiveState(next));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const updateProfile = useCallback(
    async (id: string, patch: Partial<ScheduleProfile>) => {
      const next = profiles.map((p) => (p.id === id ? { ...p, ...patch } : p));
      await persist(next);
    },
    [profiles, persist],
  );

  const addProfile = useCallback(
    async (profile: Omit<ScheduleProfile, 'id'>) => {
      const full: ScheduleProfile = { ...profile, id: generateId() };
      await persist([...profiles, full]);
      return full;
    },
    [profiles, persist],
  );

  const removeProfile = useCallback(
    async (id: string) => {
      await persist(profiles.filter((p) => p.id !== id));
    },
    [profiles, persist],
  );

  const toggleProfile = useCallback(
    async (id: string) => {
      const next = profiles.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
      await persist(next);
    },
    [profiles, persist],
  );

  return {
    profiles,
    activeState,
    updateProfile,
    addProfile,
    removeProfile,
    toggleProfile,
  };
}
