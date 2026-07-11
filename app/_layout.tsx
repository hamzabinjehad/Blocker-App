import { type ComponentProps, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PaperProvider } from 'react-native-paper';

import { OnboardingFlow } from '@/components/OnboardingFlow';
import { GlobalErrorBanner } from '@/components/GlobalErrorBanner';
import { GlobalSuccessSnackbar } from '@/components/GlobalSuccessSnackbar';
import { I18nProvider, useTranslation } from '@/i18n';
import { ProtectionProvider } from '@/store/ProtectionContext';
import { ScheduleProfilesProvider } from '@/store/ScheduleProfilesContext';
import { ThemeProvider, useTheme } from '@/theme';
import { buildPaperTheme } from '@/theme';
import { radius } from '@/theme';
import { useOnboarding } from '@/store/useOnboarding';

type TabFeatherIconName = ComponentProps<typeof Feather>['name'];

const tabIcons: Record<string, TabFeatherIconName> = {
  index: 'shield',
  rules: 'sliders',
  progress: 'bar-chart-2',
  coach: 'activity',
  admin: 'settings',
};

function TabIcon({ name, color, focused }: { name: TabFeatherIconName; color: string; focused: boolean }) {
  const { colors } = useTheme();
  const focus = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    focus.value = withSpring(focused ? 1 : 0, { damping: 14, mass: 0.7, stiffness: 220 });
  }, [focus, focused]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scale: interpolate(focus.value, [0, 1], [0.6, 1]) }],
  }));

  return (
    <View style={styles.tabIconWrap}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.tabIconPill, { backgroundColor: colors.green[50] }, pillStyle]}
      />
      <Feather name={name} size={focused ? 22 : 21} color={color} />
    </View>
  );
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const onboarding = useOnboarding();
  const t = useTranslation();
  const paperTheme = buildPaperTheme(colors, isDark);

  if (onboarding.completed === null) return null;

  if (!onboarding.completed) {
    return (
      <PaperProvider theme={paperTheme}>
        <OnboardingFlow onComplete={onboarding.complete} />
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={paperTheme}>
      <GlobalErrorBanner />
      <GlobalSuccessSnackbar />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.green[500],
          tabBarInactiveTintColor: colors.text.muted,
          tabBarShowLabel: true,
          tabBarLabel: ({ color, children }) => (
            <Text maxFontSizeMultiplier={1.3} style={[styles.tabLabel, { color }]}>{children}</Text>
          ),
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '500',
            marginBottom: 4,
            letterSpacing: 0,
          },
          tabBarItemStyle: { paddingTop: 4 },
          tabBarStyle: {
            backgroundColor: colors.bg.elevated,
            borderTopColor: colors.border.subtle,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 60,
            paddingBottom: 6,
            paddingTop: 6,
            elevation: 0,
            shadowColor: 'transparent',
            shadowOpacity: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tab.home'),
            tabBarIcon: ({ color, focused }) => <TabIcon name={tabIcons.index} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="rules"
          options={{
            title: t('tab.control'),
            tabBarIcon: ({ color, focused }) => <TabIcon name={tabIcons.rules} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: t('tab.progress'),
            tabBarIcon: ({ color, focused }) => <TabIcon name={tabIcons.progress} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="coach"
          options={{
            title: t('tab.coach'),
            tabBarIcon: ({ color, focused }) => <TabIcon name={tabIcons.coach} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: t('tab.settings'),
            tabBarIcon: ({ color, focused }) => <TabIcon name={tabIcons.admin} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen name="focus" options={{ href: null }} />
        <Tabs.Screen name="appearance" options={{ href: null }} />
        <Tabs.Screen name="guardian" options={{ href: null }} />
        <Tabs.Screen name="alerts" options={{ href: null }} />
      </Tabs>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <I18nProvider>
          <ProtectionProvider>
            <ScheduleProfilesProvider>
              <AppContent />
            </ScheduleProfilesProvider>
          </ProtectionProvider>
        </I18nProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabIconWrap: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  tabIconPill: {
    borderRadius: radius.full,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0,
    marginBottom: 5,
  },
});
