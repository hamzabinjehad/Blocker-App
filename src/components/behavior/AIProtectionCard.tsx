import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Switch, Text } from 'react-native-paper';

import { Card } from '@/components/Card';
import { Button, Field } from '@/components/controls';
import { colors, radius, spacing, typography } from '@/theme';
import type { AnomalyDetectionStatus, BehaviorPolicy, MediaScanningStatus, PolicyUpdate } from '@/types/blocker';

type AIProtectionCardProps = {
  behaviorPolicy: BehaviorPolicy;
  mediaScanning: MediaScanningStatus;
  anomalyDetection: AnomalyDetectionStatus;
  pinConfigured: boolean;
  onUpdatePolicy: (policy: PolicyUpdate) => Promise<void>;
};

export function AIProtectionCard({
  behaviorPolicy,
  mediaScanning,
  anomalyDetection,
  pinConfigured,
  onUpdatePolicy,
}: AIProtectionCardProps) {
  const [pin, setPin] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [fallbackEnabled, setFallbackEnabled] = useState(mediaScanning.cloudFallbackEnabled);

  useEffect(() => {
    setFallbackEnabled(mediaScanning.cloudFallbackEnabled);
  }, [mediaScanning.cloudFallbackEnabled]);

  const update = (next: PolicyUpdate) => {
    void onUpdatePolicy(pinConfigured ? { ...next, adminPin: pin } : next);
  };

  const detectedSignals = anomalyDetection.signals.filter((signal) => signal.detected);

  return (
    <Card
      title="AI Protection"
      subtitle="Local-first classification, context checks, and bypass anomaly signals."
      action={<Chip compact>{riskLabel(anomalyDetection.riskLevel)}</Chip>}
    >
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="Parent PIN for AI settings"
          onChangeText={setPin}
          placeholder="Enter PIN"
          secureTextEntry
          value={pin}
        />
      ) : null}

      <View style={styles.metrics}>
        <Metric label="Image classifier" value={mediaScanning.imageScanningActive ? 'Active' : 'Waiting'} />
        <Metric label="Ambiguous fallback" value={fallbackStatus(mediaScanning)} />
        <Metric label="Text context engine" value={behaviorPolicy.textContextEngine.mode.replace(/_/g, ' ')} />
        <Metric label="Anomaly window" value={`${anomalyDetection.windowHours}h / ${anomalyDetection.detectedCount} signals`} />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Cloud fallback for ambiguous images</Text>
          <Text style={styles.caption}>Sends local label metadata only.</Text>
        </View>
        <Switch
          onValueChange={(cloudImageFallbackEnabled) => {
            setFallbackEnabled(cloudImageFallbackEnabled);
            update({ cloudImageFallbackEnabled });
          }}
          value={fallbackEnabled}
        />
      </View>

      <Field
        label="Cloud fallback endpoint"
        onChangeText={setEndpoint}
        placeholder="https://example.com/review"
        value={endpoint}
      />
      <Button
        disabled={fallbackEnabled && endpoint.trim().length === 0}
        icon="cloud-check-outline"
        onPress={() => {
          update({ cloudImageFallbackEndpoint: endpoint.trim() });
          setEndpoint('');
        }}
      >
        Save Endpoint
      </Button>

      {detectedSignals.length > 0 ? (
        <View style={styles.signalList}>
          {detectedSignals.slice(0, 3).map((signal) => (
            <View key={signal.id} style={styles.signal}>
              <Text style={styles.signalSubject}>{signal.subject}</Text>
              <Text style={styles.caption}>{signal.recommendation}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.caption}>No unusual VPN, DNS, browser install, or service interruption pattern in the current window.</Text>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function fallbackStatus(status: MediaScanningStatus) {
  if (!status.cloudFallbackEnabled) return 'Off';
  return status.cloudFallbackConfigured ? 'Configured' : 'Needs endpoint';
}

function riskLabel(riskLevel: string) {
  if (riskLevel === 'critical') return 'Critical anomaly risk';
  if (riskLevel === 'high') return 'High anomaly risk';
  return 'Normal';
}

const styles = StyleSheet.create({
  caption: {
    ...typography.caption,
    color: colors.text.muted,
  },
  label: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: 1,
  },
  metricLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  metricValue: {
    ...typography.bodyMd,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  metrics: {
    marginBottom: spacing.md,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginVertical: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  signal: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    gap: 4,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  signalList: {
    gap: spacing.xs,
  },
  signalSubject: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
});
