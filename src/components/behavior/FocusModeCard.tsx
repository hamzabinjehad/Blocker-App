import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
  const [selectedDays, setSelectedDays] = useState(schedule.daysOfWeek);
  const [appSearch, setAppSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);

  useEffect(() => {
    setStartTime(minutesToTime(schedule.startMinutes));
    setEndTime(minutesToTime(schedule.endMinutes));
    setSelectedDays(schedule.daysOfWeek);
  }, [schedule.daysOfWeek, schedule.endMinutes, schedule.startMinutes]);

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

  const applySchedule = (nextStart = startTime, nextEnd = endTime, nextDays = selectedDays) => {
    update({
      schedules: [
        {
          ...schedule,
          enabled: true,
          startMinutes: timeToMinutes(nextStart, schedule.startMinutes),
          endMinutes: timeToMinutes(nextEnd, schedule.endMinutes),
          daysOfWeek: nextDays.length > 0 ? nextDays : schedule.daysOfWeek,
        },
      ],
    });
  };

  const addPackage = (kind: 'allow' | 'block', packageName: string) => {
    const normalized = normalizePackage(packageName);
    if (!normalized) return;
    if (kind === 'allow') {
      update({ allowedPackages: [...new Set([...policy.allowedPackages, normalized])] });
    } else {
      update({ blockedPackages: [...new Set([...policy.blockedPackages, normalized])] });
    }
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
      title="Focus Schedule"
      subtitle="Block apps during specific hours."
      action={
        <Chip compact icon={state.active ? 'timer-lock-outline' : 'timer-outline'}>
          {state.active ? 'Active' : 'Schedule off'}
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
        <TimeChip
          icon="moon-waning-crescent"
          label={startTime}
          onPress={() => {
            const next = minutesToTime(timeToMinutes(startTime, schedule.startMinutes) + 30);
            setStartTime(next);
            applySchedule(next, endTime, selectedDays);
          }}
        />
        <Text style={styles.timeArrow}>to</Text>
        <TimeChip
          icon="weather-sunset-up"
          label={endTime}
          onPress={() => {
            const next = minutesToTime(timeToMinutes(endTime, schedule.endMinutes) + 30);
            setEndTime(next);
            applySchedule(startTime, next, selectedDays);
          }}
        />
      </View>
      <View style={styles.timeSummary}>
        <Text style={styles.empty}>{focusDurationLabel(startTime, endTime)} · {daySummary(selectedDays)}</Text>
      </View>
      <View style={styles.dayRow}>
        {dayOptions.map((day) => (
          <Chip
            key={day.value}
            compact
            selected={selectedDays.includes(day.value)}
            onPress={() => {
              const nextDays = toggleDay(selectedDays, day.value);
              setSelectedDays(nextDays);
              applySchedule(startTime, endTime, nextDays);
            }}
          >
            {day.label}
          </Chip>
        ))}
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
        <Text style={styles.label}>Add an app</Text>
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
          <Pressable
            accessibilityRole="button"
            key={app.packageName}
            onPress={() => setSelectedApp(app)}
            style={[
              styles.appRow,
              selectedApp?.packageName === app.packageName ? styles.appRowSelected : null,
            ]}
          >
            <View style={styles.appNameGroup}>
              <Text style={styles.appLabel}>{app.label}</Text>
              <Text style={styles.packageName} numberOfLines={1}>
                {appStatusLabel(app.packageName, policy.allowedPackages, policy.blockedPackages)}
              </Text>
            </View>
            <Text style={styles.selectHint}>Select</Text>
          </Pressable>
        )) : (
          <Text style={styles.empty}>No installed apps match this filter.</Text>
        )}
      </View>

      {selectedApp ? (
        <View style={styles.selectionPanel}>
          <View style={styles.appNameGroup}>
            <Text style={styles.appLabel}>{selectedApp.label}</Text>
            <Text style={styles.empty}>{appStatusLabel(selectedApp.packageName, policy.allowedPackages, policy.blockedPackages)}</Text>
          </View>
          <View style={styles.appActions}>
            <Button icon="check" tone="neutral" onPress={() => addPackage('allow', selectedApp.packageName)}>
              Allow during focus
            </Button>
            <Button icon="block-helper" tone="danger" onPress={() => addPackage('block', selectedApp.packageName)}>
              Block during focus
            </Button>
          </View>
        </View>
      ) : null}

      <Text style={styles.note}>Core phone, SMS, launcher, System UI, and this app stay available automatically.</Text>
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

function TimeChip({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.timeChip}>
      <Chip compact icon={icon}>{label} ▾</Chip>
    </Pressable>
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

const dayOptions = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 },
];

function toggleDay(current: number[], day: number) {
  if (current.includes(day)) return current.filter((item) => item !== day);
  return [...current, day].sort((left, right) => left - right);
}

function daySummary(days: number[]) {
  if (days.length === 7) return 'every day';
  if (days.length === 5 && days.every((day) => day >= 1 && day <= 5)) return 'weekdays';
  if (days.length === 2 && days.includes(6) && days.includes(7)) return 'weekends';
  if (days.length === 0) return 'no days selected';
  return `${days.length} days`;
}

function normalizePackage(value: string) {
  return value.trim().toLowerCase();
}

function minutesToTime(value: number) {
  const minutes = ((Math.round(value) % 1440) + 1440) % 1440;
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

function focusDurationLabel(start: string, end: string) {
  const startMinutes = timeToMinutes(start, 22 * 60);
  const endMinutes = timeToMinutes(end, 6 * 60);
  const duration = endMinutes > startMinutes ? endMinutes - startMinutes : 1440 - startMinutes + endMinutes;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  if (minutes === 0) return `${hours} hours`;
  return `${hours}h ${minutes}m`;
}

function appStatusLabel(packageName: string, allowedPackages: string[], blockedPackages: string[]) {
  if (allowedPackages.includes(packageName)) return 'Allowed during focus';
  if (blockedPackages.includes(packageName)) return 'Blocked during focus';
  return 'Tap to choose focus behavior';
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
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
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
    flexDirection: 'column',
    gap: spacing.xs,
  },
  appRowSelected: {
    backgroundColor: colors.green[50],
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  note: {
    ...typography.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
  selectHint: {
    ...typography.captionMd,
    color: colors.text.secondary,
  },
  selectionPanel: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  timeArrow: {
    ...typography.captionMd,
    color: colors.text.secondary,
  },
  timeSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeChip: {
    borderRadius: radius.full,
  },
});
