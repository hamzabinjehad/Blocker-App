import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

export function usePressScale(pressedScale = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      damping: 14,
      mass: 0.7,
      stiffness: 240,
      toValue: pressedScale,
      useNativeDriver: true,
    }).start();
  }, [pressedScale, scale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      damping: 14,
      mass: 0.7,
      stiffness: 220,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const animatedStyle = {
    transform: [{ scale }],
  };

  return { animatedStyle, onPressIn, onPressOut };
}
