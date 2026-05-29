import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppIcon } from '@/components/AppIcon';
import { useTheme } from '@/theme';
import { radius, shadow, spacing, typography } from '@/theme';
import { useProtectionState } from '@/store/useProtectionState';

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
  const protection = useProtectionState();
  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const heroScale = useRef(new Animated.Value(0.8)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;

  const totalSteps = 3;

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

  const permissions: PermissionItem[] = [
    {
      key: 'vpn',
      title: 'VPN Connection',
      description: 'Filters web traffic to block harmful content',
      icon: 'shield-check',
      ready: protection.vpnPermissionGranted,
      onPress: protection.prepareVpn,
    },
    {
      key: 'accessibility',
      title: 'Accessibility Service',
      description: 'Monitors on-screen content for protection',
      icon: 'eye-check',
      ready: protection.accessibilityServiceEnabled,
      onPress: protection.openAccessibilitySettings,
    },
    {
      key: 'overlay',
      title: 'Overlay Permissions',
      description: 'Shows block screen when harmful content is detected',
      icon: 'layers',
      ready: protection.overlayPermissionGranted,
      onPress: protection.openOverlaySettings,
    },
    {
      key: 'usage',
      title: 'Usage Monitoring',
      description: 'Tracks app usage for focus mode and limits',
      icon: 'chart-bar',
      ready: protection.usageAccessStatus.granted,
      onPress: protection.openUsageAccessSettings,
    },
    {
      key: 'battery',
      title: 'Background Activity',
      description: 'Keeps protection running in the background',
      icon: 'battery-charging',
      ready: protection.batteryOptimizationStatus.ignored,
      onPress: protection.requestIgnoreBatteryOptimizations,
    },
    {
      key: 'device-admin',
      title: 'Device Admin',
      description: 'Prevents unauthorized uninstallation',
      icon: 'shield-lock',
      ready: protection.managedDeviceStatus.deviceAdminActive,
      onPress: protection.requestDeviceAdminPermission,
      optional: true,
    },
  ];

  const readyCount = permissions.filter((p) => p.ready).length;
  const requiredReady = permissions.filter((p) => !p.optional && p.ready).length;
  const requiredTotal = permissions.filter((p) => !p.optional).length;
  const canProceed = requiredReady >= requiredTotal - 1;

  const renderWelcome = () => (
    <View style={s.stepContent}>
      <Animated.View style={[s.heroContainer, { transform: [{ scale: heroScale }], opacity: heroOpacity }]}>
        <View
          style={[
            s.heroIconWrap,
            {
              backgroundColor: isDark ? colors.green[50] : colors.green[50],
              borderColor: colors.border.subtle,
            },
          ]}
        >
          <AppIcon name="shield" size={52} color={colors.green[500]} />
        </View>
      </Animated.View>

      <Text style={[s.welcomeTitle, { color: colors.text.primary }]}>Welcome to Guardian</Text>
      <Text style={[s.welcomeSubtitle, { color: colors.text.secondary }]}>
        Set up the protection basics, then start filtering with one tap.
      </Text>

      <View style={s.themeSelector}>
        <Text style={[s.themeSelectorLabel, { color: colors.text.muted }]}>APPEARANCE</Text>
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
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  const renderPermissions = () => (
    <View style={s.stepContent}>
      <Text style={[s.stepTitle, { color: colors.text.primary }]}>Enable Permissions</Text>
      <Text style={[s.stepSubtitle, { color: colors.text.secondary }]}>
        Enable the required permissions. Device admin can be added later from Admin.
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
        {requiredReady} of {requiredTotal} required ready
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
                  <Text style={{ color: colors.text.muted }}> (optional)</Text>
                ) : null}
              </Text>
              <Text style={[s.permissionDesc, { color: colors.text.secondary }]}>
                {perm.description}
              </Text>
            </View>
            {!perm.ready && (
              <View style={[s.enableBadge, { backgroundColor: colors.green[500] }]}>
                <Text style={[s.enableBadgeText, { color: '#FFFFFF' }]}>Enable</Text>
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
        <View style={[s.completeCircle, { backgroundColor: isDark ? colors.green[50] : colors.green[50] }]}>
          <MaterialCommunityIcons name="shield-check" size={72} color={colors.green[500]} />
        </View>
      </Animated.View>

      <Text style={[s.welcomeTitle, { color: colors.text.primary }]}>You're All Set!</Text>
      <Text style={[s.welcomeSubtitle, { color: colors.text.secondary }]}>
        Guardian is ready. Start protection when you land on Home.
      </Text>

      <View style={s.featureList}>
        {[
          { icon: 'shield-check', label: 'Content filtering active' },
          { icon: 'chart-timeline-variant-shimmer', label: 'Progress tracking ready' },
          { icon: 'target', label: 'Focus mode available' },
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

  const steps = [renderWelcome, renderPermissions, renderComplete];

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
          <Pressable onPress={() => animateToStep(step - 1)} style={s.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text.secondary} />
            <Text style={[s.backText, { color: colors.text.secondary }]}>Back</Text>
          </Pressable>
        ) : (
          <View style={s.backBtn} />
        )}

        {step < totalSteps - 1 ? (
          <Pressable
            onPress={() => animateToStep(step + 1)}
            disabled={step === 1 && !canProceed}
            style={({ pressed }) => [
              s.nextBtn,
              { backgroundColor: colors.green[500] },
              pressed && { opacity: 0.9 },
              step === 1 && !canProceed && { opacity: 0.4 },
            ]}
          >
            <Text style={s.nextText}>{step === 0 ? 'Set up' : 'Continue'}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable
            onPress={onComplete}
            style={({ pressed }) => [
              s.nextBtn,
              { backgroundColor: colors.green[500] },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={s.nextText}>Go to Home</Text>
            <MaterialCommunityIcons name="shield-check" size={20} color="#FFFFFF" />
          </Pressable>
        )}
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
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    height: 104,
    justifyContent: 'center',
    width: 104,
  },
  completeCircle: {
    alignItems: 'center',
    borderRadius: 70,
    height: 140,
    justifyContent: 'center',
    width: 140,
  },
  welcomeTitle: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  welcomeSubtitle: {
    ...typography.body,
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
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    ...typography.body,
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
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  backBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minWidth: 80,
  },
  backText: {
    ...typography.bodyMd,
  },
  nextBtn: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  nextText: {
    ...typography.bodyMd,
    color: '#FFFFFF',
    fontSize: 15,
  },
});
