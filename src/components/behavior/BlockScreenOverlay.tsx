import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { ProgressBar, Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '../controls';
import { colors, radius, shadow } from '@/theme';
import type { BlockEvent } from '@/types/blocker';

type BlockScreenOverlayProps = {
  event?: BlockEvent;
  durationSeconds: number;
  requiresPin: boolean;
  onDismiss: (pin?: string) => Promise<void>;
};

export function BlockScreenOverlay({ event, durationSeconds, requiresPin, onDismiss }: BlockScreenOverlayProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [pin, setPin] = useState('');

  useEffect(() => {
    setRemaining(durationSeconds);
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

  return (
    <Modal animationType="fade" presentationStyle="fullScreen" visible={Boolean(event)}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Surface mode="elevated" style={styles.panel}>
            <Text style={styles.eyebrow}>BLOCK_EVENT</Text>
            <Text style={styles.title}>Content Blocked</Text>
            <Text style={styles.reason}>
              Reason: {formatReason(event?.reason)}
            </Text>
            <Text style={styles.keyword}>{event?.keyword}</Text>
            <Text style={styles.meta}>
              {event?.appName || event?.packageName} {event?.screen ? `- ${event.screen}` : ''}
            </Text>
            {!requiresPin ? (
              <ProgressBar color={colors.red[400]} progress={durationSeconds > 0 ? remaining / durationSeconds : 0} />
            ) : null}

            {requiresPin ? (
              <>
                <Field
                  keyboardType="number-pad"
                  label="Parent PIN required"
                  onChangeText={setPin}
                  placeholder="Enter PIN"
                  secureTextEntry
                  value={pin}
                />
                <Button onPress={() => void onDismiss(pin)}>Dismiss Block</Button>
              </>
            ) : (
              <>
                <Text style={styles.timer}>Dismisses in {remaining}s</Text>
                <Button tone="neutral" onPress={() => void onDismiss()}>
                  Dismiss Now
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
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    backgroundColor: colors.bg.secondary,
    borderColor: colors.border.red,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: 16,
    padding: 24,
    ...shadow.lg,
  },
  eyebrow: {
    color: colors.red[400],
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  title: {
    color: colors.text.primary,
    fontSize: 34,
    fontWeight: '900',
  },
  reason: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 23,
  },
  keyword: {
    color: colors.red[400],
    fontSize: 22,
    fontWeight: '900',
  },
  meta: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  timer: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
  },
});

function formatReason(reason?: string) {
  switch (reason) {
    case 'blocked_app_feature':
      return 'blocked app feature';
    case 'focus_mode':
      return 'Focus Mode';
    case 'blocked_app':
      return 'blocked app';
    case 'bypass_domain':
      return 'bypass protection';
    case 'usage_limit':
      return 'daily usage limit';
    case 'sideloaded_apk':
      return 'sideloaded APK blocked';
    case 'keyword_match':
      return 'keyword match';
    default:
      return reason || 'protection policy';
  }
}
