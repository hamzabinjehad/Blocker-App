import { useEffect } from 'react';

import { AnimatedCard } from '@/components/AnimatedCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { FocusModeCard } from '@/components/behavior/FocusModeCard';
import { UsageLimitsCard } from '@/components/behavior/UsageLimitsCard';
import { useTranslation } from '@/i18n';
import { useProtection } from '@/store/ProtectionContext';

export default function FocusScreen() {
  const t = useTranslation();
  const protection = useProtection();

  // Installed apps load lazily — only the screens with app pickers pay for the fetch.
  useEffect(() => {
    void protection.refreshInstalledApps();
  }, [protection.refreshInstalledApps]);

  return (
    <ScreenScaffold title={t('focus.title')} subtitle={t('focus.subtitle')} iconName="focus">
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
