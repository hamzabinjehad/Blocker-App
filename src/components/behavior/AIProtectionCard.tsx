import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Switch, Text } from 'react-native-paper';

import { Card } from '@/components/Card';
import { Button, Field } from '@/components/controls';
import { colors, radius, spacing, typography } from '@/theme';
import type { AnomalyDetectionStatus, BehaviorPolicy, GalleryScanResult, MediaScanningStatus, PolicyUpdate } from '@/types/blocker';

type AIProtectionCardProps = {
  behaviorPolicy: BehaviorPolicy;
  mediaScanning: MediaScanningStatus;
  anomalyDetection: AnomalyDetectionStatus;
  pinConfigured: boolean;
  onUpdatePolicy: (policy: PolicyUpdate) => Promise<void>;
  onRequestGalleryScanPermission?: () => Promise<unknown>;
  onScanGalleryForExplicitContent?: (limit?: number) => Promise<GalleryScanResult | null>;
};

export function AIProtectionCard({
  behaviorPolicy,
  mediaScanning,
  anomalyDetection,
  pinConfigured,
  onUpdatePolicy,
  onRequestGalleryScanPermission,
  onScanGalleryForExplicitContent,
}: AIProtectionCardProps) {
  const [pin, setPin] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [imageScanningEnabled, setImageScanningEnabled] = useState(mediaScanning.enabled);
  const [fallbackEnabled, setFallbackEnabled] = useState(mediaScanning.cloudFallbackEnabled);
  const [galleryAction, setGalleryAction] = useState<string | null>(null);
  const [galleryFeedback, setGalleryFeedback] = useState<string | null>(null);

  useEffect(() => {
    setImageScanningEnabled(mediaScanning.enabled);
    setFallbackEnabled(mediaScanning.cloudFallbackEnabled);
  }, [mediaScanning.cloudFallbackEnabled, mediaScanning.enabled]);

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
        <Metric label="Gallery scan" value={galleryScanLabel(mediaScanning)} />
        <Metric label="Ambiguous fallback" value={fallbackStatus(mediaScanning)} />
        <Metric label="Text context engine" value={behaviorPolicy.textContextEngine.mode.replace(/_/g, ' ')} />
        <Metric label="Anomaly window" value={`${anomalyDetection.windowHours}h / ${anomalyDetection.detectedCount} signals`} />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Real-time image scanning</Text>
          <Text style={styles.caption}>On-device only while Protection is on.</Text>
        </View>
        <Switch
          onValueChange={(enabled) => {
            setImageScanningEnabled(enabled);
            update({ imageScanningEnabled: enabled });
          }}
          value={imageScanningEnabled}
        />
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

      <View style={styles.galleryPanel}>
        <Text style={styles.label}>Gallery media scan</Text>
        <Text style={styles.caption}>
          On-device thumbnail review. Flagged count only; images are not stored or shown.
        </Text>
        <View style={styles.galleryActions}>
          <Button
            disabled={mediaScanning.galleryScanPermissionGranted || !onRequestGalleryScanPermission}
            icon="image-lock-outline"
            loading={galleryAction === 'permission'}
            tone="neutral"
            onPress={() => {
              if (!onRequestGalleryScanPermission) return;
              setGalleryAction('permission');
              setGalleryFeedback(null);
              void onRequestGalleryScanPermission()
                .then(() => setGalleryFeedback('Gallery permission requested.'))
                .finally(() => setGalleryAction(null));
            }}
          >
            Allow Gallery Scan
          </Button>
          <Button
            disabled={!mediaScanning.galleryScanPermissionGranted || !onScanGalleryForExplicitContent}
            icon="image-search-outline"
            loading={galleryAction === 'scan'}
            tone="neutral"
            onPress={() => {
              if (!onScanGalleryForExplicitContent) return;
              setGalleryAction('scan');
              setGalleryFeedback(null);
              void onScanGalleryForExplicitContent(24)
                .then((result) => {
                  if (!result) return;
                  setGalleryFeedback(`Scanned ${result.scannedCount}; flagged ${result.flaggedCount}.`);
                })
                .finally(() => setGalleryAction(null));
            }}
          >
            Scan Recent Gallery
          </Button>
        </View>
        {galleryFeedback ? <Text style={styles.caption}>{galleryFeedback}</Text> : null}
      </View>

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

function galleryScanLabel(status: MediaScanningStatus) {
  if (!status.galleryScanSupported) return 'Unsupported';
  if (!status.galleryScanPermissionGranted) return 'Needs permission';
  if (status.galleryScanLastAt <= 0) return 'Ready';
  return `${status.galleryScanFlaggedCount} flagged`;
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
  galleryActions: {
    gap: spacing.sm,
  },
  galleryPanel: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginVertical: spacing.md,
    padding: spacing.md,
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
