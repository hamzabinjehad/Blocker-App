import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import { useTheme, typography } from '@/theme';

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
  const [localError, setLocalError] = useState<string | undefined>();

  const submit = () => {
    if (newPin.length < 4) {
      setLocalError('Use at least 4 digits for the demo PIN.');
      return;
    }
    if (newPin !== confirmPin) {
      setLocalError('PIN confirmation does not match.');
      return;
    }
    setLocalError(undefined);
    void onSetPin(newPin, pinConfigured ? currentPin : undefined).then(() => {
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    });
  };

  return (
    <Card
      title="Parent/Admin PIN"
      subtitle="Used before stopping protection or changing important settings."
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
      <Field
        keyboardType="number-pad"
        label={pinConfigured ? 'New PIN' : 'Create PIN'}
        onChangeText={setNewPin}
        placeholder="At least 4 digits"
        secureTextEntry
        value={newPin}
      />
      <Field
        keyboardType="number-pad"
        label="Confirm PIN"
        onChangeText={setConfirmPin}
        placeholder="Repeat PIN"
        secureTextEntry
        value={confirmPin}
      />
      <Button icon="lock-reset" loading={loading} onPress={submit}>
        {pinConfigured ? 'Update PIN' : 'Set Parent PIN'}
      </Button>
      {localError ? <Text style={[styles.error, { color: colors.red[500] }]}>{localError}</Text> : null}
      <Text style={[styles.note, { color: colors.text.muted }]}>
        MVP storage uses salted hashing for demo purposes. Production should use Android Keystore-backed storage.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  note: {
    ...typography.caption,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
