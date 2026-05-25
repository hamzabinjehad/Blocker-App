import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { usePressScale } from '@/components/usePressScale';
import { useTheme } from '@/theme';
import { radius, shadow, spacing, typography } from '@/theme';

type HeroStatusCardProps = {
  isProtected: boolean;
  cleanMinutes: number;
  streak: number;
  level: number;
  blockedCount: number;
  loading?: boolean;
  onToggle: () => void;
};

type HeroMetricProps = {
  label: string;
  value: string | number;
};

function HeroMetric({ label, value }: HeroMetricProps) {
  const { colors } = useTheme();

  return (
    <View style={s.metricItem}>
      <Text selectable style={[s.metricValue, { color: colors.text.primary }]}>
        {value}
      </Text>
      <Text selectable style={[s.metricLabel, { color: colors.text.muted }]}>
        {label}
      </Text>
    </View>
  );
}

export function HeroStatusCard({
  isProtected,
  cleanMinutes,
  streak,
  level,
  blockedCount,
  loading = false,
  onToggle,
}: HeroStatusCardProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const entry = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressScale(0.98);

  useEffect(() => {
    Animated.timing(entry, {
      duration: 600,
      easing: Easing.out(Easing.back(1.5)),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entry]);

  useEffect(() => {
    if (!isProtected) {
      pulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isProtected, pulse]);

  const hours = Math.floor(cleanMinutes / 60);
  const minutes = cleanMinutes % 60;
  const cleanTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  const statusTitle = isProtected ? 'Protection active' : 'Protection paused';
  const statusDetail = isProtected
    ? 'Filtering, safe search, and behavior checks are running.'
    : 'Restart protection to resume filtering and app safeguards.';
  const compact = width < 390;
  const accentColor = isProtected ? colors.green[500] : colors.amber[500];
  const buttonTone = isProtected
    ? { backgroundColor: colors.red[50], color: colors.red[500], icon: colors.red[500] }
    : { backgroundColor: colors.green[600], color: colors.text.inverse, icon: colors.text.inverse };

  const iconGlowStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.08, 0.2],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.5],
        }),
      },
    ],
  };

  return (
    <Animated.View
      style={[
        s.card,
        {
          backgroundColor: colors.bg.elevated,
          borderColor: isProtected ? colors.border.green : colors.border.amber,
        },
        shadow.md,
        {
          opacity: entry,
          transform: [
            {
              translateY: entry.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={s.inner}>
        <View style={s.statusCluster}>
          <View
            style={[
              s.iconContainer,
              {
                backgroundColor: isProtected ? colors.green[50] : colors.amber[50],
                borderColor: isProtected ? colors.border.green : colors.border.amber,
              },
            ]}
          >
            {isProtected ? <Animated.View style={[s.glow, { backgroundColor: accentColor }, iconGlowStyle]} /> : null}
            <AppIcon name="shield" size={32} color={accentColor} />
          </View>

          <View style={s.statusCopy}>
            <View
              style={[
                s.statusPill,
                {
                  backgroundColor: isProtected ? colors.green[50] : colors.amber[50],
                  borderColor: isProtected ? colors.border.green : colors.border.amber,
                },
              ]}
            >
              <View style={[s.statusDot, { backgroundColor: accentColor }]} />
              <Text
                selectable
                style={[
                  s.statusPillText,
                  { color: isProtected ? colors.green[700] : colors.amber[800] },
                ]}
              >
                {isProtected ? 'Live shield' : 'Needs attention'}
              </Text>
            </View>
            <Text selectable style={[s.statusText, { color: colors.text.primary }]}>
              {statusTitle}
            </Text>
            <Text selectable style={[s.statusDetail, { color: colors.text.secondary }]}>
              {statusDetail}
            </Text>
          </View>
        </View>

        <View
          style={[
            s.todayPanel,
            {
              backgroundColor: isDark ? colors.bg.tertiary : colors.bg.primary,
              borderColor: colors.border.subtle,
            },
            compact && s.todayPanelStack,
          ]}
        >
          <View style={s.cleanBlock}>
            <Text selectable style={[s.cleanLabel, { color: colors.text.muted }]}>
              Clean time today
            </Text>
            <Text selectable style={[s.cleanTime, { color: colors.text.primary }]}>
              {cleanTime}
            </Text>
          </View>

          <Animated.View style={[s.buttonWrap, pressStyle]}>
            <Pressable
              disabled={loading}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onPress={onToggle}
              style={[
                s.toggleBtn,
                { backgroundColor: buttonTone.backgroundColor },
                loading ? { opacity: 0.7 } : undefined,
              ]}
            >
              <AppIcon name={isProtected ? 'block' : 'shield'} size={16} color={buttonTone.icon} />
              <Text style={[s.toggleText, { color: buttonTone.color }]}>
                {loading ? 'Working...' : isProtected ? 'Stop Protection' : 'Start Protection'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        <View style={[s.metricsRail, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <HeroMetric label="Day streak" value={streak} />
          <View style={[s.metricDivider, { backgroundColor: colors.border.subtle }]} />
          <HeroMetric label="Level" value={level} />
          <View style={[s.metricDivider, { backgroundColor: colors.border.subtle }]} />
          <HeroMetric label="Blocks" value={blockedCount} />
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  buttonWrap: {
    flexShrink: 0,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cleanBlock: {
    gap: spacing.xs,
    minWidth: 120,
  },
  cleanLabel: {
    ...typography.captionMd,
  },
  cleanTime: {
    ...typography.display,
    fontVariant: ['tabular-nums'],
    lineHeight: 42,
  },
  glow: {
    borderRadius: 25,
    height: 50,
    position: 'absolute',
    width: 50,
  },
  iconContainer: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  inner: {
    gap: spacing.lg,
    padding: spacing.xl,
  },
  metricDivider: {
    height: 34,
    width: 1,
  },
  metricItem: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    ...typography.caption,
  },
  metricsRail: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  metricValue: {
    ...typography.h3,
    fontVariant: ['tabular-nums'],
  },
  statusCluster: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusText: {
    ...typography.h2,
  },
  statusCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  statusDetail: {
    ...typography.body,
  },
  statusPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusPillText: {
    ...typography.label,
  },
  statusDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  todayPanel: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  todayPanelStack: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  toggleBtn: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 154,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  toggleText: {
    ...typography.bodyMd,
    fontSize: 15,
  },
});
