import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
}> = [
  { id: 'filtering', label: 'Filtering', icon: 'shield', summary: 'Adult content and bypass protection' },
  { id: 'safe-search', label: 'Safe Search', icon: 'search', summary: 'Search engine safety settings' },
  { id: 'lists', label: 'Custom Lists', icon: 'list', summary: 'Domains, allowlist, and keywords' },
  { id: 'apps', label: 'Advanced App Rules', icon: 'apps', summary: 'In-app behavior and feature blocking' },
];

export default function RulesScreen() {
  const { colors } = useTheme();
  const protection = useProtectionState();
  const [activeSection, setActiveSection] = useState<ControlSection>('filtering');
  const statuses = useMemo(() => getSectionStatuses(protection), [protection]);
  const active = sections.find((section) => section.id === activeSection) ?? sections[0]!;

  return (
    <ScreenScaffold title="Control" subtitle="Protection details and filtering rules." iconName="control">
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

      <Card title={active.label} subtitle={active.summary} action={<StatusChip label={statuses[active.id].label} tone={statuses[active.id].tone} />}>
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
  panelStack: {
    gap: spacing.lg,
  },
  sectionButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  sectionGrid: {
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
