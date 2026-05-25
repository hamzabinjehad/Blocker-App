import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Switch, Text } from 'react-native-paper';

import { Card } from '../Card';
import { Button, Field } from '../controls';
import { colors, radius } from '@/theme';
import type { BehaviorPolicy, MediaScanningStatus, PolicyUpdate } from '@/types/blocker';

type BehaviorProtectionCardProps = {
  policy: BehaviorPolicy;
  mediaScanning: MediaScanningStatus;
  accessibilityServiceEnabled: boolean;
  pinConfigured: boolean;
  onUpdatePolicy: (policy: PolicyUpdate) => Promise<void>;
  onOpenAccessibilitySettings: () => Promise<void>;
  onDetectText: (input: string) => Promise<void>;
};

export function BehaviorProtectionCard({
  policy,
  mediaScanning,
  accessibilityServiceEnabled,
  pinConfigured,
  onUpdatePolicy,
  onOpenAccessibilitySettings,
  onDetectText,
}: BehaviorProtectionCardProps) {
  const [pin, setPin] = useState('');
  const [testText, setTestText] = useState('');

  const update = (next: PolicyUpdate) => {
    void onUpdatePolicy(pinConfigured ? { ...next, adminPin: pin } : next);
  };

  return (
    <Card
      title="Behavior Protection Status"
      subtitle="Visible keyword and app-interaction checks that complement VPN/DNS filtering."
      action={
        <Chip compact icon={accessibilityServiceEnabled ? 'eye-check-outline' : 'eye-off-outline'}>
          {accessibilityServiceEnabled ? 'Accessibility On' : 'Setup Needed'}
        </Chip>
      }
    >
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="Parent PIN for behavior settings"
          onChangeText={setPin}
          placeholder="Enter PIN"
          secureTextEntry
          value={pin}
        />
      ) : null}

      <View style={styles.row}>
        <Text style={styles.label}>Behavior engine</Text>
        <Switch
          onValueChange={(behaviorProtectionEnabled) => update({ behaviorProtectionEnabled })}
          value={policy.behaviorProtectionEnabled}
        />
      </View>

      <View style={styles.metrics}>
        <Metric label="Built-in keywords" value={String(policy.builtInKeywordCount)} />
        <Metric label="Custom keywords" value={String(policy.customKeywordCount)} />
        <Metric
          label="Image and thumbnail scan"
          value={mediaScanning.imageScanningActive ? 'Active' : mediaScanning.supported ? 'Waiting for Accessibility' : 'Unsupported'}
        />
        <Metric label="Last screen" value={policy.currentContext.screen || 'No context yet'} />
      </View>

      <Button icon="cog-outline" tone="neutral" onPress={() => void onOpenAccessibilitySettings()}>
        Open Accessibility Settings
      </Button>

      <Field
        label="Test keyword detection"
        onChangeText={setTestText}
        placeholder="Type a search phrase to test"
        value={testText}
      />
      <Button
        icon="magnify-scan"
        onPress={() => {
          void onDetectText(testText);
          setTestText('');
        }}
      >
        Run Detection Test
      </Button>

      <Text style={styles.note}>
        The Accessibility Service processes search-like fields, URL text, screen labels, and supported screenshots in memory only.
      </Text>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  metrics: {
    marginVertical: 12,
  },
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: 1,
  },
  metricLabel: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  metricValue: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  note: {
    color: colors.text.muted,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
