import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { Card } from './Card';
import { Field } from './controls';
import { useTheme } from '@/theme';
import type { PolicyUpdate, RiskySettings } from '@/types/blocker';

type PolicyCardProps = {
  adultFilteringEnabled: boolean;
  riskySettings: RiskySettings;
  pinConfigured: boolean;
  onUpdatePolicy: (policy: PolicyUpdate) => Promise<void>;
};

export function PolicyCard({
  adultFilteringEnabled,
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
    <Card title="Filters & Safeguards" subtitle="Adult content blocking and bypass prevention.">
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="Parent PIN"
          onChangeText={setPin}
          placeholder="Enter PIN to make changes"
          secureTextEntry
          value={pin}
        />
      ) : null}
      <PolicyRow
        label="Adult content filtering"
        helper="Blocks adult sites and known bypass domains."
        value={adultFilteringEnabled}
        onValueChange={(v) => update({ adultFilteringEnabled: v })}
      />
      <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />
      <PolicyRow
        label="Block VPN apps"
        helper="Prevents alternate VPN apps from bypassing protection."
        value={riskySettings.blockVpnApps}
        onValueChange={(blockVpnApps) => update({ blockVpnApps })}
      />
      <PolicyRow
        label="Block private browsers"
        helper="Limits browsers commonly used to avoid filters."
        value={riskySettings.blockPrivateBrowsers}
        onValueChange={(blockPrivateBrowsers) => update({ blockPrivateBrowsers })}
      />
      <PolicyRow
        label="Block bypass tools"
        helper="Flags tools designed to route around protection."
        value={riskySettings.blockBypassTools}
        onValueChange={(blockBypassTools) => update({ blockBypassTools })}
      />
      <PolicyRow
        label="Block sideloaded APKs"
        helper="Reduces installs from outside approved app stores."
        value={riskySettings.blockSideloadedApps}
        onValueChange={(blockSideloadedApps) => update({ blockSideloadedApps })}
      />
    </Card>
  );
}

function PolicyRow({
  label,
  helper,
  value,
  onValueChange,
}: {
  label: string;
  helper: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
        <Text style={[styles.helper, { color: colors.text.muted }]}>{helper}</Text>
      </View>
      <Switch onValueChange={onValueChange} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  helper: {
    fontSize: 12,
    lineHeight: 17,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
});
