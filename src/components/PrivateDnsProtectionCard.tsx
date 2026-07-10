import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import { useTranslation } from '@/i18n';
import { spacing, typography, useTheme } from '@/theme';
import type { PrivateDnsProtectionStatus, PrivateDnsProtectionResult } from '@/types/blocker';

type PrivateDnsProtectionCardProps = {
  status?: PrivateDnsProtectionStatus;
  pinConfigured: boolean;
  onEnable: (hostname: string | null, pin?: string) => Promise<PrivateDnsProtectionResult | undefined>;
  onDisable: (pin?: string) => Promise<PrivateDnsProtectionResult | undefined>;
  onOpenPrivateDnsSettings: () => Promise<void>;
};

// No-VPN protection: a device owner pins the system resolver at a family-safe DoT host and locks
// it. Filtering keeps working with the internet fully up and no VPN slot held — the trade-off
// (stated in the card) is that the family resolver is the whole defence, with no app-level lists,
// keyword blocking, or audit log.
export function PrivateDnsProtectionCard({
  status,
  pinConfigured,
  onEnable,
  onDisable,
  onOpenPrivateDnsSettings,
}: PrivateDnsProtectionCardProps) {
  const t = useTranslation();
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const supported = status?.supported ?? false;
  const active = status?.active ?? false;
  const locked = status?.locked ?? false;

  const toggle = async () => {
    setBusy(true);
    try {
      const result = active
        ? await onDisable(pinConfigured ? pin : undefined)
        : await onEnable(null, pinConfigured ? pin : undefined);
      if (result?.applied) setPin('');
    } finally {
      setBusy(false);
    }
  };

  // Without device ownership the locked mode can't be applied; guide the manual Private DNS
  // setup instead, which the existing setup card also covers.
  if (!supported) {
    return (
      <Card title={t('privateDnsProtection.title')} subtitle={t('privateDnsProtection.needsOwnerSubtitle')}>
        <Text style={[styles.body, { color: colors.text.secondary }]}>
          {t('privateDnsProtection.tradeoff')}
        </Text>
        <Button icon="cog-outline" tone="neutral" onPress={() => void onOpenPrivateDnsSettings()}>
          {t('privateDnsProtection.openSettings')}
        </Button>
      </Card>
    );
  }

  return (
    <Card
      title={t('privateDnsProtection.title')}
      subtitle={t('privateDnsProtection.subtitle')}
      action={
        <Chip
          compact
          icon={active ? 'shield-check' : 'shield-off-outline'}
          style={{ backgroundColor: (active ? colors.green[500] : colors.text.muted) + '22' }}
          textStyle={{ color: active ? colors.green[600] : colors.text.muted, fontSize: 11, fontWeight: '700' }}
        >
          {active ? t('privateDnsProtection.chipOn') : t('privateDnsProtection.chipOff')}
        </Chip>
      }
    >
      <Text style={[styles.body, { color: colors.text.secondary }]}>{t('privateDnsProtection.tradeoff')}</Text>

      {active ? (
        <View style={styles.statusRow}>
          <Chip compact icon="dns">{status?.host ?? status?.defaultHost ?? ''}</Chip>
          {locked ? <Chip compact icon="lock">{t('privateDnsProtection.locked')}</Chip> : null}
        </View>
      ) : null}

      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label={t('policy.pinLabel')}
          onChangeText={setPin}
          placeholder={t('common.enterPin')}
          secureTextEntry
          value={pin}
        />
      ) : null}

      <Button
        icon={active ? 'shield-off-outline' : 'shield-check'}
        tone={active ? 'neutral' : 'primary'}
        loading={busy}
        disabled={busy || (pinConfigured && pin.length < 4)}
        onPress={() => void toggle()}
      >
        {active ? t('privateDnsProtection.disable') : t('privateDnsProtection.enable')}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
