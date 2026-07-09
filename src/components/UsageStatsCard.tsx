import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button } from './controls';
import { formatShortDate, useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import type { DailyUsageSummary } from '@/types/blocker';

type UsageStatsCardProps = {
  onFetchDailySummary: () => Promise<DailyUsageSummary>;
  onOpenUsageAccessSettings: () => Promise<void>;
};

type Translate = ReturnType<typeof useI18n>['t'];

function formatMinutes(minutes: number, t: Translate): string {
  if (minutes < 60) return t('time.minutesShort', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0
    ? t('time.hoursMinutesShort', { hours, minutes: remaining })
    : t('time.hoursShort', { count: hours });
}

export function UsageStatsCard({ onFetchDailySummary, onOpenUsageAccessSettings }: UsageStatsCardProps) {
  const { colors } = useTheme();
  const { t, language } = useI18n();
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
      <Card title={t('usage.title')} subtitle={t('usage.loadingSubtitle')}>
        <Button icon="refresh" tone="neutral" loading onPress={refresh}>
          {t('common.loading')}
        </Button>
      </Card>
    );
  }

  if (!summary.available) {
    return (
      <Card title={t('usage.title')} subtitle={t('usage.grantSubtitle')}>
        <Button icon="cog-outline" tone="primary" onPress={() => void onOpenUsageAccessSettings()}>
          {t('usage.grantCta')}
        </Button>
      </Card>
    );
  }

  // summary.date is 'YYYY-MM-DD'; parse at local midnight so the day never
  // shifts under the device timezone.
  const dateLabel = summary.date ? formatShortDate(new Date(summary.date + 'T00:00:00'), language) : '';

  return (
    <Card
      title={t('usage.title')}
      subtitle={t('usage.todaySubtitle', { date: dateLabel })}
      action={
        <Chip compact icon="clock-outline">
          {formatMinutes(summary.totalScreenTimeMinutes ?? 0, t)}
        </Chip>
      }
    >
      <View style={[styles.metricsRow, { borderTopColor: colors.border.subtle }]}>
        <MetricBadge label={t('usage.total')} value={formatMinutes(summary.totalScreenTimeMinutes ?? 0, t)} />
        <MetricBadge label={t('usage.apps')} value={String(summary.appCount ?? 0)} />
        <MetricBadge label={t('usage.unlocks')} value={String(summary.unlockCount ?? 0)} />
        <MetricBadge label={t('usage.notifs')} value={String(summary.notificationCount ?? 0)} />
      </View>

      {(summary.topApps?.length ?? 0) > 0 && (
        <View style={[styles.section, { borderTopColor: colors.border.subtle }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>{t('usage.topApps')}</Text>
          {summary.topApps!.slice(0, 5).map((app) => (
            <View key={app.packageName} style={styles.appRow}>
              <Text style={[styles.appLabel, { color: colors.text.primary }]} numberOfLines={1}>
                {app.appLabel}
              </Text>
              <Text style={[styles.appTime, { color: colors.text.secondary }]}>
                {formatMinutes(app.foregroundTimeMinutes, t)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {(summary.categoryBreakdown?.length ?? 0) > 0 && (
        <View style={[styles.section, { borderTopColor: colors.border.subtle }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>{t('usage.byCategory')}</Text>
          {summary.categoryBreakdown!.slice(0, 5).map((cat) => (
            <View key={cat.category} style={styles.appRow}>
              <Text style={[styles.appLabel, { color: colors.text.primary }]} numberOfLines={1}>
                {cat.category}
              </Text>
              <Text style={[styles.appTime, { color: colors.text.secondary }]}>
                {formatMinutes(cat.totalTimeMinutes, t)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.refreshRow, { borderTopColor: colors.border.subtle }]}>
        <Button icon="refresh" tone="neutral" loading={loading} onPress={refresh}>
          {t('common.refresh')}
        </Button>
      </View>
    </Card>
  );
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metric}>
      <Text maxFontSizeMultiplier={1.4} style={[styles.metricValue, { color: colors.text.primary }]}>{value}</Text>
      <Text maxFontSizeMultiplier={1.4} style={[styles.metricLabel, { color: colors.text.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
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
    fontSize: 18,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 12,
  },
  section: {
    borderTopWidth: 1,
    gap: 6,
    marginTop: 8,
    paddingTop: 12,
  },
  sectionTitle: {
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
    flex: 1,
    fontSize: 14,
    marginEnd: 8,
  },
  appTime: {
    fontSize: 14,
    fontWeight: '600',
  },
  refreshRow: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 14,
  },
});
