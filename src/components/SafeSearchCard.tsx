import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { colors, radius, spacing, typography } from '@/theme';
import type { SafeSearchSettings } from '@/types/blocker';

type SafeSearchCardProps = {
  settings: SafeSearchSettings;
};

const enforcedSettings: SafeSearchSettings = {
  googleSafeSearch: true,
  bingSafeSearch: true,
  duckDuckGoSafeSearch: true,
  youtubeRestrictedMode: true,
  blockUnknownSearchEngines: true,
};

export function SafeSearchCard({ settings }: SafeSearchCardProps) {
  const enforced = {
    ...settings,
    ...enforcedSettings,
  };

  return (
    <Card
      title="Search Enforcement"
      subtitle="SafeSearch, restricted video search, and unknown search engine blocking are locked on."
      action={<Chip compact icon="lock-check-outline">Always on</Chip>}
    >
      <View style={styles.grid}>
        <LockedSearchRow label="Google Search" enabled={enforced.googleSafeSearch} />
        <LockedSearchRow label="Bing Search" enabled={enforced.bingSafeSearch} />
        <LockedSearchRow label="DuckDuckGo Search" enabled={enforced.duckDuckGoSafeSearch} />
        <LockedSearchRow label="YouTube Restricted Mode" enabled={enforced.youtubeRestrictedMode} />
        <LockedSearchRow label="Unknown Search Engines" enabled={enforced.blockUnknownSearchEngines} />
      </View>
      <Text style={styles.note}>
        These cannot be turned off individually. Disable DNS filtering to remove them.
      </Text>
    </Card>
  );
}

function LockedSearchRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Chip compact icon={enabled ? 'lock-check-outline' : 'lock-alert-outline'} style={styles.statusChip}>
        {enabled ? 'Enforced' : 'Locked'}
      </Chip>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  label: {
    ...typography.bodyMd,
    color: colors.text.primary,
    flex: 1,
  },
  note: {
    ...typography.caption,
    color: colors.text.muted,
    lineHeight: 18,
  },
  statusChip: {
    backgroundColor: colors.green[50],
  },
});
