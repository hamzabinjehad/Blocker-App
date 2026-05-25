import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button } from './controls';
import { colors } from '@/theme';
import type { NotificationFilterStatus } from '@/types/blocker';

type NotificationFilterCardProps = {
  status: NotificationFilterStatus;
  onToggleEnabled: (enabled: boolean, pin?: string) => Promise<void>;
  onOpenListenerSettings: () => Promise<void>;
};

export function NotificationFilterCard({
  status,
  onToggleEnabled,
  onOpenListenerSettings,
}: NotificationFilterCardProps) {
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    setBusy(true);
    try {
      await onToggleEnabled(!status.enabled);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Notification Filter"
      subtitle="Scan and block adult content in social media notifications."
      action={
        <Chip compact icon={status.enabled ? 'bell-check-outline' : 'bell-off-outline'}>
          {status.enabled ? 'Active' : 'Off'}
        </Chip>
      }
    >
      <View style={styles.statusRow}>
        <Text style={styles.label}>Listener connected</Text>
        <Chip compact icon={status.listenerConnected ? 'check-circle-outline' : 'alert-circle-outline'}>
          {status.listenerConnected ? 'Connected' : 'Not connected'}
        </Chip>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.label}>Monitored apps</Text>
        <Text style={styles.value}>{status.monitoredPackageCount}</Text>
      </View>

      {!status.listenerConnected && status.enabled && (
        <Text style={styles.warning}>
          The notification listener is not connected. Open Android settings and grant notification
          access to Parent Blocker.
        </Text>
      )}

      <View style={styles.actions}>
        <Button
          icon={status.enabled ? 'bell-off-outline' : 'bell-check-outline'}
          tone={status.enabled ? 'danger' : 'primary'}
          loading={busy}
          onPress={handleToggle}
        >
          {status.enabled ? 'Disable' : 'Enable'}
        </Button>

        {!status.listenerConnected && (
          <Button icon="cog-outline" tone="neutral" onPress={() => void onOpenListenerSettings()}>
            Open Settings
          </Button>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    alignItems: 'center',
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  label: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  value: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  warning: {
    backgroundColor: colors.amber[400] + '18',
    borderRadius: 8,
    color: colors.amber[500],
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    padding: 12,
  },
  actions: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 14,
  },
});
