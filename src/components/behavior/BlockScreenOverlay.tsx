import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { Field } from '@/components/controls';
import { UrgeSurfingSheet } from '@/components/UrgeSurfingSheet';
import { radius, spacing, typography, useTheme } from '@/theme';
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
  const [pinSheetVisible, setPinSheetVisible] = useState(false);
  const [urgeSheetVisible, setUrgeSheetVisible] = useState(false);

  useEffect(() => {
    setRemaining(Math.max(5, durationSeconds));
    setPin('');
    setPinSheetVisible(false);
    setUrgeSheetVisible(false);
  }, [durationSeconds, event?.id]);

  useEffect(() => {
    if (!event || requiresPin) return;
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [event, remaining, requiresPin]);

  const canDismiss = requiresPin || remaining <= 0;

  return (
    <Modal animationType="fade" presentationStyle="fullScreen" visible={Boolean(event)}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg.elevated }]}>
        <View style={styles.content}>
          <View style={[styles.breathRing, { borderColor: colors.green[500] }]}>
            <AppIcon name="shield" size={48} color={colors.green[500]} />
          </View>
          <Text style={[styles.title, { color: colors.text.primary }]}>This content is blocked.</Text>
          <Text style={[styles.copy, { color: colors.text.secondary }]}>You're doing well. Take a moment.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setUrgeSheetVisible(true)}
            style={[styles.outlineButton, { borderColor: colors.green[500] }]}
          >
            <Text style={[styles.outlineButtonText, { color: colors.green[600] }]}>I'm struggling</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!canDismiss}
            onPress={() => (requiresPin ? setPinSheetVisible(true) : void onDismiss())}
            style={styles.textButton}
          >
            <Text style={[styles.textButtonLabel, { color: canDismiss ? colors.text.secondary : colors.text.muted }]}>
              {requiresPin ? 'Enter PIN to dismiss' : remaining > 0 ? `Got it in ${remaining}s` : 'Got it'}
            </Text>
          </Pressable>
        </View>

        <UrgeSurfingSheet visible={urgeSheetVisible} onClose={() => setUrgeSheetVisible(false)} />

        <Modal animationType="slide" transparent visible={pinSheetVisible} onRequestClose={() => setPinSheetVisible(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setPinSheetVisible(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: colors.bg.elevated }]}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.border.default }]} />
              <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>Enter PIN</Text>
              <Text style={[styles.sheetCopy, { color: colors.text.secondary }]}>A guardian PIN is required to dismiss this screen.</Text>
              <Field
                keyboardType="number-pad"
                label="PIN"
                onChangeText={setPin}
                placeholder="Enter PIN"
                secureTextEntry
                value={pin}
              />
              <Pressable accessibilityRole="button" onPress={() => void onDismiss(pin)} style={[styles.primaryButton, { backgroundColor: colors.green[500] }]}>
                <Text style={[styles.primaryButtonText, { color: colors.text.inverse }]}>Dismiss</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    padding: spacing.xl,
  },
  breathRing: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    height: 132,
    justifyContent: 'center',
    width: 132,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  copy: {
    ...typography.body,
    textAlign: 'center',
  },
  outlineButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
  },
  outlineButtonText: {
    ...typography.bodyMd,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 48,
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...typography.bodyMd,
  },
  safeArea: {
    flex: 1,
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
  title: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
});
