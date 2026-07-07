import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppIcon } from '@/components/AppIcon';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { radius, shadow, spacing, typography } from '@/theme';
import { useProtection } from '@/store/ProtectionContext';

type OnboardingFlowProps = {
  onComplete: () => void;
};

type PermissionItem = {
  key: string;
  title: string;
  description: string;
  icon: string;
  ready: boolean;
  onPress: () => Promise<void>;
  optional?: boolean;
};

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { colors, isDark, mode, setMode } = useTheme();
  const { t } = useI18n();
  const protection = useProtection();
  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const heroScale = useRef(new Animated.Value(0.8)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;

  const totalSteps = 5;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(heroScale, { toValue: 1, useNativeDriver: true, tension: 40, friction: 7 }),
      Animated.timing(heroOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [heroScale, heroOpacity]);

  const animateToStep = useCallback(
    (next: number) => {
      const direction = next > step ? 1 : -1;
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setStep(next);
        slideAnim.setValue(direction * 40);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [step, fadeAnim, slideAnim],
  );

  // Only the two permissions protection cannot start without. Everything else
  // moved to contextual prompts: Usage → Focus screen, Overlay → App Rules,
  // Battery → Home (after the first protected day), Device Admin → Guardian.
  const permissions: PermissionItem[] = [
    {
      key: 'vpn',
      title: t('onboarding.permVpnTitle'),
      description: t('onboarding.permVpnDesc'),
      icon: 'shield-check',
      ready: protection.vpnPermissionGranted,
      onPress: protection.prepareVpn,
    },
    {
      key: 'accessibility',
      title: t('onboarding.permAccessibilityTitle'),
      description: t('onboarding.permAccessibilityDesc'),
      icon: 'eye-check',
      ready: protection.accessibilityServiceEnabled,
      onPress: protection.openAccessibilitySettings,
    },
  ];

  const readyCount = permissions.filter((p) => p.ready).length;
  const requiredReady = permissions.filter((p) => !p.optional && p.ready).length;
  const requiredTotal = permissions.filter((p) => !p.optional).length;
  // Both critical permissions (VPN + Accessibility) must be granted — no silent skip.
  // The rest are optional here and surface as contextual prompts later.
  const canProceed = requiredReady >= requiredTotal;

  const renderWelcome = () => (
    <View style={[s.stepContent, { alignItems: 'center' }]}>
      <Animated.View style={[s.heroContainer, { transform: [{ scale: heroScale }], opacity: heroOpacity }]}>
        <View style={[s.heroIconWrap, { backgroundColor: colors.green[500] }]}>
          <AppIcon name="shield" size={64} color="#FFFFFF" />
        </View>
      </Animated.View>

      <Text style={[s.welcomeTitle, { color: colors.text.primary }]}>{t('onboarding.welcomeTitle')}</Text>
      <Text style={[s.welcomeSubtitle, { color: colors.text.secondary }]}>
        {t('onboarding.welcomeSubtitle')}
      </Text>

      <View style={s.themeSelector}>
        <Text style={[s.themeSelectorLabel, { color: colors.text.muted }]}>{t('onboarding.appearance')}</Text>
        <View style={[s.themeOptions, { backgroundColor: colors.bg.tertiary }]}>
          {(['light', 'dark', 'system'] as const).map((opt) => (
            <Pressable
              key={opt}
              onPress={() => setMode(opt)}
              style={[
                s.themeOption,
                mode === opt && { backgroundColor: colors.bg.elevated },
                mode === opt && shadow.sm,
              ]}
            >
              <MaterialCommunityIcons
                name={opt === 'light' ? 'white-balance-sunny' : opt === 'dark' ? 'moon-waning-crescent' : 'cellphone'}
                size={18}
                color={mode === opt ? colors.green[500] : colors.text.muted}
              />
              <Text style={[s.themeOptionText, { color: mode === opt ? colors.text.primary : colors.text.muted }]}>
                {t(`theme.${opt}` as TranslationKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  const renderPermissions = () => (
    <View style={s.stepContent}>
      <Text style={[s.stepTitle, { color: colors.text.primary }]}>{t('onboarding.enablePermissions')}</Text>
      <Text style={[s.stepSubtitle, { color: colors.text.secondary }]}>
        {t('onboarding.enablePermissionsSub')}
      </Text>

      <View style={[s.progressBar, { backgroundColor: colors.bg.tertiary }]}>
        <View
          style={[
            s.progressFill,
            {
              backgroundColor: colors.green[500],
              width: `${(readyCount / permissions.length) * 100}%`,
            },
          ]}
        />
      </View>
      <Text style={[s.progressText, { color: colors.text.muted }]}>
        {t('onboarding.requiredReady', { ready: requiredReady, total: requiredTotal })}
      </Text>

      <View style={s.permissionList}>
        {permissions.map((perm) => (
          <Pressable
            key={perm.key}
            disabled={perm.ready}
            onPress={() => void perm.onPress()}
            style={({ pressed }) => [
              s.permissionRow,
              {
                backgroundColor: perm.ready
                  ? isDark ? colors.green[50] : colors.green[50]
                  : colors.bg.elevated,
                borderColor: perm.ready ? colors.border.green : colors.border.subtle,
              },
              pressed && !perm.ready && { backgroundColor: colors.bg.tertiary },
            ]}
          >
            <View
              style={[
                s.permissionIcon,
                {
                  backgroundColor: perm.ready
                    ? isDark ? colors.green[100] : colors.green[50]
                    : colors.bg.tertiary,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={perm.ready ? 'check-circle' : (perm.icon as any)}
                size={22}
                color={perm.ready ? colors.green[500] : colors.text.muted}
              />
            </View>
            <View style={s.permissionText}>
              <Text style={[s.permissionTitle, { color: colors.text.primary }]}>
                {perm.title}
                {perm.optional ? (
                  <Text style={{ color: colors.text.muted }}> ({t('onboarding.optional')})</Text>
                ) : null}
              </Text>
              <Text style={[s.permissionDesc, { color: colors.text.secondary }]}>
                {perm.description}
              </Text>
            </View>
            {!perm.ready && (
              <View style={[s.enableBadge, { backgroundColor: colors.green[500] }]}>
                <Text style={[s.enableBadgeText, { color: '#FFFFFF' }]}>{t('onboarding.enable')}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderComplete = () => (
    <View style={[s.stepContent, s.stepContentCenter]}>
      <Animated.View
        style={[s.heroContainer, { transform: [{ scale: heroScale }], opacity: heroOpacity }]}
      >
        <View style={[s.completeCircle, { backgroundColor: colors.green[500] }]}>
          <MaterialCommunityIcons name="shield-check" size={72} color="#FFFFFF" />
        </View>
      </Animated.View>

      <Text style={[s.welcomeTitle, { color: colors.text.primary }]}>{t('onboarding.allSet')}</Text>
      <Text style={[s.welcomeSubtitle, { color: colors.text.secondary }]}>
        {t('onboarding.allSetSub')}
      </Text>

      <View style={s.featureList}>
        {[
          { icon: 'shield-check', label: t('onboarding.featureFiltering') },
          { icon: 'chart-timeline-variant-shimmer', label: t('onboarding.featureProgress') },
          { icon: 'target', label: t('onboarding.featureFocus') },
        ].map((feat) => (
          <View key={feat.label} style={s.featureRow}>
            <MaterialCommunityIcons
              name={feat.icon as any}
              size={20}
              color={colors.green[500]}
            />
            <Text style={[s.featureLabel, { color: colors.text.primary }]}>{feat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderFeature1 = () => (
    <View style={s.featureSlide}>
      <View style={s.phoneMockWrap}>
        <View style={s.phoneShell}>
          <View style={s.phoneSpeakerRow}>
            <View style={s.phoneSpeaker} />
          </View>
          <View style={[s.phoneScreen, { backgroundColor: colors.bg.primary }]}>
            <View style={[s.mockCard, { backgroundColor: colors.green[500] }]}>
              <Text style={s.mockProtectedLabel}>● PROTECTED</Text>
              <View style={s.mockHeroMidRow}>
                <Text style={s.mockHeroSub}>VPN · DNS filter active</Text>
                <View>
                  <Text style={s.mockBlocksNum}>47</Text>
                  <Text style={s.mockBlocksLabel}>blocks</Text>
                </View>
              </View>
              <View style={[s.mockStatsRow, { borderTopColor: 'rgba(255,255,255,0.15)' }]}>
                {[['12', 'streak'], ['3h 20m', 'clean'], ['Lv 3', 'Steady']].map(([val, label], i) => (
                  <View key={i} style={s.mockStat}>
                    <Text style={s.mockStatVal}>{val}</Text>
                    <Text style={s.mockStatLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[s.mockMoodCard, { backgroundColor: colors.bg.elevated, borderLeftColor: colors.green[500] }]}>
              <Text style={[s.mockSmallLabel, { color: colors.text.muted }]}>How are you feeling?</Text>
              <Text style={s.mockEmojiRow}>😊  😌  😐  😔  😤</Text>
            </View>
            <View style={s.mockQARow}>
              {['Rules', 'Focus', 'Guardian', 'Alerts'].map((label) => (
                <View key={label} style={[s.mockQABtn, { backgroundColor: colors.bg.elevated }]}>
                  <View style={[s.mockQAIcon, { backgroundColor: colors.bg.tertiary }]} />
                  <Text style={[s.mockQALabel, { color: colors.text.secondary }]}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
      <View style={s.featureCaption}>
        <Text style={[s.featureTitle, { color: colors.text.primary }]}>{t('onboarding.feature1Title')}</Text>
        <Text style={[s.featureSub, { color: colors.text.secondary }]}>
          {t('onboarding.feature1Sub')}
        </Text>
      </View>
    </View>
  );

  const renderFeature2 = () => (
    <View style={s.featureSlide}>
      <View style={s.phoneMockWrap}>
        <View style={s.phoneShell}>
          <View style={s.phoneSpeakerRow}>
            <View style={s.phoneSpeaker} />
          </View>
          <View style={[s.phoneScreen, { backgroundColor: colors.bg.primary }]}>
            <View style={[s.mockCard, { backgroundColor: colors.bg.elevated }]}>
              <Text style={[s.mockSmallLabel, { color: colors.text.muted, letterSpacing: 0.5 }]}>90-DAY JOURNEY</Text>
              <Text style={[s.mockJourneyPct, { color: colors.text.primary }]}>62%</Text>
              <View style={[s.mockProgressTrack, { backgroundColor: colors.bg.tertiary }]}>
                <View style={[s.mockProgressFill, { backgroundColor: colors.green[500], width: '62%' }]} />
              </View>
              <Text style={[s.mockSmallLabel, { color: colors.text.muted }]}>Day 56 of 90 · 34 days remaining</Text>
            </View>
            <View style={s.mockWeekRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <View key={i} style={s.mockDayCol}>
                  <View style={[s.mockDayDot, { backgroundColor: i < 5 ? colors.green[500] : colors.bg.tertiary }]} />
                  <Text style={[s.mockSmallLabel, { color: colors.text.muted }]}>{d}</Text>
                </View>
              ))}
            </View>
            <View style={[s.mockCard, { backgroundColor: colors.bg.elevated, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <View style={[s.mockLevelBadge, { backgroundColor: colors.green[50] }]}>
                <Text style={[s.mockLevelNum, { color: colors.green[600] }]}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.mockLevelName, { color: colors.text.primary }]}>Steady</Text>
                <View style={[s.mockProgressTrack, { backgroundColor: colors.bg.tertiary, marginTop: 3 }]}>
                  <View style={[s.mockProgressFill, { backgroundColor: colors.green[400], width: '70%' }]} />
                </View>
                <Text style={[s.mockSmallLabel, { color: colors.text.muted, marginTop: 2 }]}>420 / 600 XP</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      <View style={s.featureCaption}>
        <Text style={[s.featureTitle, { color: colors.text.primary }]}>{t('onboarding.feature2Title')}</Text>
        <Text style={[s.featureSub, { color: colors.text.secondary }]}>
          {t('onboarding.feature2Sub')}
        </Text>
      </View>
    </View>
  );

  const steps = [renderWelcome, renderFeature1, renderFeature2, renderPermissions, renderComplete];

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg.primary }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={s.indicators}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              {
                backgroundColor: i <= step ? colors.green[500] : colors.bg.tertiary,
                width: i === step ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      <Animated.View
        style={[
          s.slideContainer,
          { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {steps[step]()}
      </Animated.View>

      <View style={s.footer}>
        {step > 0 ? (
          <Pressable onPress={() => animateToStep(step - 1)} style={s.backLink}>
            <Text style={[s.backLinkText, { color: colors.text.secondary }]}>{I18nManager.isRTL ? '→' : '←'} {t('onboarding.back')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={step < totalSteps - 1 ? () => animateToStep(step + 1) : onComplete}
          disabled={step === 3 && !canProceed}
          style={({ pressed }) => [
            s.primaryBtn,
            { backgroundColor: step === 3 && !canProceed ? colors.green[200] : colors.green[500] },
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={s.primaryBtnText}>
            {step === 0 ? t('onboarding.getStarted') : step < totalSteps - 1 ? t('onboarding.continue') : t('onboarding.letsGo')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  indicators: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dot: {
    borderRadius: 4,
    height: 8,
  },
  slideContainer: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  stepContentCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroIconWrap: {
    alignItems: 'center',
    borderRadius: 70,
    height: 140,
    justifyContent: 'center',
    width: 140,
  },
  completeCircle: {
    alignItems: 'center',
    borderRadius: 70,
    height: 140,
    justifyContent: 'center',
    width: 140,
  },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 42,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  themeSelector: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
    gap: spacing.sm,
  },
  themeSelectorLabel: {
    ...typography.label,
    letterSpacing: 1,
  },
  themeOptions: {
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  themeOption: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  themeOptionText: {
    ...typography.bodyMd,
    fontSize: 13,
  },
  stepTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 36,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  progressBar: {
    borderRadius: radius.full,
    height: 6,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    borderRadius: radius.full,
    height: '100%',
  },
  progressText: {
    ...typography.caption,
    marginBottom: spacing.lg,
  },
  permissionList: {
    gap: spacing.sm,
  },
  permissionRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  permissionIcon: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  permissionText: {
    flex: 1,
    gap: 2,
  },
  permissionTitle: {
    ...typography.bodyMd,
  },
  permissionDesc: {
    ...typography.caption,
  },
  enableBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  enableBadgeText: {
    ...typography.label,
  },
  featureList: {
    gap: spacing.lg,
    marginTop: spacing['2xl'],
    paddingHorizontal: spacing.xl,
  },
  featureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  featureLabel: {
    ...typography.bodyMd,
  },
  featureSlide: {
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  featureCaption: {
    gap: spacing.sm,
  },
  featureTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  featureSub: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  phoneMockWrap: {
    alignItems: 'center',
  },
  phoneShell: {
    backgroundColor: '#131313',
    borderRadius: 32,
    overflow: 'hidden',
    padding: 5,
    width: 210,
  },
  phoneSpeakerRow: {
    alignItems: 'center',
    paddingBottom: 5,
    paddingTop: 8,
  },
  phoneSpeaker: {
    backgroundColor: '#2A2A2A',
    borderRadius: 2,
    height: 4,
    width: 36,
  },
  phoneScreen: {
    borderRadius: 26,
    gap: 6,
    minHeight: 288,
    overflow: 'hidden',
    padding: 10,
  },
  mockCard: {
    borderRadius: 10,
    gap: 3,
    padding: 10,
  },
  mockProtectedLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mockHeroMidRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  mockHeroSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 7,
  },
  mockBlocksNum: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  mockBlocksLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 6,
    textAlign: 'right',
  },
  mockStatsRow: {
    borderTopWidth: 0.5,
    flexDirection: 'row',
    marginTop: 6,
    paddingTop: 6,
  },
  mockStat: {
    alignItems: 'center',
    flex: 1,
  },
  mockStatVal: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  mockStatLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 6,
  },
  mockMoodCard: {
    borderLeftWidth: 2,
    borderRadius: 8,
    gap: 3,
    padding: 8,
  },
  mockSmallLabel: {
    fontSize: 7,
    fontWeight: '400',
  },
  mockEmojiRow: {
    fontSize: 11,
    letterSpacing: 1,
  },
  mockQARow: {
    flexDirection: 'row',
    gap: 4,
  },
  mockQABtn: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    gap: 3,
    padding: 6,
  },
  mockQAIcon: {
    borderRadius: 5,
    height: 14,
    width: 14,
  },
  mockQALabel: {
    fontSize: 6,
    fontWeight: '500',
  },
  mockJourneyPct: {
    fontSize: 22,
    fontWeight: '800',
  },
  mockProgressTrack: {
    borderRadius: 3,
    height: 4,
    overflow: 'hidden',
  },
  mockProgressFill: {
    borderRadius: 3,
    height: '100%',
  },
  mockWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  mockDayCol: {
    alignItems: 'center',
    gap: 2,
  },
  mockDayDot: {
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  mockLevelBadge: {
    alignItems: 'center',
    borderRadius: 20,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  mockLevelNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  mockLevelName: {
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    width: '100%',
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  backLinkText: {
    ...typography.bodyMd,
  },
  primaryBtn: {
    alignItems: 'center',
    borderRadius: 28,
    justifyContent: 'center',
    minHeight: 58,
    width: '100%',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
