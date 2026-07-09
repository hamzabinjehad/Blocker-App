import { useCallback } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Returns a style for a reanimated Animated.View plus press handlers; the
// spring runs entirely on the UI thread.
export function usePressScale(pressedScale = 0.97) {
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(pressedScale, { damping: 14, mass: 0.7, stiffness: 240 });
  }, [pressedScale, scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 14, mass: 0.7, stiffness: 220 });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, onPressIn, onPressOut };
}
