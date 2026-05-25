import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RemoteDevice, RemoteSession, UnlockRequest } from '@/types/blocker';

const STORAGE_KEY = 'remote_management';

function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const initialSession: RemoteSession = {
  paired: false,
  pairingCode: null,
  pairingCodeExpiresAt: 0,
  devices: [],
  pendingRequests: [],
};

export function useRemoteManagement() {
  const [session, setSession] = useState<RemoteSession>(initialSession);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as RemoteSession;
          const pendingRequests = (parsed.pendingRequests ?? []).map((r) => ({
            ...r,
            status: r.status === 'pending' && r.requestedAt + 30 * 60_000 < Date.now() ? 'expired' : r.status,
          }));
          setSession({ ...initialSession, ...parsed, pendingRequests });
        } catch (error) {
          console.error('Failed to parse remote session data', error);
        }
      }
    }).catch(console.error);
  }, []);

  const persist = useCallback(async (next: RemoteSession) => {
    setSession(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const generateNewPairingCode = useCallback(async () => {
    setLoading(true);
    const code = generatePairingCode();
    const next: RemoteSession = {
      ...session,
      pairingCode: code,
      pairingCodeExpiresAt: Date.now() + 10 * 60_000,
    };
    await persist(next);
    setLoading(false);
    return code;
  }, [session, persist]);

  const addDevice = useCallback(
    async (name: string, role: 'admin' | 'child') => {
      const device: RemoteDevice = {
        id: generateId(),
        name,
        role,
        pairedAt: Date.now(),
        lastSeen: Date.now(),
        online: true,
      };
      const next: RemoteSession = {
        ...session,
        paired: true,
        pairingCode: null,
        pairingCodeExpiresAt: 0,
        devices: [...session.devices, device],
      };
      await persist(next);
      return device;
    },
    [session, persist],
  );

  const removeDevice = useCallback(
    async (deviceId: string) => {
      const devices = session.devices.filter((d) => d.id !== deviceId);
      const next: RemoteSession = {
        ...session,
        paired: devices.length > 0,
        devices,
      };
      await persist(next);
    },
    [session, persist],
  );

  const submitUnlockRequest = useCallback(
    async (reason: string, durationMinutes = 30) => {
      const request: UnlockRequest = {
        id: generateId(),
        deviceId: 'self',
        deviceName: 'This device',
        reason,
        requestedAt: Date.now(),
        status: 'pending',
        durationMinutes,
      };
      const next: RemoteSession = {
        ...session,
        pendingRequests: [...session.pendingRequests, request],
      };
      await persist(next);
      return request;
    },
    [session, persist],
  );

  const respondToUnlockRequest = useCallback(
    async (requestId: string, approved: boolean) => {
      const next: RemoteSession = {
        ...session,
        pendingRequests: session.pendingRequests.map((r) =>
          r.id === requestId ? { ...r, status: approved ? 'approved' : 'denied', respondedAt: Date.now() } : r,
        ),
      };
      await persist(next);
    },
    [session, persist],
  );

  const clearExpiredRequests = useCallback(async () => {
    const next: RemoteSession = {
      ...session,
      pendingRequests: session.pendingRequests.filter(
        (r) => r.status === 'pending' || r.requestedAt + 24 * 60 * 60_000 > Date.now(),
      ),
    };
    await persist(next);
  }, [session, persist]);

  return {
    session,
    loading,
    generateNewPairingCode,
    addDevice,
    removeDevice,
    submitUnlockRequest,
    respondToUnlockRequest,
    clearExpiredRequests,
  };
}
