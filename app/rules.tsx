import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Banner } from '@/components/Banner';
import { PolicyCard } from '@/components/PolicyCard';
import { ScheduleProfilesCard } from '@/components/ScheduleProfilesCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Skeleton } from '@/components/Skeleton';
import { AIProtectionCard } from '@/components/behavior/AIProtectionCard';
import { AppFeatureBlockingSettings } from '@/components/behavior/AppFeatureBlockingSettings';
import { CustomKeywordManager } from '@/components/behavior/CustomKeywordManager';
import { RecentlyBlockedCard } from '@/components/RecentlyBlockedCard';
import { useTranslation } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { useProtection } from '@/store/ProtectionContext';
import { useSchedules } from '@/store/ScheduleProfilesContext';
import { radius, spacing, typography, useTheme } from '@/theme';

type ControlSection = 'filtering' | 'lists' | 'apps';
type StatusTone = 'success' | 'warning' | 'neutral';

const sections: Array<{ id: ControlSection; labelKey: TranslationKey }> = [
  { id: 'filtering', labelKey: 'rules.sectionFiltering' },
  { id: 'lists', labelKey: 'rules.sectionLists' },
  { id: 'apps', labelKey: 'rules.sectionApps' },
];

export default function RulesScreen() {
  const t = useTranslation();
  const { colors } = useTheme();
  const protection = useProtection();
  const schedules = useSchedules();
  const [activeSection, setActiveSection] = useState<ControlSection>('filtering');

  // Installed apps load lazily, first time the Apps section is opened.
  useEffect(() => {
    if (activeSection === 'apps' && protection.installedApps.length === 0) {
      void protection.refreshInstalledApps();
    }
  }, [activeSection, protection.installedApps.length, protection.refreshInstalledApps]);
  const statuses = useMemo(() => getSectionStatuses(protection), [protection]);
  const overview = useMemo(() => getOverview(protection), [protection]);

  const isSuccess = overview.tone === 'success';
  const protectionActive =
    protection.statusVerified && protection.status === 'active' && protection.vpnActive;
  // Lock the UI only when no PIN is configured. With a PIN, each card already requires PIN entry,
  // so guardians can adjust rules without needing to stop protection first.
  const isLocked = protectionActive && !protection.pinConfigured;

  return (
    <ScreenScaffold title={t('rules.title')} subtitle={t('rules.subtitle')} iconName="control">
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
            <Text style={[s.overviewTitle, { color: colors.text.primary }]}>{t(overview.titleKey)}</Text>
            <Text style={[s.overviewSubtitle, { color: colors.text.secondary }]}>{t(overview.subtitleKey)}</Text>
          </View>
        </View>
        <View style={s.metricRow}>
          {protection.hydrated ? (
            <>
              <Metric label={t('rules.metricDomainsBlocked')} value={protection.blockedDomainCount.toLocaleString()} tone="success" />
              <Metric label={t('rules.metricAppRules')} value={String(Object.values(protection.behaviorPolicy.featureBlocks).filter(Boolean).length)} />
              <Metric label={t('rules.metricCustomEntries')} value={String(
                protection.behaviorPolicy.customKeywords.length +
                protection.blockedDomains.length +
                protection.allowlistedDomains.length
              )} />
            </>
          ) : (
            <>
              <Skeleton height={62} radius={radius.md} style={s.metricSkeleton} />
              <Skeleton height={62} radius={radius.md} style={s.metricSkeleton} />
              <Skeleton height={62} radius={radius.md} style={s.metricSkeleton} />
            </>
          )}
        </View>
        <View style={[s.scopeNote, { backgroundColor: colors.bg.tertiary }]}>
          <Feather name="crosshair" size={13} color={colors.text.muted} style={s.scopeIcon} />
          <Text style={[s.scopeText, { color: colors.text.secondary }]}>{t('rules.scopeNote')}</Text>
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
                {t(section.labelKey)}
              </Text>
              {status.tone !== 'neutral' ? (
                <View style={[s.segDot, { backgroundColor: status.tone === 'success' ? colors.green[500] : colors.amber[500] }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {protectionActive ? (
        <Banner
          tone={isLocked ? 'warning' : 'success'}
          icon={isLocked ? 'lock' : 'shield'}
          iconSize={13}
          subtitle={isLocked ? t('rules.lockedNoPin') : t('rules.lockedWithPin')}
        />
      ) : null}

      <View pointerEvents={isLocked ? 'none' : 'auto'} style={isLocked ? s.lockedContent : undefined}>
        {activeSection === 'filtering' ? (
          <View style={s.panelStack}>
            <PolicyCard
              adultFilteringEnabled={protection.adultFilteringEnabled}
              blockUnknownSearchEngines={protection.safeSearchSettings.blockUnknownSearchEngines}
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
            <ScheduleProfilesCard
              profiles={schedules.profiles}
              activeState={schedules.activeState}
              onToggleProfile={schedules.toggleProfile}
              onUpdateProfile={schedules.updateProfile}
              onAddProfile={schedules.addProfile}
              onRemoveProfile={schedules.removeProfile}
            />
          </View>
        ) : null}

        {activeSection === 'lists' ? (
          <View style={s.panelStack}>
            <RecentlyBlockedCard
              pinConfigured={protection.pinConfigured}
              getRecentBlockedDomains={protection.getRecentBlockedDomains}
              onAllowDomain={protection.addAllowlistedDomain}
            />
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
          </View>
        ) : null}

        {activeSection === 'apps' ? (
          <>
            {/* Overlay permission is asked for here — the block screen App Rules
                rely on cannot draw without it. */}
            {protection.hydrated &&
            !protection.overlayPermissionGranted &&
            Object.values(protection.behaviorPolicy.featureBlocks).some(Boolean) ? (
              <Banner
                icon="layers"
                title={t('ctx.overlayTitle')}
                subtitle={t('ctx.overlaySubtitle')}
                trailing="chevron"
                onPress={() => void protection.openOverlaySettings()}
              />
            ) : null}
            <AppFeatureBlockingSettings
              installedApps={protection.installedApps}
              onChange={protection.updatePolicy}
              pinConfigured={protection.pinConfigured}
              settings={protection.behaviorPolicy.featureBlocks}
            />
          </>
        ) : null}
      </View>
    </ScreenScaffold>
  );
}

function getSectionStatuses(protection: ReturnType<typeof useProtection>): Record<ControlSection, { label: string; tone: StatusTone }> {
  const filteringConfigured = protection.adultFilteringEnabled || Object.values(protection.riskySettings).some(Boolean);
  const filteringActive = protection.statusVerified && protection.vpnActive && filteringConfigured;
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

function getOverview(protection: ReturnType<typeof useProtection>): {
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  tone: StatusTone;
} {
  const statuses = getSectionStatuses(protection);
  const issueCount = Object.values(statuses).filter((s) => s.tone === 'warning').length;
  if (
    protection.statusVerified &&
    protection.status === 'active' &&
    protection.vpnActive &&
    issueCount === 0
  ) {
    return {
      titleKey: 'rules.fullyProtected',
      subtitleKey: 'rules.fullyProtectedSubtitle',
      tone: 'success',
    };
  }
  return {
    titleKey: 'rules.reviewSettings',
    subtitleKey: 'rules.reviewSettingsSubtitle',
    tone: 'warning',
  };
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: StatusTone }) {
  const { colors } = useTheme();
  const valueColor = tone === 'success' ? colors.green[600] : colors.text.primary;
  return (
    <View style={[s.metric, { backgroundColor: colors.bg.tertiary }]}>
      <Text maxFontSizeMultiplier={1.4} style={[s.metricValue, { color: valueColor }]} numberOfLines={1}>{value}</Text>
      <Text maxFontSizeMultiplier={1.4} style={[s.metricLabel, { color: colors.text.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
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
  metricSkeleton: {
    flex: 1,
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
  scopeNote: {
    alignItems: 'flex-start',
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  scopeIcon: {
    marginTop: 2,
  },
  scopeText: {
    ...typography.caption,
    flex: 1,
    lineHeight: 17,
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
    minHeight: 44,
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
