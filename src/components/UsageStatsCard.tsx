import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button } from './controls';
import { colors } from '@/theme';
import type { DailyUsageSummary } from '@/types/blocker';

type UsageStatsCardProps = {
  onFetchDailySummary: () => Promise<DailyUsageSummary>;
  onOpenUsageAccessSettings: () => Promise<void>;
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function UsageStatsCard({ onFetchDailySummary, onOpenUsageAccessSettings }: UsageStatsCardProps) {
  const [summary, setSummary] = useState<DailyUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await onFetchDailySummary();
      setSummary(result);
    } finally {
      setLoading(false);
    }
  }, [onFetchDailySummary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!summary) {
    return (
      <Card title="Screen Time" subtitle="Loading usage statistics...">
        <Button icon="refresh" tone="neutral" loading onPress={refresh}>
          Loading
        </Button>
      </Card>
    );
  }

  if (!summary.available) {
    return (
      <Card
        title="Screen Time"
        subtitle="Grant Usage Access to see screen time and app activity data."
      >
        <Button icon="cog-outline" tone="primary" onPress={() => void onOpenUsageAccessSettings()}>
          Grant Usage Access
        </Button>
      </Card>
    );
  }

  return (
    <Card
      title="Screen Time"
      subtitle={`Today — ${summary.date}`}
      action={
        <Chip compact icon="clock-outline">
          {formatMinutes(summary.totalScreenTimeMinutes ?? 0)}
        </Chip>
      }
    >
      <View style={styles.metricsRow}>
        <MetricBadge label="Total" value={formatMinutes(summary.totalScreenTimeMinutes ?? 0)} />
        <MetricBadge label="Apps" value={String(summary.appCount ?? 0)} />
        <MetricBadge label="Unlocks" value={String(summary.unlockCount ?? 0)} />
        <MetricBadge label="Notifs" value={String(summary.notificationCount ?? 0)} />
      </View>

      {(summary.topApps?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top apps</Text>
          {summary.topApps!.slice(0, 5).map((app) => (
            <View key={app.packageName} style={styles.appRow}>
              <Text style={styles.appLabel} numberOfLines={1}>
                {app.appLabel}
              </Text>
              <Text style={styles.appTime}>{formatMinutes(app.foregroundTimeMinutes)}</Text>
            </View>
          ))}
        </View>
      )}

      {(summary.categoryBreakdown?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By category</Text>
          {summary.categoryBreakdown!.slice(0, 5).map((cat) => (
            <View key={cat.category} style={styles.appRow}>
              <Text style={styles.appLabel} numberOfLines={1}>
                {cat.category}
              </Text>
              <Text style={styles.appTime}>{formatMinutes(cat.totalTimeMinutes)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.refreshRow}>
        <Button icon="refresh" tone="neutral" loading={loading} onPress={refresh}>
          Refresh
        </Button>
      </View>
    </Card>
  );
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-around',
    paddingTop: 14,
  },
  metric: {
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  metricLabel: {
    color: colors.text.muted,
    fontSize: 12,
  },
  section: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    gap: 6,
    marginTop: 8,
    paddingTop: 12,
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  appRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  appLabel: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 14,
    marginRight: 8,
  },
  appTime: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  refreshRow: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 14,
  },
});
