import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { Banner } from '@/components/Banner';
import { Chevron } from '@/components/Chevron';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useTranslation } from '@/i18n';
import { useAlertCenter } from '@/store/useAlertCenter';
import { useProtection } from '@/store/ProtectionContext';
import { useRemoteManagement } from '@/store/useRemoteManagement';
import { radius, spacing, typography, useTheme } from '@/theme';

type Translate = ReturnType<typeof useTranslation>;

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
  const t = useTranslation();
  const router = useRouter();
  const protection = useProtection();
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

  const protectionDetailsSublabel = useMemo(() => getProtectionDetailsSublabel(protection, t), [protection, t]);
  const focusSublabel = useMemo(() => getFocusSublabel(protection, t), [protection, t]);
  const guardianSublabel = getGuardianSublabel(remote.session, protection.pinConfigured, t);
  const alertSublabel = getAlertSublabel(alertCenter.unreadCount, warningUnread, criticalUnread, t);
  const alertTone: RowTone = criticalUnread > 0 ? 'danger' : warningUnread > 0 || alertCenter.unreadCount > 0 ? 'warning' : 'neutral';

  return (
    <ScreenScaffold
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      iconName="control"
      collapsibleTitle
    >
      {!protection.pinConfigured ? (
        <Banner
          icon="alert-triangle"
          iconSize={18}
          title={t('settings.pinNotSet')}
          subtitle={t('settings.pinNotSetCopy')}
          trailing={<Text style={[s.bannerAction, { color: colors.amber[900] }]}>{t('settings.setPinNow')}</Text>}
          onPress={() => router.push('/guardian')}
        />
      ) : null}

      <View style={s.section}>
        <Text style={[s.sectionHeader, { color: colors.text.muted }]}>{t('settings.sectionProtection')}</Text>
        <View style={[s.list, { borderColor: colors.border.subtle }]}>
          <SettingsRow
            icon="shield"
            iconTone="shield"
            label={t('settings.protection')}
            sublabel={isProtected ? t('settings.protectionActiveSince', { since: formatProtectionSince(sessionStartedAt, t) }) : t('settings.protectionOff')}
            value={isProtected ? t('settings.valueOn') : t('settings.valueOff')}
            valueTone={isProtected ? 'success' : 'neutral'}
          />
          <SettingsRow
            icon="sliders"
            iconTone="details"
            label={t('settings.protectionDetails')}
            sublabel={protectionDetailsSublabel}
            onPress={() => router.push('/rules')}
          />
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionHeader, { color: colors.text.muted }]}>{t('settings.sectionAccountability')}</Text>
        <View style={[s.list, { borderColor: colors.border.subtle }]}>
          <SettingsRow
            icon="user"
            iconTone="guardian"
            label={t('settings.guardian')}
            sublabel={guardianSublabel}
            sublabelTone={protection.pinConfigured ? 'neutral' : 'warning'}
            value={t('settings.private')}
            valueTone="neutral"
            onPress={() => router.push('/guardian')}
          />
          <SettingsRow
            icon="bell"
            iconTone="alerts"
            label={t('settings.alertCenter')}
            sublabel={alertSublabel}
            sublabelTone={alertTone}
            value={alertCenter.unreadCount > 0 ? t('settings.unreadValue', { count: alertCenter.unreadCount }) : undefined}
            valueTone={alertTone}
            onPress={() => router.push('/alerts')}
          />
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionHeader, { color: colors.text.muted }]}>{t('settings.sectionFocus')}</Text>
        <View style={[s.list, { borderColor: colors.border.subtle }]}>
          <SettingsRow
            icon="clock"
            iconTone="focus"
            label={t('settings.focusScreenTime')}
            sublabel={focusSublabel}
            onPress={() => router.push('/focus')}
          />
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionHeader, { color: colors.text.muted }]}>{t('settings.sectionApp')}</Text>
        <View style={[s.list, { borderColor: colors.border.subtle }]}>
          <SettingsRow
            icon="sun"
            iconTone="appearance"
            label={t('settings.appearanceRow')}
            sublabel={getThemeSublabel(mode, isDark, t)}
            onPress={() => router.push('/appearance')}
          />
          <SettingsRow icon="info" iconTone="appearance" label={t('settings.about')} value={`v${appVersion}`} valueTone="neutral" onPress={() => setAboutVisible(true)} />
        </View>
      </View>

      <AboutModal visible={aboutVisible} version={appVersion} onClose={() => setAboutVisible(false)} />
    </ScreenScaffold>
  );
}

function AboutModal({ visible, version, onClose }: { visible: boolean; version: string; onClose: () => void }) {
  const { colors } = useTheme();
  const t = useTranslation();
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={s.aboutBackdrop} onPress={onClose}>
        <Pressable style={[s.aboutSheet, { backgroundColor: colors.bg.elevated }]}>
          <View style={[s.aboutIconRow]}>
            <View style={[s.aboutIcon, { backgroundColor: colors.green[50] }]}>
              <Feather name="shield" size={28} color={colors.green[600]} />
            </View>
          </View>
          <Text style={[s.aboutTitle, { color: colors.text.primary }]}>{t('common.appName')}</Text>
          <Text style={[s.aboutVersion, { color: colors.text.muted }]}>{t('about.version', { version })}</Text>
          <Text style={[s.aboutBody, { color: colors.text.secondary }]}>
            {t('about.body')}
          </Text>
          <View style={[s.aboutDivider, { backgroundColor: colors.border.subtle }]} />
          <Text style={[s.aboutLabel, { color: colors.text.muted }]}>{t('about.dataPrivacy')}</Text>
          <Text style={[s.aboutBody, { color: colors.text.secondary }]}>
            {t('about.privacyBody')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[s.aboutCloseBtn, { backgroundColor: colors.green[500] }]}
          >
            <Text style={[s.aboutCloseBtnText, { color: colors.text.inverse }]}>{t('about.close')}</Text>
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
      {value ? <ValueChip value={value} tone={valueTone} /> : interactive ? <Chevron size={20} color={colors.text.muted} /> : null}
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

function getProtectionDetailsSublabel(protection: ReturnType<typeof useProtection>, t: Translate) {
  const dnsOn = protection.adultFilteringEnabled || protection.privateDnsStatus.mode === 'hostname' || protection.vpnActive;
  const safeSearchOn = Object.values(protection.safeSearchSettings).every(Boolean);
  const appBlockingOn =
    Object.values(protection.riskySettings).every(Boolean) ||
    Object.values(protection.behaviorPolicy.featureBlocks).some(Boolean);

  if (dnsOn && safeSearchOn && appBlockingOn) {
    return t('settings.detailsAllActive');
  }
  if (!dnsOn && !safeSearchOn && !appBlockingOn) {
    return t('settings.detailsAllDisabled');
  }

  return t('settings.detailsMixed', {
    dns: t(dnsOn ? 'common.on' : 'common.off'),
    safe: t(safeSearchOn ? 'common.on' : 'common.off'),
    apps: t(appBlockingOn ? 'common.on' : 'common.off'),
  });
}

function getFocusSublabel(protection: ReturnType<typeof useProtection>, t: Translate) {
  const activeSchedule = protection.focusPolicy.schedules.find((schedule) => schedule.enabled);
  const appLimitCount = Object.values(protection.usageLimitPolicy.appLimits).filter((limit) => limit > 0).length;

  if (!activeSchedule && appLimitCount === 0) return t('settings.focusNoSchedule');
  if (activeSchedule && appLimitCount > 0) return t('settings.focusBedtimeAndLimits', { count: appLimitCount });
  if (activeSchedule) return t('settings.focusBedtimeRange', { start: minutesToTime(activeSchedule.startMinutes), end: minutesToTime(activeSchedule.endMinutes) });
  return t('settings.focusLimits', { count: appLimitCount });
}

function getGuardianSublabel(session: ReturnType<typeof useRemoteManagement>['session'], pinConfigured: boolean, t: Translate) {
  if (!pinConfigured) return t('settings.guardianNoPin');
  if (!session.paired) return t('settings.guardianNoPair');
  return t('settings.guardianPaired');
}

function getAlertSublabel(unreadCount: number, warningCount: number, criticalCount: number, t: Translate) {
  if (criticalCount > 0) return t('settings.alertsCritical', { count: criticalCount });
  if (warningCount > 0) return t('settings.alertsWarning', { count: warningCount });
  if (unreadCount > 0) return t('settings.alertsUnread', { count: unreadCount });
  return t('settings.alertsNone');
}

function getThemeSublabel(mode: 'light' | 'dark' | 'system', isDark: boolean, t: Translate) {
  if (mode === 'light') return t('theme.light');
  if (mode === 'dark') return t('theme.dark');
  return t('settings.themeSystemResolved', { resolved: t(isDark ? 'theme.dark' : 'theme.light') });
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

function formatProtectionSince(startedAt: number | null, t: Translate) {
  if (!startedAt) return t('time.now');
  const minutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  if (minutes < 60) return minutes < 1 ? t('time.now') : t('time.minAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? t('time.hourAgo', { count: hours }) : t('time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t('time.dayAgo', { count: days }) : t('time.daysAgo', { count: days });
}

const s = StyleSheet.create({
  bannerAction: {
    ...typography.captionMd,
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
    fontSize: 11,
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
