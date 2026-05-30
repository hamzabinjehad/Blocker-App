import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Switch } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';

import { ParentPinCard } from '@/components/ParentPinCard';
import { RemoteManagementCard } from '@/components/RemoteManagementCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useProtectionState } from '@/store/useProtectionState';
import { useRemoteManagement } from '@/store/useRemoteManagement';
import { colors, radius, spacing, typography } from '@/theme';

export default function GuardianScreen() {
  const protection = useProtectionState();
  const remote = useRemoteManagement();
  const [unlockRequestsEnabled, setUnlockRequestsEnabled] = useState(true);
  const recentRequests = remote.session.pendingRequests.slice(0, 5);

  return (
    <ScreenScaffold title="Guardian" subtitle="PIN, paired devices, and unlock requests." iconName="guardian">
      <View style={s.section}>
        <ParentPinCard
          pinConfigured={protection.pinConfigured}
          loading={protection.loading}
          onSetPin={protection.setParentPin}
        />
      </View>

      <View style={s.section}>
        <RemoteManagementCard
          session={remote.session}
          loading={remote.loading}
          onGeneratePairingCode={remote.generateNewPairingCode}
          onAddDevice={remote.addDevice}
          onRemoveDevice={remote.removeDevice}
          onSubmitUnlockRequest={remote.submitUnlockRequest}
          onRespondToUnlockRequest={remote.respondToUnlockRequest}
        />
      </View>

      <View style={[s.panel, { borderColor: colors.border.subtle }]}>
        <View style={s.toggleRow}>
          <View style={s.toggleCopy}>
            <Text style={s.sectionTitle}>Unlock Requests</Text>
            <Text style={s.sectionMeta}>Allow protected users to ask a guardian for temporary access.</Text>
          </View>
          <Switch value={unlockRequestsEnabled} onValueChange={setUnlockRequestsEnabled} />
        </View>
        <View style={s.requestList}>
          {recentRequests.length > 0 ? recentRequests.map((request) => (
            <View key={request.id} style={s.requestRow}>
              <Feather name="lock" size={16} color={colors.text.secondary} />
              <View style={s.requestText}>
                <Text style={s.requestReason} numberOfLines={1}>{request.reason}</Text>
                <Text style={s.requestMeta}>{request.status} · {formatTimeAgo(request.requestedAt)}</Text>
              </View>
            </View>
          )) : (
            <Text style={s.emptyText}>No recent unlock requests.</Text>
          )}
        </View>
      </View>
    </ScreenScaffold>
  );
}

function formatTimeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const s = StyleSheet.create({
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
  },
  panel: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  requestList: {
    gap: spacing.sm,
  },
  requestMeta: {
    ...typography.caption,
    color: colors.text.muted,
    textTransform: 'capitalize',
  },
  requestReason: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  requestRow: {
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  requestText: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: spacing.sm,
  },
  sectionMeta: {
    ...typography.body,
    color: colors.text.secondary,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
});
