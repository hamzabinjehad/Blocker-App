import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { BlockScreenOverlay } from '@/components/behavior/BlockScreenOverlay';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { XpPopup } from '@/components/XpPopup';
import { getStoredMood, saveMood } from '@/services/mood';
import type { MoodCheckIn } from '@/services/mood';
import { useGamification } from '@/store/useGamification';
import { useProtectionState } from '@/store/useProtectionState';
import { radius, shadow, spacing, typography, useTheme } from '@/theme';

const moodOptions: Array<{ value: MoodCheckIn; icon: string }> = [
  { value: 'steady', icon: '\u{1F642}' },
  { value: 'stressed', icon: '\u{1F61F}' },
  { value: 'bored', icon: '\u{1F610}' },
  { value: 'tempted', icon: '\u{1FAE4}' },
  { value: 'tired', icon: '\u{1F634}' },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const protection = useProtectionState();
  const gamification = useGamification();
  const [showXp, setShowXp] = useState(false);
  const [mood, setMood] = useState<MoodCheckIn>('steady');
  const [disableCountdown, setDisableCountdown] = useState(0);
  const [pinNoticeVisible, setPinNoticeVisible] = useState(false);

  const isProtected = protection.status === 'active' || protection.vpnActive;
  const cleanMinutes = gamification.todayCleanHours * 60;

  useEffect(() => {
    void getStoredMood().then(setMood);
  }, []);

  useEffect(() => {
    if (disableCountdown <= 0) return;
    const timer = setTimeout(() => setDisableCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [disableCountdown]);

  const showXpGain = () => {
    setShowXp(true);
    setTimeout(() => setShowXp(false), 1800);
  };

  const handleMoodChange = (nextMood: MoodCheckIn) => {
    setMood(nextMood);
    void saveMood(nextMood);
    void gamification.awardXP(10, 'daily_mood_check_in');
  };

  const handleProtectionToggle = () => {
    setPinNoticeVisible(false);
    if (!isProtected) {
      void protection.startProtection().then(showXpGain);
      return;
    }

    if (disableCountdown === 0) {
      setDisableCountdown(10);
      return;
    }

    if (protection.pinConfigured) {
      setPinNoticeVisible(true);
      return;
    }

    void protection.stopProtection('');
    setDisableCountdown(0);
  };

  return (
    <ScreenScaffold
      title="Control Yourself"
      subtitle="Progress over perfection."
      floatingContent={
        <>
          <XpPopup amount={25} visible={showXp} />
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
      <View style={s.topRow}>
        <View />
        <View style={[s.streakBadge, { backgroundColor: colors.green[50], borderColor: colors.border.green }]}>
          <Text style={[s.streakText, { color: colors.green[600] }]}>
            {'\u{1F525}'} {gamification.currentStreak} days
          </Text>
        </View>
      </View>

      <View style={s.hero}>
        <View
          style={[
            s.shield,
            {
              backgroundColor: isProtected ? colors.green[50] : colors.bg.tertiary,
              borderColor: isProtected ? colors.border.green : colors.border.subtle,
            },
            shadow.sm,
          ]}
        >
          <AppIcon name="shield" size={72} color={isProtected ? colors.green[500] : colors.text.muted} />
        </View>
        <Text style={[s.status, { color: colors.text.primary }]}>
          {isProtected ? 'Protected' : 'Protection is off'}
        </Text>
        <Text style={[s.statusCopy, { color: colors.text.secondary }]}>
          {isProtected ? "You're covered right now." : 'Turn protection on when you are ready.'}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={handleProtectionToggle}
        style={[
          s.primaryAction,
          {
            backgroundColor: isProtected && disableCountdown > 0 ? colors.amber[500] : colors.green[600],
          },
        ]}
      >
        <Text style={[s.primaryActionText, { color: colors.text.inverse }]}>
          {!isProtected
            ? 'Turn on protection'
            : disableCountdown > 0
              ? `Confirm in ${disableCountdown}s`
              : 'Turn protection off'}
        </Text>
      </Pressable>

      {disableCountdown > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => setDisableCountdown(0)} style={s.secondaryAction}>
          <Text style={[s.secondaryActionText, { color: colors.text.secondary }]}>Stay protected</Text>
        </Pressable>
      ) : null}

      {pinNoticeVisible ? (
        <Text style={[s.notice, { color: colors.text.secondary }]}>
          A parent PIN is required before protection can be turned off.
        </Text>
      ) : null}

      {protection.error ? <Text style={[s.notice, { color: colors.red[500] }]}>{protection.error}</Text> : null}

      <View style={s.statsRow}>
        <Stat label="Blocks" value={String(gamification.totalBlocksLifetime)} />
        <Stat label="Level" value={String(gamification.level)} />
        <Stat label="Clean" value={`${Math.floor(cleanMinutes / 60)}h`} />
      </View>

      <View style={[s.moodStrip, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        <Text style={[s.moodTitle, { color: colors.text.primary }]}>How are you?</Text>
        <View style={s.moodOptions}>
          {moodOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => handleMoodChange(option.value)}
              style={[
                s.moodButton,
                {
                  backgroundColor: mood === option.value ? colors.green[50] : colors.bg.primary,
                  borderColor: mood === option.value ? colors.border.green : colors.border.subtle,
                },
              ]}
            >
              <Text style={s.moodIcon}>{option.icon}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenScaffold>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[s.stat, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <Text style={[s.statValue, { color: colors.text.primary }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.text.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  moodButton: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  moodIcon: {
    fontSize: 24,
  },
  moodOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  moodStrip: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg,
  },
  moodTitle: {
    ...typography.bodyMd,
  },
  notice: {
    ...typography.body,
    textAlign: 'center',
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  primaryActionText: {
    ...typography.bodyMd,
  },
  secondaryAction: {
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
  },
  secondaryActionText: {
    ...typography.body,
  },
  shield: {
    alignItems: 'center',
    borderRadius: 80,
    borderWidth: 1,
    height: 148,
    justifyContent: 'center',
    width: 148,
  },
  stat: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 2,
    padding: spacing.md,
  },
  statLabel: {
    ...typography.caption,
  },
  statValue: {
    ...typography.h3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  status: {
    ...typography.display,
    textAlign: 'center',
  },
  statusCopy: {
    ...typography.body,
    textAlign: 'center',
  },
  streakBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  streakText: {
    ...typography.captionMd,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
