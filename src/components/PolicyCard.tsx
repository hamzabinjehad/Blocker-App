import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

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
        subtitle="Intercepts device DNS locally, blocks adult categories before connection, then resolves allowed domains over family-safe DoH."
      >
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.text.primary }]}>Adult-domain filtering</Text>
          <Switch
            onValueChange={(adultFilteringEnabledValue) => update({ adultFilteringEnabled: adultFilteringEnabledValue })}
            value={adultFilteringEnabled}
          />
        </View>
        <Text style={[styles.body, { color: colors.text.secondary }]}>Blocked categories: adult content, pornography, explicit media, and configured bypass domains.</Text>
        <Text style={[styles.body, { color: colors.text.secondary }]}>Upstream safety: Cloudflare 1.1.1.3, CleanBrowsing Family, OpenDNS FamilyShield.</Text>
        <Text style={[styles.body, { color: colors.text.secondary }]}>Blocked domains: {blockedDomainCount}</Text>
        <Text style={[styles.body, { color: colors.text.secondary }]}>Last blocklist update: {lastBlocklistUpdate}</Text>
        <Text style={[styles.note, { color: colors.text.muted }]}>Allowed lookups use encrypted DNS-over-HTTPS; blocked lookups are answered locally without an upstream request.</Text>
      </Card>

      <Card
        title="Risky App / Bypass Protection"
        subtitle="Detects hardcoded DNS resolvers, blocks encrypted DNS resolver traffic, and flags bypass apps through managed or accessibility flows."
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
        <Text style={[styles.note, { color: colors.text.muted }]}>Strict bypass policy also strips DNS HTTPS/SVCB hints used to advertise encrypted SNI/ECH when safe fallback records are available.</Text>
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
  note: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
