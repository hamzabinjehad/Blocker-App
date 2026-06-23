import { type ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Feather } from '@expo/vector-icons';
import { AppIcon } from '@/components/AppIcon';
import { BlockScreenOverlay } from '@/components/behavior/BlockScreenOverlay';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { StreakPopup } from '@/components/streak/StreakPopup';
import { useDailyStreakPopup } from '@/components/streak/useDailyStreakPopup';
import { usePressScale } from '@/components/usePressScale';
import { XpPopup } from '@/components/XpPopup';
import { MoodDetailView } from '@/components/MoodDetailView';
import { MoodFace } from '@/components/MoodFace';
import { MoodPickerView } from '@/components/MoodPickerView';
import { getTodaysMood, moodOptions, saveMood } from '@/services/mood';
import type { MoodCheckIn } from '@/services/mood';
import { useAlertCenter } from '@/store/useAlertCenter';
import { useGamification } from '@/store/useGamification';
import { useProtectionState } from '@/store/useProtectionState';
import { radius, spacing, typography, useTheme } from '@/theme';

const PROTECTION_SESSION_KEY = 'home_protection_session_started_at';
const DISABLE_PROTECTION_COUNTDOWN_SECONDS = 5;

function mapGuardianEventType(eventType: string): 'tamper_attempt' | 'bypass_attempt' | 'vpn_disconnected' | 'keyword_detected' | 'app_blocked' | 'domain_blocked' | 'unlock_request' {
  const t = eventType.toLowerCase();
  if (t.includes('tamper')) return 'tamper_attempt';
  if (t.includes('bypass')) return 'bypass_attempt';
  if (t.includes('vpn') || t.includes('disconnect')) return 'vpn_disconnected';
  if (t.includes('unlock')) return 'unlock_request';
  if (t.includes('keyword')) return 'keyword_detected';
  return 'tamper_attempt';
}

function mapGuardianSeverity(severity: string): 'info' | 'warning' | 'critical' {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high') return 'critical';
  if (s === 'low') return 'info';
  return 'warning';
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDateLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function levelNameShort(level: number): string {
  const names = ['Starting', 'Aware', 'Steady', 'Resilient', 'Grounded', 'Strong'];
  return names[Math.min(level, names.length - 1)] ?? 'Resilient';
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const protection = useProtectionState();
  const gamification = useGamification();
  const alertCenter = useAlertCenter();
  const appStartedAtRef = useRef(Date.now());
  const syncedGuardianAlertIdsRef = useRef<Set<string>>(new Set());
  const streakPopup = useDailyStreakPopup({
    currentStreak: gamification.currentStreak,
    dayHistory: gamification.dayHistory,
    hydrated: gamification.hydrated,
  });
  const [showXp, setShowXp] = useState(false);
  const [mood, setMood] = useState<MoodCheckIn | null>(null);
  const [disableSheetVisible, setDisableSheetVisible] = useState(false);
  const [disableCountdown, setDisableCountdown] = useState(DISABLE_PROTECTION_COUNTDOWN_SECONDS);
  const [disablePin, setDisablePin] = useState('');
  const [disablePinError, setDisablePinError] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [lastRecordedBlockId, setLastRecordedBlockId] = useState<string | null>(null);
  const [moodModalStep, setMoodModalStep] = useState<'picker' | 'detail' | null>(null);
  const [pendingMood, setPendingMood] = useState<MoodCheckIn | null>(null);
  const [moodNote, setMoodNote] = useState('');
  const isProtected = protection.status === 'active' || protection.vpnActive;
  const liveSessionMinutes =
    isProtected && sessionStartedAt ? Math.max(0, Math.floor((now - sessionStartedAt) / 60000)) : 0;
  const cleanMinutes = gamification.todayCleanHours * 60 + liveSessionMinutes;
  const { animatedStyle: heroAnimStyle, onPressIn: heroPressIn, onPressOut: heroPressOut } = usePressScale(0.98);

  useEffect(() => {
    void getTodaysMood().then((storedMood) => setMood(storedMood));
  }, []);

  useEffect(() => {
    if (!disableSheetVisible) return;
    setDisableCountdown(DISABLE_PROTECTION_COUNTDOWN_SECONDS);
    setDisablePin('');
    setDisablePinError(false);
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
    const event = protection.activeBlockEvent;
    if (!event || event.id === lastRecordedBlockId) return;
    gamification.recordBlock();
    setLastRecordedBlockId(event.id);
    void alertCenter.addAlert({
      type: event.keyword ? 'keyword_detected' : event.appName ? 'app_blocked' : 'domain_blocked',
      severity: event.keyword ? 'warning' : 'info',
      title: event.keyword ? 'Keyword detected' : event.appName ? `${event.appName} blocked` : 'Site blocked',
      description: event.reason ?? (event.keyword ? 'A keyword filter triggered' : event.appName ? `Feature blocked in ${event.appName}` : 'DNS filter blocked a request'),
    });
  }, [alertCenter, gamification, lastRecordedBlockId, protection.activeBlockEvent]);

  useEffect(() => {
    const newAlerts = protection.guardianAlerts.filter(
      (a) => !a.cleared && !syncedGuardianAlertIdsRef.current.has(a.id) && a.timestamp >= appStartedAtRef.current,
    );
    for (const alert of newAlerts) {
      syncedGuardianAlertIdsRef.current.add(alert.id);
      void alertCenter.addAlert({
        type: mapGuardianEventType(alert.eventType),
        severity: mapGuardianSeverity(alert.severity),
        title: alert.subject,
        description: alert.action || alert.subject,
      });
    }
  }, [alertCenter, protection.guardianAlerts]);

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
    setDisablePinError(false);
    void protection.stopProtection(disablePin).then((status) => {
      if (status === 'pin_locked_out' || status === 'pin_required') {
        setDisablePinError(true);
        if (status === 'pin_locked_out') setDisableSheetVisible(false);
        return;
      }
      if (status === 'inactive') {
        void AsyncStorage.removeItem(PROTECTION_SESSION_KEY);
        setDisableSheetVisible(false);
      }
    });
  };

  const openMoodModal = () => {
    setMoodNote('');
    setMoodModalStep('picker');
  };

  const handleMoodSelect = (selected: MoodCheckIn) => {
    setPendingMood(selected);
    setMoodModalStep('detail');
  };

  const handleMoodSave = () => {
    if (!pendingMood) return;
    setMood(pendingMood);
    void saveMood(pendingMood, moodNote || undefined);
    gamification.markMoodCheckedIn();
    void gamification.awardXP(10, 'daily_mood_check_in');
    setMoodModalStep(null);
  };

  const closeMoodModal = () => {
    setMoodModalStep(null);
  };

  return (
    <ScreenScaffold
      title={getGreeting()}
      subtitle={getDateLabel()}
      floatingContent={
        <>
          <XpPopup amount={10} visible={showXp} />
          <StreakPopup
            currentStreak={gamification.currentStreak}
            dayHistory={gamification.dayHistory}
            longestStreak={gamification.longestStreak}
            previousStreak={streakPopup.previousStreak}
            state={streakPopup.state}
            visible={streakPopup.visible}
            onContinue={streakPopup.dismiss}
          />
          <BlockScreenOverlay
            durationSeconds={protection.behaviorPolicy.behaviorBlockDurationSeconds}
            event={protection.activeBlockEvent}
            onDismiss={protection.dismissBlockEvent}
            requiresPin={protection.pinConfigured && protection.behaviorPolicy.behaviorBlockRequiresPin}
          />
          <DisableProtectionSheet
            countdown={disableCountdown}
            locked={protection.managedDeviceStatus.uninstallLockActive}
            lockExpiresAt={protection.managedDeviceStatus.uninstallLockExpiresAt}
            pin={disablePin}
            pinConfigured={protection.pinConfigured}
            pinError={disablePinError}
            visible={disableSheetVisible}
            onCancel={() => setDisableSheetVisible(false)}
            onConfirm={confirmDisable}
            onPinChange={setDisablePin}
          />
          <Modal
            animationType="slide"
            visible={moodModalStep !== null}
            onRequestClose={closeMoodModal}
          >
            {moodModalStep === 'picker' ? (
              <MoodPickerView onSelect={handleMoodSelect} onClose={closeMoodModal} />
            ) : moodModalStep === 'detail' && pendingMood ? (
              <MoodDetailView
                mood={pendingMood}
                note={moodNote}
                onNoteChange={setMoodNote}
                onSave={handleMoodSave}
                onClose={closeMoodModal}
              />
            ) : null}
          </Modal>
        </>
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
      {/* Hero card */}
      <Animated.View style={heroAnimStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ checked: isProtected }}
          onPress={handleProtectionPress}
          onPressIn={heroPressIn}
          onPressOut={heroPressOut}
          style={[
            s.heroCard,
            isProtected
              ? { backgroundColor: colors.bg.green, borderColor: colors.green[700] }
              : { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle },
          ]}
        >
          <View style={s.heroCardTop}>
            <View style={[s.heroIconCircle, { backgroundColor: isProtected ? 'rgba(255,255,255,0.18)' : colors.bg.tertiary }]}>
              <AppIcon name="shield" size={18} color={isProtected ? colors.text.inverse : colors.text.muted} />
            </View>
            <View style={s.heroCardCenter}>
              <Text style={[s.heroStatus, { color: isProtected ? colors.text.inverse : colors.text.muted }]}>
                {isProtected ? 'PROTECTED' : 'OFF'}
              </Text>
              <Text style={[s.heroSub, { color: isProtected ? 'rgba(255,255,255,0.7)' : colors.text.muted }]}>
                {isProtected ? statusLine : 'Tap to start protection'}
              </Text>
            </View>
            <View style={s.heroBlocksRight}>
              <Text style={[s.heroBlocksNum, { color: isProtected ? colors.text.inverse : colors.text.primary }]}>
                {gamification.blocksToday}
              </Text>
              <Text style={[s.heroBlocksLabel, { color: isProtected ? 'rgba(255,255,255,0.65)' : colors.text.muted }]}>
                blocks
              </Text>
            </View>
          </View>
          {isProtected ? (
            <View style={[s.heroStatsRow, { borderTopColor: 'rgba(255,255,255,0.15)' }]}>
              <View style={s.heroStat}>
                <Text style={s.heroStatVal}>{gamification.currentStreak}</Text>
                <Text style={s.heroStatLabel}>day streak</Text>
              </View>
              <View style={[s.heroStatDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              <View style={s.heroStat}>
                <Text style={s.heroStatVal}>{formatCleanTime(cleanMinutes)}</Text>
                <Text style={s.heroStatLabel}>clean today</Text>
              </View>
              <View style={[s.heroStatDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              <View style={s.heroStat}>
                <Text style={s.heroStatVal}>Lv {gamification.level}</Text>
                <Text style={s.heroStatLabel}>{levelNameShort(gamification.level)}</Text>
              </View>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>

      {/* Mood check-in */}
      <MoodStrip mood={mood} onPress={openMoodModal} />

      {!protection.vpnPermissionGranted ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void protection.prepareVpn()}
          style={[s.permNotice, { backgroundColor: colors.amber[50], borderColor: colors.amber[200] }]}
        >
          <Feather name="alert-triangle" size={14} color={colors.amber[700]} />
          <View style={{ flex: 1 }}>
            <Text style={[s.permNoticeTitle, { color: colors.amber[700] }]}>VPN permission needed</Text>
            <Text style={[s.permNoticeSub, { color: colors.amber[600] }]}>Tap to enable DNS filtering</Text>
          </View>
          <Feather name="chevron-right" size={14} color={colors.amber[700]} />
        </Pressable>
      ) : null}
      {!protection.accessibilityServiceEnabled ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void protection.openAccessibilitySettings()}
          style={[s.permNotice, { backgroundColor: colors.amber[50], borderColor: colors.amber[200] }]}
        >
          <Feather name="eye-off" size={14} color={colors.amber[700]} />
          <View style={{ flex: 1 }}>
            <Text style={[s.permNoticeTitle, { color: colors.amber[700] }]}>Behavior blocking inactive</Text>
            <Text style={[s.permNoticeSub, { color: colors.amber[600] }]}>Tap to enable Accessibility — needed for app-level blocking</Text>
          </View>
          <Feather name="chevron-right" size={14} color={colors.amber[700]} />
        </Pressable>
      ) : null}
      <View style={s.quickActionsGrid}>
        <View style={s.quickActionsRow}>
          <QuickAction icon="sliders" label="Rules" onPress={() => router.push('/rules')} colors={colors} />
          <QuickAction icon="moon" label="Focus" onPress={() => router.push('/focus')} colors={colors} />
        </View>
        <View style={s.quickActionsRow}>
          <QuickAction icon="users" label="Guardian" onPress={() => router.push('/guardian')} colors={colors} />
          <QuickAction icon="bell" label="Alerts" onPress={() => router.push('/alerts')} colors={colors} />
        </View>
      </View>

      {protection.error ? <Text style={[s.notice, { color: colors.red[500] }]}>{protection.error}</Text> : null}
    </ScreenScaffold>
  );
}

function MoodStrip({
  mood,
  onPress,
}: {
  mood: MoodCheckIn | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mood ? `Today's mood: ${moodOptions.find((o) => o.value === mood)?.label ?? ''}` : 'Log your mood'}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          s.moodStrip,
          {
            backgroundColor: colors.bg.elevated,
            borderColor: mood ? colors.border.green : colors.border.subtle,
            borderLeftColor: mood ? colors.green[500] : colors.border.subtle,
          },
        ]}
      >
        {mood ? (
          <>
            <View style={s.moodEmptyLeft}>
              <Text style={[s.moodTitle, { color: colors.text.secondary }]}>Today's mood</Text>
            </View>
            <View style={s.completedMoodRight}>
              <MoodFace mood={mood} size={26} />
              <Text style={[s.moodLabel, { color: colors.text.primary }]}>
                {moodOptions.find((o) => o.value === mood)?.label ?? ''}
              </Text>
              <Feather name="chevron-right" size={13} color={colors.text.muted} />
            </View>
          </>
        ) : (
          <>
            <View style={s.moodEmptyLeft}>
              <Feather name="smile" size={15} color={colors.text.muted} />
              <Text style={[s.moodTitle, { color: colors.text.secondary }]}>How are you feeling?</Text>
            </View>
            <Feather name="chevron-right" size={14} color={colors.text.muted} />
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.95);
  return (
    <Animated.View style={[s.quickAction, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={s.quickActionPressable}
      >
        <Feather name={icon} size={15} color={colors.green[500]} />
        <Text style={[s.quickActionLabel, { color: colors.text.primary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function DisableProtectionSheet({
  countdown,
  locked,
  lockExpiresAt,
  pin,
  pinConfigured,
  pinError,
  visible,
  onCancel,
  onConfirm,
  onPinChange,
}: {
  countdown: number;
  locked: boolean;
  lockExpiresAt?: number | null;
  pin: string;
  pinConfigured: boolean;
  pinError: boolean;
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onPinChange: (pin: string) => void;
}) {
  const { colors } = useTheme();
  const pinInputRef = useRef<TextInput>(null);
  const canConfirm = !locked && (!pinConfigured || pin.length >= 4) && countdown <= 0;

  const lockCopy = useMemo(() => {
    if (!locked) return null;
    if (!lockExpiresAt || lockExpiresAt <= 0) return 'Protection is time-locked and cannot be turned off right now.';
    const remaining = lockExpiresAt - Date.now();
    const days = Math.max(0, Math.ceil(remaining / 86_400_000));
    const date = new Date(lockExpiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    return `Protection is locked until ${date} · ${days} day${days === 1 ? '' : 's'} remaining.`;
  }, [locked, lockExpiresAt]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onCancel}>
      <Pressable style={s.sheetBackdrop} onPress={onCancel}>
        <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated }]}>
          <View style={[s.sheetHandle, { backgroundColor: colors.border.default }]} />
          <Text style={[s.sheetTitle, { color: colors.text.primary }]}>Turn protection off?</Text>
          <Text style={[s.sheetCopy, { color: colors.text.secondary }]}>
            {locked
              ? lockCopy
              : pinConfigured
                ? 'Enter your parent PIN to turn protection off.'
                : `Wait ${DISABLE_PROTECTION_COUNTDOWN_SECONDS} seconds, then confirm only if this is intentional.`}
          </Text>
          {pinConfigured && !locked ? (
            <TextInput
              ref={pinInputRef}
              accessibilityLabel="Parent PIN"
              autoFocus
              keyboardType="number-pad"
              maxLength={12}
              placeholder="Enter PIN"
              placeholderTextColor={colors.text.muted}
              secureTextEntry
              style={[
                s.pinInput,
                {
                  backgroundColor: colors.bg.tertiary,
                  borderColor: pinError ? colors.red[500] : colors.border.subtle,
                  color: colors.text.primary,
                },
              ]}
              value={pin}
              onChangeText={onPinChange}
              onSubmitEditing={onConfirm}
            />
          ) : null}
          {pinError ? (
            <Text style={[s.pinError, { color: colors.red[500] }]}>Incorrect PIN. Try again.</Text>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onCancel} style={[s.sheetButton, { backgroundColor: colors.green[500] }]}>
            <Text style={[s.sheetButtonText, { color: colors.text.inverse }]}>Stay protected</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!canConfirm}
            onPress={onConfirm}
            style={s.sheetTextButton}
          >
            <Text
              style={[
                s.sheetTextButtonLabel,
                { color: canConfirm ? colors.red[500] : colors.text.muted },
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

function formatCleanTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours <= 0) return remainingMinutes === 0 ? '—' : `${remainingMinutes} min`;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

function isSameDay(first: number, second: number) {
  return new Date(first).toDateString() === new Date(second).toDateString();
}

const s = StyleSheet.create({
  screenContent: {
    gap: spacing.lg,
  },
  notice: {
    ...typography.body,
    textAlign: 'center',
  },

  // Hero card
  heroCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heroCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  heroIconCircle: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  heroCardCenter: {
    flex: 1,
    gap: 3,
  },
  heroStatus: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroSub: {
    fontSize: 11,
    fontWeight: '400',
  },
  heroBlocksRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  heroBlocksNum: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
  },
  heroBlocksLabel: {
    fontSize: 9,
    fontWeight: '400',
  },
  heroStatsRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroStat: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  heroStatVal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
    fontWeight: '400',
  },
  heroStatDivider: {
    alignSelf: 'stretch',
    marginVertical: 4,
    width: StyleSheet.hairlineWidth,
  },

  // Mood strip
  moodStrip: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  completedMoodRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  moodLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  moodEmptyLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  moodTitle: {
    fontSize: 13,
    fontWeight: '400',
  },

  // Quick actions 2×2
  quickActionsGrid: {
    gap: spacing.sm,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAction: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: 'hidden',
  },
  quickActionPressable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  // VPN permission notice
  permNotice: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  permNoticeTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  permNoticeSub: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },

  // Disable sheet
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
  pinInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 18,
    letterSpacing: 4,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  pinError: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: -spacing.xs,
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
});
