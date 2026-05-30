import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import { radius, spacing, useTheme, typography } from '@/theme';

type ParentPinCardProps = {
  pinConfigured: boolean;
  loading: boolean;
  onSetPin: (newPin: string, currentPin?: string) => Promise<void>;
};

export function ParentPinCard({ pinConfigured, loading, onSetPin }: ParentPinCardProps) {
  const { colors } = useTheme();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [localError, setLocalError] = useState<string | undefined>();

  const submit = () => {
    if (newPin.length < 4) {
      setLocalError('Use at least 4 digits for the demo PIN.');
      return;
    }
    if (newPin !== confirmPin) {
      setLocalError('PINs do not match. Try again.');
      setNewPin('');
      setConfirmPin('');
      setStep('create');
      return;
    }
    setLocalError(undefined);
    void onSetPin(newPin, pinConfigured ? currentPin : undefined).then(() => {
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setStep('create');
    });
  };

  const currentEntry = step === 'create' ? newPin : confirmPin;
  const setCurrentEntry = step === 'create' ? setNewPin : setConfirmPin;
  const pinReady = currentEntry.length >= 4;

  return (
    <Card
      title="Parent PIN"
      subtitle="Used before stopping protection or changing important settings."
      action={<StatusChip label={pinConfigured ? 'Set' : 'Not set'} tone={pinConfigured ? 'success' : 'warning'} />}
    >
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="Current PIN"
          onChangeText={setCurrentPin}
          placeholder="Enter current PIN"
          secureTextEntry
          value={currentPin}
        />
      ) : null}
      <Text style={[styles.prompt, { color: colors.text.primary }]}>
        {step === 'create' ? 'Enter your new PIN' : 'Confirm your PIN'}
      </Text>
      <PinEntry value={currentEntry} onChange={setCurrentEntry} />
      <Button
        icon={step === 'create' ? 'arrow-right' : 'lock-check-outline'}
        loading={loading}
        disabled={!pinReady}
        onPress={() => {
          if (step === 'create') {
            setStep('confirm');
            return;
          }
          submit();
        }}
      >
        {step === 'create' ? 'Continue' : pinConfigured ? 'Update PIN' : 'Set PIN'}
      </Button>
      {localError ? <Text style={[styles.error, { color: colors.red[500] }]}>{localError}</Text> : null}
    </Card>
  );
}

function StatusChip({ label, tone }: { label: string; tone: 'success' | 'warning' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statusChip, { backgroundColor: tone === 'success' ? colors.green[50] : colors.amber[50] }]}>
      <Text style={[styles.statusText, { color: tone === 'success' ? colors.green[600] : colors.amber[700] }]}>{label}</Text>
    </View>
  );
}

function PinDots({ value }: { value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dots}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: value.length > index ? colors.green[500] : 'transparent',
              borderColor: value.length > index ? colors.green[500] : colors.border.default,
            },
          ]}
        />
      ))}
    </View>
  );
}

function PinEntry({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pinEntry, { borderColor: colors.border.subtle }]}>
      <PinDots value={value} />
      <TextInput
        accessibilityLabel="PIN"
        autoFocus
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, 6))}
        secureTextEntry
        style={[styles.hiddenInput, { color: colors.text.primary }]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  dot: {
    borderRadius: radius.full,
    borderWidth: 1,
    height: 14,
    width: 14,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  hiddenInput: {
    height: 1,
    opacity: 0.01,
    width: 1,
  },
  pinEntry: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
    justifyContent: 'center',
  },
  prompt: {
    ...typography.bodyMd,
    textAlign: 'center',
  },
  statusChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.captionMd,
  },
  note: {
    ...typography.caption,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
