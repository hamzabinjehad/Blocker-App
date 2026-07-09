import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useGamification } from '@/store/useGamification';
import { useRecovery } from '@/store/useRecovery';
import { radius, spacing, typography, useTheme } from '@/theme';

const URGE_SECONDS = 7 * 60;
const BREATH_CYCLE_SECONDS = 14;

type UrgeSurfingSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function UrgeSurfingSheet({ visible, onClose }: UrgeSurfingSheetProps) {
  const { colors } = useTheme();
  const t = useTranslation();
  const recovery = useRecovery();
  const gamification = useGamification();
  const [remainingSeconds, setRemainingSeconds] = useState(URGE_SECONDS);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const ringScale = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      setStarted(false);
      setCompleted(false);
      setRemainingSeconds(URGE_SECONDS);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !started || completed) return;
    if (remainingSeconds <= 0) {
      haptics.success();
      setCompleted(true);
      recovery.recordUrgeSurfed();
      gamification.recordUrgeSurfed();
      return;
    }
    const timer = setTimeout(() => setRemainingSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [completed, gamification, recovery, remainingSeconds, started, visible]);

  // 14s breathing loop matching the label phases: in 4s → hold 4s → out 6s.
  // Runs as a UI-thread worklet so the ring glides instead of stepping once a second.
  useEffect(() => {
    if (visible && started && !completed) {
      ringScale.value = 1;
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.24, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
          withDelay(4000, withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.quad) })),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(ringScale);
      ringScale.value = withTiming(1, { duration: 300 });
    }
    return () => cancelAnimation(ringScale);
  }, [completed, ringScale, started, visible]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ringScale.value }] }));

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
    const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [remainingSeconds]);

  const elapsed = URGE_SECONDS - remainingSeconds;
  const cycleSecond = elapsed % BREATH_CYCLE_SECONDS;
  const breathLabel = cycleSecond < 4 ? t('urge.breatheIn') : cycleSecond < 8 ? t('urge.hold') : t('urge.breatheOut');
  const breathCount = cycleSecond < 4 ? 4 - cycleSecond : cycleSecond < 8 ? 8 - cycleSecond : 14 - cycleSecond;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated }]}>
          <View style={[s.sheetHandle, { backgroundColor: colors.border.default }]} />
          <Text style={[s.sheetTitle, { color: colors.text.primary }]}>{t('urge.title')}</Text>
          <Text style={[s.sheetCopy, { color: colors.text.secondary }]}>
            {t('urge.copy')}
          </Text>

          <View style={s.timerPanel}>
            <Animated.View style={[s.breathRing, { borderColor: colors.green[500] }, ringStyle]}>
              <Text style={[s.breathLabel, { color: colors.green[600] }]}>
                {completed ? t('urge.done') : started ? breathLabel : t('urge.ready')}
              </Text>
              <Text style={[s.breathCount, { color: colors.text.secondary }]}>
                {completed ? t('urge.reward') : started ? breathCount : t('urge.duration')}
              </Text>
            </Animated.View>
            <Text style={[s.timer, { color: colors.text.primary }]}>
              {completed ? t('urge.madeIt') : timerLabel}
            </Text>
            <Text style={[s.privateText, { color: colors.text.secondary }]}>
              {t('urge.trackedPrivately')}
            </Text>
          </View>

          {completed ? (
            <Pressable accessibilityRole="button" onPress={onClose} style={[s.primaryButton, { backgroundColor: colors.green[500] }]}>
              <Text style={[s.primaryButtonText, { color: colors.text.inverse }]}>{t('common.close')}</Text>
            </Pressable>
          ) : started ? (
            <Pressable accessibilityRole="button" onPress={onClose} style={s.textButton}>
              <Text style={[s.textButtonLabel, { color: colors.text.secondary }]}>{t('urge.keepOn')}</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.tap();
                setStarted(true);
              }}
              style={[s.primaryButton, { backgroundColor: colors.green[500] }]}
            >
              <Text style={[s.primaryButtonText, { color: colors.text.inverse }]}>{t('urge.start')}</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  breathCount: {
    ...typography.bodyMd,
  },
  breathLabel: {
    fontSize: 17,
    fontWeight: '500',
  },
  breathRing: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 2,
    height: 132,
    justifyContent: 'center',
    width: 132,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...typography.bodyMd,
  },
  privateText: {
    ...typography.caption,
    textAlign: 'center',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.xl,
    width: '100%',
  },
  sheetBackdrop: {
    backgroundColor: 'rgba(21,26,23,0.18)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetCopy: {
    ...typography.body,
  },
  sheetHandle: {
    alignSelf: 'center',
    borderRadius: radius.full,
    height: 4,
    width: 32,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  textButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
  },
  textButtonLabel: {
    ...typography.bodyMd,
  },
  timer: {
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: 0,
  },
  timerPanel: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
});
