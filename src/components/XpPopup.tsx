import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';
import { radius, shadow, typography } from '@/theme';

export function XpPopup({ amount, visible }: { amount: number; visible: boolean }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(20);
      scale.setValue(0.7);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        duration: 200,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        damping: 12,
        stiffness: 200,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        damping: 10,
        stiffness: 250,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, scale, visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[s.popup, { backgroundColor: colors.green[500] }, shadow.lg, { opacity, transform: [{ translateY }, { scale }] }]}>
      <Text selectable style={s.text}>+{amount} XP</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  popup: {
    alignSelf: 'center',
    borderRadius: radius.full,
    paddingHorizontal: 24,
    paddingVertical: 12,
    position: 'absolute',
    top: 80,
    zIndex: 999,
  },
  text: {
    ...typography.bodyMd,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
