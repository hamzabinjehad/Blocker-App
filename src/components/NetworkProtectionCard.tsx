import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import { colors, radius } from '@/theme';
import type { HttpsInspectionStatus, VpnPolicyStatus, VpnPolicyUpdate } from '@/types/blocker';

type NetworkProtectionCardProps = {
  alwaysOnVpnLocked: boolean;
  httpsInspection: HttpsInspectionStatus;
  vpnPolicy: VpnPolicyStatus;
  onSetHttpsInspectionEnabled: (
    enabled: boolean,
    privacyAcknowledged: boolean,
    pin?: string,
  ) => Promise<void>;
  onUpdateVpnPolicy: (policy: VpnPolicyUpdate) => Promise<void>;
};

export function NetworkProtectionCard({
  alwaysOnVpnLocked,
  httpsInspection,
  vpnPolicy,
  onSetHttpsInspectionEnabled,
  onUpdateVpnPolicy,
}: NetworkProtectionCardProps) {
  const [pin, setPin] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function run(action: string, callback: () => Promise<void>) {
    setPendingAction(action);
    try {
      await callback();
    } finally {
      setPendingAction(null);
    }
  }

  const fullTunnelActive = vpnPolicy.effectiveTunnelMode === 'full_tunnel' && vpnPolicy.routesAllIpv4Traffic;

  return (
    <Card title="Network Protection" subtitle="Local VPN routing, app scope, IPv6 leaks, and HTTPS proxy controls.">
      <View style={styles.chips}>
        <Chip compact icon={fullTunnelActive ? 'lan-connect' : 'dns-outline'}>
          {fullTunnelActive ? 'Full tunnel' : 'DNS tunnel'}
        </Chip>
        <Chip compact icon={vpnPolicy.perAppVpnFilteringEnabled ? 'application-cog-outline' : 'apps'}>
          {vpnPolicy.perAppVpnFilteringEnabled ? `${vpnPolicy.filteredPackageCount} scoped apps` : 'All apps'}
        </Chip>
        <Chip compact icon={vpnPolicy.ipv6LeakPreventionEnabled ? 'shield-check-outline' : 'shield-alert-outline'}>
          {vpnPolicy.ipv6LeakPreventionEnabled ? 'IPv6 leak guard' : 'IPv6 guard off'}
        </Chip>
        <Chip compact icon={httpsInspection.localProxyConfigured ? 'lock-check-outline' : 'lock-alert-outline'}>
          {httpsInspection.localProxyConfigured ? 'HTTPS proxy set' : 'HTTPS proxy off'}
        </Chip>
        <Chip compact icon={alwaysOnVpnLocked ? 'vpn' : 'network-off-outline'}>
          {alwaysOnVpnLocked ? 'Always-on locked' : 'Always-on optional'}
        </Chip>
      </View>

      <View style={styles.statusPanel}>
        <StatusRow
          label="Traffic route"
          value={fullTunnelActive ? 'Selected app traffic routes through the local VPN.' : 'DNS-only fallback is active.'}
        />
        <StatusRow
          label="System bypass"
          value={`${vpnPolicy.systemBypassPackages.length} updater/essential packages bypass the app tunnel.`}
        />
        <StatusRow
          label="Reconnect"
          value={
            vpnPolicy.reconnectOnBootEnabled && vpnPolicy.reconnectOnPackageReplaceEnabled
              ? 'Boot and app update restart hooks are registered.'
              : 'Restart hooks need attention.'
          }
        />
        <StatusRow
          label="HTTPS content"
          value={httpsInspection.contentInspectionActive ? 'Root-CA content inspection active.' : 'CONNECT host filtering only.'}
        />
      </View>

      <Field
        label="Parent PIN for network changes"
        onChangeText={setPin}
        placeholder="Enter PIN if configured"
        secureTextEntry
        value={pin}
      />

      <View style={styles.actions}>
        <Button
          disabled={fullTunnelActive}
          icon="lan-connect"
          loading={pendingAction === 'enable-full-tunnel'}
          onPress={() =>
            void run('enable-full-tunnel', () =>
              onUpdateVpnPolicy({
                fullTunnelVpnEnabled: true,
                perAppVpnFilteringEnabled: true,
                ipv6LeakPreventionEnabled: true,
                currentPin: pin,
              }),
            )
          }
        >
          Enable Full-Tunnel App Filtering
        </Button>
        <Button
          disabled={!fullTunnelActive}
          icon="dns-outline"
          loading={pendingAction === 'disable-full-tunnel'}
          tone="neutral"
          onPress={() =>
            void run('disable-full-tunnel', () =>
              onUpdateVpnPolicy({
                fullTunnelVpnEnabled: false,
                currentPin: pin,
              }),
            )
          }
        >
          Use DNS-Only Fallback
        </Button>
        <Button
          disabled={vpnPolicy.ipv6LeakPreventionEnabled}
          icon="shield-check-outline"
          loading={pendingAction === 'enable-ipv6'}
          tone="neutral"
          onPress={() =>
            void run('enable-ipv6', () =>
              onUpdateVpnPolicy({
                ipv6LeakPreventionEnabled: true,
                currentPin: pin,
              }),
            )
          }
        >
          Enable IPv6 Leak Guard
        </Button>
        <Button
          disabled={!httpsInspection.supported || httpsInspection.enabled}
          icon="lock-check-outline"
          loading={pendingAction === 'enable-https'}
          tone="danger"
          onPress={() =>
            void run('enable-https', () => onSetHttpsInspectionEnabled(true, true, pin))
          }
        >
          Enable HTTPS Proxy
        </Button>
        <Button
          disabled={!httpsInspection.enabled}
          icon="lock-open-outline"
          loading={pendingAction === 'disable-https'}
          tone="neutral"
          onPress={() =>
            void run('disable-https', () => onSetHttpsInspectionEnabled(false, false, pin))
          }
        >
          Disable HTTPS Proxy
        </Button>
      </View>

      <View style={styles.warningPanel}>
        <Text selectable style={styles.warningTitle}>
          HTTPS privacy warning
        </Text>
        <Text selectable style={styles.note}>
          {httpsInspection.warning}
        </Text>
        <Text selectable style={styles.note}>
          Root CA installed: {httpsInspection.rootCaInstalled ? 'yes' : 'no'}. Content inspection:{' '}
          {httpsInspection.contentInspectionActive ? 'active' : 'not active'}.
        </Text>
      </View>
    </Card>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text selectable style={styles.statusLabel}>
        {label}
      </Text>
      <Text selectable style={styles.statusValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  note: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  statusLabel: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  statusPanel: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  statusRow: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusValue: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  warningPanel: {
    backgroundColor: 'rgba(255,186,59,0.10)',
    borderColor: colors.border.amber,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  warningTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
