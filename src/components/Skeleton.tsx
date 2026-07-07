import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

import { radius as radiusScale, useTheme } from '@/theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

// Simple pulsing placeholder for cards awaiting native-bridge data. Opacity-only
// pulse (native driver) so it stays cheap on the main thread.
export function Skeleton({ width = '100%', height = 16, radius = radiusScale.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        s.base,
        { width, height, borderRadius: radius, backgroundColor: colors.bg.tertiary, opacity: pulse },
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
