import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppIcon } from '@/components/AppIcon';
import { Card } from '@/components/Card';
import { PolicyCard } from '@/components/PolicyCard';
import { SafeSearchCard } from '@/components/SafeSearchCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { AppFeatureBlockingSettings } from '@/components/behavior/AppFeatureBlockingSettings';
import { CustomKeywordManager } from '@/components/behavior/CustomKeywordManager';
import { useProtectionState } from '@/store/useProtectionState';
import { radius, spacing, typography, useTheme } from '@/theme';

type ControlSection = 'filtering' | 'safe-search' | 'lists' | 'apps';
type StatusTone = 'success' | 'warning' | 'neutral';

const sections: Array<{
  id: ControlSection;
  label: string;
  icon: 'shield' | 'search' | 'list' | 'apps';
  summary: string;
  detail: string;
}> = [
  {
    id: 'filtering',
    label: 'Filtering',
    icon: 'shield',
    summary: 'Adult content and bypass protection',
    detail: 'Blocks unsafe sites and common bypass tools.',
  },
  {
    id: 'safe-search',
    label: 'Safe Search',
    icon: 'search',
    summary: 'Search and video safety',
    detail: 'Keeps supported search engines in family-safe mode.',
  },
  {
    id: 'lists',
    label: 'Custom Lists',
    icon: 'list',
    summary: 'Websites and keywords',
    detail: 'Add sites or words that should always be blocked or allowed.',
  },
  {
    id: 'apps',
    label: 'App Rules',
    icon: 'apps',
    summary: 'Risky app surfaces',
    detail: 'Limit high-risk features inside social, video, and browser apps.',
  },
];

export default function RulesScreen() {
  const { colors } = useTheme();
  const protection = useProtectionState();
  const [activeSection, setActiveSection] = useState<ControlSection>('filtering');
  const statuses = useMemo(() => getSectionStatuses(protection), [protection]);
  const active = sections.find((section) => section.id === activeSection) ?? sections[0]!;

  const overview = useMemo(() => getOverview(protection), [protection]);

  return (
    <ScreenScaffold title="Control" subtitle="Protection details and filtering rules." iconName="control">
      <View style={[s.overviewPanel, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        <View style={s.overviewHeader}>
          <View style={[s.overviewIcon, { backgroundColor: overview.tone === 'success' ? colors.green[50] : colors.amber[50] }]}>
            <Feather
              name={overview.tone === 'success' ? 'shield' : 'alert-triangle'}
              size={20}
              color={overview.tone === 'success' ? colors.green[600] : colors.amber[700]}
            />
          </View>
          <View style={s.overviewCopy}>
            <Text style={[s.overviewTitle, { color: colors.text.primary }]}>{overview.title}</Text>
            <Text style={[s.overviewSubtitle, { color: colors.text.secondary }]}>{overview.subtitle}</Text>
          </View>
          <StatusChip label={overview.label} tone={overview.tone} />
        </View>
        <View style={s.metricRow}>
          <Metric label="Domains" value={protection.blockedDomainCount.toLocaleString()} />
          <Metric label="Safe search" value={statuses['safe-search'].label} />
          <Metric label="App rules" value={statuses.apps.label} />
        </View>
      </View>

      <View style={s.sectionGrid}>
        {sections.map((section) => {
          const selected = section.id === activeSection;
          const status = statuses[section.id];
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={section.id}
              onPress={() => setActiveSection(section.id)}
              style={[
                s.sectionButton,
                {
                  backgroundColor: selected ? colors.green[50] : colors.bg.elevated,
                  borderColor: selected ? colors.green[500] : colors.border.subtle,
                },
              ]}
            >
              <AppIcon name={section.icon} size={18} color={selected ? colors.green[600] : colors.text.secondary} />
              <View style={s.sectionText}>
                <Text style={[s.sectionLabel, { color: selected ? colors.green[600] : colors.text.primary }]}>
                  {section.label}
                </Text>
                <Text style={[s.sectionSummary, { color: colors.text.muted }]} numberOfLines={1}>
                  {section.summary}
                </Text>
              </View>
              <StatusChip label={status.label} tone={status.tone} />
            </Pressable>
          );
        })}
      </View>

      <View style={[s.detailHeader, { borderColor: colors.border.subtle }]}>
        <View style={s.detailCopy}>
          <Text style={[s.detailTitle, { color: colors.text.primary }]}>{active.label}</Text>
          <Text style={[s.detailSubtitle, { color: colors.text.secondary }]}>{active.detail}</Text>
        </View>
        <StatusChip label={statuses[active.id].label} tone={statuses[active.id].tone} />
      </View>

      <Card padding={spacing.md}>
        {activeSection === 'filtering' ? (
          <View style={s.panelStack}>
            <PolicyCard
              adultFilteringEnabled={protection.adultFilteringEnabled}
              blockedDomainCount={protection.blockedDomainCount}
              lastBlocklistUpdate={protection.lastBlocklistUpdate}
              riskySettings={protection.riskySettings}
              pinConfigured={protection.pinConfigured}
              onUpdatePolicy={protection.updatePolicy}
            />
          </View>
        ) : null}

        {activeSection === 'safe-search' ? <SafeSearchCard settings={protection.safeSearchSettings} /> : null}

        {activeSection === 'lists' ? (
          <CustomKeywordManager
            allowlistedDomains={protection.allowlistedDomains}
            blockedDomains={protection.blockedDomains}
            blockedDomainCount={protection.blockedDomainCount}
            keywords={protection.behaviorPolicy.customKeywords}
            lastBlocklistUpdate={protection.lastBlocklistUpdate}
            onAddBlockedDomain={protection.addBlockedDomain}
            onAddAllowlistedDomain={protection.addAllowlistedDomain}
            onImportBlockedDomains={protection.importBlockedDomains}
            onRemoveAllowlistedDomain={protection.removeAllowlistedDomain}
            onRemoveBlockedDomain={protection.removeBlockedDomain}
            onUpdateKeywordList={protection.updateKeywordList}
            pinConfigured={protection.pinConfigured}
          />
        ) : null}

        {activeSection === 'apps' ? (
          <AppFeatureBlockingSettings
            blockedDomains={protection.blockedDomains}
            keywords={protection.behaviorPolicy.customKeywords}
            onChange={protection.updatePolicy}
            pinConfigured={protection.pinConfigured}
            settings={protection.behaviorPolicy.featureBlocks}
          />
        ) : null}
      </Card>
    </ScreenScaffold>
  );
}

function getSectionStatuses(protection: ReturnType<typeof useProtectionState>): Record<ControlSection, { label: string; tone: StatusTone }> {
  const filteringActive = protection.adultFilteringEnabled || Object.values(protection.riskySettings).some(Boolean);
  const safeSearchCount = Object.values(protection.safeSearchSettings).filter(Boolean).length;
  const safeSearchTotal = Object.keys(protection.safeSearchSettings).length;
  const customEntryCount =
    protection.behaviorPolicy.customKeywords.length +
    protection.blockedDomains.length +
    protection.allowlistedDomains.length;
  const appRuleCount = Object.values(protection.behaviorPolicy.featureBlocks).filter(Boolean).length;

  return {
    filtering: filteringActive
      ? { label: 'Active', tone: 'success' }
      : { label: 'Off', tone: 'warning' },
    'safe-search': safeSearchCount === safeSearchTotal
      ? { label: 'All on', tone: 'success' }
      : safeSearchCount > 0
        ? { label: `${safeSearchCount}/${safeSearchTotal}`, tone: 'warning' }
        : { label: 'Off', tone: 'warning' },
    lists: {
      label: `${customEntryCount} entries`,
      tone: 'neutral',
    },
    apps: {
      label: `${appRuleCount} rules`,
      tone: appRuleCount > 0 ? 'neutral' : 'warning',
    },
  };
}

function getOverview(protection: ReturnType<typeof useProtectionState>): { title: string; subtitle: string; label: string; tone: StatusTone } {
  const statuses = getSectionStatuses(protection);
  const issueCount = Object.values(statuses).filter((status) => status.tone === 'warning').length;
  if (issueCount === 0) {
    return {
      title: 'Core protection is configured',
      subtitle: 'Filtering, safe search, custom rules, and app safeguards are ready to review.',
      label: 'Healthy',
      tone: 'success',
    };
  }
  return {
    title: 'Review protection settings',
    subtitle: `${issueCount} area${issueCount === 1 ? '' : 's'} may need attention before protection feels complete.`,
    label: `${issueCount} issue${issueCount === 1 ? '' : 's'}`,
    tone: 'warning',
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[s.metric, { backgroundColor: colors.bg.tertiary }]}>
      <Text style={[s.metricValue, { color: colors.text.primary }]} numberOfLines={1}>{value}</Text>
      <Text style={[s.metricLabel, { color: colors.text.muted }]}>{label}</Text>
    </View>
  );
}

function StatusChip({ label, tone }: { label: string; tone: StatusTone }) {
  const { colors } = useTheme();
  const backgroundColor =
    tone === 'success' ? colors.green[50] : tone === 'warning' ? colors.amber[50] : colors.bg.tertiary;
  const color =
    tone === 'success' ? colors.green[600] : tone === 'warning' ? colors.amber[700] : colors.text.secondary;

  return (
    <View style={[s.statusPill, { backgroundColor }]}>
      <Text style={[s.statusPillText, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  detailCopy: {
    flex: 1,
    gap: 2,
  },
  detailHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  detailSubtitle: {
    ...typography.body,
  },
  detailTitle: {
    ...typography.h3,
  },
  metric: {
    borderRadius: radius.md,
    flex: 1,
    gap: 2,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metricLabel: {
    ...typography.caption,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricValue: {
    ...typography.bodyMd,
  },
  overviewCopy: {
    flex: 1,
    gap: 2,
  },
  overviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  overviewIcon: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  overviewPanel: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.md,
  },
  overviewSubtitle: {
    ...typography.body,
  },
  overviewTitle: {
    ...typography.h3,
  },
  panelStack: {
    gap: spacing.lg,
  },
  sectionButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: '48%',
  },
  sectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.bodyMd,
  },
  sectionSummary: {
    ...typography.caption,
  },
  sectionText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusPillText: {
    ...typography.captionMd,
  },
});
