import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RefreshControlProps } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import type { AppIconName } from '@/components/AppIcon';
import { useTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme';

type ScreenScaffoldProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  iconName?: AppIconName;
  headerRight?: ReactNode;
  floatingContent?: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}>;

export function ScreenScaffold({
  title,
  subtitle,
  iconName,
  headerRight,
  floatingContent,
  refreshControl,
  contentContainerStyle,
  children,
}: ScreenScaffoldProps) {
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg.primary }]}>
      <StatusBar backgroundColor={colors.bg.primary} style={isDark ? 'light' : 'dark'} />
      {floatingContent}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[s.content, contentContainerStyle]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.header, { borderBottomColor: colors.border.subtle }]}>
          <View style={[s.headerRow, s.contentWidth]}>
            {iconName ? (
              <View
                style={[
                  s.iconTile,
                  {
                    backgroundColor: colors.green[50],
                    borderColor: colors.border.green,
                  },
                ]}
              >
                <AppIcon color={colors.green[500]} name={iconName} size={21} />
              </View>
            ) : null}
            <View style={s.titleGroup}>
              <Text selectable style={[s.title, { color: colors.text.primary }]}>
                {title}
              </Text>
              {subtitle ? (
                <Text selectable style={[s.subtitle, { color: colors.text.secondary }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {headerRight}
          </View>
        </View>
        <View style={[s.body, s.contentWidth]}>
          {children}
        </View>
        <View style={s.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  bottomSpace: {
    height: 96,
  },
  body: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  content: {
    paddingTop: 0,
  },
  contentWidth: {
    alignSelf: 'center',
    maxWidth: 760,
    width: '100%',
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  iconTile: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  safeArea: {
    flex: 1,
  },
  subtitle: {
    ...typography.body,
    lineHeight: 20,
  },
  title: {
    ...typography.h2,
  },
  titleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
});
