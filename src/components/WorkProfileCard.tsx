import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import { colors } from '@/theme';
import type { WorkProfileStatus } from '@/types/blocker';

type WorkProfileCardProps = {
  status: WorkProfileStatus;
  onProvisionWorkProfile: () => Promise<void>;
  onApplyCorporatePolicy: (pin?: string) => Promise<void>;
  onRemoveWorkProfile: (pin?: string) => Promise<void>;
};

export function WorkProfileCard({
  status,
  onProvisionWorkProfile,
  onApplyCorporatePolicy,
  onRemoveWorkProfile,
}: WorkProfileCardProps) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const wrap = (key: string, action: () => Promise<void>) => async () => {
    setBusy(key);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };

  const enrollmentLabel = (() => {
    switch (status.enrollmentMethod) {
      case 'device_owner_active':
        return 'Device Owner';
      case 'profile_owner_active':
        return 'Profile Owner';
      case 'work_profile_provisioning':
        return 'Ready to provision';
      default:
        return 'Device Admin only';
    }
  })();

  return (
    <Card
      title="Work Profile / MDM"
      subtitle="Android Enterprise managed device support for corporate or school deployments."
      action={
        <Chip compact icon={status.managedOwner ? 'shield-check-outline' : 'shield-outline'}>
          {status.managedOwner ? 'Managed' : 'Standard'}
        </Chip>
      }
    >
      <View style={styles.row}>
        <Text style={styles.label}>Device Owner</Text>
        <StatusChip active={status.deviceOwner} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Profile Owner</Text>
        <StatusChip active={status.profileOwner} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Enrollment</Text>
        <Text style={styles.value}>{enrollmentLabel}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Restrictions applied</Text>
        <Text style={styles.value}>{status.restrictions.length}</Text>
      </View>

      {!status.managedOwner && status.provisioningAvailable && (
        <View style={styles.actions}>
          <Text style={styles.hint}>
            Provision a Work Profile to enable full app suspension, always-on VPN lockdown, and
            uninstall blocking without root.
          </Text>
          <Button
            icon="briefcase-plus-outline"
            tone="primary"
            loading={busy === 'provision'}
            onPress={wrap('provision', onProvisionWorkProfile)}
          >
            Provision Work Profile
          </Button>
        </View>
      )}

      {status.managedOwner && (
        <View style={styles.actions}>
          <Field label="Admin PIN" value={pin} onChangeText={setPin} secureTextEntry placeholder="PIN" />
          <View style={styles.buttonRow}>
            <Button
              icon="shield-lock-outline"
              tone="primary"
              loading={busy === 'corporate'}
              onPress={wrap('corporate', () => onApplyCorporatePolicy(pin || undefined))}
            >
              Apply Corporate Policy
            </Button>
            <Button
              icon="delete-outline"
              tone="danger"
              loading={busy === 'remove'}
              onPress={wrap('remove', () => onRemoveWorkProfile(pin || undefined))}
            >
              Remove Profile
            </Button>
          </View>
        </View>
      )}

      {!status.workProfileSupported && (
        <Text style={styles.warning}>
          Work Profile requires Android 5.0 or newer. This device does not support managed profiles.
        </Text>
      )}
    </Card>
  );
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <Chip compact icon={active ? 'check-circle-outline' : 'close-circle-outline'}>
      {active ? 'Yes' : 'No'}
    </Chip>
  );
}

const styles = StyleSheet.create({
  row: {
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
  actions: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    gap: 10,
    marginTop: 4,
    paddingTop: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hint: {
    color: colors.text.muted,
    fontSize: 13,
    lineHeight: 20,
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
});
