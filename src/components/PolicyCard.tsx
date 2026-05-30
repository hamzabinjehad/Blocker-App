import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Chip, Switch, Text } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';

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
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const update = (policy: PolicyUpdate) => {
    void onUpdatePolicy(pinConfigured ? { ...policy, adminPin: pin } : policy);
  };

  return (
    <>
      <Card
        title="Adult Content Blocking"
        subtitle="Blocks adult sites before they open."
        action={<Chip compact icon={adultFilteringEnabled ? 'shield-check-outline' : 'shield-alert-outline'}>{adultFilteringEnabled ? 'On' : 'Off'}</Chip>}
      >
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.text.primary }]}>Adult-domain filtering</Text>
          <Switch
            onValueChange={(adultFilteringEnabledValue) => update({ adultFilteringEnabled: adultFilteringEnabledValue })}
            value={adultFilteringEnabled}
          />
        </View>
        <View style={[styles.summaryBox, { backgroundColor: colors.bg.tertiary, borderColor: colors.border.subtle }]}>
          <Feather name="shield" size={18} color={adultFilteringEnabled ? colors.green[500] : colors.text.muted} />
          <Text style={[styles.body, { color: colors.text.secondary }]}>
            {adultFilteringEnabled
              ? 'Adult sites and known bypass domains are blocked during protected sessions.'
              : 'Adult-domain filtering is currently off.'}
          </Text>
        </View>
        <View style={styles.chipRow}>
          <Chip compact>{blockedDomainCount.toLocaleString()} domains blocked</Chip>
          <Chip compact>{formatBlocklistAge(lastBlocklistUpdate)}</Chip>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setTechnicalOpen((value) => !value)} style={styles.technicalToggle}>
          <Text style={[styles.technicalText, { color: colors.text.secondary }]}>Technical info</Text>
          <Feather name={technicalOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text.muted} />
        </Pressable>
        {technicalOpen ? (
          <Text style={[styles.note, { color: colors.text.muted }]}>
            Allowed lookups use family-safe encrypted DNS. Blocked lookups are answered locally.
          </Text>
        ) : null}
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
          label="Block sideloaded APK installs"
          helper="Reduces installs from outside approved app stores."
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
  summaryBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  technicalText: {
    fontSize: 13,
    fontWeight: '600',
  },
  technicalToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
});

function formatBlocklistAge(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Lists updated recently';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days < 1) return 'Lists updated today';
  return `Lists updated ${days} day${days === 1 ? '' : 's'} ago`;
}
