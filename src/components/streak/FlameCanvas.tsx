import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { radius, useTheme } from '@/theme';

import type { StreakPopupState } from './streakCopy';

type FlameCanvasProps = {
  streakDays: number;
  state: StreakPopupState;
};

type Particle = {
  drift: number;
  phase: number;
  size: number;
  startX: number;
  tone: number;
  turn: number;
};

const PARTICLE_COUNT = 52;

// The whole flame runs off two shared values (a looping clock + an entrance
// progress); every particle derives its frame from them in a UI-thread worklet,
// so the JS thread does no per-frame work.
export function FlameCanvas({ streakDays, state }: FlameCanvasProps) {
  const { colors } = useTheme();
  const loop = useSharedValue(0);
  const entrance = useSharedValue(0);
  const particles = useMemo(() => buildParticles(), []);
  const baseHeight = flameHeightForStreak(streakDays);
  const flameHeight = state === 'freeze' ? baseHeight * 0.82 : baseHeight;
  const freeze = state === 'freeze';
  const palette = freeze
    ? [colors.blue[400], colors.blue[500], '#B8D9F2']
    : ['#176341', colors.green[500], '#CDE9A1'];

  useEffect(() => {
    loop.value = 0;
    loop.value = withRepeat(
      withTiming(1, { duration: state === 'freeze' ? 2400 : 1700, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(loop);
  }, [loop, state]);

  useEffect(() => {
    entrance.value = state === 'freshStart' ? 1 : 0.82;
    entrance.value = withTiming(state === 'freshStart' ? 0 : 1, {
      duration: state === 'freshStart' ? 600 : 800,
      easing: state === 'freshStart' ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic),
    });
  }, [entrance, state, streakDays]);

  const stoneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(entrance.value, [0, 1], [1, 0.2]),
    transform: [{ scale: interpolate(entrance.value, [0, 1], [1, 1.8]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(entrance.value, [0, 1], [0, freeze ? 0.68 : 0.84]),
    transform: [{ scale: interpolate(entrance.value, [0, 1], [0.82, 1]) }],
  }));

  if (state === 'freshStart') {
    return (
      <View style={[s.stage, { height: flameHeightForStreak(1) + 54 }]}>
        <Animated.View style={[s.baseStone, { backgroundColor: colors.teal[200] }, stoneStyle]} />
      </View>
    );
  }

  return (
    <View style={[s.stage, { height: flameHeight + 54 }]}>
      <Animated.View
        pointerEvents="none"
        style={[s.glow, { backgroundColor: freeze ? colors.blue[50] : colors.green[50] }, glowStyle]}
      />
      {particles.map((particle, index) => (
        <FlameParticle
          key={`${particle.phase}-${index}`}
          color={palette[particle.tone] ?? palette[1]}
          entrance={entrance}
          flameHeight={flameHeight}
          freeze={freeze}
          loop={loop}
          particle={particle}
        />
      ))}
      {streakDays >= 90 ? (
        <Shimmer color={freeze ? colors.blue[400] : colors.green[400]} loop={loop} />
      ) : null}
    </View>
  );
}

function FlameParticle({
  color,
  entrance,
  flameHeight,
  freeze,
  loop,
  particle,
}: {
  color: string;
  entrance: SharedValue<number>;
  flameHeight: number;
  freeze: boolean;
  loop: SharedValue<number>;
  particle: Particle;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const age = (loop.value + particle.phase) % 1;
    return {
      opacity: interpolate(age, [0, 0.14, 0.72, 1], [0, 0.72, freeze ? 0.42 : 0.58, 0]),
      transform: [
        {
          translateX: interpolate(
            age,
            [0, 0.45, 1],
            [particle.startX, particle.startX + particle.drift * 0.34, particle.startX + particle.drift],
          ),
        },
        { translateY: interpolate(age, [0, 1], [flameHeight * 0.24, -flameHeight * 0.76]) },
        { scale: interpolate(age, [0, 0.62, 1], [1.12, 0.72, 0.18]) * entrance.value },
        { rotate: `${particle.turn}deg` },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[s.particleAnchor, animatedStyle]}>
      <View
        style={[
          s.particle,
          { backgroundColor: color, height: particle.size * 1.36, width: particle.size },
        ]}
      />
    </Animated.View>
  );
}

function Shimmer({ color, loop }: { color: string; loop: SharedValue<number> }) {
  return (
    <>
      {[0.18, 0.48, 0.76].map((phase, index) => (
        <ShimmerSpark key={phase} color={color} index={index} loop={loop} phase={phase} />
      ))}
    </>
  );
}

function ShimmerSpark({
  color,
  index,
  loop,
  phase,
}: {
  color: string;
  index: number;
  loop: SharedValue<number>;
  phase: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const age = (loop.value + phase) % 1;
    return {
      opacity: interpolate(age, [0, 0.35, 1], [0, 0.6, 0]),
      transform: [
        {
          translateX: interpolate(
            age,
            [0, 1],
            [index === 1 ? 4 : -14 + index * 14, index === 1 ? 18 : -4 + index * 16],
          ),
        },
        { translateY: interpolate(age, [0, 1], [-120, -156]) },
        { scale: interpolate(age, [0, 0.35, 1], [0.5, 1, 0.2]) },
      ],
    };
  });

  return <Animated.View style={[s.spark, { backgroundColor: color }, animatedStyle]} />;
}

function flameHeightForStreak(streakDays: number) {
  if (streakDays >= 90) return 218;
  if (streakDays >= 30) return 190;
  if (streakDays >= 7) return 136;
  if (streakDays >= 1) return 92;
  return 72;
}

function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const seed = Math.sin((index + 1) * 999) * 10000;
    const a = seed - Math.floor(seed);
    const b = Math.sin((index + 3) * 313) * 10000;
    const c = b - Math.floor(b);
    const tone = index % 9 < 3 ? 0 : index % 9 < 7 ? 1 : 2;
    return {
      drift: -26 + a * 52,
      phase: (index / PARTICLE_COUNT + c * 0.14) % 1,
      size: 6 + a * 12,
      startX: -12 + c * 24,
      tone,
      turn: -18 + a * 36,
    };
  });
}

const s = StyleSheet.create({
  baseStone: {
    borderRadius: radius.full,
    bottom: 14,
    height: 18,
    position: 'absolute',
    width: 18,
  },
  glow: {
    borderRadius: radius.full,
    bottom: 0,
    height: 120,
    opacity: 0.7,
    position: 'absolute',
    width: 120,
  },
  particle: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    transform: [{ rotate: '42deg' }],
  },
  particleAnchor: {
    bottom: 28,
    left: '50%',
    position: 'absolute',
  },
  spark: {
    borderRadius: radius.full,
    bottom: 56,
    height: 5,
    left: '50%',
    position: 'absolute',
    width: 5,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    width: '100%',
  },
});
