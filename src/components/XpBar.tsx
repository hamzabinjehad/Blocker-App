import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { useTheme } from '@/theme';
import { radius, shadow, spacing, typography } from '@/theme';

type XpBarProps = {
  xp: number;
  xpToNext: number;
  level: number;
};

export function XpBar({ xp, xpToNext, level }: XpBarProps) {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const ratio = useMemo(() => Math.min(1, xpToNext > 0 ? xp / xpToNext : 0), [xp, xpToNext]);

  useEffect(() => {
    Animated.spring(progress, {
      damping: 15,
      mass: 0.8,
      stiffness: 100,
      toValue: ratio,
      useNativeDriver: false,
    }).start();
  }, [progress, ratio]);

  const fillStyle = {
    width: progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    }),
  };

  return (
    <View style={[s.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }, shadow.sm]}>
      <View style={s.header}>
        <View style={[s.iconBox, { backgroundColor: colors.purple[50], borderColor: colors.border.subtle }]}>
          <AppIcon name="xp" size={20} color={colors.purple[500]} />
        </View>
        <View style={s.textColumn}>
          <Text selectable style={[s.levelLabel, { color: colors.text.primary }]}>Level {level}</Text>
          <View style={[s.track, { backgroundColor: colors.bg.tertiary }]}>
            <Animated.View style={[s.fill, { backgroundColor: colors.purple[400] }, fillStyle]} />
          </View>
        </View>
        <Text selectable style={[s.xpText, { color: colors.text.muted }]}>{xp}/{xpToNext}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    justifyContent: 'center',
    flex: 1,
    borderWidth: 1,
    minHeight: 76,
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  textColumn: {
    flex: 1,
  },
  levelLabel: {
    ...typography.caption,
    fontWeight: '700',
    marginBottom: 4,
  },
  track: {
    borderRadius: radius.full,
    height: 6,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.full,
    height: '100%',
  },
  xpText: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
});
