import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DayRecord } from '@/store/useGamification';
import { radius, spacing, typography, useTheme } from '@/theme';

import { FlameCanvas } from './FlameCanvas';
import { WeekRow } from './WeekRow';
import {
  getStreakButtonLabel,
  getStreakMotivation,
  getStreakStatusLabel,
  type StreakPopupState,
} from './streakCopy';

type StreakPopupProps = {
  currentStreak: number;
  dayHistory: DayRecord[];
  longestStreak: number;
  previousStreak: number;
  state: StreakPopupState;
  visible: boolean;
  onContinue: () => void;
};

export function StreakPopup({
  currentStreak,
  dayHistory,
  longestStreak,
  previousStreak,
  state,
  visible,
  onContinue,
}: StreakPopupProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const entrance = useRef(new Animated.Value(0)).current;
  const [displayedStreak, setDisplayedStreak] = useState(currentStreak);
  const accent = state === 'freeze' ? colors.blue[400] : state === 'freshStart' ? '#D9A441' : colors.green[500];

  useEffect(() => {
    if (!visible) return;
    entrance.setValue(0);
    Animated.timing(entrance, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entrance, visible]);

  useEffect(() => {
    if (!visible) return;
    const from = Number.isFinite(previousStreak) ? previousStreak : currentStreak;
    const to = currentStreak;
    const started = Date.now();
    const duration = 820;
    setDisplayedStreak(from);

    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedStreak(Math.round(from + (to - from) * eased));
      if (progress >= 1) clearInterval(timer);
    }, 32);

    return () => clearInterval(timer);
  }, [currentStreak, previousStreak, visible]);

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onContinue}>
      <Animated.View
        style={[
          s.backdrop,
          {
            backgroundColor: colors.bg.primary,
            opacity: entrance,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            paddingTop: Math.max(insets.top, spacing.lg),
          },
        ]}
      >
        <Animated.View
          style={[
            s.content,
            {
              transform: [
                {
                  translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[s.badge, { backgroundColor: colors.bg.tertiary, borderColor: colors.border.subtle }]}>
            <View style={[s.badgeDot, { backgroundColor: accent }]} />
            <Text selectable style={[s.badgeText, { color: colors.text.secondary }]}>
              {getStreakStatusLabel(state)}
            </Text>
          </View>

          <View style={s.visualSlot}>
            <FlameCanvas state={state} streakDays={Math.max(currentStreak, previousStreak)} />
          </View>

          <View style={s.numberGroup}>
            <Text selectable style={[s.number, { color: colors.text.primary }]}>
              {displayedStreak}
            </Text>
            <Text selectable style={[s.numberLabel, { color: colors.text.secondary }]}>
              Day streak
            </Text>
          </View>

          <Text selectable style={[s.motivation, { color: colors.text.primary }]}>
            {getStreakMotivation(currentStreak, state)}
          </Text>

          <View style={s.weekBlock}>
            <WeekRow days={dayHistory} todayState={state} />
            <Text selectable style={[s.bestText, { color: colors.text.muted }]}>
              Best streak: {longestStreak} days
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            style={({ pressed }) => [
              s.button,
              {
                backgroundColor: state === 'freshStart' ? colors.text.primary : colors.green[500],
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text selectable={false} style={[s.buttonText, { color: colors.text.inverse }]}>
              {getStreakButtonLabel(state)}
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    paddingHorizontal: 20,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  badgeDot: {
    borderRadius: radius.full,
    height: 8,
    width: 8,
  },
  badgeText: {
    ...typography.captionMd,
  },
  bestText: {
    ...typography.caption,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 52,
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    ...typography.bodyMd,
  },
  content: {
    alignItems: 'center',
    alignSelf: 'center',
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'space-between',
    maxWidth: 420,
    paddingVertical: spacing.lg,
    width: '100%',
  },
  motivation: {
    ...typography.bodyLg,
    maxWidth: 310,
    minHeight: 48,
    textAlign: 'center',
  },
  number: {
    fontSize: 72,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 78,
    textAlign: 'center',
  },
  numberGroup: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  numberLabel: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: 0,
  },
  visualSlot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 156,
    width: '100%',
  },
  weekBlock: {
    gap: spacing.sm,
    width: '100%',
  },
});
