import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { Card } from '../Card';
import { Button, Field } from '../controls';
import { useTheme } from '@/theme';
import type { BehaviorPolicy, PolicyUpdate } from '@/types/blocker';

type BlockScreenConfigurationProps = {
  policy: BehaviorPolicy;
  pinConfigured: boolean;
  onChange: (policy: PolicyUpdate) => Promise<void>;
};

export function BlockScreenConfiguration({ policy, pinConfigured, onChange }: BlockScreenConfigurationProps) {
  const { colors } = useTheme();
  const [duration, setDuration] = useState(String(policy.behaviorBlockDurationSeconds));
  const [cooldown, setCooldown] = useState(String(policy.behaviorDisableCooldownDays));
  const [pin, setPin] = useState('');

  useEffect(() => {
    setDuration(String(policy.behaviorBlockDurationSeconds));
    setCooldown(String(policy.behaviorDisableCooldownDays));
  }, [policy.behaviorBlockDurationSeconds, policy.behaviorDisableCooldownDays]);

  const save = () => {
    const behaviorBlockDurationSeconds = clampNumber(duration, 5, 120, policy.behaviorBlockDurationSeconds);
    const behaviorDisableCooldownDays = clampNumber(cooldown, 7, 90, policy.behaviorDisableCooldownDays);
    setDuration(String(behaviorBlockDurationSeconds));
    setCooldown(String(behaviorDisableCooldownDays));
    void onChange({
      behaviorBlockDurationSeconds,
      behaviorDisableCooldownDays,
      ...(pinConfigured ? { adminPin: pin } : {}),
    });
  };

  const updatePinRequirement = (behaviorBlockRequiresPin: boolean) => {
    void onChange({
      behaviorBlockRequiresPin,
      ...(pinConfigured ? { adminPin: pin } : {}),
    });
  };

  return (
    <Card title="Block Screen Configuration" subtitle="Controls the visible interruption shown after behavior triggers.">
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="Parent PIN for block screen changes"
          onChangeText={setPin}
          placeholder="Enter PIN"
          secureTextEntry
          value={pin}
        />
      ) : null}

      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.text.primary }]}>Require PIN to dismiss</Text>
        <Switch onValueChange={updatePinRequirement} value={policy.behaviorBlockRequiresPin} />
      </View>

      <Field
        keyboardType="number-pad"
        label="Auto-dismiss seconds"
        onChangeText={setDuration}
        placeholder="12"
        value={duration}
      />
      <Field
        keyboardType="number-pad"
        label="Disable cooldown days"
        onChangeText={setCooldown}
        placeholder="7"
        value={cooldown}
      />
      <Button icon="content-save-outline" tone="neutral" onPress={save}>
        Save Block Screen Settings
      </Button>
      <Text style={[styles.note, { color: colors.text.secondary }]}>Cooldown values are clamped by native policy to 7-90 days.</Text>
    </Card>
  );
}

function clampNumber(value: string, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
});
