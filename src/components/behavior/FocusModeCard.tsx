import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Switch, Text } from 'react-native-paper';

import { Card } from '../Card';
import { Button, Field } from '../controls';
import { colors, radius, spacing, typography } from '@/theme';
import type { FocusPolicy, FocusPolicyUpdate, FocusState, InstalledApp } from '@/types/blocker';

type FocusModeCardProps = {
  policy: FocusPolicy;
  state: FocusState;
  installedApps: InstalledApp[];
  pinConfigured: boolean;
  onChange: (policy: FocusPolicyUpdate) => Promise<void>;
  onRefreshApps: () => Promise<void>;
};

export function FocusModeCard({
  policy,
  state,
  installedApps,
  pinConfigured,
  onChange,
  onRefreshApps,
}: FocusModeCardProps) {
  const schedule = policy.schedules[0] ?? defaultSchedule;
  const [pin, setPin] = useState('');
  const [startTime, setStartTime] = useState(minutesToTime(schedule.startMinutes));
  const [endTime, setEndTime] = useState(minutesToTime(schedule.endMinutes));
  const [packageInput, setPackageInput] = useState('');
  const [appSearch, setAppSearch] = useState('');

  useEffect(() => {
    setStartTime(minutesToTime(schedule.startMinutes));
    setEndTime(minutesToTime(schedule.endMinutes));
  }, [schedule.endMinutes, schedule.startMinutes]);

  const appRows = useMemo(
    () => {
      const query = appSearch.trim().toLowerCase();
      return installedApps
        .filter((app) => app.enabled)
        .filter((app) => {
          if (!query) return true;
          return app.label.toLowerCase().includes(query) || app.packageName.toLowerCase().includes(query);
        })
        .slice(0, 24);
    },
    [appSearch, installedApps],
  );

  const update = (patch: FocusPolicyUpdate) => {
    void onChange(pinConfigured ? { ...patch, adminPin: pin } : patch);
  };

  const saveSchedule = () => {
    update({
      schedules: [
        {
          ...schedule,
          enabled: true,
          startMinutes: timeToMinutes(startTime, schedule.startMinutes),
          endMinutes: timeToMinutes(endTime, schedule.endMinutes),
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        },
      ],
    });
  };

  const addPackage = (kind: 'allow' | 'block', packageName = packageInput) => {
    const normalized = normalizePackage(packageName);
    if (!normalized) return;
    if (kind === 'allow') {
      update({ allowedPackages: [...new Set([...policy.allowedPackages, normalized])] });
    } else {
      update({ blockedPackages: [...new Set([...policy.blockedPackages, normalized])] });
    }
    setPackageInput('');
  };

  const removePackage = (kind: 'allow' | 'block', packageName: string) => {
    const key = normalizePackage(packageName);
    if (kind === 'allow') {
      update({ allowedPackages: policy.allowedPackages.filter((item) => item !== key) });
    } else {
      update({ blockedPackages: policy.blockedPackages.filter((item) => item !== key) });
    }
  };

  return (
    <Card
      title="Focus Mode and App Blocking"
      subtitle="Managed mode can suspend apps; Accessibility also blocks foreground apps during active focus windows."
      action={
        <Chip compact icon={state.active ? 'timer-lock-outline' : 'timer-outline'}>
          {state.active ? 'Focus active' : 'Focus idle'}
        </Chip>
      }
    >
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="Parent PIN for Focus changes"
          onChangeText={setPin}
          placeholder="Enter PIN"
          secureTextEntry
          value={pin}
        />
      ) : null}

      <View style={styles.row}>
        <Text style={styles.label}>Focus Mode</Text>
        <Switch onValueChange={(focusModeEnabled) => update({ focusModeEnabled })} value={policy.focusModeEnabled} />
      </View>

      <View style={styles.grid}>
        <View style={{ flex: 1 }}><Field label="Start time" onChangeText={setStartTime} placeholder="22:00" value={startTime} /></View>
        <View style={{ flex: 1 }}><Field label="End time" onChangeText={setEndTime} placeholder="06:00" value={endTime} /></View>
      </View>
      <Button icon="content-save-outline" tone="neutral" onPress={saveSchedule}>
        Save Daily Focus Window
      </Button>

      <Field
        label="Package name"
        onChangeText={setPackageInput}
        placeholder="com.example.app"
        value={packageInput}
      />
      <View style={styles.buttonRow}>
        <Button icon="check-circle-outline" onPress={() => addPackage('allow')}>
          Allow
        </Button>
        <Button icon="block-helper" tone="danger" onPress={() => addPackage('block')}>
          Block
        </Button>
      </View>

      <PackageChips
        emptyLabel="No extra allowed apps."
        icon="check"
        packages={policy.allowedPackages}
        tone="allow"
        onRemove={(packageName) => removePackage('allow', packageName)}
      />
      <PackageChips
        emptyLabel="No always-blocked apps."
        icon="block-helper"
        packages={policy.blockedPackages}
        tone="block"
        onRemove={(packageName) => removePackage('block', packageName)}
      />

      <View style={styles.appListHeader}>
        <Text style={styles.label}>Installed apps</Text>
        <Button icon="refresh" tone="neutral" onPress={() => void onRefreshApps()}>
          Refresh
        </Button>
      </View>
      <Field
        label="Search installed apps"
        onChangeText={setAppSearch}
        placeholder="App name or package"
        value={appSearch}
      />
      <View style={styles.appList}>
        {appRows.length > 0 ? appRows.map((app) => (
          <View key={app.packageName} style={styles.appRow}>
            <View style={styles.appNameGroup}>
              <Text style={styles.appLabel}>{app.label}</Text>
              <Text style={styles.packageName} numberOfLines={1}>
                {app.packageName}
              </Text>
            </View>
            <View style={styles.appActions}>
              <Button icon="check" tone="neutral" onPress={() => addPackage('allow', app.packageName)}>
                Allow
              </Button>
              <Button icon="block-helper" tone="danger" onPress={() => addPackage('block', app.packageName)}>
                Block
              </Button>
            </View>
          </View>
        )) : (
          <Text style={styles.empty}>No installed apps match this filter.</Text>
        )}
      </View>

      <Text style={styles.note}>
        Current focus allowlist includes default phone, SMS, launcher, System UI, and this app automatically. Suspended
        packages: {state.suspendedPackageCount}.
      </Text>
    </Card>
  );
}

function PackageChips({
  packages,
  icon,
  emptyLabel,
  tone,
  onRemove,
}: {
  packages: string[];
  icon: string;
  emptyLabel: string;
  tone: 'allow' | 'block';
  onRemove: (packageName: string) => void;
}) {
  return (
    <View style={styles.chipList}>
      {packages.length > 0 ? (
        packages.map((packageName) => (
          <Chip
            key={packageName}
            compact
            closeIcon="close"
            icon={icon}
            onClose={() => onRemove(packageName)}
            style={tone === 'allow' ? styles.allowChip : styles.blockChip}
          >
            {packageName}
          </Chip>
        ))
      ) : (
        <Text style={styles.empty}>{emptyLabel}</Text>
      )}
    </View>
  );
}

const defaultSchedule = {
  id: 'daily-night-focus',
  label: 'Daily night focus',
  enabled: true,
  startMinutes: 22 * 60,
  endMinutes: 6 * 60,
  daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
};

function normalizePackage(value: string) {
  return value.trim().toLowerCase();
}

function minutesToTime(value: number) {
  const minutes = Math.min(1439, Math.max(0, Math.round(value)));
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function timeToMinutes(value: string, fallback: number) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return hour * 60 + minute;
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.bodyMd,
    color: colors.text.primary,
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  allowChip: {
    backgroundColor: colors.green[50],
  },
  blockChip: {
    backgroundColor: colors.red[50],
  },
  empty: {
    ...typography.caption,
    color: colors.text.muted,
  },
  appListHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  appList: {
    marginTop: spacing.sm,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: 1,
  },
  appNameGroup: {
    flex: 1,
    gap: 2,
  },
  appLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  packageName: {
    ...typography.caption,
    color: colors.text.muted,
  },
  appActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  note: {
    ...typography.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
});
