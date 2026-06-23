import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useAlertCenter } from '@/store/useAlertCenter';
import { useProtectionState } from '@/store/useProtectionState';
import { useRemoteManagement } from '@/store/useRemoteManagement';
import { radius, spacing, typography, useTheme } from '@/theme';

type IconTone = 'shield' | 'details' | 'focus' | 'guardian' | 'alerts' | 'appearance';
type RowTone = 'neutral' | 'success' | 'warning' | 'danger';

type SettingsRowProps = {
  icon?: ComponentProps<typeof Feather>['name'];
  iconTone?: IconTone;
  label: string;
  sublabel?: string;
  sublabelTone?: RowTone;
  value?: string;
  valueTone?: RowTone;
  onPress?: () => void;
};

const appVersion = Constants.expoConfig?.version ?? '1.0.0';
const PROTECTION_SESSION_KEY = 'home_protection_session_started_at';

export default function SettingsScreen() {
  const { colors, isDark, mode } = useTheme();
  const router = useRouter();
  const protection = useProtectionState();
  const alertCenter = useAlertCenter();
  const remote = useRemoteManagement();
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [aboutVisible, setAboutVisible] = useState(false);
  const isProtected = protection.status === 'active' || protection.vpnActive;
  const unreadAlerts = alertCenter.alerts.filter((alert) => !alert.read);
  const criticalUnread = unreadAlerts.filter((alert) => alert.severity === 'critical').length;
  const warningUnread = unreadAlerts.filter((alert) => alert.severity === 'warning').length;

  useEffect(() => {
    if (!isProtected) {
      setSessionStartedAt(null);
      return;
    }

    let cancelled = false;
    void AsyncStorage.getItem(PROTECTION_SESSION_KEY).then((stored) => {
      const parsed = stored ? Number(stored) : 0;
      if (!cancelled) setSessionStartedAt(parsed > 0 ? parsed : null);
    });
    return () => {
      cancelled = true;
    };
  }, [isProtected]);

  const protectionDetailsSublabel = useMemo(() => getProtectionDetailsSublabel(protection), [protection]);
  const focusSublabel = useMemo(() => getFocusSublabel(protection), [protection]);
  const guardianSublabel = getGuardianSublabel(remote.session, protection.pinConfigured);
  const alertSublabel = getAlertSublabel(alertCenter.unreadCount, warningUnread, criticalUnread);
  const alertTone: RowTone = criticalUnread > 0 ? 'danger' : warningUnread > 0 || alertCenter.unreadCount > 0 ? 'warning' : 'neutral';

  return (
    <ScreenScaffold
      title="Settings"
      subtitle="Manage protection, focus, and accountability"
      iconName="control"
      collapsibleTitle
    >
      {!protection.pinConfigured ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/guardian')}
          style={[s.pinBanner, { backgroundColor: colors.amber[50], borderColor: colors.border.amber }]}
        >
          <Feather name="alert-triangle" size={18} color={colors.amber[700]} />
          <View style={s.bannerText}>
            <Text style={[s.bannerTitle, { color: colors.amber[900] }]}>PIN not set</Text>
            <Text style={[s.bannerCopy, { color: colors.amber[800] }]}>
              Protection can be disabled without a PIN.
            </Text>
          </View>
          <Text style={[s.bannerAction, { color: colors.amber[900] }]}>Set PIN now</Text>
        </Pressable>
      ) : null}

      <View style={s.section}>
        <Text style={[s.sectionHeader, { color: colors.text.muted }]}>PROTECTION</Text>
        <View style={[s.list, { borderColor: colors.border.subtle }]}>
          <SettingsRow
            icon="shield"
            iconTone="shield"
            label="Protection"
            sublabel={isProtected ? `Active · protecting ${formatProtectionSince(sessionStartedAt)}` : 'Off · not protecting'}
            value={isProtected ? 'ON' : 'OFF'}
            valueTone={isProtected ? 'success' : 'neutral'}
          />
          <SettingsRow
            icon="sliders"
            iconTone="details"
            label="Protection details"
            sublabel={protectionDetailsSublabel}
            onPress={() => router.push('/rules')}
          />
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionHeader, { color: colors.text.muted }]}>ACCOUNTABILITY</Text>
        <View style={[s.list, { borderColor: colors.border.subtle }]}>
          <SettingsRow
            icon="user"
            iconTone="guardian"
            label="Guardian"
            sublabel={guardianSublabel}
            sublabelTone={protection.pinConfigured ? 'neutral' : 'warning'}
            value="Private"
            valueTone="neutral"
            onPress={() => router.push('/guardian')}
          />
          <SettingsRow
            icon="bell"
            iconTone="alerts"
            label="Alert Center"
            sublabel={alertSublabel}
            sublabelTone={alertTone}
            value={alertCenter.unreadCount > 0 ? `${alertCenter.unreadCount} unread` : undefined}
            valueTone={alertTone}
            onPress={() => router.push('/alerts')}
          />
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionHeader, { color: colors.text.muted }]}>FOCUS</Text>
        <View style={[s.list, { borderColor: colors.border.subtle }]}>
          <SettingsRow
            icon="clock"
            iconTone="focus"
            label="Focus & Screen Time"
            sublabel={focusSublabel}
            onPress={() => router.push('/focus')}
          />
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionHeader, { color: colors.text.muted }]}>APP</Text>
        <View style={[s.list, { borderColor: colors.border.subtle }]}>
          <SettingsRow
            icon="sun"
            iconTone="appearance"
            label="Appearance"
            sublabel={getThemeSublabel(mode, isDark)}
            onPress={() => router.push('/appearance')}
          />
          <SettingsRow icon="info" iconTone="appearance" label="About" value={`v${appVersion}`} valueTone="neutral" onPress={() => setAboutVisible(true)} />
        </View>
      </View>

      <AboutModal visible={aboutVisible} version={appVersion} onClose={() => setAboutVisible(false)} />
    </ScreenScaffold>
  );
}

function AboutModal({ visible, version, onClose }: { visible: boolean; version: string; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={s.aboutBackdrop} onPress={onClose}>
        <Pressable style={[s.aboutSheet, { backgroundColor: colors.bg.elevated }]}>
          <View style={[s.aboutIconRow]}>
            <View style={[s.aboutIcon, { backgroundColor: colors.green[50] }]}>
              <Feather name="shield" size={28} color={colors.green[600]} />
            </View>
          </View>
          <Text style={[s.aboutTitle, { color: colors.text.primary }]}>Control Yourself</Text>
          <Text style={[s.aboutVersion, { color: colors.text.muted }]}>Version {version}</Text>
          <Text style={[s.aboutBody, { color: colors.text.secondary }]}>
            A parental control and self-accountability app for Android. DNS filtering, app blocking, habit tracking, and guardian oversight — all on-device.
          </Text>
          <View style={[s.aboutDivider, { backgroundColor: colors.border.subtle }]} />
          <Text style={[s.aboutLabel, { color: colors.text.muted }]}>DATA & PRIVACY</Text>
          <Text style={[s.aboutBody, { color: colors.text.secondary }]}>
            All filtering and blocking happens locally on your device. No browsing data, usage stats, or personal information is sent to any server without your explicit consent.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[s.aboutCloseBtn, { backgroundColor: colors.green[500] }]}
          >
            <Text style={[s.aboutCloseBtnText, { color: colors.text.inverse }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SettingsRow({
  icon,
  iconTone = 'details',
  label,
  sublabel,
  sublabelTone = 'neutral',
  value,
  valueTone = 'neutral',
  onPress,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const interactive = Boolean(onPress);

  return (
    <Pressable
      accessibilityRole={interactive ? 'button' : 'text'}
      onPress={onPress}
      disabled={!interactive}
      style={({ pressed }) => [
        s.row,
        !sublabel ? s.rowCompact : null,
        pressed ? { backgroundColor: colors.bg.tertiary } : null,
      ]}
    >
      {icon ? <IconTile icon={icon} tone={iconTone} /> : null}
      <View style={s.rowText}>
        <Text style={[s.rowLabel, { color: colors.text.primary }]}>{label}</Text>
        {sublabel ? (
          <Text style={[s.rowSublabel, { color: getToneTextColor(sublabelTone, colors) }]} numberOfLines={2}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {value ? <ValueChip value={value} tone={valueTone} /> : interactive ? <Feather name="chevron-right" size={20} color={colors.text.muted} /> : null}
    </Pressable>
  );
}

function IconTile({ icon, tone }: { icon: ComponentProps<typeof Feather>['name']; tone: IconTone }) {
  const { isDark } = useTheme();
  const toneStyle = getIconToneStyle(tone, isDark);
  return (
    <View style={[s.iconTile, { backgroundColor: toneStyle.bg }]}>
      <Feather name={icon} size={17} color={toneStyle.fg} />
    </View>
  );
}

function ValueChip({ value, tone }: { value: string; tone: RowTone }) {
  const { colors } = useTheme();
  return (
    <View style={[s.valueChip, { backgroundColor: getToneBackgroundColor(tone, colors) }]}>
      <Text style={[s.valueText, { color: getToneTextColor(tone, colors) }]}>{value}</Text>
    </View>
  );
}

function getProtectionDetailsSublabel(protection: ReturnType<typeof useProtectionState>) {
  const dnsOn = protection.adultFilteringEnabled || protection.privateDnsStatus.mode === 'hostname' || protection.vpnActive;
  const safeSearchOn = Object.values(protection.safeSearchSettings).every(Boolean);
  const appBlockingOn =
    Object.values(protection.riskySettings).every(Boolean) ||
    Object.values(protection.behaviorPolicy.featureBlocks).some(Boolean);

  if (dnsOn && safeSearchOn && appBlockingOn) {
    return 'DNS · SafeSearch · App blocking — all active';
  }
  if (!dnsOn && !safeSearchOn && !appBlockingOn) {
    return 'All filtering disabled';
  }

  return [
    `DNS ${dnsOn ? 'on' : 'off'}`,
    `SafeSearch ${safeSearchOn ? 'on' : 'off'}`,
    `App blocking ${appBlockingOn ? 'on' : 'off'}`,
  ].join(' · ');
}

function getFocusSublabel(protection: ReturnType<typeof useProtectionState>) {
  const activeSchedule = protection.focusPolicy.schedules.find((schedule) => schedule.enabled);
  const appLimitCount = Object.values(protection.usageLimitPolicy.appLimits).filter((limit) => limit > 0).length;

  if (!activeSchedule && appLimitCount === 0) return 'No schedule active';
  if (activeSchedule && appLimitCount > 0) return `Bedtime lock on · ${appLimitCount} app limits set`;
  if (activeSchedule) return `Bedtime lock on · ${minutesToTime(activeSchedule.startMinutes)} - ${minutesToTime(activeSchedule.endMinutes)}`;
  return `${appLimitCount} app limits set`;
}

function getGuardianSublabel(session: ReturnType<typeof useRemoteManagement>['session'], pinConfigured: boolean) {
  if (!pinConfigured) return 'PIN not set — tap to create';
  if (!session.paired) return 'PIN set · no guardian paired';
  return 'PIN set · Guardian paired';
}

function getAlertSublabel(unreadCount: number, warningCount: number, criticalCount: number) {
  if (criticalCount > 0) return `${criticalCount} critical alert${criticalCount === 1 ? '' : 's'}`;
  if (warningCount > 0) return `${warningCount} warning${warningCount === 1 ? '' : 's'}`;
  if (unreadCount > 0) return `${unreadCount} unread`;
  return 'No unread alerts';
}

function getThemeSublabel(mode: 'light' | 'dark' | 'system', isDark: boolean) {
  if (mode === 'light') return 'Light';
  if (mode === 'dark') return 'Dark';
  return `System (${isDark ? 'Dark' : 'Light'})`;
}

function getIconToneStyle(tone: IconTone, isDark: boolean) {
  const tones: Record<IconTone, { bg: string; fg: string }> = {
    shield: { bg: isDark ? 'rgba(39,160,106,0.18)' : 'rgba(39,160,106,0.12)', fg: '#27A06A' },
    details: { bg: isDark ? 'rgba(15,110,86,0.2)' : '#E1F5EE', fg: '#0F6E56' },
    focus: { bg: isDark ? 'rgba(217,164,65,0.18)' : '#FFF1D6', fg: '#B7791F' },
    guardian: { bg: isDark ? 'rgba(160,138,184,0.2)' : '#F1EAF8', fg: '#7C5EA3' },
    alerts: { bg: isDark ? 'rgba(45,212,191,0.16)' : '#E4F8F5', fg: '#20897F' },
    appearance: { bg: isDark ? 'rgba(139,148,158,0.16)' : '#EEF1F0', fg: '#6C7671' },
  };
  return tones[tone];
}

function getToneBackgroundColor(tone: RowTone, colors: ReturnType<typeof useTheme>['colors']) {
  if (tone === 'success') return colors.green[50];
  if (tone === 'warning') return colors.amber[50];
  if (tone === 'danger') return colors.red[50];
  return colors.bg.tertiary;
}

function getToneTextColor(tone: RowTone, colors: ReturnType<typeof useTheme>['colors']) {
  if (tone === 'success') return colors.green[600];
  if (tone === 'warning') return colors.amber[700];
  if (tone === 'danger') return colors.red[500];
  return colors.text.secondary;
}

function minutesToTime(value: number) {
  const minutes = Math.min(1439, Math.max(0, Math.round(value)));
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatProtectionSince(startedAt: number | null) {
  if (!startedAt) return 'now';
  const minutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  if (minutes < 60) return minutes < 1 ? 'now' : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const s = StyleSheet.create({
  bannerAction: {
    ...typography.captionMd,
  },
  bannerCopy: {
    ...typography.caption,
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    ...typography.bodyMd,
  },
  iconTile: {
    alignItems: 'center',
    borderRadius: 7,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  list: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pinBanner: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowCompact: {
    minHeight: 48,
  },
  rowLabel: {
    ...typography.bodyMd,
  },
  rowSublabel: {
    ...typography.caption,
    lineHeight: 17,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  section: {
    gap: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 0,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  valueChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  valueText: {
    ...typography.captionMd,
  },

  // About modal
  aboutBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  aboutSheet: {
    alignItems: 'center',
    borderRadius: radius.lg,
    gap: spacing.md,
    maxWidth: 360,
    padding: spacing.xl,
    width: '100%',
  },
  aboutIconRow: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  aboutIcon: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  aboutVersion: {
    ...typography.caption,
    textAlign: 'center',
  },
  aboutBody: {
    ...typography.body,
    lineHeight: 20,
    textAlign: 'center',
  },
  aboutDivider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
  aboutLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  aboutCloseBtn: {
    alignItems: 'center',
    borderRadius: radius.md,
    marginTop: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
    width: '100%',
  },
  aboutCloseBtnText: {
    ...typography.bodyMd,
  },
});
