import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import { colors, radius } from '@/theme';
import type { ManagedDeviceStatus, ManagedEnforcementStatus } from '@/types/blocker';

type ManagedModeNoticeProps = {
  batteryOptimizationIgnored: boolean;
  status: ManagedDeviceStatus;
  enforcement: ManagedEnforcementStatus;
  error?: string;
  onCopyDeviceOwnerCommand: () => Promise<boolean>;
  onRefreshStatus: () => Promise<void>;
  onRequestDeviceAdminPermission: () => Promise<void>;
  onSetUninstallProtectionEnabled: (enabled: boolean, pin?: string, durationDays?: number) => Promise<void>;
  onConfigureManagedPrivateDns: (hostname: string) => Promise<void>;
  onOpenPrivateDnsSettings: () => Promise<void>;
  onSetAlwaysOnVpnLockdown: (enabled: boolean, pin?: string) => Promise<void>;
  onSetPackageSuspensionEnabled: (enabled: boolean, pin?: string) => Promise<void>;
  onSetEmergencyLockEnabled: (enabled: boolean, pin?: string) => Promise<void>;
  onRequestIgnoreBatteryOptimizations: () => Promise<void>;
  onApplyStrictDeviceOwnerPolicy: (pin?: string) => Promise<void>;
  onSetStrictModeEnabled: (enabled: boolean, pin?: string) => Promise<void>;
};

export function ManagedModeNotice({
  batteryOptimizationIgnored,
  status,
  enforcement,
  error,
  onCopyDeviceOwnerCommand,
  onRefreshStatus,
  onRequestDeviceAdminPermission,
  onSetUninstallProtectionEnabled,
  onConfigureManagedPrivateDns,
  onOpenPrivateDnsSettings,
  onSetAlwaysOnVpnLockdown,
  onSetPackageSuspensionEnabled,
  onSetEmergencyLockEnabled,
  onRequestIgnoreBatteryOptimizations,
  onApplyStrictDeviceOwnerPolicy,
  onSetStrictModeEnabled,
}: ManagedModeNoticeProps) {
  const [privateDnsHost, setPrivateDnsHost] = useState(status.privateDnsHost ?? '');
  const [uninstallLockDays, setUninstallLockDays] = useState(String(status.uninstallLockDurationDays || 30));
  const [pin, setPin] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [deviceOwnerCommandCopied, setDeviceOwnerCommandCopied] = useState(false);
  const managedOwner = status.deviceOwner || status.profileOwner;
  const uninstallProtection = uninstallProtectionLabel(status);
  const lockDays = clampLockDays(uninstallLockDays);
  const lockTiming = uninstallLockTiming(status);
  const ownerRestrictedLabel = managedOwner ? 'Available' : 'Needs owner';
  const enrollmentCommand =
    'adb shell dpm set-device-owner com.example.parentblocker/com.example.blocker.BlockerDeviceAdminReceiver';
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  async function runManagedAction(
    action: string,
    label: string,
    callback: () => Promise<void>,
    clearPin = true,
  ) {
    setPendingAction(action);
    setActionFeedback(null);
    try {
      await callback();
      if (clearPin) setPin('');
      setActionFeedback(`${label} requested. Current status is shown below.`);
    } finally {
      setPendingAction(null);
    }
  }

  async function copyEnrollmentCommand() {
    setPendingAction('copy-device-owner-command');
    setActionFeedback(null);
    try {
      const copied = await onCopyDeviceOwnerCommand();
      setDeviceOwnerCommandCopied(copied);
      setActionFeedback(
        copied
          ? 'Enrollment command copied. Run it with ADB on a fresh emulator or provisioned test device.'
          : 'Could not copy the enrollment command.',
      );
    } finally {
      setPendingAction(null);
    }
  }

  useEffect(() => {
    if (!status.uninstallLockActive) {
      setUninstallLockDays(String(status.uninstallLockDurationDays || 30));
    }
  }, [status.uninstallLockActive, status.uninstallLockDurationDays]);

  useEffect(() => {
    setPrivateDnsHost(status.privateDnsHost ?? '');
  }, [status.privateDnsHost]);

  return (
    <Card title="Managed Device Controls" subtitle="Android permissions for stronger enforcement without hiding the app.">
      <View style={styles.chips}>
        <Chip compact icon={status.deviceAdminActive ? 'shield-check-outline' : 'shield-alert-outline'}>
          {status.deviceAdminActive ? 'Device admin active' : 'Admin permission needed'}
        </Chip>
        <Chip compact icon={managedOwner ? 'account-key-outline' : 'account-alert-outline'}>
          {managedOwner ? 'Managed owner' : 'Not managed owner'}
        </Chip>
        <Chip compact icon={uninstallProtection.icon}>
          {uninstallProtection.label}
        </Chip>
        <Chip compact icon={status.uninstallLockActive ? 'timer-sand' : 'timer-outline'}>
          {lockTiming.chip}
        </Chip>
        <Chip compact icon={enforcement.alwaysOnVpnLockdownEnabled ? 'vpn' : 'network-off-outline'}>
          {enforcement.alwaysOnVpnLockdownEnabled ? 'VPN lockdown' : 'VPN not locked'}
        </Chip>
        <Chip compact icon={enforcement.strictModeEnabled ? 'lock-check-outline' : 'lock-open-outline'}>
          {enforcement.strictModeEnabled ? 'Strict Mode' : 'Strict Mode off'}
        </Chip>
        <Chip compact icon={enforcement.emergencyLockEnabled ? 'cellphone-lock' : 'cellphone'}>
          {enforcement.emergencyLockEnabled ? 'Emergency lock' : 'Emergency lock off'}
        </Chip>
      </View>

      <Text selectable style={styles.body}>
        Device Admin adds a visible uninstall/deactivation warning. Android only lets a device owner or profile owner
        fully block uninstall, enforce VPN lockdown, and force system Private DNS.
      </Text>
      <Text selectable style={styles.note}>
        Fresh-device ADB enrollment: {enrollmentCommand}
      </Text>
      {error ? (
        <View style={styles.errorPanel}>
          <Text selectable style={styles.statusTitle}>
            Action needs attention
          </Text>
          <Text selectable style={styles.note}>
            {error}
          </Text>
        </View>
      ) : actionFeedback ? (
        <View style={styles.feedbackPanel}>
          <Text selectable style={styles.statusTitle}>
            Last action
          </Text>
          <Text selectable style={styles.note}>
            {actionFeedback}
          </Text>
        </View>
      ) : null}
      {!managedOwner ? (
        <View style={styles.requirementPanel}>
          <Text selectable style={styles.disabledTitle}>
            Managed-owner enrollment required
          </Text>
          <Text selectable style={styles.note}>
            These stronger controls stay disabled until Android reports this app as Device Owner or Profile Owner.
            Use the ADB command on a fresh emulator or provisioned test device.
          </Text>
          <Button
            icon={deviceOwnerCommandCopied ? 'check-circle-outline' : 'content-copy'}
            loading={pendingAction === 'copy-device-owner-command'}
            tone="neutral"
            onPress={() => void copyEnrollmentCommand()}
          >
            {deviceOwnerCommandCopied ? 'Enrollment Command Copied' : 'Copy Enrollment Command'}
          </Button>
        </View>
      ) : null}
      <View style={styles.capabilityGrid}>
        <CapabilityRow
          label="Basic uninstall guard"
          ready={status.deviceAdminActive}
          readyLabel="Device Admin active"
          waitingLabel="Needs Device Admin"
        />
        <CapabilityRow
          label="Managed-owner controls"
          ready={managedOwner}
          readyLabel="Available"
          waitingLabel="Enrollment required"
        />
        <CapabilityRow
          label="Strict Mode"
          ready={enforcement.strictModeEnabled}
          readyLabel="Enabled"
          waitingLabel="Off"
        />
        <CapabilityRow
          label="Battery optimization"
          ready={batteryOptimizationIgnored}
          readyLabel="Ignored"
          waitingLabel="Needs ignore"
        />
        <CapabilityRow
          label="Always-on VPN lockdown"
          ready={enforcement.alwaysOnVpnLockdownEnabled}
          readyLabel="Applied"
          waitingLabel={enforcement.alwaysOnVpnLockdownRequested ? 'Requested' : ownerRestrictedLabel}
        />
        <CapabilityRow
          label="Package suspension"
          ready={enforcement.packageSuspensionEnabled}
          readyLabel={
            enforcement.suspendedPackageCount > 0
              ? `${enforcement.suspendedPackageCount} suspended`
              : 'Enabled'
          }
          waitingLabel={managedOwner ? 'Off' : 'Needs owner'}
        />
        <CapabilityRow
          label="Managed Private DNS"
          ready={Boolean(status.privateDnsHost)}
          readyLabel={status.privateDnsHost ?? 'Configured'}
          waitingLabel={status.canConfigurePrivateDns ? 'Host unset' : 'Needs owner'}
        />
      </View>

      <Button
        icon="refresh"
        loading={pendingAction === 'refresh-status'}
        tone="neutral"
        onPress={() => void runManagedAction('refresh-status', 'Managed status refresh', onRefreshStatus, false)}
      >
        Refresh Managed Status
      </Button>

      <Button
        disabled={status.deviceAdminActive}
        icon="shield-account-outline"
        loading={pendingAction === 'device-admin'}
        tone="neutral"
        onPress={() =>
          void runManagedAction('device-admin', 'Basic uninstall guard permission', onRequestDeviceAdminPermission, false)
        }
      >
        {status.deviceAdminActive ? 'Basic Uninstall Guard Enabled' : 'Enable Basic Uninstall Guard'}
      </Button>

      <View style={styles.privateDnsPanel}>
        <Text selectable style={styles.disabledTitle}>
          Managed Enforcement
        </Text>
        <Field
          keyboardType="number-pad"
          label="Parent PIN for managed controls"
          onChangeText={setPin}
          placeholder="Enter PIN if configured"
          secureTextEntry
          value={pin}
        />
        <Text selectable style={styles.note}>
          Uninstall guard: {uninstallProtection.description}
        </Text>
        <Text selectable style={styles.note}>
          Time lock: {lockTiming.description}
        </Text>
        <Field
          keyboardType="number-pad"
          label="Uninstall lock duration (days)"
          onChangeText={setUninstallLockDays}
          placeholder="30"
          value={uninstallLockDays}
        />
        <Button
          disabled={!status.canBlockUninstall || status.uninstallLockActive}
          icon="lock-remove-outline"
          loading={pendingAction === 'enable-uninstall-lock'}
          tone="danger"
          onPress={() =>
            void runManagedAction(
              'enable-uninstall-lock',
              'Managed uninstall lock',
              () => onSetUninstallProtectionEnabled(true, pin, lockDays),
            )
          }
        >
          {status.uninstallBlocked ? `Start ${lockDays}-day Uninstall Timer` : `Enable ${lockDays}-day Uninstall Lock`}
        </Button>
        <Button
          disabled={!status.uninstallBlocked || status.uninstallLockActive}
          icon="delete-off-outline"
          loading={pendingAction === 'disable-uninstall-lock'}
          tone="neutral"
          onPress={() =>
            void runManagedAction(
              'disable-uninstall-lock',
              'Managed uninstall unlock',
              () => onSetUninstallProtectionEnabled(false, pin),
            )
          }
        >
          {status.uninstallLockActive ? `Locked until ${formatDate(status.uninstallLockExpiresAt)}` : 'Disable Managed Uninstall Lock'}
        </Button>
        <Button
          disabled={!enforcement.canSetAlwaysOnVpn || enforcement.alwaysOnVpnLockdownEnabled}
          icon="vpn"
          loading={pendingAction === 'enable-vpn-lockdown'}
          onPress={() =>
            void runManagedAction(
              'enable-vpn-lockdown',
              'Always-on VPN lockdown',
              () => onSetAlwaysOnVpnLockdown(true, pin),
            )
          }
        >
          Enable Always-on VPN Lockdown
        </Button>
        <Button
          disabled={!enforcement.canSetAlwaysOnVpn || !enforcement.alwaysOnVpnLockdownEnabled}
          icon="network-off-outline"
          loading={pendingAction === 'disable-vpn-lockdown'}
          tone="neutral"
          onPress={() =>
            void runManagedAction(
              'disable-vpn-lockdown',
              'Always-on VPN lockdown removal',
              () => onSetAlwaysOnVpnLockdown(false, pin),
            )
          }
        >
          Disable Always-on VPN Lockdown
        </Button>
        <Button
          disabled={!enforcement.canSuspendPackages || enforcement.packageSuspensionEnabled}
          icon="cellphone-lock"
          loading={pendingAction === 'enable-package-suspension'}
          onPress={() =>
            void runManagedAction(
              'enable-package-suspension',
              'Package suspension',
              () => onSetPackageSuspensionEnabled(true, pin),
            )
          }
        >
          Enable Package Suspension
        </Button>
        <Button
          disabled={!enforcement.canSuspendPackages || !enforcement.packageSuspensionEnabled}
          icon="cellphone-remove"
          loading={pendingAction === 'disable-package-suspension'}
          tone="neutral"
          onPress={() =>
            void runManagedAction(
              'disable-package-suspension',
              'Package suspension removal',
              () => onSetPackageSuspensionEnabled(false, pin),
            )
          }
        >
          Disable Package Suspension
        </Button>
        <Button
          disabled={!enforcement.canSuspendPackages || enforcement.emergencyLockEnabled}
          icon="cellphone-lock"
          loading={pendingAction === 'enable-emergency-lock'}
          tone="danger"
          onPress={() =>
            void runManagedAction(
              'enable-emergency-lock',
              'Emergency lock',
              () => onSetEmergencyLockEnabled(true, pin),
            )
          }
        >
          Enable Emergency Lock
        </Button>
        <Button
          disabled={!enforcement.emergencyLockEnabled}
          icon="cellphone-remove"
          loading={pendingAction === 'disable-emergency-lock'}
          tone="neutral"
          onPress={() =>
            void runManagedAction(
              'disable-emergency-lock',
              'Emergency lock removal',
              () => onSetEmergencyLockEnabled(false, pin),
            )
          }
        >
          Disable Emergency Lock
        </Button>
        <Button
          disabled={batteryOptimizationIgnored}
          icon={batteryOptimizationIgnored ? 'battery-check-outline' : 'battery-alert'}
          loading={pendingAction === 'battery-ignore'}
          tone="neutral"
          onPress={() =>
            void runManagedAction('battery-ignore', 'Battery optimization exception', onRequestIgnoreBatteryOptimizations, false)
          }
        >
          {batteryOptimizationIgnored ? 'Battery Ignore Ready' : 'Request Battery Ignore'}
        </Button>
        <Button
          disabled={enforcement.strictModeEnabled}
          icon="lock-check-outline"
          loading={pendingAction === 'enable-strict-mode'}
          tone="danger"
          onPress={() =>
            void runManagedAction('enable-strict-mode', 'Strict Mode', () => onSetStrictModeEnabled(true, pin))
          }
        >
          Enable Strict Mode
        </Button>
        <Button
          disabled={!enforcement.strictModeEnabled}
          icon="lock-open-outline"
          loading={pendingAction === 'disable-strict-mode'}
          tone="neutral"
          onPress={() =>
            void runManagedAction('disable-strict-mode', 'Strict Mode disable', () => onSetStrictModeEnabled(false, pin))
          }
        >
          Disable Strict Mode
        </Button>
        <Button
          disabled={!managedOwner}
          icon="shield-lock-outline"
          loading={pendingAction === 'apply-device-owner-policy'}
          tone="danger"
          onPress={() =>
            void runManagedAction(
              'apply-device-owner-policy',
              'Device Owner Strict Policy',
              () => onApplyStrictDeviceOwnerPolicy(pin),
            )
          }
        >
          Apply Device Owner Strict Policy
        </Button>
        <Text selectable style={styles.note}>
          Suspended packages: {enforcement.suspendedPackageCount}. Always-on package:{' '}
          {enforcement.alwaysOnVpnPackage || 'none'}.
        </Text>
      </View>

      <View style={styles.privateDnsPanel}>
        <Text selectable style={styles.disabledTitle}>
          Managed Private DNS
        </Text>
        <Text selectable style={styles.note}>
          Use this only with a managed DNS-over-TLS hostname. This does not run a local VPN.
        </Text>
        <Field
          label="Private DNS hostname"
          onChangeText={setPrivateDnsHost}
          placeholder="dns.example.com"
          value={privateDnsHost}
        />
        <Button
          disabled={!status.canConfigurePrivateDns}
          icon="dns-outline"
          loading={pendingAction === 'managed-dns'}
          onPress={() =>
            void runManagedAction('managed-dns', 'Managed Private DNS', () => onConfigureManagedPrivateDns(privateDnsHost), false)
          }
        >
          Apply Managed DNS
        </Button>
        <Button
          icon="cog-outline"
          loading={pendingAction === 'open-private-dns-settings'}
          tone="neutral"
          onPress={() =>
            void runManagedAction('open-private-dns-settings', 'Android DNS settings', onOpenPrivateDnsSettings, false)
          }
        >
          Open Android DNS Settings
        </Button>
        <Text selectable style={styles.note}>
          Current managed host: {status.privateDnsHost || 'none'}
        </Text>
      </View>
    </Card>
  );
}

function CapabilityRow({
  label,
  ready,
  readyLabel,
  waitingLabel,
}: {
  label: string;
  ready: boolean;
  readyLabel: string;
  waitingLabel: string;
}) {
  return (
    <View style={styles.capabilityRow}>
      <Text selectable style={styles.capabilityLabel}>
        {label}
      </Text>
      <Chip compact icon={ready ? 'check-circle-outline' : 'alert-circle-outline'}>
        {ready ? readyLabel : waitingLabel}
      </Chip>
    </View>
  );
}

function uninstallProtectionLabel(status: ManagedDeviceStatus) {
  if (status.uninstallProtectionLevel === 'managed_owner') {
    return {
      icon: status.uninstallLockActive ? 'timer-sand' : 'lock-remove-outline',
      label: status.uninstallLockActive ? 'Timed uninstall lock' : 'Managed uninstall lock',
      description: status.uninstallLockActive
        ? `managed uninstall blocking is active until ${formatDate(status.uninstallLockExpiresAt)}.`
        : 'full managed-owner uninstall blocking is active.',
    };
  }

  if (status.uninstallProtectionLevel === 'device_admin' || status.basicUninstallProtectionActive) {
    return {
      icon: 'shield-key-outline',
      label: 'Basic uninstall guard',
      description: 'Device Admin is active; uninstall requires disabling the visible admin permission first.',
    };
  }

  return {
    icon: 'delete-outline',
    label: 'No uninstall guard',
    description: 'enable Device Admin for the basic guard or enroll as a managed owner for a full lock.',
  };
}

function uninstallLockTiming(status: ManagedDeviceStatus) {
  if (status.uninstallLockActive) {
    return {
      chip: `${remainingDays(status.uninstallLockRemainingMs)} left`,
      description: `${remainingDays(status.uninstallLockRemainingMs)} remaining. The lock can be disabled after ${formatDate(status.uninstallLockExpiresAt)}.`,
    };
  }

  return {
    chip: `${status.uninstallLockDurationDays || 30}d lock ready`,
    description: `next managed uninstall lock will run for ${status.uninstallLockDurationDays || 30} days.`,
  };
}

function clampLockDays(value: string) {
  const days = Number.parseInt(value, 10);
  if (!Number.isFinite(days)) return 30;
  return Math.min(365, Math.max(1, days));
}

function remainingDays(value: number) {
  const days = Math.max(1, Math.ceil(Number(value || 0) / 86_400_000));
  return days === 1 ? '1 day' : `${days} days`;
}

function formatDate(value?: number | null) {
  if (!value) return 'the configured date';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  body: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  privateDnsPanel: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  requirementPanel: {
    backgroundColor: 'rgba(255,186,59,0.10)',
    borderColor: colors.border.amber,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  capabilityGrid: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  capabilityRow: {
    alignItems: 'center',
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  capabilityLabel: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  errorPanel: {
    backgroundColor: 'rgba(255,87,87,0.12)',
    borderColor: colors.border.red,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  feedbackPanel: {
    backgroundColor: 'rgba(30,206,164,0.10)',
    borderColor: colors.border.teal,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  statusTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  disabledTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  note: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
