import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useTranslation } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

export type WeeklyBlocksDatum = {
  /** Weekday label already localized by the caller. */
  label: string;
  count: number;
  isToday: boolean;
  isFuture: boolean;
};

type WeeklyBlocksChartProps = {
  data: WeeklyBlocksDatum[];
};

const CHART_HEIGHT = 72;
const MIN_BAR = 3; // a sliver so an all-zero week still reads as a chart, not a gap

// Compact animated bar chart of blocks-per-day for the current week. Bars grow from the
// baseline on mount (UI-thread worklet), normalized to the week's busiest day. Pure reanimated
// + Views — no charting dependency and no native rebuild.
export function WeeklyBlocksChart({ data }: WeeklyBlocksChartProps) {
  const { colors } = useTheme();
  const t = useTranslation();
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.caption, { color: colors.text.secondary }]}>
          {t('weeklyChart.title')}
        </Text>
        <Text maxFontSizeMultiplier={1.4} style={[styles.total, { color: colors.text.primary }]}>
          {t('weeklyChart.total', { count: total })}
        </Text>
      </View>

      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {data.map((datum, index) => (
          <Bar
            key={datum.label + index}
            colors={colors}
            datum={datum}
            index={index}
            ratio={datum.count / max}
          />
        ))}
      </View>
    </View>
  );
}

function Bar({
  colors,
  datum,
  index,
  ratio,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  datum: WeeklyBlocksDatum;
  index: number;
  ratio: number;
}) {
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.value = withDelay(index * 55, withTiming(ratio, { duration: 520 }));
  }, [grow, index, ratio]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${MIN_BAR + grow.value * (100 - MIN_BAR)}%`,
  }));

  const barColor = datum.isToday
    ? colors.green[500]
    : datum.isFuture
      ? colors.bg.tertiary
      : colors.green[200];

  return (
    <View style={styles.barCell}>
      <Text
        maxFontSizeMultiplier={1.3}
        style={[styles.count, { color: datum.count > 0 ? colors.text.secondary : colors.text.muted }]}
      >
        {datum.count > 0 ? datum.count : ''}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.bg.tertiary }]}>
        <Animated.View style={[styles.fill, { backgroundColor: barColor }, fillStyle]} />
      </View>
      <Text maxFontSizeMultiplier={1.3} style={[styles.dayLabel, { color: colors.text.muted }]}>
        {datum.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  caption: {
    ...typography.captionMd,
    letterSpacing: 0.3,
  },
  total: {
    ...typography.captionMd,
    fontWeight: '700',
  },
  chart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  barCell: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    height: '100%',
    justifyContent: 'flex-end',
  },
  count: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '68%',
  },
  fill: {
    borderRadius: radius.sm,
    width: '100%',
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
