import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button } from './controls';
import type { PrivateDnsStatus } from '@/types/blocker';

type PrivateDnsSetupCardProps = {
  status: PrivateDnsStatus;
  onCopyHostname: () => Promise<boolean>;
  onOpenSettings: () => Promise<void>;
};

export function PrivateDnsSetupCard({ status, onCopyHostname, onOpenSettings }: PrivateDnsSetupCardProps) {
  const [copied, setCopied] = useState(false);
  const configuredHost = status.configuredHost || status.activeHost;
  const recommendedActive = configuredHost?.toLowerCase() === status.recommendedHost.toLowerCase();
  const modeLabel = useMemo(() => privateDnsModeLabel(status.mode), [status.mode]);

  const copyHostname = async () => {
    const didCopy = await onCopyHostname();
    setCopied(didCopy);
  };

  return (
    <Card title="Private DNS Server" subtitle="No-VPN setup for Android Private DNS provider hostname mode.">
      <View style={styles.chips}>
        <Chip compact icon={status.supported ? 'cellphone-check' : 'cellphone-off'}>
          {status.supported ? 'Android supported' : 'Android 9+ needed'}
        </Chip>
        <Chip compact icon={recommendedActive ? 'shield-check-outline' : 'shield-alert-outline'} selected={recommendedActive}>
          {recommendedActive ? 'DNS active' : modeLabel}
        </Chip>
      </View>

      <View style={styles.hostnameBox}>
        <Text selectable style={styles.hostnameLabel}>
          Provider hostname
        </Text>
        <Text selectable style={styles.hostname}>
          {status.recommendedHost}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button disabled={!status.supported} icon={copied ? 'clipboard-check-outline' : 'content-copy'} tone="neutral" onPress={() => void copyHostname()}>
          {copied ? 'Hostname Copied' : 'Copy Hostname'}
        </Button>
        <Button disabled={!status.supported} icon="dns-outline" onPress={() => void onOpenSettings()}>
          Open Private DNS
        </Button>
      </View>

      <Text selectable style={styles.note}>
        Private DNS blocks domains at resolution time. HTTPS sites may show a browser block or certificate screen instead of a custom in-app block page.
      </Text>
      <Text selectable style={styles.current}>
        Current host: {configuredHost || 'automatic or off'}.
      </Text>
    </Card>
  );
}

function privateDnsModeLabel(mode?: string | null) {
  switch (mode) {
    case 'hostname':
      return 'Custom DNS set';
    case 'opportunistic':
      return 'Automatic DNS';
    case 'off':
      return 'DNS off';
    default:
      return 'DNS not set';
  }
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hostnameBox: {
    backgroundColor: '#eef2ef',
    borderColor: '#d2dbd6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  hostnameLabel: {
    color: '#65726c',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  hostname: {
    color: '#1c2420',
    fontSize: 17,
    fontWeight: '800',
  },
  actions: {
    gap: 10,
  },
  note: {
    color: '#6a766f',
    fontSize: 13,
    lineHeight: 19,
  },
  current: {
    color: '#34413b',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
