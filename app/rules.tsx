import { AnimatedCard } from '@/components/AnimatedCard';
import { DisclosureSection } from '@/components/DisclosureSection';
import { PolicyCard } from '@/components/PolicyCard';
import { SafeSearchCard } from '@/components/SafeSearchCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { AppFeatureBlockingSettings } from '@/components/behavior/AppFeatureBlockingSettings';
import { CustomKeywordManager } from '@/components/behavior/CustomKeywordManager';
import { FocusModeCard } from '@/components/behavior/FocusModeCard';
import { UsageLimitsCard } from '@/components/behavior/UsageLimitsCard';
import { useProtectionState } from '@/store/useProtectionState';

export default function RulesScreen() {
  const protection = useProtectionState();

  return (
    <ScreenScaffold title="Control" subtitle="Blocking, focus schedules, and protection settings." iconName="control">
      <AnimatedCard>
        <DisclosureSection defaultOpen title="Focus and screen time" subtitle="Schedules, bedtime lock, and app limits">
          <FocusModeCard
            installedApps={protection.installedApps}
            onChange={protection.updateFocusPolicy}
            onRefreshApps={protection.refreshInstalledApps}
            pinConfigured={protection.pinConfigured}
            policy={protection.focusPolicy}
            state={protection.focusState}
          />
          <UsageLimitsCard
            installedApps={protection.installedApps}
            onChange={protection.updateUsageLimitPolicy}
            onRefreshApps={protection.refreshInstalledApps}
            pinConfigured={protection.pinConfigured}
            policy={protection.usageLimitPolicy}
            usageAccessGranted={protection.usageAccessStatus.granted}
          />
        </DisclosureSection>
      </AnimatedCard>

      <AnimatedCard delay={40}>
        <DisclosureSection title="Filtering" subtitle="Adult content and bypass protection">
          <PolicyCard
            adultFilteringEnabled={protection.adultFilteringEnabled}
            blockedDomainCount={protection.blockedDomainCount}
            lastBlocklistUpdate={protection.lastBlocklistUpdate}
            riskySettings={protection.riskySettings}
            pinConfigured={protection.pinConfigured}
            onUpdatePolicy={protection.updatePolicy}
          />
        </DisclosureSection>
      </AnimatedCard>

      <AnimatedCard delay={80}>
        <DisclosureSection title="Safe search" subtitle="Search engine safety settings">
          <SafeSearchCard settings={protection.safeSearchSettings} />
        </DisclosureSection>
      </AnimatedCard>

      <AnimatedCard delay={120}>
        <DisclosureSection title="Custom lists" subtitle="Blocked domains, allowed domains, and keywords">
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
        </DisclosureSection>
      </AnimatedCard>

      <AnimatedCard delay={160}>
        <DisclosureSection title="Advanced app rules" subtitle="In-app behavior and feature blocking">
          <AppFeatureBlockingSettings
            blockedDomains={protection.blockedDomains}
            keywords={protection.behaviorPolicy.customKeywords}
            onChange={protection.updatePolicy}
            pinConfigured={protection.pinConfigured}
            settings={protection.behaviorPolicy.featureBlocks}
          />
        </DisclosureSection>
      </AnimatedCard>
    </ScreenScaffold>
  );
}
