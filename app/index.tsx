import { type ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { Feather } from '@expo/vector-icons';
import { AppIcon } from '@/components/AppIcon';
import { AppSheet } from '@/components/AppSheet';
import { Banner } from '@/components/Banner';
import { Chevron } from '@/components/Chevron';
import { BlockScreenOverlay } from '@/components/behavior/BlockScreenOverlay';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Skeleton } from '@/components/Skeleton';
import { StreakPopup } from '@/components/streak/StreakPopup';
import { useDailyStreakPopup } from '@/components/streak/useDailyStreakPopup';
import { usePressScale } from '@/components/usePressScale';
import { XpPopup } from '@/components/XpPopup';
import { MoodDetailView } from '@/components/MoodDetailView';
import { MoodFace } from '@/components/MoodFace';
import { MoodPickerView } from '@/components/MoodPickerView';
import { haptics } from '@/lib/haptics';
import { getTodaysMood, saveMood } from '@/services/mood';
import type { MoodCheckIn } from '@/services/mood';
import { useAlertCenter } from '@/store/useAlertCenter';
import { useGamification } from '@/store/useGamification';
import { useProtection } from '@/store/ProtectionContext';
import { formatFullDate, formatShortDate, levelNameKey, moodLabelKey, useI18n, useTranslation } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

type Translate = ReturnType<typeof useTranslation>;

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

function getGreetingKey(): TranslationKey {
  const h = new Date().getHours();
  if (h < 12) return 'home.goodMorning';
  if (h < 17) return 'home.goodAfternoon';
  return 'home.goodEvening';
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const router = useRouter();
  const protection = useProtection();
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
    if (streakPopup.visible) haptics.success();
  }, [streakPopup.visible]);

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
    if (!isProtected) return t('home.protectionDisabled');
    return t('home.statusLine', { count: gamification.blocksToday });
  }, [gamification.blocksToday, isProtected, t]);

  const showXpGain = () => {
    haptics.success();
    setShowXp(true);
    setTimeout(() => setShowXp(false), 1800);
  };

  const handleProtectionPress = () => {
    haptics.press();
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
        haptics.error();
        setDisablePinError(true);
        if (status === 'pin_locked_out') setDisableSheetVisible(false);
        return;
      }
      if (status === 'inactive') {
        haptics.warning();
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
    haptics.selection();
    setPendingMood(selected);
    setMoodModalStep('detail');
  };

  const handleMoodSave = () => {
    if (!pendingMood) return;
    haptics.success();
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
      title={t(getGreetingKey())}
      subtitle={formatFullDate(Date.now(), language)}
      headerRight={
        <AlertsBell
          unreadCount={alertCenter.unreadCount}
          label={t('home.quickAlerts')}
          onPress={() => router.push('/alerts')}
        />
      }
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
            onPinChange={(value) => {
              if (value.length > disablePin.length) haptics.selection();
              setDisablePin(value);
            }}
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
      {/* Hero card — skeleton until the first bridge status lands, so a cold
          start never flashes deceptive "Not protected · 0 blocks" copy. */}
      {!protection.hydrated ? (
        <Skeleton height={96} radius={radius.lg} />
      ) : (
      <Animated.View style={heroAnimStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ checked: isProtected }}
          accessibilityLabel={isProtected ? t('home.protected') : t('home.notProtected')}
          accessibilityHint={isProtected ? undefined : t('home.tapToProtect')}
          onPress={handleProtectionPress}
          onPressIn={heroPressIn}
          onPressOut={heroPressOut}
          style={[
            s.heroCard,
            isProtected
              ? { borderColor: colors.green[700] }
              : { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle },
          ]}
        >
          {isProtected ? (
            <LinearGradient
              colors={[colors.bg.greenDark, colors.bg.green]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={s.heroCardTop}>
            <View style={[s.heroIconCircle, { backgroundColor: isProtected ? 'rgba(255,255,255,0.18)' : colors.bg.tertiary }]}>
              {protection.loading ? (
                <ActivityIndicator size="small" color={isProtected ? colors.text.inverse : colors.text.muted} />
              ) : (
                <AppIcon name="shield" size={18} color={isProtected ? colors.text.inverse : colors.text.muted} />
              )}
            </View>
            <View style={s.heroCardCenter}>
              <Text maxFontSizeMultiplier={1.3} style={[s.heroStatus, { color: isProtected ? colors.text.inverse : colors.text.muted }]}>
                {isProtected ? t('home.protected') : t('home.notProtected')}
              </Text>
              <Text maxFontSizeMultiplier={1.3} style={[s.heroSub, { color: isProtected ? 'rgba(255,255,255,0.7)' : colors.text.muted }]}>
                {protection.loading
                  ? (isProtected ? t('home.stopping') : t('home.starting'))
                  : (isProtected ? statusLine : t('home.tapToProtect'))}
              </Text>
            </View>
            <View style={s.heroBlocksRight}>
              <Text maxFontSizeMultiplier={1.3} style={[s.heroBlocksNum, { color: isProtected ? colors.text.inverse : colors.text.primary }]}>
                {gamification.blocksToday}
              </Text>
              <Text maxFontSizeMultiplier={1.3} style={[s.heroBlocksLabel, { color: isProtected ? 'rgba(255,255,255,0.65)' : colors.text.muted }]}>
                {t('home.blocksLabel')}
              </Text>
            </View>
          </View>
          {isProtected ? (
            <View style={[s.heroStatsRow, { borderTopColor: 'rgba(255,255,255,0.15)' }]}>
              <View style={s.heroStat}>
                <Text maxFontSizeMultiplier={1.3} style={s.heroStatVal}>{gamification.currentStreak}</Text>
                <Text maxFontSizeMultiplier={1.3} style={s.heroStatLabel}>{t('home.dayStreak')}</Text>
              </View>
              <View style={[s.heroStatDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              <View style={s.heroStat}>
                <Text maxFontSizeMultiplier={1.3} style={s.heroStatVal}>{formatCleanTime(cleanMinutes, t)}</Text>
                <Text maxFontSizeMultiplier={1.3} style={s.heroStatLabel}>{t('home.cleanToday')}</Text>
              </View>
              <View style={[s.heroStatDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              <View style={s.heroStat}>
                <Text maxFontSizeMultiplier={1.3} style={s.heroStatVal}>{t('home.levelShort', { level: gamification.level })}</Text>
                <Text maxFontSizeMultiplier={1.3} style={s.heroStatLabel}>{t(levelNameKey(gamification.level))}</Text>
              </View>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
      )}

      {/* Mood check-in */}
      <MoodStrip mood={mood} onPress={openMoodModal} />

      {protection.hydrated && !protection.vpnPermissionGranted ? (
        <Banner
          icon="alert-triangle"
          title={t('home.vpnNeededTitle')}
          subtitle={t('home.vpnNeededSubtitle')}
          trailing="chevron"
          onPress={() => void protection.prepareVpn()}
        />
      ) : null}
      {protection.hydrated && !protection.accessibilityServiceEnabled ? (
        <Banner
          icon="eye-off"
          title={t('home.behaviorInactiveTitle')}
          subtitle={t('home.behaviorInactiveSubtitle')}
          trailing="chevron"
          onPress={() => void protection.openAccessibilitySettings()}
        />
      ) : null}
      {/* Battery exemption is only pitched once protection has proven itself
          for a day — an onboarding ask would be noise. */}
      {protection.hydrated &&
      !protection.batteryOptimizationStatus.ignored &&
      gamification.currentStreak >= 1 ? (
        <Banner
          icon="battery-charging"
          title={t('ctx.batteryTitle')}
          subtitle={t('ctx.batterySubtitle')}
          trailing="chevron"
          onPress={() => void protection.requestIgnoreBatteryOptimizations()}
        />
      ) : null}
      <View style={s.quickActionsGrid}>
        <View style={s.quickActionsRow}>
          <QuickAction icon="moon" label={t('home.quickFocus')} onPress={() => router.push('/focus')} colors={colors} />
          <QuickAction icon="users" label={t('home.quickGuardian')} onPress={() => router.push('/guardian')} colors={colors} />
        </View>
      </View>

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
  const t = useTranslation();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          mood
            ? t('home.moodTodayA11y', { mood: t(moodLabelKey(mood)) })
            : t('home.logMoodA11y')
        }
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          s.moodStrip,
          {
            backgroundColor: colors.bg.elevated,
            borderColor: mood ? colors.border.green : colors.border.subtle,
            borderStartColor: mood ? colors.green[500] : colors.border.subtle,
          },
        ]}
      >
        {mood ? (
          <>
            <View style={s.moodEmptyLeft}>
              <Text style={[s.moodTitle, { color: colors.text.secondary }]}>{t('home.todaysMood')}</Text>
            </View>
            <View style={s.completedMoodRight}>
              <MoodFace mood={mood} size={26} />
              <Text style={[s.moodLabel, { color: colors.text.primary }]}>
                {t(moodLabelKey(mood))}
              </Text>
              <Chevron size={13} color={colors.text.muted} />
            </View>
          </>
        ) : (
          <>
            <View style={s.moodEmptyLeft}>
              <Feather name="smile" size={15} color={colors.text.muted} />
              <Text style={[s.moodTitle, { color: colors.text.secondary }]}>{t('home.howAreYouFeeling')}</Text>
            </View>
            <Chevron size={14} color={colors.text.muted} />
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

function AlertsBell({
  unreadCount,
  label,
  onPress,
}: {
  unreadCount: number;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={s.bellButton}>
      <Feather name="bell" size={20} color={colors.text.secondary} />
      {unreadCount > 0 ? (
        <View style={[s.bellBadge, { backgroundColor: colors.red[500], borderColor: colors.bg.primary }]}>
          <Text style={s.bellBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
        </View>
      ) : null}
    </Pressable>
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
  const { t, language } = useI18n();
  const canConfirm = !locked && (!pinConfigured || pin.length >= 4) && countdown <= 0;

  const lockCopy = useMemo(() => {
    if (!locked) return null;
    if (!lockExpiresAt || lockExpiresAt <= 0) return t('disable.lockedNoExpiry');
    return t('disable.lockedUntil', { date: formatShortDate(lockExpiresAt, language) });
  }, [locked, lockExpiresAt, t, language]);

  return (
    <AppSheet visible={visible} onClose={onCancel}>
      <Text style={[s.sheetTitle, { color: colors.text.primary }]}>{t('disable.title')}</Text>
      <Text style={[s.sheetCopy, { color: colors.text.secondary }]}>
        {locked
          ? lockCopy
          : pinConfigured
            ? t('disable.enterPin')
            : t('disable.wait', { seconds: DISABLE_PROTECTION_COUNTDOWN_SECONDS })}
      </Text>
      {pinConfigured && !locked ? (
        <TextInput
          accessibilityLabel={t('policy.pinLabel')}
          autoFocus
          keyboardType="number-pad"
          maxLength={12}
          placeholder={t('common.enterPin')}
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
        <Text style={[s.pinError, { color: colors.red[500] }]}>{t('disable.incorrectPin')}</Text>
      ) : null}
      <Pressable accessibilityRole="button" onPress={onCancel} style={[s.sheetButton, { backgroundColor: colors.green[500] }]}>
        <Text style={[s.sheetButtonText, { color: colors.text.inverse }]}>{t('disable.stayProtected')}</Text>
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
          {countdown > 0 && !locked && !pinConfigured
            ? t('disable.confirmIn', { seconds: countdown })
            : t('disable.turnOff')}
        </Text>
      </Pressable>
    </AppSheet>
  );
}

function formatCleanTime(minutes: number, t: Translate) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours <= 0) return remainingMinutes === 0 ? t('time.empty') : t('time.minutesShort', { count: remainingMinutes });
  return remainingMinutes === 0
    ? t('time.hoursShort', { count: hours })
    : t('time.hoursMinutesShort', { hours, minutes: remainingMinutes });
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
    fontSize: 11,
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
    fontSize: 11,
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
    borderStartWidth: 3,
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

  // Header alerts bell
  bellButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  bellBadge: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1.5,
    height: 16,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    end: 2,
    top: 2,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },

  // Disable sheet
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
