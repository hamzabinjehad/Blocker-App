import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EmergencyPasscode, EmergencyUnlockState } from '@/types/blocker';

const STORAGE_KEY = 'emergency_unlock';

function generatePasscode(): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

function generateId(): string {
  return `eu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const initialState: EmergencyUnlockState = {
  active: false,
  activePasscodeId: null,
  expiresAt: null,
  remainingSeconds: 0,
  history: [],
};

export function useEmergencyUnlock() {
  const [state, setState] = useState<EmergencyUnlockState>(initialState);
  const [loading, setLoading] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const parsed = JSON.parse(raw) as EmergencyUnlockState;
        if (parsed.active && parsed.expiresAt && parsed.expiresAt <= Date.now()) {
          parsed.active = false;
          parsed.activePasscodeId = null;
          parsed.remainingSeconds = 0;
        } else if (parsed.active && parsed.expiresAt) {
          parsed.remainingSeconds = Math.max(0, Math.round((parsed.expiresAt - Date.now()) / 1000));
        }
        setState(parsed);
      }
    });
  }, []);

  useEffect(() => {
    if (!state.active || !state.expiresAt) {
      clearInterval(tickRef.current);
      return;
    }

    tickRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((state.expiresAt! - Date.now()) / 1000));
      if (remaining <= 0) {
        setState((prev) => ({
          ...prev,
          active: false,
          activePasscodeId: null,
          remainingSeconds: 0,
        }));
        clearInterval(tickRef.current);
      } else {
        setState((prev) => ({ ...prev, remainingSeconds: remaining }));
      }
    }, 1000);

    return () => clearInterval(tickRef.current);
  }, [state.active, state.expiresAt]);

  const persist = useCallback(async (next: EmergencyUnlockState) => {
    setState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const createPasscode = useCallback(
    async (durationMinutes = 30): Promise<EmergencyPasscode> => {
      setLoading(true);
      const passcode: EmergencyPasscode = {
        id: generateId(),
        code: generatePasscode(),
        createdAt: Date.now(),
        expiresAt: Date.now() + durationMinutes * 60_000,
        durationMinutes,
        used: false,
      };
      const next: EmergencyUnlockState = {
        ...state,
        history: [passcode, ...state.history].slice(0, 20),
      };
      await persist(next);
      setLoading(false);
      return passcode;
    },
    [state, persist],
  );

  const activatePasscode = useCallback(
    async (code: string): Promise<boolean> => {
      const passcode = state.history.find(
        (p) => p.code === code && !p.used && !p.revokedAt && p.expiresAt > Date.now(),
      );
      if (!passcode) return false;

      const next: EmergencyUnlockState = {
        active: true,
        activePasscodeId: passcode.id,
        expiresAt: Date.now() + passcode.durationMinutes * 60_000,
        remainingSeconds: passcode.durationMinutes * 60,
        history: state.history.map((p) =>
          p.id === passcode.id ? { ...p, used: true, usedAt: Date.now() } : p,
        ),
      };
      await persist(next);
      return true;
    },
    [state, persist],
  );

  const revokePasscode = useCallback(
    async (passcodeId: string) => {
      const isActive = state.activePasscodeId === passcodeId;
      const next: EmergencyUnlockState = {
        ...state,
        active: isActive ? false : state.active,
        activePasscodeId: isActive ? null : state.activePasscodeId,
        expiresAt: isActive ? null : state.expiresAt,
        remainingSeconds: isActive ? 0 : state.remainingSeconds,
        history: state.history.map((p) =>
          p.id === passcodeId ? { ...p, revokedAt: Date.now() } : p,
        ),
      };
      await persist(next);
    },
    [state, persist],
  );

  const endEmergencyUnlock = useCallback(async () => {
    const next: EmergencyUnlockState = {
      ...state,
      active: false,
      activePasscodeId: null,
      expiresAt: null,
      remainingSeconds: 0,
    };
    await persist(next);
  }, [state, persist]);

  return {
    state,
    loading,
    createPasscode,
    activatePasscode,
    revokePasscode,
    endEmergencyUnlock,
  };
}
