import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { PolicyCard } from '@/components/PolicyCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { AIProtectionCard } from '@/components/behavior/AIProtectionCard';
import { AppFeatureBlockingSettings } from '@/components/behavior/AppFeatureBlockingSettings';
import { CustomKeywordManager } from '@/components/behavior/CustomKeywordManager';
import { useProtectionState } from '@/store/useProtectionState';
import { radius, spacing, typography, useTheme } from '@/theme';

type ControlSection = 'filtering' | 'lists' | 'apps';
type StatusTone = 'success' | 'warning' | 'neutral';

const sections: Array<{ id: ControlSection; label: string }> = [
  { id: 'filtering', label: 'Filtering' },
  { id: 'lists', label: 'Custom Lists' },
  { id: 'apps', label: 'App Rules' },
];

export default function RulesScreen() {
  const { colors } = useTheme();
  const protection = useProtectionState();
  const [activeSection, setActiveSection] = useState<ControlSection>('filtering');
  const statuses = useMemo(() => getSectionStatuses(protection), [protection]);
  const overview = useMemo(() => getOverview(protection), [protection]);

  const isSuccess = overview.tone === 'success';
  // Lock the UI only when no PIN is configured. With a PIN, each card already requires PIN entry,
  // so guardians can adjust rules without needing to stop protection first.
  const isLocked = protection.status === 'active' && !protection.pinConfigured;

  return (
    <ScreenScaffold title="Control" subtitle="Protection details and filtering rules." iconName="control">
      <View style={[s.overviewPanel, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        <View style={s.overviewHeader}>
          <View style={[s.overviewCircle, { backgroundColor: isSuccess ? colors.green[50] : colors.amber[50] }]}>
            <Feather
              name={isSuccess ? 'shield' : 'alert-triangle'}
              size={22}
              color={isSuccess ? colors.green[600] : colors.amber[700]}
            />
          </View>
          <View style={s.overviewCopy}>
            <Text style={[s.overviewTitle, { color: colors.text.primary }]}>{overview.title}</Text>
            <Text style={[s.overviewSubtitle, { color: colors.text.secondary }]}>{overview.subtitle}</Text>
          </View>
        </View>
        <View style={s.metricRow}>
          <Metric label="Domains blocked" value={protection.blockedDomainCount.toLocaleString()} tone="success" />
          <Metric label="App rules on" value={String(Object.values(protection.behaviorPolicy.featureBlocks).filter(Boolean).length)} />
          <Metric label="Custom entries" value={String(
            protection.behaviorPolicy.customKeywords.length +
            protection.blockedDomains.length +
            protection.allowlistedDomains.length
          )} />
        </View>
      </View>

      <View style={[s.segControl, { backgroundColor: colors.bg.tertiary }]}>
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
                s.segButton,
                selected && { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle },
              ]}
            >
              <Text style={[s.segLabel, { color: selected ? colors.text.primary : colors.text.muted }]}>
                {section.label}
              </Text>
              {status.tone !== 'neutral' ? (
                <View style={[s.segDot, { backgroundColor: status.tone === 'success' ? colors.green[500] : colors.amber[500] }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {protection.status === 'active' ? (
        <View style={[s.lockBanner, { backgroundColor: isLocked ? colors.amber[50] : colors.green[50], borderColor: isLocked ? colors.amber[200] : colors.border.green }]}>
          <Feather name={isLocked ? 'lock' : 'shield'} size={13} color={isLocked ? colors.amber[700] : colors.green[600]} />
          <Text style={[s.lockText, { color: isLocked ? colors.amber[700] : colors.green[700] }]}>
            {isLocked
              ? 'Rules are locked while protection is active. Set a PIN to allow changes without stopping protection.'
              : 'Protection is active. PIN required to make changes.'}
          </Text>
        </View>
      ) : null}

      <View pointerEvents={isLocked ? 'none' : 'auto'} style={isLocked ? s.lockedContent : undefined}>
        {activeSection === 'filtering' ? (
          <View style={s.panelStack}>
            <PolicyCard
              adultFilteringEnabled={protection.adultFilteringEnabled}
              riskySettings={protection.riskySettings}
              pinConfigured={protection.pinConfigured}
              onUpdatePolicy={protection.updatePolicy}
            />
            <AIProtectionCard
              anomalyDetection={protection.anomalyDetectionStatus}
              mediaScanning={protection.mediaScanningStatus}
              onRequestGalleryScanPermission={protection.requestGalleryScanPermission}
              onScanGalleryForExplicitContent={protection.scanGalleryForExplicitContent}
              onUpdatePolicy={protection.updatePolicy}
              pinConfigured={protection.pinConfigured}
            />
          </View>
        ) : null}

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
            installedApps={protection.installedApps}
            onChange={protection.updatePolicy}
            pinConfigured={protection.pinConfigured}
            settings={protection.behaviorPolicy.featureBlocks}
          />
        ) : null}
      </View>
    </ScreenScaffold>
  );
}

function getSectionStatuses(protection: ReturnType<typeof useProtectionState>): Record<ControlSection, { label: string; tone: StatusTone }> {
  const filteringActive = protection.adultFilteringEnabled || Object.values(protection.riskySettings).some(Boolean);
  const customEntryCount =
    protection.behaviorPolicy.customKeywords.length +
    protection.blockedDomains.length +
    protection.allowlistedDomains.length;
  const appRuleCount = Object.values(protection.behaviorPolicy.featureBlocks).filter(Boolean).length;

  return {
    filtering: filteringActive
      ? { label: 'Active', tone: 'success' }
      : { label: 'Off', tone: 'warning' },
    lists: { label: `${customEntryCount} entries`, tone: 'neutral' },
    apps: { label: `${appRuleCount} rules`, tone: appRuleCount > 0 ? 'neutral' : 'warning' },
  };
}

function getOverview(protection: ReturnType<typeof useProtectionState>): { title: string; subtitle: string; tone: StatusTone } {
  const statuses = getSectionStatuses(protection);
  const issueCount = Object.values(statuses).filter((s) => s.tone === 'warning').length;
  if (issueCount === 0) {
    return {
      title: 'Fully protected',
      subtitle: 'Filtering, safe search, and app rules are all active.',
      tone: 'success',
    };
  }
  return {
    title: 'Review your settings',
    subtitle: `${issueCount} area${issueCount === 1 ? '' : 's'} may need attention.`,
    tone: 'warning',
  };
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: StatusTone }) {
  const { colors } = useTheme();
  const valueColor = tone === 'success' ? colors.green[600] : colors.text.primary;
  return (
    <View style={[s.metric, { backgroundColor: colors.bg.tertiary }]}>
      <Text style={[s.metricValue, { color: valueColor }]} numberOfLines={1}>{value}</Text>
      <Text style={[s.metricLabel, { color: colors.text.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  lockBanner: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  lockText: {
    ...typography.caption,
    flex: 1,
    lineHeight: 18,
  },
  lockedContent: {
    opacity: 0.45,
  },
  metric: {
    borderRadius: radius.md,
    flex: 1,
    gap: 2,
    minHeight: 60,
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
    fontSize: 18,
    fontWeight: '700',
  },
  overviewCircle: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  panelStack: {
    gap: spacing.lg,
  },
  segControl: {
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 3,
    padding: 3,
  },
  segButton: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  segLabel: {
    ...typography.captionMd,
  },
  segDot: {
    borderRadius: radius.full,
    height: 5,
    width: 5,
  },
});
