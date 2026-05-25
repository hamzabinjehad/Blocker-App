import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import { colors, radius } from '@/theme';
import type { GuardianAlert, IntegrityStatus, MediaScanningStatus, ScreenshotAuditPolicy } from '@/types/blocker';

type AccountabilityAuditCardProps = {
  auditEventCount: number;
  guardianAlertCount: number;
  guardianAlerts: GuardianAlert[];
  integrityStatus: IntegrityStatus;
  mediaScanningStatus: MediaScanningStatus;
  pinConfigured: boolean;
  safeModeBoot: boolean;
  screenshotAuditPolicy: ScreenshotAuditPolicy;
  onClearGuardianAlert: (alertId: string) => Promise<void>;
  onExportAuditEvents: () => Promise<boolean>;
  onRefreshGuardianAlerts: () => Promise<void>;
  onUpdateScreenshotAuditPolicy: (enabled: boolean, intervalMinutes: number, pin?: string) => Promise<void>;
};

export function AccountabilityAuditCard({
  auditEventCount,
  guardianAlertCount,
  guardianAlerts,
  integrityStatus,
  mediaScanningStatus,
  pinConfigured,
  safeModeBoot,
  screenshotAuditPolicy,
  onClearGuardianAlert,
  onExportAuditEvents,
  onRefreshGuardianAlerts,
  onUpdateScreenshotAuditPolicy,
}: AccountabilityAuditCardProps) {
  const [pin, setPin] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(String(screenshotAuditPolicy.intervalMinutes || 15));
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const visibleAlerts = guardianAlerts.filter((alert) => !alert.cleared).slice(0, 3);
  const integrityLabel = formatIntegrityStatus(integrityStatus);

  useEffect(() => {
    setIntervalMinutes(String(screenshotAuditPolicy.intervalMinutes || 15));
  }, [screenshotAuditPolicy.intervalMinutes]);

  async function run(action: string, callback: () => Promise<void>, message: string) {
    setPendingAction(action);
    setFeedback(null);
    try {
      await callback();
      setFeedback(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function exportAudit() {
    setPendingAction('export-audit');
    setFeedback(null);
    try {
      const copied = await onExportAuditEvents();
      setFeedback(copied ? 'Audit log copied as JSON.' : 'Audit log export failed.');
    } finally {
      setPendingAction(null);
    }
  }

  const normalizedInterval = Math.min(240, Math.max(1, Number.parseInt(intervalMinutes, 10) || 15));

  return (
    <Card title="Accountability & Audit" subtitle="Guardian alerts, audit export, screenshots, and integrity signals.">
      <View style={styles.chips}>
        <Chip compact icon={guardianAlertCount > 0 ? 'bell-alert-outline' : 'bell-check-outline'}>
          {guardianAlertCount > 0 ? `${guardianAlertCount} alerts` : 'No alerts'}
        </Chip>
        <Chip compact icon={safeModeBoot ? 'alert-octagon-outline' : 'shield-check-outline'}>
          {safeModeBoot ? 'Safe Mode seen' : 'No Safe Mode flag'}
        </Chip>
        <Chip compact icon={screenshotAuditPolicy.enabled ? 'monitor-screenshot' : 'monitor-off'}>
          {screenshotAuditPolicy.enabled ? 'Screenshot audit on' : 'Screenshot audit off'}
        </Chip>
        <Chip compact icon={integrityLabel.icon}>{integrityLabel.label}</Chip>
      </View>

      <View style={styles.panel}>
        <Text selectable style={styles.panelTitle}>
          Opt-in Screenshot Audits
        </Text>
        <Text selectable style={styles.note}>
          Captures are reviewed on-device, not stored, and blocked for secure Android windows.
        </Text>
        <Field
          keyboardType="number-pad"
          label="Audit interval minutes"
          onChangeText={setIntervalMinutes}
          placeholder="15"
          value={intervalMinutes}
        />
        {pinConfigured ? (
          <Field
            keyboardType="number-pad"
            label="Parent PIN"
            onChangeText={setPin}
            placeholder="Required for audit changes"
            secureTextEntry
            value={pin}
          />
        ) : null}
        <Button
          icon={screenshotAuditPolicy.enabled ? 'monitor-off' : 'monitor-screenshot'}
          loading={pendingAction === 'screenshot-audit'}
          tone={screenshotAuditPolicy.enabled ? 'neutral' : 'danger'}
          onPress={() =>
            void run(
              'screenshot-audit',
              () =>
                onUpdateScreenshotAuditPolicy(
                  !screenshotAuditPolicy.enabled,
                  normalizedInterval,
                  pinConfigured ? pin : undefined,
                ),
              screenshotAuditPolicy.enabled ? 'Screenshot audit disabled.' : 'Screenshot audit enabled.',
            )
          }
        >
          {screenshotAuditPolicy.enabled ? 'Disable Screenshot Audit' : 'Enable Screenshot Audit'}
        </Button>
        <Text selectable style={styles.note}>
          Scanner: {mediaScanningStatus.scanner}. Active:{' '}
          {mediaScanningStatus.imageScanningActive ? 'yes' : 'no'}.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text selectable style={styles.panelTitle}>
          Audit Log
        </Text>
        <Text selectable style={styles.note}>
          Stored events: {auditEventCount}. Export contains event type, severity, subject, action, timestamp, and
          minimal metadata.
        </Text>
        <Button
          icon="file-export-outline"
          loading={pendingAction === 'export-audit'}
          tone="neutral"
          onPress={() => void exportAudit()}
        >
          Export Audit JSON
        </Button>
      </View>

      <View style={styles.panel}>
        <View style={styles.row}>
          <Text selectable style={styles.panelTitle}>
            Guardian Alerts
          </Text>
          <Text selectable style={styles.subtle}>
            {guardianAlertCount} open
          </Text>
        </View>
        {visibleAlerts.length === 0 ? (
          <Text selectable style={styles.note}>
            No open guardian alerts.
          </Text>
        ) : (
          visibleAlerts.map((alert) => (
            <View key={alert.id} style={styles.alertRow}>
              <View style={styles.alertText}>
                <Text selectable style={styles.alertTitle}>
                  {alert.eventType}
                </Text>
                <Text selectable style={styles.note}>
                  {alert.subject} - {alert.action} - {formatDateTime(alert.timestamp)}
                </Text>
              </View>
              <Text style={styles.clearLink} onPress={() => void onClearGuardianAlert(alert.id)}>
                Clear
              </Text>
            </View>
          ))
        )}
        <Button
          icon="refresh"
          loading={pendingAction === 'refresh-alerts'}
          tone="neutral"
          onPress={() => void run('refresh-alerts', onRefreshGuardianAlerts, 'Guardian alerts refreshed.')}
        >
          Refresh Alerts
        </Button>
      </View>

      <View style={styles.panel}>
        <Text selectable style={styles.panelTitle}>
          Integrity
        </Text>
        <Text selectable style={styles.note}>
          Play Integrity: {integrityLabel.description}. Local signature baseline:{' '}
          {integrityStatus.localSignatureBaselineStored || integrityStatus.signatureBaselineStored ? 'stored' : 'pending'}.
        </Text>
        <Text selectable style={styles.note}>
          Last check: {formatDateTime(integrityStatus.lastCheckedAt)}.
        </Text>
      </View>

      {feedback ? (
        <Text selectable style={styles.feedback}>
          {feedback}
        </Text>
      ) : null}
    </Card>
  );
}

function formatIntegrityStatus(status: IntegrityStatus) {
  switch (status.lastStatus) {
    case 'token_received_pending_server_verification':
      return {
        icon: 'shield-sync-outline',
        label: 'Integrity token',
        description: 'token received; server verdict required',
      };
    case 'token_request_failed':
      return {
        icon: 'shield-alert-outline',
        label: 'Integrity failed',
        description: status.lastMessage || 'token request failed',
      };
    case 'play_integrity_unavailable':
      return {
        icon: 'shield-off-outline',
        label: 'Integrity unavailable',
        description: 'Play Integrity unavailable on this device',
      };
    default:
      return {
        icon: 'shield-search',
        label: 'Integrity pending',
        description: 'not checked yet',
      };
  }
}

function formatDateTime(value?: number | null) {
  if (!value) return 'never';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  alertRow: {
    alignItems: 'center',
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  alertText: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  clearLink: {
    color: colors.green[500],
    fontSize: 13,
    fontWeight: '800',
  },
  feedback: {
    color: colors.green[600],
    fontSize: 13,
    fontWeight: '700',
  },
  note: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  panel: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  panelTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subtle: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '700',
  },
});
