import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppIcon } from '@/components/AppIcon';
import { Card } from '@/components/Card';
import { PolicyCard } from '@/components/PolicyCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { AIProtectionCard } from '@/components/behavior/AIProtectionCard';
import { AppFeatureBlockingSettings } from '@/components/behavior/AppFeatureBlockingSettings';
import { CustomKeywordManager } from '@/components/behavior/CustomKeywordManager';
import { useProtectionState } from '@/store/useProtectionState';
import { radius, spacing, typography, useTheme } from '@/theme';

type ControlSection = 'filtering' | 'lists' | 'apps';
type StatusTone = 'success' | 'warning' | 'neutral';

const sections: Array<{
  id: ControlSection;
  label: string;
  icon: 'shield' | 'list' | 'apps';
  summary: string;
  detail: string;
}> = [
  {
    id: 'filtering',
    label: 'Filtering',
    icon: 'shield',
    summary: 'Adult content, bypass, and image scanning',
    detail: 'Blocks unsafe sites, bypass tools, and scans images for explicit content.',
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
          <Metric label="Safe search" value="All on" tone="success" />
          <Metric label="App rules" value={`${statuses.apps.label}`} />
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
            <AIProtectionCard
              anomalyDetection={protection.anomalyDetectionStatus}
              behaviorPolicy={protection.behaviorPolicy}
              mediaScanning={protection.mediaScanningStatus}
              onRequestGalleryScanPermission={protection.requestGalleryScanPermission}
              onScanGalleryForExplicitContent={protection.scanGalleryForExplicitContent}
              onUpdatePolicy={protection.updatePolicy}
              pinConfigured={protection.pinConfigured}
            />
            <ImageScanningCard
              enabled={protection.imageScanningEnabled}
              sensitivity={protection.scanSensitivity}
              active={protection.mediaScanningStatus.imageScanningActive}
              flaggedCount={protection.mediaScanningStatus.galleryScanFlaggedCount}
              onSetSensitivity={protection.setScanSensitivity}
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
            blockedDomains={protection.blockedDomains}
            installedApps={protection.installedApps}
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
  const customEntryCount =
    protection.behaviorPolicy.customKeywords.length +
    protection.blockedDomains.length +
    protection.allowlistedDomains.length;
  const appRuleCount = Object.values(protection.behaviorPolicy.featureBlocks).filter(Boolean).length;

  return {
    filtering: filteringActive
      ? { label: 'Active', tone: 'success' }
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
      title: 'Protection is fully configured',
      subtitle: 'Filtering, safe search, and app safeguards are all active.',
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

function ImageScanningCard({
  enabled,
  sensitivity,
  active,
  flaggedCount,
  onSetSensitivity,
}: {
  enabled: boolean;
  sensitivity: 'conservative' | 'standard' | 'strict';
  active: boolean;
  flaggedCount: number;
  onSetSensitivity: (s: 'conservative' | 'standard' | 'strict') => Promise<void>;
}) {
  const { colors } = useTheme();
  const sensitivities: Array<{ key: 'conservative' | 'standard' | 'strict'; label: string }> = [
    { key: 'conservative', label: 'Conservative' },
    { key: 'standard', label: 'Standard' },
    { key: 'strict', label: 'Strict' },
  ];
  return (
    <Card title="Image Scanning" subtitle="On-device screen and gallery content detection.">
      <View style={[s.scanBanner, { backgroundColor: active ? colors.green[50] : colors.bg.tertiary, borderColor: active ? colors.border.green : colors.border.subtle }]}>
        <Feather name={active ? 'eye' : 'eye-off'} size={16} color={active ? colors.green[600] : colors.text.muted} />
        <Text style={[s.scanBannerText, { color: active ? colors.green[700] : colors.text.secondary }]}>
          {active
            ? 'Scanning screen content on-device in real time'
            : enabled ? 'Requires protection to be active' : 'Image scanning is disabled'}
        </Text>
      </View>
      <View style={s.sensitivitySection}>
        <Text style={[s.sensitivityLabel, { color: colors.text.secondary }]}>Sensitivity</Text>
        <View style={s.sensitivityRow}>
          {sensitivities.map(({ key, label }) => {
            const selected = sensitivity === key;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={key}
                onPress={() => { void onSetSensitivity(key); }}
                style={[
                  s.sensitivityPill,
                  {
                    backgroundColor: selected ? colors.green[50] : colors.bg.elevated,
                    borderColor: selected ? colors.green[500] : colors.border.subtle,
                  },
                ]}
              >
                <Text style={[s.sensitivityPillText, { color: selected ? colors.green[600] : colors.text.secondary }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {flaggedCount > 0 ? (
        <View style={[s.scanAlert, { backgroundColor: colors.amber[50], borderColor: colors.amber[200] }]}>
          <Feather name="alert-triangle" size={14} color={colors.amber[700]} />
          <Text style={[s.scanAlertText, { color: colors.amber[700] }]}>
            {flaggedCount} item{flaggedCount !== 1 ? 's' : ''} flagged in gallery scan
          </Text>
        </View>
      ) : null}
      <Text style={[s.scanNote, { color: colors.text.muted }]}>
        All scanning runs on-device. No screenshots or images are saved or transmitted.
      </Text>
    </Card>
  );
}

const s = StyleSheet.create({
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
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusPillText: {
    ...typography.captionMd,
  },
  scanAlert: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  scanAlertText: {
    ...typography.caption,
    flex: 1,
  },
  scanBanner: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  scanBannerText: {
    ...typography.body,
    flex: 1,
  },
  scanNote: {
    ...typography.caption,
    lineHeight: 18,
  },
  sensitivityLabel: {
    ...typography.caption,
  },
  sensitivityPill: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  sensitivityPillText: {
    ...typography.captionMd,
  },
  sensitivityRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sensitivitySection: {
    gap: spacing.xs,
  },
});
