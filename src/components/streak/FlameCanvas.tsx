import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

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

export function FlameCanvas({ streakDays, state }: FlameCanvasProps) {
  const { colors } = useTheme();
  const loop = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const particles = useMemo(() => buildParticles(), []);
  const baseHeight = flameHeightForStreak(streakDays);
  const flameHeight = state === 'freeze' ? baseHeight * 0.82 : baseHeight;
  const palette = state === 'freeze'
    ? [colors.blue[400], colors.blue[500], '#B8D9F2']
    : ['#176341', colors.green[500], '#CDE9A1'];

  useEffect(() => {
    const runner = Animated.loop(
      Animated.timing(loop, {
        duration: state === 'freeze' ? 2400 : 1700,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    runner.start();
    return () => runner.stop();
  }, [loop, state]);

  useEffect(() => {
    entrance.setValue(state === 'freshStart' ? 1 : 0.82);
    Animated.timing(entrance, {
      duration: state === 'freshStart' ? 600 : 800,
      easing: state === 'freshStart' ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic),
      toValue: state === 'freshStart' ? 0 : 1,
      useNativeDriver: true,
    }).start();
  }, [entrance, state, streakDays]);

  if (state === 'freshStart') {
    return (
      <View style={[s.stage, { height: flameHeightForStreak(1) + 54 }]}>
        <Animated.View
          style={[
            s.baseStone,
            {
              backgroundColor: colors.teal[200],
              opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }),
              transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={[s.stage, { height: flameHeight + 54 }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          s.glow,
          {
            backgroundColor: state === 'freeze' ? colors.blue[50] : colors.green[50],
            opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0, state === 'freeze' ? 0.68 : 0.84] }),
            transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
          },
        ]}
      />
      {particles.map((particle, index) => {
        const age = Animated.modulo(Animated.add(loop, particle.phase), 1);
        const translateY = age.interpolate({
          inputRange: [0, 1],
          outputRange: [flameHeight * 0.24, -flameHeight * 0.76],
        });
        const translateX = age.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [particle.startX, particle.startX + particle.drift * 0.34, particle.startX + particle.drift],
        });
        const opacity = age.interpolate({
          inputRange: [0, 0.14, 0.72, 1],
          outputRange: [0, 0.72, state === 'freeze' ? 0.42 : 0.58, 0],
        });
        const scale = age.interpolate({
          inputRange: [0, 0.62, 1],
          outputRange: [1.12, 0.72, 0.18],
        });

        return (
          <Animated.View
            key={`${particle.phase}-${index}`}
            pointerEvents="none"
            style={[
              s.particleAnchor,
              {
                opacity,
                transform: [
                  { translateX },
                  { translateY },
                  { scale: Animated.multiply(scale, entrance) },
                  { rotate: `${particle.turn}deg` },
                ],
              },
            ]}
          >
            <View
              style={[
                s.particle,
                {
                  backgroundColor: palette[particle.tone] ?? palette[1],
                  height: particle.size * 1.36,
                  width: particle.size,
                },
              ]}
            />
          </Animated.View>
        );
      })}
      {streakDays >= 90 ? <Shimmer color={state === 'freeze' ? colors.blue[400] : colors.green[400]} loop={loop} /> : null}
    </View>
  );
}

function Shimmer({ color, loop }: { color: string; loop: Animated.Value }) {
  return (
    <>
      {[0.18, 0.48, 0.76].map((phase, index) => {
        const age = Animated.modulo(Animated.add(loop, phase), 1);
        return (
          <Animated.View
            key={phase}
            style={[
              s.spark,
              {
                backgroundColor: color,
                opacity: age.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.6, 0] }),
                transform: [
                  {
                    translateX: age.interpolate({
                      inputRange: [0, 1],
                      outputRange: [index === 1 ? 4 : -14 + index * 14, index === 1 ? 18 : -4 + index * 16],
                    }),
                  },
                  { translateY: age.interpolate({ inputRange: [0, 1], outputRange: [-120, -156] }) },
                  { scale: age.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.5, 1, 0.2] }) },
                ],
              },
            ]}
          />
        );
      })}
    </>
  );
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
