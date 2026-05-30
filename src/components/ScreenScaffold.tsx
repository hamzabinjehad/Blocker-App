import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { RefreshControlProps } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useRef } from 'react';

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
  collapsibleTitle?: boolean;
}>;

export function ScreenScaffold({
  title,
  subtitle,
  iconName,
  headerRight,
  floatingContent,
  refreshControl,
  contentContainerStyle,
  collapsibleTitle = false,
  children,
}: ScreenScaffoldProps) {
  const { colors, isDark } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const collapsedTitleOpacity = collapsibleTitle
    ? scrollY.interpolate({
        inputRange: [24, 44],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      })
    : 0;
  const subtitleOpacity = collapsibleTitle
    ? scrollY.interpolate({
        inputRange: [0, 36],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      })
    : 1;

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg.primary }]}>
      <StatusBar backgroundColor={colors.bg.primary} style={isDark ? 'light' : 'dark'} />
      {floatingContent}
      {collapsibleTitle ? (
        <Animated.View
          pointerEvents="none"
          style={[
            s.collapsedHeader,
            {
              backgroundColor: colors.bg.primary,
              borderBottomColor: colors.border.subtle,
              opacity: collapsedTitleOpacity,
            },
          ]}
        >
          <View style={s.collapsedHeaderInner}>
            <Text selectable style={[s.collapsedTitle, { color: colors.text.primary }]}>
              {title}
            </Text>
          </View>
        </Animated.View>
      ) : null}
      <Animated.ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[s.content, contentContainerStyle]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        onScroll={
          collapsibleTitle
            ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })
            : undefined
        }
        scrollEventThrottle={16}
      >
        <View style={s.header}>
          <View style={[s.headerRow, s.contentWidth]}>
            {iconName ? (
              <View
                style={[
                  s.iconTile,
                  {
                    backgroundColor: colors.bg.tertiary,
                  },
                ]}
              >
                <AppIcon color={colors.text.secondary} name={iconName} size={20} />
              </View>
            ) : null}
            <View style={s.titleGroup}>
              <Text selectable style={[s.title, { color: colors.text.primary }]}>
                {title}
              </Text>
              {subtitle ? (
                <Animated.Text selectable style={[s.subtitle, { color: colors.text.secondary, opacity: subtitleOpacity }]}>
                  {subtitle}
                </Animated.Text>
              ) : null}
            </View>
            {headerRight}
          </View>
        </View>
        <View style={[s.body, s.contentWidth]}>
          {children}
        </View>
        <View style={s.bottomSpace} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  bottomSpace: {
    height: 96,
  },
  body: {
    gap: spacing.lg,
    paddingHorizontal: 20,
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
  collapsedHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 20,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  collapsedHeaderInner: {
    alignSelf: 'center',
    maxWidth: 760,
    width: '100%',
  },
  collapsedTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  safeArea: {
    flex: 1,
  },
  subtitle: {
    ...typography.body,
    lineHeight: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 25,
  },
  titleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
});
