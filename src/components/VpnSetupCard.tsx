import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button } from './controls';

type VpnSetupCardProps = {
  vpnPermissionGranted: boolean;
  loading: boolean;
  onGrantPermission: () => Promise<void>;
};

export function VpnSetupCard({ vpnPermissionGranted, loading, onGrantPermission }: VpnSetupCardProps) {
  return (
    <Card
      title="Local VPN Filter"
      subtitle="Routes DNS and selected app traffic through the on-device filter without root."
    >
      <View style={styles.row}>
        <Text style={styles.label}>Android VPN permission</Text>
        <Chip compact icon={vpnPermissionGranted ? 'check-circle-outline' : 'alert-circle-outline'}>
          {vpnPermissionGranted ? 'Granted' : 'Not granted'}
        </Chip>
      </View>
      <Button
        disabled={vpnPermissionGranted}
        icon="vpn"
        loading={loading}
        tone="neutral"
        onPress={() => void onGrantPermission()}
      >
        Grant VPN Permission
      </Button>
      <Text style={styles.note}>
        This local Android VPN runs on-device. Full-tunnel app filtering is scoped by package so system updates can bypass while risky browsers and bypass tools are filtered.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#34413b',
    fontSize: 14,
    fontWeight: '700',
  },
  note: {
    color: '#6a766f',
    fontSize: 13,
    lineHeight: 19,
  },
});
