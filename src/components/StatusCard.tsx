import { StyleSheet } from 'react-native';
import { Chip, ProgressBar, Text } from 'react-native-paper';

import { Card } from './Card';
import type { ProtectionStatus } from '@/types/blocker';

type StatusCardProps = {
  status: ProtectionStatus;
  vpnActive: boolean;
  tampered: boolean;
};

const displayByStatus: Record<ProtectionStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  needs_vpn_permission: 'Needs VPN Permission',
  tampered: 'Tampered',
};

export function StatusCard({ status, vpnActive, tampered }: StatusCardProps) {
  const progress = tampered ? 1 : status === 'active' ? 1 : status === 'needs_vpn_permission' ? 0.45 : 0.18;
  const chipIcon = tampered ? 'alert-octagon-outline' : status === 'active' ? 'shield-check-outline' : 'shield-alert-outline';

  return (
    <Card
      title="Protection Status"
      subtitle="Blocks common adult-domain DNS requests through a visible local Android VPN."
      action={
        <Chip compact icon={chipIcon} selected={status === 'active'}>
          {displayByStatus[status]}
        </Chip>
      }
    >
      <ProgressBar color={tampered ? '#b33a3a' : status === 'active' ? '#25694b' : '#a56a12'} progress={progress} />
      <Text style={styles.body}>
        {vpnActive
          ? 'The local VPN is running. DNS/domain traffic can be filtered before common browsers and apps resolve blocked domains.'
          : 'Protection is not currently filtering traffic. Start protection and grant Android VPN permission to enable DNS/domain filtering.'}
      </Text>
      <Text style={styles.disclosure}>
        This MVP does not decrypt HTTPS or read private messages. Accessibility-based screenshot checks are visible, consented, and used only for supported adult-image detection.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    color: '#34413b',
    fontSize: 14,
    lineHeight: 21,
  },
  disclosure: {
    color: '#6a766f',
    fontSize: 13,
    lineHeight: 19,
  },
});
