import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import type { ProtectionStatus } from '@/types/blocker';

type ProtectionToggleCardProps = {
  status: ProtectionStatus;
  loading: boolean;
  error?: string;
  pinConfigured: boolean;
  onStart: () => Promise<void>;
  onStop: (pin: string) => Promise<void>;
};

export function ProtectionToggleCard({
  status,
  loading,
  error,
  pinConfigured,
  onStart,
  onStop,
}: ProtectionToggleCardProps) {
  const [pin, setPin] = useState('');
  const active = status === 'active' || status === 'tampered';

  return (
    <Card title="Protection Control" subtitle="Start and stop the local filtering service.">
      {active && pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="Parent PIN required to stop"
          onChangeText={setPin}
          placeholder="Enter PIN"
          secureTextEntry
          value={pin}
        />
      ) : null}

      <Button
        icon={active ? 'shield-off-outline' : 'shield-check-outline'}
        loading={loading}
        tone={active ? 'danger' : 'primary'}
        onPress={() => {
          if (active) {
            void onStop(pin);
            setPin('');
          } else {
            void onStart();
          }
        }}
      >
        {active ? 'Stop Protection' : 'Start Protection'}
      </Button>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.note}>
        Android requires explicit VPN consent before this app can filter DNS/domain traffic.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#a12d2d',
    fontSize: 13,
    fontWeight: '700',
  },
  note: {
    color: '#6a766f',
    fontSize: 13,
    lineHeight: 19,
  },
});
