import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppIcon } from '@/components/AppIcon';
import { colors, radius, spacing, typography } from '@/theme';

type BlockOverlayProps = {
  reason?: string;
  onBack: () => void;
  onSurf?: () => void;
  onUnblock?: () => void;
};

const moods = [
  { emoji: 'Stress', label: 'Stressed' },
  { emoji: 'Bored', label: 'Bored' },
  { emoji: 'Low', label: 'Lonely' },
  { emoji: 'Anger', label: 'Frustrated' },
];

export function BlockOverlayScreen({ reason, onBack, onSurf, onUnblock }: BlockOverlayProps) {
  const countdown = useRef(new Animated.Value(1)).current;
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [timerDone, setTimerDone] = useState(false);

  useEffect(() => {
    Animated.timing(countdown, {
      duration: 8000,
      toValue: 0,
      useNativeDriver: false,
    }).start(() => setTimerDone(true));
  }, [countdown]);

  const width = countdown.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.iconFrame}>
        <AppIcon name="block" size={64} color={colors.red[500]} />
      </View>

      <Text style={styles.title}>Your brain is asking for a hit</Text>
      <Text style={styles.body}>{reason ?? "This moment will pass. You're stronger than the urge."}</Text>

      <View style={styles.timerTrack}>
        <Animated.View style={[styles.timerFill, { width }]} />
      </View>
      <Text style={styles.timerLabel}>8-second pause</Text>

      <Text style={styles.moodTitle}>How are you feeling?</Text>
      <View style={styles.moodRow}>
        {moods.map((mood, index) => (
          <Pressable
            key={mood.label}
            onPress={() => setSelectedMood(index)}
            style={[styles.moodBtn, selectedMood === index ? styles.moodBtnActive : null]}
          >
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
            <Text style={styles.moodLabel}>{mood.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>Go back</Text>
        </Pressable>
        <Pressable onPress={onSurf} style={styles.surfBtn}>
          <Text style={styles.surfText}>I'll wait +25 XP</Text>
        </Pressable>
      </View>

      {timerDone && onUnblock && (
        <Pressable onPress={onUnblock} style={styles.unblockBtn}>
          <Text style={styles.unblockText}>Unblock</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing['2xl'],
    width: '100%',
  },
  backBtn: {
    alignItems: 'center',
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    flex: 1,
    padding: spacing.lg,
  },
  backText: {
    ...typography.bodyMd,
    color: colors.text.secondary,
  },
  body: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22,
    marginTop: spacing.md,
    maxWidth: 280,
    textAlign: 'center',
  },
  iconFrame: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,87,87,0.08)',
    borderColor: colors.border.red,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  moodBtn: {
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    padding: spacing.md,
    width: 72,
  },
  moodBtnActive: {
    borderColor: colors.teal[400],
  },
  moodEmoji: {
    ...typography.captionMd,
    color: colors.text.primary,
    minHeight: 18,
    textAlign: 'center',
  },
  moodLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  moodTitle: {
    ...typography.bodyMd,
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  screen: {
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  surfBtn: {
    alignItems: 'center',
    backgroundColor: colors.teal[500],
    borderRadius: radius.lg,
    flex: 2,
    padding: spacing.lg,
  },
  surfText: {
    ...typography.bodyMd,
    color: colors.text.inverse,
  },
  unblockBtn: {
    alignItems: 'center',
    backgroundColor: colors.red[500],
    borderRadius: radius.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    width: '100%',
  },
  unblockText: {
    ...typography.bodyMd,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  timerFill: {
    backgroundColor: colors.amber[400],
    borderRadius: radius.full,
    height: '100%',
  },
  timerLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  timerTrack: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.full,
    height: 6,
    marginTop: spacing.xl,
    overflow: 'hidden',
    width: '100%',
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
