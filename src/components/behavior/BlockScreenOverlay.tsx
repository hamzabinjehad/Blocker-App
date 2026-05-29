import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { ProgressBar, Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '../controls';
import { radius, shadow, spacing, typography, useTheme } from '@/theme';
import type { BlockEvent } from '@/types/blocker';

type BlockScreenOverlayProps = {
  event?: BlockEvent;
  durationSeconds: number;
  requiresPin: boolean;
  onDismiss: (pin?: string) => Promise<void>;
};

export function BlockScreenOverlay({ event, durationSeconds, requiresPin, onDismiss }: BlockScreenOverlayProps) {
  const { colors } = useTheme();
  const [remaining, setRemaining] = useState(durationSeconds);
  const [pin, setPin] = useState('');

  useEffect(() => {
    setRemaining(Math.max(5, durationSeconds));
    setPin('');
  }, [durationSeconds, event?.id]);

  useEffect(() => {
    if (!event || requiresPin) return;
    if (remaining <= 0) {
      void onDismiss();
      return;
    }

    const timer = setTimeout(() => setRemaining((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [event, onDismiss, remaining, requiresPin]);

  const total = Math.max(5, durationSeconds);

  return (
    <Modal animationType="fade" presentationStyle="fullScreen" visible={Boolean(event)}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg.primary }]}>
        <View style={styles.content}>
          <Surface
            mode="elevated"
            style={[
              styles.panel,
              {
                backgroundColor: colors.bg.secondary,
                borderColor: colors.border.green,
              },
            ]}
          >
            <View style={[styles.breathCircle, { backgroundColor: colors.green[50], borderColor: colors.border.green }]}>
              <Text style={[styles.breathText, { color: colors.green[600] }]}>Breathe</Text>
            </View>
            <Text style={[styles.title, { color: colors.text.primary }]}>This is blocked. Take a breath.</Text>
            <Text style={[styles.copy, { color: colors.text.secondary }]}>
              You're doing the right thing by giving yourself space.
            </Text>

            {!requiresPin ? (
              <ProgressBar color={colors.green[500]} progress={total > 0 ? remaining / total : 0} />
            ) : null}

            {requiresPin ? (
              <>
                <Field
                  keyboardType="number-pad"
                  label="Parent PIN"
                  onChangeText={setPin}
                  placeholder="Enter PIN"
                  secureTextEntry
                  value={pin}
                />
                <Button onPress={() => void onDismiss(pin)}>Dismiss</Button>
              </>
            ) : (
              <>
                <Text style={[styles.timer, { color: colors.text.secondary }]}>A few seconds: {remaining}s</Text>
                <Button tone="neutral" onPress={() => void onDismiss()}>
                  Dismiss
                </Button>
              </>
            )}
          </Surface>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  breathCircle: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 62,
    borderWidth: 1,
    height: 124,
    justifyContent: 'center',
    width: 124,
  },
  breathText: {
    ...typography.bodyMd,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  copy: {
    ...typography.body,
    textAlign: 'center',
  },
  panel: {
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
    ...shadow.lg,
  },
  safeArea: {
    flex: 1,
  },
  timer: {
    ...typography.captionMd,
    textAlign: 'center',
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
  },
});
