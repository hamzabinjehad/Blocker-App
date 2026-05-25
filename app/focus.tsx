import { AnimatedCard } from '@/components/AnimatedCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { FocusModeCard } from '@/components/behavior/FocusModeCard';
import { UsageLimitsCard } from '@/components/behavior/UsageLimitsCard';
import { useProtectionState } from '@/store/useProtectionState';

export default function FocusScreen() {
  const protection = useProtectionState();

  return (
    <ScreenScaffold title="Focus Mode" subtitle="Time limits and app controls for protected hours." iconName="focus">
      <AnimatedCard>
        <FocusModeCard
          installedApps={protection.installedApps}
          onChange={protection.updateFocusPolicy}
          onRefreshApps={protection.refreshInstalledApps}
          pinConfigured={protection.pinConfigured}
          policy={protection.focusPolicy}
          state={protection.focusState}
        />
      </AnimatedCard>

      <AnimatedCard delay={80}>
        <UsageLimitsCard
          installedApps={protection.installedApps}
          onChange={protection.updateUsageLimitPolicy}
          onRefreshApps={protection.refreshInstalledApps}
          pinConfigured={protection.pinConfigured}
          policy={protection.usageLimitPolicy}
          usageAccessGranted={protection.usageAccessStatus.granted}
        />
      </AnimatedCard>
    </ScreenScaffold>
  );
}
