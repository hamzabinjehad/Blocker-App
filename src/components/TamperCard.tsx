import { StyleSheet } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { useTheme, typography } from '@/theme';
import type { TamperSignal, UsageAccessStatus } from '@/types/blocker';

type TamperCardProps = {
  tampered: boolean;
  vpnActive: boolean;
  overlayPermissionGranted: boolean;
  batteryOptimizationIgnored: boolean;
  usageAccessStatus?: UsageAccessStatus;
  strictModeEnabled: boolean;
  tamperReport?: TamperSignal[];
  onOpenOverlaySettings: () => Promise<void>;
  onOpenUsageAccessSettings: () => Promise<void>;
  onRequestIgnoreBatteryOptimizations: () => Promise<void>;
};

export function TamperCard({
  tampered,
  vpnActive,
  overlayPermissionGranted,
  batteryOptimizationIgnored,
  usageAccessStatus,
  strictModeEnabled,
  tamperReport,
  onOpenOverlaySettings,
  onOpenUsageAccessSettings,
  onRequestIgnoreBatteryOptimizations,
}: TamperCardProps) {
  const { colors } = useTheme();
  const detectedSignals = (tamperReport ?? []).filter((signal) => signal.detected).slice(0, 4);
  const usageAccessGranted = Boolean(usageAccessStatus?.granted);

  return (
    <Card title="Tamper Protection" subtitle="Detects when protection becomes inactive after being enabled.">
      <Chip compact icon={strictModeEnabled ? 'lock-check-outline' : 'lock-open-outline'}>
        {strictModeEnabled ? 'Strict Mode enabled' : 'Strict Mode off'}
      </Chip>
      <Chip compact icon={tampered ? 'alert-octagon-outline' : 'check-circle-outline'}>
        {tampered ? 'Tamper warning detected' : 'No tamper warning'}
      </Chip>
      <Chip compact icon={overlayPermissionGranted ? 'monitor-shimmer' : 'monitor-off'}>
        {overlayPermissionGranted ? 'Overlay ready' : 'Overlay permission needed'}
      </Chip>
      <Chip compact icon={usageAccessGranted ? 'timeline-check-outline' : 'timeline-alert-outline'}>
        {usageAccessGranted ? 'Usage Access ready' : 'Usage Access needed'}
      </Chip>
      <Chip compact icon={batteryOptimizationIgnored ? 'battery-check-outline' : 'battery-alert'}>
        {batteryOptimizationIgnored ? 'Battery optimization ignored' : 'Battery ignore needed'}
      </Chip>
      <Text style={[styles.body, { color: colors.text.secondary }]}>
        {vpnActive
          ? 'The VPN service is active.'
          : 'If protection had been enabled before this stop, the app records a tamper warning.'}
      </Text>
      {!overlayPermissionGranted ? (
        <Text style={[styles.link, { color: colors.green[600] }]} onPress={() => void onOpenOverlaySettings()}>
          Open overlay permission settings
        </Text>
      ) : null}
      {!usageAccessGranted ? (
        <Text style={[styles.link, { color: colors.green[600] }]} onPress={() => void onOpenUsageAccessSettings()}>
          Open usage access settings
        </Text>
      ) : null}
      {!batteryOptimizationIgnored ? (
        <Text style={[styles.link, { color: colors.green[600] }]} onPress={() => void onRequestIgnoreBatteryOptimizations()}>
          Request battery optimization ignore
        </Text>
      ) : null}
      {detectedSignals.map((signal) => (
        <Text key={signal.id} style={[styles.note, { color: colors.text.muted }]}>
          {signal.subject}: {signal.recommendation}
        </Text>
      ))}
      <Text style={[styles.note, { color: colors.text.muted }]}>
        Local audit events store minimal metadata only: domain/package/category, timestamp, severity, and action.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
  },
  note: {
    ...typography.caption,
    fontStyle: 'italic',
    marginTop: 4,
  },
  link: {
    ...typography.bodyMd,
    textDecorationLine: 'underline',
  },
});
