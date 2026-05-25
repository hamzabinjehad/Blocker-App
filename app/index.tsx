import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AnimatedCard } from '@/components/AnimatedCard';
import { Card } from '@/components/Card';
import { CoachingCard } from '@/components/CoachingCard';
import { HeroStatusCard } from '@/components/HeroStatusCard';
import { MoodCheckInCard } from '@/components/MoodCheckInCard';
import { PermissionChecklistCard } from '@/components/PermissionChecklistCard';
import { PersonalizedChallengeCard } from '@/components/PersonalizedChallengeCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { StatCard } from '@/components/StatCard';
import { StreakCard } from '@/components/StreakCard';
import { XpBar } from '@/components/XpBar';
import { XpPopup } from '@/components/XpPopup';
import { BlockScreenOverlay } from '@/components/behavior/BlockScreenOverlay';
import { useGamification } from '@/store/useGamification';
import { useProtectionState } from '@/store/useProtectionState';
import { getStoredMood, saveMood } from '@/services/mood';
import type { MoodCheckIn } from '@/services/mood';
import { useTheme } from '@/theme';
import { spacing, typography } from '@/theme';

export default function HomeScreen() {
  const { colors } = useTheme();
  const protection = useProtectionState();
  const gamification = useGamification();
  const { width } = useWindowDimensions();
  const [showXp, setShowXp] = useState(false);
  const [xpAmount, setXpAmount] = useState(25);
  const [mood, setMood] = useState<MoodCheckIn>('steady');
  const [pinNoticeVisible, setPinNoticeVisible] = useState(false);

  const compactLayout = width < 420;
  const isProtected = protection.status === 'active' || protection.vpnActive;
  const cleanMinutes = gamification.todayCleanHours * 60;
  const xpCurrent = gamification.xpProgress.current;
  const xpRequired = gamification.xpProgress.required;
  const setupComplete =
    protection.vpnPermissionGranted &&
    protection.accessibilityServiceEnabled &&
    protection.overlayPermissionGranted &&
    protection.usageAccessStatus.granted &&
    protection.batteryOptimizationStatus.ignored &&
    protection.managedDeviceStatus.deviceAdminActive;

  useEffect(() => {
    void getStoredMood().then(setMood);
  }, []);

  const showXpGain = (amount = 25) => {
    setXpAmount(amount);
    setShowXp(true);
    setTimeout(() => setShowXp(false), 1800);
  };

  const handleMoodChange = (nextMood: MoodCheckIn) => {
    setMood(nextMood);
    void saveMood(nextMood);
  };

  const handleProtectionToggle = () => {
    setPinNoticeVisible(false);
    if (isProtected) {
      if (protection.pinConfigured) {
        setPinNoticeVisible(true);
        return;
      }
      void protection.stopProtection('');
      return;
    }

    void protection.startProtection().then(() => showXpGain(25));
  };

  const weakSpots = [
    protection.activeBlockEvent?.screen,
    ...protection.tamperReport.filter((signal) => signal.detected).map((signal) => signal.subject),
  ].filter((value): value is string => Boolean(value));

  return (
    <ScreenScaffold
      iconName="shield"
      title="Guardian"
      subtitle="Protection and progress at a glance."
      floatingContent={
        <>
          <XpPopup amount={xpAmount} visible={showXp} />
          <BlockScreenOverlay
            durationSeconds={protection.behaviorPolicy.behaviorBlockDurationSeconds}
            event={protection.activeBlockEvent}
            onDismiss={protection.dismissBlockEvent}
            requiresPin={protection.pinConfigured && protection.behaviorPolicy.behaviorBlockRequiresPin}
          />
        </>
      }
      refreshControl={
        <RefreshControl
          refreshing={protection.refreshing}
          tintColor={colors.green[500]}
          onRefresh={protection.refreshStatus}
        />
      }
    >
      <AnimatedCard>
        <HeroStatusCard
          cleanMinutes={cleanMinutes}
          blockedCount={gamification.totalBlocksLifetime}
          isProtected={isProtected}
          level={gamification.level}
          loading={protection.loading}
          onToggle={handleProtectionToggle}
          streak={gamification.currentStreak}
        />
      </AnimatedCard>

      {pinNoticeVisible ? (
        <AnimatedCard>
          <Card accent="amber" style={s.noticeCard}>
            <Text selectable style={[s.noticeText, { color: colors.text.secondary }]}>
              Parent PIN is required before protection can be turned off. Use the existing protection controls or
              admin settings to stop it.
            </Text>
          </Card>
        </AnimatedCard>
      ) : null}

      {protection.error ? (
        <AnimatedCard>
          <Card accent="red" style={s.noticeCard}>
            <Text selectable style={[s.errorText, { color: colors.red[500] }]}>{protection.error}</Text>
          </Card>
        </AnimatedCard>
      ) : null}

      {!setupComplete ? (
        <AnimatedCard delay={40}>
          <PermissionChecklistCard
            accessibilityServiceEnabled={protection.accessibilityServiceEnabled}
            batteryOptimizationIgnored={protection.batteryOptimizationStatus.ignored}
            deviceAdminActive={protection.managedDeviceStatus.deviceAdminActive}
            onGrantVpnPermission={protection.prepareVpn}
            onOpenAccessibilitySettings={protection.openAccessibilitySettings}
            onOpenOverlaySettings={protection.openOverlaySettings}
            onOpenUsageAccessSettings={protection.openUsageAccessSettings}
            onRequestDeviceAdminPermission={protection.requestDeviceAdminPermission}
            onRequestIgnoreBatteryOptimizations={protection.requestIgnoreBatteryOptimizations}
            overlayPermissionGranted={protection.overlayPermissionGranted}
            usageAccessGranted={protection.usageAccessStatus.granted}
            vpnPermissionGranted={protection.vpnPermissionGranted}
          />
        </AnimatedCard>
      ) : null}

      <AnimatedCard delay={60} style={[s.statsRow, compactLayout && s.statsRowCompact]}>
        <StatCard iconName="block" label="Blocks" value={gamification.totalBlocksLifetime} color="red" />
        <StatCard iconName="clean-hours" label="Clean hours" value={`${gamification.todayCleanHours}h`} color="teal" />
        <StatCard iconName="xp" label="Level" value={gamification.level} color="purple" />
      </AnimatedCard>

      <AnimatedCard delay={80} style={[s.row, compactLayout && s.stack]}>
        <XpBar xp={xpCurrent} xpToNext={xpRequired} level={gamification.level} />
        <StreakCard streak={gamification.currentStreak} />
      </AnimatedCard>

      <AnimatedCard delay={100}>
        <MoodCheckInCard onChange={handleMoodChange} value={mood} />
      </AnimatedCard>

      <AnimatedCard delay={120}>
        <CoachingCard
          stats={{
            streak: gamification.currentStreak,
            level: gamification.level,
            blocksYesterday: 0,
            cleanHoursYesterday: gamification.todayCleanHours,
            mood,
          }}
        />
      </AnimatedCard>

      <AnimatedCard delay={140}>
        <PersonalizedChallengeCard
          input={{
            streak: gamification.currentStreak,
            cleanHours: gamification.todayCleanHours,
            totalBlocks: gamification.totalBlocksLifetime,
            mood,
            focusActive: protection.focusState.active,
            anomalyRiskLevel: protection.anomalyDetectionStatus.riskLevel,
            mediaScanningActive: protection.mediaScanningStatus.imageScanningActive,
            weakSpots,
          }}
          onComplete={(amount) => {
            void gamification.awardXP(amount, 'personalized_challenge');
            showXpGain(amount);
          }}
        />
      </AnimatedCard>
    </ScreenScaffold>
  );
}

const s = StyleSheet.create({
  errorText: {
    ...typography.bodyMd,
  },
  noticeCard: {
    marginTop: 0,
  },
  noticeText: {
    ...typography.body,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statsRowCompact: {
    flexDirection: 'column',
  },
  stack: {
    flexDirection: 'column',
  },
});
