import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { radius as radiusScale, useTheme } from '@/theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

// Simple pulsing placeholder for cards awaiting native-bridge data. Opacity-only
// pulse driven on the UI thread so it stays cheap regardless of JS load.
export function Skeleton({ width = '100%', height = 16, radius = radiusScale.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        s.base,
        { width, height, borderRadius: radius, backgroundColor: colors.bg.tertiary },
        pulseStyle,
        style,
      ]}
    />
  );
}

const s = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
