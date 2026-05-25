import { AnimatedCard } from '@/components/AnimatedCard';
import { PolicyCard } from '@/components/PolicyCard';
import { SafeSearchCard } from '@/components/SafeSearchCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { AppFeatureBlockingSettings } from '@/components/behavior/AppFeatureBlockingSettings';
import { CustomKeywordManager } from '@/components/behavior/CustomKeywordManager';
import { useProtectionState } from '@/store/useProtectionState';

export default function RulesScreen() {
  const protection = useProtectionState();

  return (
    <ScreenScaffold title="Rules" subtitle="Tune filtering, bypass protection, and safe-search policy." iconName="rules">
      <AnimatedCard>
        <PolicyCard
          adultFilteringEnabled={protection.adultFilteringEnabled}
          blockedDomainCount={protection.blockedDomainCount}
          lastBlocklistUpdate={protection.lastBlocklistUpdate}
          riskySettings={protection.riskySettings}
          pinConfigured={protection.pinConfigured}
          onUpdatePolicy={protection.updatePolicy}
        />
      </AnimatedCard>

      <AnimatedCard delay={70}>
        <SafeSearchCard settings={protection.safeSearchSettings} />
      </AnimatedCard>

      <AnimatedCard delay={110}>
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
      </AnimatedCard>

      <AnimatedCard delay={150}>
        <AppFeatureBlockingSettings
          blockedDomains={protection.blockedDomains}
          keywords={protection.behaviorPolicy.customKeywords}
          onChange={protection.updatePolicy}
          pinConfigured={protection.pinConfigured}
          settings={protection.behaviorPolicy.featureBlocks}
        />
      </AnimatedCard>
    </ScreenScaffold>
  );
}
