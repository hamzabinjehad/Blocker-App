import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { Card } from '@/components/Card';
import { Field } from '@/components/controls';
import { useTranslation } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import type { AnomalyDetectionStatus, GalleryScanResult, MediaScanningStatus, PolicyUpdate } from '@/types/blocker';

type AIProtectionCardProps = {
  mediaScanning: MediaScanningStatus;
  anomalyDetection: AnomalyDetectionStatus;
  pinConfigured: boolean;
  onUpdatePolicy: (policy: PolicyUpdate) => Promise<void>;
  onRequestGalleryScanPermission?: () => Promise<unknown>;
  onScanGalleryForExplicitContent?: (limit?: number) => Promise<GalleryScanResult | null>;
};

export function AIProtectionCard({
  mediaScanning,
  anomalyDetection,
  pinConfigured,
  onUpdatePolicy,
  onRequestGalleryScanPermission,
  onScanGalleryForExplicitContent,
}: AIProtectionCardProps) {
  const t = useTranslation();
  const [pin, setPin] = useState('');
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

  const detectedSignals = anomalyDetection.signals.filter((s) => s.detected);

  const handleGalleryPress = () => {
    if (!mediaScanning.galleryScanPermissionGranted) {
      if (!onRequestGalleryScanPermission) return;
      setGalleryAction('permission');
      void onRequestGalleryScanPermission().finally(() => setGalleryAction(null));
    } else {
      if (!onScanGalleryForExplicitContent) return;
      setGalleryAction('scan');
      setGalleryFeedback(null);
      void onScanGalleryForExplicitContent(24)
        .then((result) => {
          if (result) setGalleryFeedback(t('smart.galleryFlagged', { count: result.flaggedCount }));
        })
        .finally(() => setGalleryAction(null));
    }
  };

  const galleryStatusText = () => {
    if (!mediaScanning.galleryScanPermissionGranted) return t('smart.galleryTapAllow');
    if (galleryFeedback) return galleryFeedback;
    if (mediaScanning.galleryScanLastAt > 0) {
      return t('smart.galleryFlaggedLast', { count: mediaScanning.galleryScanFlaggedCount });
    }
    return t('smart.galleryReady');
  };

  return (
    <Card title={t('smart.title')} subtitle={t('smart.subtitle')}>
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label={t('policy.pinLabel')}
          onChangeText={setPin}
          placeholder={t('policy.pinPlaceholder')}
          secureTextEntry
          value={pin}
        />
      ) : null}

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>{t('smart.imageScanning')}</Text>
          <Text style={styles.caption}>{t('smart.imageScanningHelper')}</Text>
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
          <Text style={styles.label}>{t('smart.cloudFallback')}</Text>
          <Text style={styles.caption}>{t('smart.cloudFallbackHelper')}</Text>
        </View>
        <Switch
          onValueChange={(v) => {
            setFallbackEnabled(v);
            update({ cloudImageFallbackEnabled: v });
          }}
          value={fallbackEnabled}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>{t('smart.galleryScan')}</Text>
          <Text style={styles.caption}>{galleryStatusText()}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={galleryAction !== null}
          onPress={handleGalleryPress}
          style={styles.scanBtn}
        >
          <Text style={styles.scanBtnText}>
            {galleryAction !== null ? '…' : mediaScanning.galleryScanPermissionGranted ? t('smart.scan') : t('common.allow')}
          </Text>
        </Pressable>
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
      ) : null}
    </Card>
  );
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  scanBtn: {
    borderColor: colors.border.default,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scanBtnText: {
    ...typography.captionMd,
    color: colors.text.primary,
  },
  signal: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    gap: 4,
    padding: spacing.md,
  },
  signalList: {
    gap: spacing.xs,
  },
  signalSubject: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
});
