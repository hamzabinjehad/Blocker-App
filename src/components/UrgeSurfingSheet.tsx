import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const recovery = useRecovery();
  const gamification = useGamification();
  const [remainingSeconds, setRemainingSeconds] = useState(URGE_SECONDS);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);

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
      setCompleted(true);
      recovery.recordUrgeSurfed();
      gamification.recordUrgeSurfed();
      return;
    }
    const timer = setTimeout(() => setRemainingSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [completed, gamification, recovery, remainingSeconds, started, visible]);

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
    const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [remainingSeconds]);

  const elapsed = URGE_SECONDS - remainingSeconds;
  const cycleSecond = elapsed % BREATH_CYCLE_SECONDS;
  const breathLabel = cycleSecond < 4 ? 'Breathe in' : cycleSecond < 8 ? 'Hold' : 'Breathe out';
  const breathCount = cycleSecond < 4 ? 4 - cycleSecond : cycleSecond < 8 ? 8 - cycleSecond : 14 - cycleSecond;
  const ringScale = cycleSecond < 4 ? 1 + cycleSecond * 0.06 : cycleSecond < 8 ? 1.24 : 1.24 - (cycleSecond - 8) * 0.04;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated }]}>
          <View style={[s.sheetHandle, { backgroundColor: colors.border.default }]} />
          <Text style={[s.sheetTitle, { color: colors.text.primary }]}>Urge surfing</Text>
          <Text style={[s.sheetCopy, { color: colors.text.secondary }]}>
            Stay with the next breath. Seven minutes is enough for the wave to move.
          </Text>

          <View style={s.timerPanel}>
            <View
              style={[
                s.breathRing,
                {
                  borderColor: colors.green[500],
                  transform: [{ scale: started && !completed ? ringScale : 1 }],
                },
              ]}
            >
              <Text style={[s.breathLabel, { color: colors.green[600] }]}>
                {completed ? 'Done' : started ? breathLabel : 'Ready'}
              </Text>
              <Text style={[s.breathCount, { color: colors.text.secondary }]}>
                {completed ? '+50 XP' : started ? breathCount : '7 min'}
              </Text>
            </View>
            <Text style={[s.timer, { color: colors.text.primary }]}>
              {completed ? 'You made it.' : timerLabel}
            </Text>
            <Text style={[s.privateText, { color: colors.text.secondary }]}>
              Surfed urges are tracked privately in Progress.
            </Text>
          </View>

          {completed ? (
            <Pressable accessibilityRole="button" onPress={onClose} style={[s.primaryButton, { backgroundColor: colors.green[500] }]}>
              <Text style={[s.primaryButtonText, { color: colors.text.inverse }]}>Close</Text>
            </Pressable>
          ) : started ? (
            <Pressable accessibilityRole="button" onPress={onClose} style={s.textButton}>
              <Text style={[s.textButtonLabel, { color: colors.text.secondary }]}>Keep protection on</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setStarted(true)} style={[s.primaryButton, { backgroundColor: colors.green[500] }]}>
              <Text style={[s.primaryButtonText, { color: colors.text.inverse }]}>Start 7 minutes</Text>
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
