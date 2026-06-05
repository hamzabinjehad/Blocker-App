import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { MoodFace } from '@/components/MoodFace';
import { useTheme } from '@/theme';
import type { MoodCheckIn } from '@/services/mood';

type Bubble = {
  value: MoodCheckIn;
  label: string;
  xRatio: number; // center x as fraction of screen width
  y: number;      // center y in dp within the bubble area
  size: number;
};

const BUBBLES: Bubble[] = [
  { value: 'terrible', label: 'Terrible', xRatio: 0.40, y: 88,  size: 82 },
  { value: 'excellent', label: 'Excellent', xRatio: 0.72, y: 65,  size: 70 },
  { value: 'bad',      label: 'Bad',       xRatio: 0.13, y: 196, size: 66 },
  { value: 'great',    label: 'Great',     xRatio: 0.86, y: 188, size: 74 },
  { value: 'down',     label: 'Down',      xRatio: 0.34, y: 325, size: 80 },
  { value: 'neutral',  label: 'Neutral',   xRatio: 0.67, y: 340, size: 72 },
];

type Props = {
  onSelect: (mood: MoodCheckIn) => void;
  onClose: () => void;
};

export function MoodPickerView({ onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const anims = useRef(BUBBLES.map(() => ({
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0.7),
  }))).current;

  useEffect(() => {
    Animated.stagger(
      50,
      anims.map(({ opacity, scale }) =>
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, damping: 14, mass: 0.8, stiffness: 120, useNativeDriver: true }),
        ])
      )
    ).start();
  }, [anims]);

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.bg.primary }]}>
      <View style={s.bubbleArea}>
        {BUBBLES.map((bubble, i) => {
          const cx = bubble.xRatio * width;
          const left = cx - bubble.size / 2;
          return (
            <Animated.View
              key={bubble.value}
              style={[s.bubble, { left, top: bubble.y, width: bubble.size }, { opacity: anims[i]!.opacity, transform: [{ scale: anims[i]!.scale }] }]}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => onSelect(bubble.value)}
                style={{ alignItems: 'center', width: '100%' }}
              >
                <MoodFace mood={bubble.value} size={bubble.size} />
                <Text style={[s.bubbleLabel, { color: colors.text.primary }]}>{bubble.label}</Text>
              </Pressable>
            </Animated.View>
          );
        })}

        <View style={s.questionWrap} pointerEvents="none">
          <Text style={[s.question, { color: colors.text.primary }]}>How are you{'\n'}feeling?</Text>
        </View>
      </View>

      <View style={s.closeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={[s.closeBtn, { borderColor: colors.border.default }]}
        >
          <Feather name="x" size={20} color={colors.text.secondary} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  bubbleArea: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  bubble: {
    alignItems: 'center',
    position: 'absolute',
  },
  bubbleLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 7,
    textAlign: 'center',
  },
  questionWrap: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 222,
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeRow: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingTop: 8,
  },
  closeBtn: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
});
