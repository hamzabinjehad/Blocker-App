import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Switch, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import { useTheme } from '@/theme';
import type { PolicyUpdate, RiskySettings } from '@/types/blocker';

type PolicyCardProps = {
  adultFilteringEnabled: boolean;
  blockedDomainCount: number;
  lastBlocklistUpdate: string;
  riskySettings: RiskySettings;
  pinConfigured: boolean;
  onUpdatePolicy: (policy: PolicyUpdate) => Promise<void>;
};

export function PolicyCard({
  adultFilteringEnabled,
  blockedDomainCount,
  lastBlocklistUpdate,
  riskySettings,
  pinConfigured,
  onUpdatePolicy,
}: PolicyCardProps) {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');

  const update = (policy: PolicyUpdate) => {
    void onUpdatePolicy(pinConfigured ? { ...policy, adminPin: pin } : policy);
  };

  return (
    <>
      <Card
        title="Adult Content Blocking"
        subtitle="Blocks adult content at the network level before it reaches your device."
      >
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.text.primary }]}>Adult-domain filtering</Text>
          <Switch
            onValueChange={(adultFilteringEnabledValue) => update({ adultFilteringEnabled: adultFilteringEnabledValue })}
            value={adultFilteringEnabled}
          />
        </View>
        <Text style={[styles.body, { color: colors.text.secondary }]}>Blocks adult content at the network level before it reaches your device.</Text>
        <View style={styles.chipRow}>
          <Chip compact>{blockedDomainCount.toLocaleString()} domains blocked</Chip>
          <Chip compact>{formatBlocklistAge(lastBlocklistUpdate)}</Chip>
        </View>
      </Card>

      <Card
        title="Risky App / Bypass Protection"
        subtitle="Blocks common ways people try to get around protection."
      >
        {pinConfigured ? (
          <Field
            keyboardType="number-pad"
            label="Parent PIN for setting changes"
            onChangeText={setPin}
            placeholder="Enter PIN"
            secureTextEntry
            value={pin}
          />
        ) : null}
        <PolicyRow
          label="Block VPN apps"
          value={riskySettings.blockVpnApps}
          onValueChange={(blockVpnApps) => update({ blockVpnApps })}
        />
        <PolicyRow
          label="Block private browsers"
          value={riskySettings.blockPrivateBrowsers}
          onValueChange={(blockPrivateBrowsers) => update({ blockPrivateBrowsers })}
        />
        <PolicyRow
          label="Block bypass tools"
          value={riskySettings.blockBypassTools}
          onValueChange={(blockBypassTools) => update({ blockBypassTools })}
        />
        <PolicyRow
          label="Block sideloaded APK installs"
          value={riskySettings.blockSideloadedApps}
          onValueChange={(blockSideloadedApps) => update({ blockSideloadedApps })}
        />
        <Button icon="eraser" tone="neutral" onPress={() => setPin('')}>
          Clear PIN Entry
        </Button>
        <Text style={[styles.note, { color: colors.text.muted }]}>These safeguards help keep protection active during protected sessions.</Text>
      </Card>
    </>
  );
}

function PolicyRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
      <Switch onValueChange={onValueChange} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

function formatBlocklistAge(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Lists updated recently';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days < 1) return 'Lists updated today';
  return `Lists updated ${days} day${days === 1 ? '' : 's'} ago`;
}
