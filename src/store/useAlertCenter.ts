import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AlertPreferences, AlertSeverity, ViolationAlert } from '@/types/blocker';

const ALERTS_KEY = 'alert_center_alerts';
const PREFS_KEY = 'alert_center_prefs';
const MAX_ALERTS = 200;

function generateId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const defaultPreferences: AlertPreferences = {
  enabled: true,
  notifyOnBlock: true,
  notifyOnTamper: true,
  notifyOnBypass: true,
  notifyOnUnlockRequest: true,
  minSeverity: 'warning',
  quietHoursEnabled: false,
  quietHoursStart: 22 * 60,
  quietHoursEnd: 7 * 60,
  dailyDigestEnabled: false,
  dailyDigestHour: 8,
};

const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

export function useAlertCenter() {
  const [alerts, setAlerts] = useState<ViolationAlert[]>([]);
  const [preferences, setPreferences] = useState<AlertPreferences>(defaultPreferences);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(ALERTS_KEY),
      AsyncStorage.getItem(PREFS_KEY),
    ]).then(([alertsRaw, prefsRaw]) => {
      if (alertsRaw) {
        const parsed = JSON.parse(alertsRaw) as ViolationAlert[];
        setAlerts(parsed);
        setUnreadCount(parsed.filter((a) => !a.read).length);
      }
      if (prefsRaw) {
        setPreferences({ ...defaultPreferences, ...JSON.parse(prefsRaw) });
      }
    });
  }, []);

  const persistAlerts = useCallback(async (next: ViolationAlert[]) => {
    const trimmed = next.slice(0, MAX_ALERTS);
    setAlerts(trimmed);
    setUnreadCount(trimmed.filter((a) => !a.read).length);
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(trimmed));
  }, []);

  const persistPreferences = useCallback(async (next: AlertPreferences) => {
    setPreferences(next);
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }, []);

  const addAlert = useCallback(
    async (alert: Omit<ViolationAlert, 'id' | 'timestamp' | 'read' | 'notified'>) => {
      if (!preferences.enabled) return;
      if (SEVERITY_WEIGHT[alert.severity] < SEVERITY_WEIGHT[preferences.minSeverity]) return;

      const full: ViolationAlert = {
        ...alert,
        id: generateId(),
        timestamp: Date.now(),
        read: false,
        notified: false,
      };
      await persistAlerts([full, ...alerts]);
    },
    [alerts, preferences, persistAlerts],
  );

  const markAsRead = useCallback(
    async (alertId: string) => {
      const next = alerts.map((a) => (a.id === alertId ? { ...a, read: true } : a));
      await persistAlerts(next);
    },
    [alerts, persistAlerts],
  );

  const markAllAsRead = useCallback(async () => {
    const next = alerts.map((a) => ({ ...a, read: true }));
    await persistAlerts(next);
  }, [alerts, persistAlerts]);

  const deleteAlert = useCallback(
    async (alertId: string) => {
      await persistAlerts(alerts.filter((a) => a.id !== alertId));
    },
    [alerts, persistAlerts],
  );

  const clearAllAlerts = useCallback(async () => {
    await persistAlerts([]);
  }, [persistAlerts]);

  const updatePreferences = useCallback(
    async (patch: Partial<AlertPreferences>) => {
      await persistPreferences({ ...preferences, ...patch });
    },
    [preferences, persistPreferences],
  );

  const getAlertsByType = useCallback(
    (type: ViolationAlert['type']) => alerts.filter((a) => a.type === type),
    [alerts],
  );

  const getAlertsBySeverity = useCallback(
    (severity: AlertSeverity) => alerts.filter((a) => a.severity === severity),
    [alerts],
  );

  return {
    alerts,
    preferences,
    unreadCount,
    addAlert,
    markAsRead,
    markAllAsRead,
    deleteAlert,
    clearAllAlerts,
    updatePreferences,
    getAlertsByType,
    getAlertsBySeverity,
  };
}
