import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';

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
      title="Safe Search"
      subtitle="Keeps search and video results in safer modes."
      action={<Chip compact icon="lock-check-outline">Always on</Chip>}
    >
      <View style={styles.summaryBox}>
        <Feather name="lock" size={18} color={colors.green[500]} />
        <Text style={styles.summaryText}>
          These search protections are read-only here, so they stay consistent with DNS filtering.
        </Text>
      </View>
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
      <View style={styles.engineCopy}>
        <Feather name={enabled ? 'check-circle' : 'alert-circle'} size={16} color={enabled ? colors.green[500] : colors.amber[500]} />
        <Text style={styles.label}>{label}</Text>
      </View>
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
  engineCopy: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  note: {
    ...typography.caption,
    color: colors.text.muted,
    lineHeight: 18,
  },
  summaryBox: {
    alignItems: 'center',
    backgroundColor: colors.green[50],
    borderColor: colors.border.green,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  summaryText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  statusChip: {
    backgroundColor: colors.green[50],
  },
});
