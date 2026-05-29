import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { usePressScale } from '@/components/usePressScale';
import { useTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme';

type HeroStatusCardProps = {
  isProtected: boolean;
  cleanMinutes: number;
  loading?: boolean;
  onToggle: () => void;
};

export function HeroStatusCard({
  isProtected,
  cleanMinutes,
  loading = false,
  onToggle,
}: HeroStatusCardProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressScale(0.98);

  const hours = Math.floor(cleanMinutes / 60);
  const minutes = cleanMinutes % 60;
  const cleanTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  const statusTitle = isProtected ? 'Protection active' : 'Protection paused';
  const statusDetail = isProtected
    ? 'Filtering and app safeguards are running.'
    : 'Start protection to resume blocking and focus safeguards.';
  const compact = width < 390;
  const accentColor = isProtected ? colors.green[500] : colors.amber[500];
  const buttonTone = isProtected
    ? { backgroundColor: colors.red[50], color: colors.red[500], icon: colors.red[500] }
    : { backgroundColor: colors.green[600], color: colors.text.inverse, icon: colors.text.inverse };

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.bg.elevated,
          borderColor: colors.border.subtle,
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
                borderColor: colors.border.subtle,
              },
            ]}
          >
            <AppIcon name="shield" size={32} color={accentColor} />
          </View>

          <View style={s.statusCopy}>
            <View
              style={[
                s.statusPill,
                {
                  backgroundColor: isProtected ? colors.green[50] : colors.amber[50],
                  borderColor: colors.border.subtle,
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
              backgroundColor: colors.bg.primary,
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
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  buttonWrap: {
    flexShrink: 0,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
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
  iconContainer: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  inner: {
    gap: spacing.lg,
    padding: spacing.xl,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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
