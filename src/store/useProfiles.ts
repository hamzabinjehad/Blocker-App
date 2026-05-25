import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ProfileType, UserProfile, ProfileSettings } from '@/types/blocker';
import { PROFILE_PRESETS } from '@/types/blocker';

const STORAGE_KEY = 'user_profiles';

function generateId(): string {
  return `prof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const AVATAR_COLORS = ['#3DA34D', '#8B72F8', '#F5A623', '#4A9CF5', '#F25555', '#5CC6A0'];

export function useProfiles() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const parsed = JSON.parse(raw) as UserProfile[];
        setProfiles(parsed);
        const active = parsed.find((p) => p.isActive);
        if (active) setActiveProfile(active);
      }
    });
  }, []);

  const persist = useCallback(async (next: UserProfile[]) => {
    setProfiles(next);
    const active = next.find((p) => p.isActive);
    setActiveProfile(active ?? null);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const createProfile = useCallback(
    async (name: string, type: ProfileType): Promise<UserProfile> => {
      setLoading(true);
      const preset = PROFILE_PRESETS[type];
      const profile: UserProfile = {
        id: generateId(),
        name,
        type,
        avatarColor: AVATAR_COLORS[profiles.length % AVATAR_COLORS.length],
        createdAt: Date.now(),
        isActive: profiles.length === 0,
        strictnessPreset: preset.strictness,
        settings: { ...preset.settings },
      };
      const next = profiles.length === 0
        ? [profile]
        : [...profiles, profile];
      await persist(next);
      setLoading(false);
      return profile;
    },
    [profiles, persist],
  );

  const switchProfile = useCallback(
    async (profileId: string) => {
      const next = profiles.map((p) => ({
        ...p,
        isActive: p.id === profileId,
      }));
      await persist(next);
    },
    [profiles, persist],
  );

  const updateProfileSettings = useCallback(
    async (profileId: string, settings: Partial<ProfileSettings>) => {
      const next = profiles.map((p) =>
        p.id === profileId ? { ...p, settings: { ...p.settings, ...settings } } : p,
      );
      await persist(next);
    },
    [profiles, persist],
  );

  const updateProfileName = useCallback(
    async (profileId: string, name: string) => {
      const next = profiles.map((p) => (p.id === profileId ? { ...p, name } : p));
      await persist(next);
    },
    [profiles, persist],
  );

  const deleteProfile = useCallback(
    async (profileId: string) => {
      const filtered = profiles.filter((p) => p.id !== profileId);
      if (filtered.length > 0 && !filtered.some((p) => p.isActive)) {
        filtered[0].isActive = true;
      }
      await persist(filtered);
    },
    [profiles, persist],
  );

  const resetToPreset = useCallback(
    async (profileId: string) => {
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) return;
      const preset = PROFILE_PRESETS[profile.type];
      const next = profiles.map((p) =>
        p.id === profileId
          ? { ...p, strictnessPreset: preset.strictness, settings: { ...preset.settings } }
          : p,
      );
      await persist(next);
    },
    [profiles, persist],
  );

  return {
    profiles,
    activeProfile,
    loading,
    createProfile,
    switchProfile,
    updateProfileSettings,
    updateProfileName,
    deleteProfile,
    resetToPreset,
  };
}
