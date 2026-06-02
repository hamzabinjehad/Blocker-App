import { type ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { Feather } from '@expo/vector-icons';
import { AppIcon } from '@/components/AppIcon';
import { BlockScreenOverlay } from '@/components/behavior/BlockScreenOverlay';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { StreakPopup } from '@/components/streak/StreakPopup';
import { useDailyStreakPopup } from '@/components/streak/useDailyStreakPopup';
import { usePressScale } from '@/components/usePressScale';
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
const DISABLE_PROTECTION_COUNTDOWN_SECONDS = 5;

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const protection = useProtectionState();
  const gamification = useGamification();
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
  const isProtected = protection.status === 'active' || protection.vpnActive;
  const liveSessionMinutes =
    isProtected && sessionStartedAt ? Math.max(0, Math.floor((now - sessionStartedAt) / 60000)) : 0;
  const cleanMinutes = gamification.todayCleanHours * 60 + liveSessionMinutes;
  const progressRatio = Math.min(1, gamification.xpProgress.current / gamification.xpProgress.required);

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const xpBarWidth = useRef(new Animated.Value(0)).current;
  const { animatedStyle: shieldAnimStyle, onPressIn: shieldPressIn, onPressOut: shieldPressOut } = usePressScale(0.94);

  useEffect(() => {
    if (!isProtected) {
      pulseScale.setValue(1);
      pulseOpacity.setValue(0);
      return;
    }
    pulseOpacity.setValue(0.4);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1.55, duration: 1600, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isProtected, pulseOpacity, pulseScale]);

  useEffect(() => {
    Animated.timing(xpBarWidth, {
      toValue: progressRatio,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progressRatio, xpBarWidth]);

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
            pin={disablePin}
            pinConfigured={protection.pinConfigured}
            pinError={disablePinError}
            visible={disableSheetVisible}
            onCancel={() => setDisableSheetVisible(false)}
            onConfirm={confirmDisable}
            onPinChange={setDisablePin}
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
        {isProtected ? (
          <LinearGradient
            colors={[colors.green[50] as string, 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        {isProtected ? (
          <Animated.View
            pointerEvents="none"
            style={[
              s.pulseRing,
              {
                borderColor: colors.green[500],
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
        ) : null}
        <Animated.View style={shieldAnimStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ checked: isProtected }}
            onPress={handleProtectionPress}
            onPressIn={shieldPressIn}
            onPressOut={shieldPressOut}
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
        </Animated.View>
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
            <Animated.View style={[s.xpFill, { backgroundColor: colors.green[500], width: xpBarWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
          <Text style={[s.statLabel, { color: colors.text.muted }]}>
            {gamification.xpProgress.current} / {gamification.xpProgress.required} XP
          </Text>
        </View>
        <Stat label="clean time" value={formatCleanTime(cleanMinutes)} />
      </View>

      {isProtected ? (
        <>
          {(!protection.accessibilityServiceEnabled || !protection.overlayPermissionGranted || !protection.managedDeviceStatus.deviceAdminActive) ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/guardian')}
              style={[s.setupBanner, { backgroundColor: colors.amber[50], borderColor: colors.amber[200] }]}
            >
              <Feather name="alert-triangle" size={14} color={colors.amber[700]} />
              <Text style={[s.setupBannerText, { color: colors.amber[700] }]}>
                Some features need setup to work fully
              </Text>
              <Feather name="chevron-right" size={14} color={colors.amber[700]} />
            </Pressable>
          ) : null}
          <View style={s.quickActions}>
            <QuickAction icon="sliders" label="Rules" onPress={() => router.push('/rules')} colors={colors} />
            <QuickAction icon="bell" label="Alerts" onPress={() => router.push('/alerts')} colors={colors} />
            <QuickAction icon="moon" label="Focus" onPress={() => router.push('/focus')} colors={colors} />
            <QuickAction icon="user" label="Guardian" onPress={() => router.push('/guardian')} colors={colors} />
          </View>
        </>
      ) : (
        <SetupChecklist protection={protection} colors={colors} onStart={() => void protection.startProtection(7)} />
      )}

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
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.93);
  return (
    <Animated.View style={[s.quickAction, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={s.quickActionPressable}
      >
        <Feather name={icon} size={18} color={colors.green[500]} />
        <Text style={[s.quickActionLabel, { color: colors.text.secondary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function SetupChecklist({
  protection,
  colors,
  onStart,
}: {
  protection: ReturnType<typeof useProtectionState>;
  colors: ReturnType<typeof useTheme>['colors'];
  onStart: () => void;
}) {
  const required: Array<{
    label: string;
    sublabel: string;
    done: boolean;
    onEnable?: () => Promise<unknown> | void;
  }> = [
    {
      label: 'VPN permission',
      sublabel: 'Allows DNS-level filtering of adult content',
      done: protection.vpnPermissionGranted,
      onEnable: protection.vpnPermissionGranted ? undefined : protection.prepareVpn,
    },
    {
      label: 'Device Admin',
      sublabel: 'Prevents the app from being uninstalled',
      done: protection.managedDeviceStatus.deviceAdminActive,
      onEnable: protection.managedDeviceStatus.deviceAdminActive
        ? undefined
        : protection.requestDeviceAdminPermission,
    },
  ];

  const recommended: typeof required = [
    {
      label: 'Behavior protection',
      sublabel: 'Screen monitoring and keyword detection',
      done: protection.accessibilityServiceEnabled,
      onEnable: protection.accessibilityServiceEnabled
        ? undefined
        : protection.openAccessibilitySettings,
    },
    {
      label: 'Block overlay',
      sublabel: 'Shows block screen over apps when triggered',
      done: protection.overlayPermissionGranted,
      onEnable: protection.overlayPermissionGranted
        ? undefined
        : protection.openOverlaySettings,
    },
    {
      label: 'Parent PIN',
      sublabel: 'Locks settings so only you can change them',
      done: protection.pinConfigured,
    },
  ];

  const requiredDone = required.every((item) => item.done);
  const totalDone = [...required, ...recommended].filter((item) => item.done).length;
  const total = required.length + recommended.length;

  return (
    <View style={[s.checklist, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <View style={s.checklistHeader}>
        <View style={s.checklistHeaderText}>
          <Text style={[s.checklistTitle, { color: colors.text.primary }]}>
            {requiredDone ? 'Ready to start' : 'Complete setup first'}
          </Text>
          <Text style={[s.checklistSubtitle, { color: colors.text.muted }]}>
            {totalDone} of {total} steps done
          </Text>
        </View>
        {requiredDone ? (
          <Pressable
            accessibilityRole="button"
            onPress={onStart}
            style={[s.checklistCta, { backgroundColor: colors.green[500] }]}
          >
            <Text style={[s.checklistCtaText, { color: colors.text.inverse }]}>Start now</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[s.checklistSection, { color: colors.text.muted }]}>Required</Text>
      {required.map((item) => (
        <SetupItem key={item.label} required colors={colors} {...item} />
      ))}

      <Text style={[s.checklistSection, { color: colors.text.muted }]}>Recommended</Text>
      {recommended.map((item) => (
        <SetupItem key={item.label} colors={colors} {...item} />
      ))}
    </View>
  );
}

function SetupItem({
  label,
  sublabel,
  done,
  required = false,
  onEnable,
  colors,
}: {
  label: string;
  sublabel: string;
  done: boolean;
  required?: boolean;
  onEnable?: () => Promise<unknown> | void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={s.checklistItem}>
      <Feather
        name={done ? 'check-circle' : required ? 'alert-circle' : 'circle'}
        size={16}
        color={done ? colors.green[500] : required ? colors.amber[600] : colors.text.muted}
      />
      <View style={s.checklistItemBody}>
        <Text style={[s.checklistItemLabel, { color: done ? colors.text.secondary : colors.text.primary }]}>
          {label}
        </Text>
        <Text style={[s.checklistItemSublabel, { color: colors.text.muted }]} numberOfLines={1}>
          {sublabel}
        </Text>
      </View>
      {!done && onEnable ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => { void onEnable(); }}
          style={[
            s.checklistItemBtn,
            { borderColor: required ? colors.amber[400] : colors.border.subtle },
          ]}
        >
          <Text style={[s.checklistItemBtnText, { color: required ? colors.amber[700] : colors.text.secondary }]}>
            Enable
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DisableProtectionSheet({
  countdown,
  locked,
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
    borderRadius: radius.lg,
    gap: spacing.lg,
    minHeight: 260,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pulseRing: {
    borderRadius: radius.full,
    borderWidth: 2,
    height: 180,
    position: 'absolute',
    width: 180,
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
  quickActions: {
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
    gap: spacing.xs,
    minHeight: 64,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  checklist: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg,
  },
  checklistHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  checklistHeaderText: {
    flex: 1,
    gap: 2,
  },
  checklistTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  checklistSubtitle: {
    ...typography.caption,
  },
  checklistSection: {
    ...typography.caption,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  checklistCta: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  checklistCtaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  checklistItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
  },
  checklistItemBody: {
    flex: 1,
    gap: 2,
  },
  checklistItemLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  checklistItemSublabel: {
    ...typography.caption,
  },
  checklistItemBtn: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  checklistItemBtnText: {
    ...typography.captionMd,
  },
  setupBanner: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  setupBannerText: {
    ...typography.caption,
    flex: 1,
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


