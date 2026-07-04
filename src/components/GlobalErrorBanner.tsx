import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProtection } from '@/store/ProtectionContext';
import { radius, spacing, useTheme } from '@/theme';

const AUTO_DISMISS_MS = 6000;

// Single global surface for protection-store errors. Screens no longer render
// protection.error themselves; any failed action surfaces here, on every screen.
export function GlobalErrorBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { error, dismissError } = useProtection();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!error) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(dismissError, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [error, dismissError, opacity]);

  if (!error) return null;

  return (
    <Animated.View pointerEvents="box-none" style={[s.wrap, { top: insets.top + spacing.sm, opacity }]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityHint="Tap to dismiss"
        onPress={dismissError}
        style={[s.banner, { backgroundColor: colors.red[500] }]}
      >
        <Text style={s.text}>{error}</Text>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
    zIndex: 1000,
  },
  banner: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
