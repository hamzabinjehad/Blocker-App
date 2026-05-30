import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from './Card';
import { Button, Field } from './controls';
import { colors, radius, spacing, typography } from '@/theme';
import type { RemoteSession, UnlockRequest } from '@/types/blocker';

type RemoteManagementCardProps = {
  session: RemoteSession;
  loading: boolean;
  onGeneratePairingCode: () => Promise<string>;
  onAddDevice: (name: string, role: 'admin' | 'child') => Promise<unknown>;
  onRemoveDevice: (deviceId: string) => Promise<void>;
  onSubmitUnlockRequest: (reason: string, durationMinutes?: number) => Promise<unknown>;
  onRespondToUnlockRequest: (requestId: string, approved: boolean) => Promise<void>;
};

export function RemoteManagementCard({
  session,
  loading,
  onGeneratePairingCode,
  onAddDevice,
  onRemoveDevice,
  onSubmitUnlockRequest,
  onRespondToUnlockRequest,
}: RemoteManagementCardProps) {
  const [deviceName, setDeviceName] = useState('');
  const [unlockReason, setUnlockReason] = useState('');
  const [showPairing, setShowPairing] = useState(false);

  const pendingRequests = session.pendingRequests.filter((r) => r.status === 'pending');
  const recentRequests = session.pendingRequests.slice(0, 5);

  return (
    <Card
      title="Remote Management"
      subtitle="Pair devices for remote administration and oversight."
      action={
        <Chip compact icon={session.paired ? 'cellphone-check' : 'cellphone-link'} style={session.paired ? styles.approvedChip : styles.expiredChip}>
          {session.paired ? 'Paired' : 'Not paired'}
        </Chip>
      }
    >
      {/* Connected devices */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connected Devices</Text>
        {session.devices.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="devices" size={24} color={colors.text.muted} />
            <Text style={styles.emptyText}>No guardian device paired yet.</Text>
          </View>
        ) : (
          <View style={styles.deviceList}>
            {session.devices.map((device) => (
              <View key={device.id} style={styles.deviceRow}>
                <MaterialCommunityIcons
                  name={device.role === 'admin' ? 'shield-account' : 'cellphone'}
                  size={20}
                  color={device.online ? colors.green[400] : colors.text.muted}
                />
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceMeta}>
                    {device.role === 'admin' ? 'Admin' : 'Child'} · {device.online ? 'Online' : 'Offline'}
                  </Text>
                </View>
                <IconButton
                  icon="close-circle-outline"
                  iconColor={colors.red[400]}
                  size={18}
                  onPress={() => void onRemoveDevice(device.id)}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Pairing */}
      <View style={styles.section}>
        <Button
          icon={showPairing ? 'chevron-up' : 'link-variant'}
          tone="neutral"
          onPress={() => setShowPairing(!showPairing)}
        >
          {showPairing ? 'Hide Pairing' : 'Pair New Device'}
        </Button>

        {showPairing && (
          <View style={styles.pairingBox}>
            {session.pairingCode && session.pairingCodeExpiresAt > Date.now() ? (
              <View style={styles.codeDisplay}>
                <Text style={styles.codeLabel}>Pairing Code</Text>
                <Text selectable style={styles.codeValue}>{session.pairingCode}</Text>
                <Text style={styles.codeExpiry}>
                  Expires in {Math.max(0, Math.round((session.pairingCodeExpiresAt - Date.now()) / 60_000))} min
                </Text>
              </View>
            ) : (
              <Button icon="refresh" loading={loading} onPress={() => void onGeneratePairingCode()}>
                Generate Pairing Code
              </Button>
            )}

            <Field label="Device Name" onChangeText={setDeviceName} placeholder="e.g. Mom's Phone" value={deviceName} />
            <View style={styles.pairButtons}>
              <Button
                icon="shield-account"
                disabled={!deviceName.trim()}
                onPress={() => {
                void onAddDevice(deviceName.trim(), 'admin')
                  .then(() => setDeviceName(''))
                  .catch(console.error);
                }}
              >
                Pair as Admin
              </Button>
              <Button
                icon="cellphone"
                tone="neutral"
                disabled={!deviceName.trim()}
                onPress={() => {
                void onAddDevice(deviceName.trim(), 'child')
                  .then(() => setDeviceName(''))
                  .catch(console.error);
                }}
              >
                Pair as Child
              </Button>
            </View>
          </View>
        )}
      </View>

      {/* Unlock Requests */}
      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Pending Unlock Requests ({pendingRequests.length})
          </Text>
          {pendingRequests.map((request) => (
            <UnlockRequestRow
              key={request.id}
              request={request}
              onRespond={onRespondToUnlockRequest}
            />
          ))}
        </View>
      )}

      {/* Submit unlock request */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Request Unlock</Text>
        <Text style={styles.helpText}>
          Send an unlock request to the admin device for approval.
        </Text>
        <Field
          label="Reason"
          onChangeText={setUnlockReason}
          placeholder="e.g. Need to access a school website"
          value={unlockReason}
        />
        <Button
          icon="lock-open-variant"
          disabled={!unlockReason.trim()}
          onPress={() => {
            void onSubmitUnlockRequest(unlockReason.trim(), 30)
              .then(() => setUnlockReason(''))
              .catch(console.error);
          }}
        >
          Request 30-Min Unlock
        </Button>
      </View>

      {/* Recent history */}
      {recentRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Requests</Text>
          {recentRequests.map((request) => (
            <View key={request.id} style={styles.historyRow}>
              <Chip
                compact
                icon={statusIcon(request.status)}
                style={statusChipStyle(request.status)}
                textStyle={styles.chipText}
              >
                {request.status}
              </Chip>
              <Text style={styles.historyReason} numberOfLines={1}>
                {request.reason}
              </Text>
              <Text style={styles.historyTime}>{formatTimeAgo(request.requestedAt)}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function UnlockRequestRow({
  request,
  onRespond,
}: {
  request: UnlockRequest;
  onRespond: (id: string, approved: boolean) => Promise<void>;
}) {
  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <MaterialCommunityIcons name="lock-open-variant-outline" size={18} color={colors.amber[400]} />
        <Text style={styles.requestDevice}>{request.deviceName}</Text>
        <Text style={styles.requestTime}>{formatTimeAgo(request.requestedAt)}</Text>
      </View>
      <Text style={styles.requestReason}>{request.reason}</Text>
      <Text style={styles.requestDuration}>{request.durationMinutes} min requested</Text>
      <View style={styles.requestActions}>
        <Button icon="check" onPress={() => void onRespond(request.id, true)}>
          Approve
        </Button>
        <Button icon="close" tone="danger" onPress={() => void onRespond(request.id, false)}>
          Deny
        </Button>
      </View>
    </View>
  );
}

function statusIcon(status: UnlockRequest['status']): string {
  switch (status) {
    case 'approved': return 'check-circle';
    case 'denied': return 'close-circle';
    case 'expired': return 'clock-alert';
    default: return 'clock-outline';
  }
}

function statusChipStyle(status: UnlockRequest['status']) {
  switch (status) {
    case 'approved': return styles.approvedChip;
    case 'denied': return styles.deniedChip;
    case 'expired': return styles.expiredChip;
    default: return styles.pendingChip;
  }
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  helpText: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  deviceList: {
    gap: spacing.sm,
  },
  deviceRow: {
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    ...typography.bodyMd,
    color: colors.text.primary,
    fontWeight: '600',
  },
  deviceMeta: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  pairingBox: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  codeDisplay: {
    alignItems: 'center',
    backgroundColor: colors.green[50],
    borderColor: colors.border.green,
    borderWidth: 1,
    borderRadius: radius.md,
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  codeLabel: {
    ...typography.captionMd,
    color: colors.green[700],
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  codeValue: {
    fontFamily: 'monospace',
    fontSize: 36,
    fontWeight: '800',
    color: colors.green[600],
    letterSpacing: 8,
  },
  codeExpiry: {
    ...typography.caption,
    color: colors.green[700],
  },
  pairButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  requestCard: {
    backgroundColor: colors.amber[50],
    borderColor: colors.border.amber,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  requestHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  requestDevice: {
    ...typography.bodyMd,
    color: colors.amber[900],
    fontWeight: '700',
    flex: 1,
  },
  requestTime: {
    ...typography.caption,
    color: colors.amber[700],
  },
  requestReason: {
    ...typography.body,
    color: colors.amber[800],
    fontStyle: 'italic',
  },
  requestDuration: {
    ...typography.captionMd,
    color: colors.amber[700],
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  historyRow: {
    alignItems: 'center',
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyReason: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  historyTime: {
    ...typography.caption,
    color: colors.text.muted,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  approvedChip: {
    backgroundColor: colors.green[50],
    borderColor: colors.border.green,
    borderWidth: 1,
  },
  deniedChip: {
    backgroundColor: colors.red[50],
    borderColor: colors.border.red,
    borderWidth: 1,
  },
  expiredChip: {
    backgroundColor: colors.bg.secondary,
    borderColor: colors.border.default,
    borderWidth: 1,
  },
  pendingChip: {
    backgroundColor: colors.amber[50],
    borderColor: colors.border.amber,
    borderWidth: 1,
  },
});
