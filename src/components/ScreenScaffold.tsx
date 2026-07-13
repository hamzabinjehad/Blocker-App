import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RefreshControlProps } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useRef } from 'react';

import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import type { AppIconName } from '@/components/AppIcon';
import { Chevron } from '@/components/Chevron';
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
  showBack?: boolean;
  backLabel?: string;
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
  showBack = false,
  backLabel = 'Back',
  children,
}: ScreenScaffoldProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
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
          <LinearGradient
            colors={[colors.gradient.headerStart, colors.gradient.headerMid, colors.gradient.headerEnd]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <View style={[s.headerRow, s.contentWidth]}>
            {showBack ? (
              <Pressable
                accessibilityLabel={backLabel}
                accessibilityRole="button"
                hitSlop={6}
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/');
                }}
                style={({ pressed }) => [
                  s.backButton,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: colors.border.subtle,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Chevron color={colors.text.primary} direction="back" size={22} />
              </Pressable>
            ) : iconName ? (
              <View
                style={[
                  s.iconTile,
                  {
                    backgroundColor: colors.green[50],
                    borderColor: colors.border.green,
                  },
                ]}
              >
                <AppIcon color={colors.green[600]} name={iconName} size={21} />
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
    gap: spacing.xl,
    paddingHorizontal: 20,
    paddingTop: spacing.xl,
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
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
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
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  safeArea: {
    flex: 1,
  },
  subtitle: {
    ...typography.body,
    lineHeight: 21,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  titleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
});
