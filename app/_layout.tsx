import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { PaperProvider } from 'react-native-paper';

import { OnboardingFlow } from '@/components/OnboardingFlow';
import { ThemeProvider, useTheme } from '@/theme';
import { buildPaperTheme } from '@/theme';
import { radius } from '@/theme';
import { useOnboarding } from '@/store/useOnboarding';

type TabFeatherIconName = ComponentProps<typeof Feather>['name'];

const tabIcons: Record<string, TabFeatherIconName> = {
  index: 'shield',
  progress: 'bar-chart-2',
  coach: 'activity',
  admin: 'settings',
};

function TabIcon({ name, color, focused }: { name: TabFeatherIconName; color: string; focused: boolean }) {
  return (
    <View style={styles.tabIconWrap}>
      <Feather name={name} size={21} color={color} />
    </View>
  );
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const onboarding = useOnboarding();
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
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.green[500],
          tabBarInactiveTintColor: colors.text.muted,
          tabBarShowLabel: true,
          tabBarLabel: ({ focused, color, children }) =>
            focused ? (
              <Text style={[styles.tabLabel, { color }]}>{children}</Text>
            ) : null,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginBottom: 5,
            letterSpacing: 0,
          },
          tabBarItemStyle: { paddingTop: 5 },
          tabBarStyle: {
            backgroundColor: colors.bg.elevated,
            borderTopColor: colors.border.subtle,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
            elevation: 0,
            shadowColor: 'transparent',
            shadowOpacity: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => <TabIcon name={tabIcons.index} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, focused }) => <TabIcon name={tabIcons.progress} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="coach"
          options={{
            title: 'Coach',
            tabBarIcon: ({ color, focused }) => <TabIcon name={tabIcons.coach} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => <TabIcon name={tabIcons.admin} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen name="rules" options={{ href: null }} />
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
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0,
    marginBottom: 5,
  },
});
