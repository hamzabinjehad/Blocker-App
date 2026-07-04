import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { Card } from './Card';
import { Field } from './controls';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { PolicyUpdate, RiskySettings } from '@/types/blocker';

type PolicyCardProps = {
  adultFilteringEnabled: boolean;
  blockUnknownSearchEngines: boolean;
  riskySettings: RiskySettings;
  pinConfigured: boolean;
  onUpdatePolicy: (policy: PolicyUpdate) => Promise<void>;
};

export function PolicyCard({
  adultFilteringEnabled,
  blockUnknownSearchEngines,
  riskySettings,
  pinConfigured,
  onUpdatePolicy,
}: PolicyCardProps) {
  const t = useTranslation();
  const { colors } = useTheme();
  const [pin, setPin] = useState('');

  const update = (policy: PolicyUpdate) => {
    void onUpdatePolicy(pinConfigured ? { ...policy, adminPin: pin } : policy);
  };

  return (
    <Card title={t('policy.title')} subtitle={t('policy.subtitle')}>
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label={t('policy.pinLabel')}
          onChangeText={setPin}
          placeholder={t('policy.pinPlaceholder')}
          secureTextEntry
          value={pin}
        />
      ) : null}
      <PolicyRow
        label={t('policy.adultFiltering')}
        helper={t('policy.adultFilteringHelper')}
        value={adultFilteringEnabled}
        onValueChange={(v) => update({ adultFilteringEnabled: v })}
      />
      <PolicyRow
        label={t('policy.blockUnmanagedSearch')}
        helper={t('policy.blockUnmanagedSearchHelper')}
        value={blockUnknownSearchEngines}
        onValueChange={(v) => update({ blockUnknownSearchEngines: v })}
      />
      <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />
      <PolicyRow
        label={t('policy.blockVpnApps')}
        helper={t('policy.blockVpnAppsHelper')}
        value={riskySettings.blockVpnApps}
        onValueChange={(blockVpnApps) => update({ blockVpnApps })}
      />
      <PolicyRow
        label={t('policy.blockPrivateBrowsers')}
        helper={t('policy.blockPrivateBrowsersHelper')}
        value={riskySettings.blockPrivateBrowsers}
        onValueChange={(blockPrivateBrowsers) => update({ blockPrivateBrowsers })}
      />
      <PolicyRow
        label={t('policy.blockBypassTools')}
        helper={t('policy.blockBypassToolsHelper')}
        value={riskySettings.blockBypassTools}
        onValueChange={(blockBypassTools) => update({ blockBypassTools })}
      />
      <PolicyRow
        label={t('policy.blockSideloaded')}
        helper={t('policy.blockSideloadedHelper')}
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
