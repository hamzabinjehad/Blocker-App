import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { BlockScreenOverlay } from '@/components/behavior/BlockScreenOverlay';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { XpPopup } from '@/components/XpPopup';
import { getTodaysMood, saveMood } from '@/services/mood';
import type { MoodCheckIn } from '@/services/mood';
import { useGamification } from '@/store/useGamification';
import { useProtectionState } from '@/store/useProtectionState';
import { radius, spacing, typography, useTheme } from '@/theme';

const moodOptions: Array<{ value: MoodCheckIn; icon: string }> = [
  { value: 'steady', icon: '\u{1F642}' },
  { value: 'stressed', icon: '\u{1F610}' },
  { value: 'bored', icon: '\u{1F614}' },
  { value: 'tempted', icon: '\u{1F62E}' },
];

const PROTECTION_SESSION_KEY = 'home_protection_session_started_at';

export default function HomeScreen() {
  const { colors } = useTheme();
  const protection = useProtectionState();
  const gamification = useGamification();
  const [showXp, setShowXp] = useState(false);
  const [mood, setMood] = useState<MoodCheckIn | null>(null);
  const [disableSheetVisible, setDisableSheetVisible] = useState(false);
  const [disableCountdown, setDisableCountdown] = useState(30);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [lastRecordedBlockId, setLastRecordedBlockId] = useState<string | null>(null);
  const isProtected = protection.status === 'active' || protection.vpnActive;
  const liveSessionMinutes =
    isProtected && sessionStartedAt ? Math.max(0, Math.floor((now - sessionStartedAt) / 60000)) : 0;
  const cleanMinutes = gamification.todayCleanHours * 60 + liveSessionMinutes;
  const progressRatio = Math.min(1, gamification.xpProgress.current / gamification.xpProgress.required);

  useEffect(() => {
    void getTodaysMood().then((storedMood) => setMood(storedMood));
  }, []);

  useEffect(() => {
    if (!disableSheetVisible) return;
    setDisableCountdown(30);
  }, [disableSheetVisible]);

  useEffect(() => {
    if (!disableSheetVisible || disableCountdown <= 0) return;
    const timer = setTimeout(() => setDisableCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [disableSheetVisible, disableCountdown]);

  useEffect(() => {
    if (!isProtected) {
      setSessionStartedAt(null);
      return;
    }
    let cancelled = false;
    void AsyncStorage.getItem(PROTECTION_SESSION_KEY).then((stored) => {
      const parsed = stored ? Number(stored) : 0;
      const startedAt = parsed > 0 && isSameDay(parsed, Date.now()) ? parsed : Date.now();
      if (!stored || startedAt !== parsed) {
        void AsyncStorage.setItem(PROTECTION_SESSION_KEY, String(startedAt));
      }
      if (!cancelled) setSessionStartedAt((current) => current ?? startedAt);
    });
    return () => {
      cancelled = true;
    };
  }, [isProtected]);

  useEffect(() => {
    if (!isProtected) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isProtected]);

  useEffect(() => {
    const eventId = protection.activeBlockEvent?.id;
    if (!eventId || eventId === lastRecordedBlockId) return;
    gamification.recordBlock();
    setLastRecordedBlockId(eventId);
  }, [gamification, lastRecordedBlockId, protection.activeBlockEvent?.id]);

  const statusLine = useMemo(() => {
    if (!isProtected) return 'Protection is disabled';
    return `VPN on · ${gamification.blocksToday} blocks today`;
  }, [gamification.blocksToday, isProtected]);

  const showXpGain = () => {
    setShowXp(true);
    setTimeout(() => setShowXp(false), 1800);
  };

  const handleProtectionPress = () => {
    if (!isProtected) {
      void protection.startProtection(7).then(showXpGain);
      return;
    }
    setDisableSheetVisible(true);
  };

  const confirmDisable = () => {
    if (disableCountdown > 0 || protection.managedDeviceStatus.uninstallLockActive) return;
    if (!protection.pinConfigured) {
      void protection.stopProtection('');
      void AsyncStorage.removeItem(PROTECTION_SESSION_KEY);
    }
    setDisableSheetVisible(false);
  };

  const handleMoodChange = (nextMood: MoodCheckIn) => {
    setMood(nextMood);
    void saveMood(nextMood);
    gamification.markMoodCheckedIn();
    void gamification.awardXP(10, 'daily_mood_check_in');
  };

  return (
    <ScreenScaffold
      title="Control Yourself"
      floatingContent={
        <>
          <XpPopup amount={25} visible={showXp} />
          <BlockScreenOverlay
            durationSeconds={protection.behaviorPolicy.behaviorBlockDurationSeconds}
            event={protection.activeBlockEvent}
            onDismiss={protection.dismissBlockEvent}
            requiresPin={protection.pinConfigured && protection.behaviorPolicy.behaviorBlockRequiresPin}
          />
          <DisableProtectionSheet
            countdown={disableCountdown}
            locked={protection.managedDeviceStatus.uninstallLockActive}
            pinConfigured={protection.pinConfigured}
            visible={disableSheetVisible}
            onCancel={() => setDisableSheetVisible(false)}
            onConfirm={confirmDisable}
          />
        </>
      }
      headerRight={
        <View style={s.headerPills}>
          <View style={[s.headerPill, { backgroundColor: colors.bg.tertiary }]}>
            <Text style={[s.streakText, { color: gamification.currentStreak > 0 ? colors.green[600] : colors.text.muted }]}>
              Streak {gamification.currentStreak} days
            </Text>
          </View>
          <View style={[s.headerPill, { backgroundColor: colors.bg.tertiary }]}>
            <Text style={[s.freezeText, { color: colors.text.secondary }]}>Freeze {gamification.remainingStreakFreezes}</Text>
          </View>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={protection.refreshing}
          tintColor={colors.green[500]}
          onRefresh={protection.refreshStatus}
        />
      }
      contentContainerStyle={s.screenContent}
    >
      <View style={s.hero}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ checked: isProtected }}
          onPress={handleProtectionPress}
          style={[
            s.shield,
            {
              borderColor: isProtected ? colors.green[500] : colors.border.default,
              height: isProtected ? 160 : 136,
              width: isProtected ? 160 : 136,
            },
          ]}
        >
          <AppIcon name="shield" size={32} color={isProtected ? colors.green[500] : colors.text.muted} />
          <Text style={[s.shieldLabel, { color: isProtected ? colors.green[600] : colors.text.muted }]}>
            {isProtected ? 'PROTECTED' : 'OFF'}
          </Text>
        </Pressable>
        <Text style={[s.statusLine, { color: colors.text.secondary }]}>{statusLine}</Text>
        {!isProtected ? (
          <Text style={[s.startHint, { color: colors.text.muted }]}>Tap the shield to start protection.</Text>
        ) : null}
      </View>

      <View style={s.statsRow}>
        <Stat label="blocks today" value={String(gamification.blocksToday)} />
        <View style={[s.stat, { backgroundColor: colors.bg.tertiary }]}>
          <Text style={[s.statValue, { color: colors.text.primary }]}>Lv {gamification.level}</Text>
          <View style={[s.xpTrack, { backgroundColor: colors.border.subtle }]}>
            <View style={[s.xpFill, { backgroundColor: colors.green[500], width: `${progressRatio * 100}%` }]} />
          </View>
          <Text style={[s.statLabel, { color: colors.text.muted }]}>
            {gamification.xpProgress.current} / {gamification.xpProgress.required} XP
          </Text>
        </View>
        <Stat label="clean time" value={formatCleanTime(cleanMinutes)} />
      </View>

      <View style={[s.moodStrip, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        {mood ? (
          <View style={s.completedMood}>
            <Text style={[s.moodTitle, { color: colors.text.secondary }]}>Today's mood</Text>
            <View style={[s.moodSummary, { backgroundColor: colors.green[50] }]}>
              <Text style={[s.moodSummaryText, { color: colors.green[600] }]}>
                {moodOptions.find((option) => option.value === mood)?.icon ?? '\u{1F642}'}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={[s.moodTitle, { color: colors.text.secondary }]}>How are you?</Text>
            <View style={s.moodOptions}>
              {moodOptions.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => handleMoodChange(option.value)}
                  style={[s.moodButton, { borderColor: colors.border.subtle }]}
                >
                  <Text style={s.moodIcon}>{option.icon}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>

      {protection.error ? <Text style={[s.notice, { color: colors.red[500] }]}>{protection.error}</Text> : null}
    </ScreenScaffold>
  );
}

function DisableProtectionSheet({
  countdown,
  locked,
  pinConfigured,
  visible,
  onCancel,
  onConfirm,
}: {
  countdown: number;
  locked: boolean;
  pinConfigured: boolean;
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onCancel}>
      <Pressable style={s.sheetBackdrop} onPress={onCancel}>
        <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated }]}>
          <View style={[s.sheetHandle, { backgroundColor: colors.border.default }]} />
          <Text style={[s.sheetTitle, { color: colors.text.primary }]}>Turn protection off?</Text>
          <Text style={[s.sheetCopy, { color: colors.text.secondary }]}>
            {locked
              ? 'Protection is time-locked right now.'
              : pinConfigured
                ? 'A parent PIN is required before protection can be turned off.'
                : 'Wait 30 seconds, then confirm only if this is intentional. A guardian alert has been queued.'}
          </Text>
          <Pressable accessibilityRole="button" onPress={onCancel} style={[s.sheetButton, { backgroundColor: colors.green[500] }]}>
            <Text style={[s.sheetButtonText, { color: colors.text.inverse }]}>Stay protected</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={locked || pinConfigured || countdown > 0}
            onPress={onConfirm}
            style={s.sheetTextButton}
          >
            <Text
              style={[
                s.sheetTextButtonLabel,
                { color: locked || pinConfigured || countdown > 0 ? colors.text.muted : colors.red[500] },
              ]}
            >
              {countdown > 0 && !locked && !pinConfigured ? `Confirm in ${countdown}s` : 'Turn off protection'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[s.stat, { backgroundColor: colors.bg.tertiary }]}>
      <Text style={[s.statValue, { color: colors.text.primary }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.text.muted }]}>{label}</Text>
    </View>
  );
}

function formatCleanTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours <= 0) return remainingMinutes === 0 ? '\u2014' : `${remainingMinutes} min`;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

function isSameDay(first: number, second: number) {
  return new Date(first).toDateString() === new Date(second).toDateString();
}

const s = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 260,
    justifyContent: 'center',
  },
  moodButton: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  moodIcon: {
    fontSize: 20,
  },
  moodOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  moodStrip: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  moodSummary: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  moodSummaryText: {
    ...typography.captionMd,
  },
  completedMood: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodTitle: {
    fontSize: 13,
    fontWeight: '400',
  },
  notice: {
    ...typography.body,
    textAlign: 'center',
  },
  screenContent: {
    gap: spacing.lg,
  },
  shield: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 2,
    gap: spacing.sm,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  shieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.xl,
    width: '100%',
  },
  sheetBackdrop: {
    backgroundColor: 'rgba(21,26,23,0.18)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  sheetButtonText: {
    ...typography.bodyMd,
  },
  sheetCopy: {
    ...typography.body,
  },
  sheetHandle: {
    alignSelf: 'center',
    borderRadius: radius.full,
    height: 4,
    width: 32,
  },
  sheetTextButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  sheetTextButtonLabel: {
    ...typography.bodyMd,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  stat: {
    borderRadius: radius.lg,
    flex: 1,
    gap: spacing.xs,
    minHeight: 74,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '400',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statusLine: {
    fontSize: 14,
    fontWeight: '400',
  },
  startHint: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: -spacing.sm,
    textAlign: 'center',
  },
  headerPills: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerPill: {
    alignItems: 'center',
    borderRadius: radius.full,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  streakText: {
    ...typography.captionMd,
  },
  freezeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  xpFill: {
    borderRadius: radius.full,
    height: '100%',
  },
  xpTrack: {
    borderRadius: radius.full,
    height: 3,
    overflow: 'hidden',
    width: '100%',
  },
});


