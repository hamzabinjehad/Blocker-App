import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedCard } from '@/components/AnimatedCard';
import { Card } from '@/components/Card';
import { Button, Field } from '@/components/controls';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useGamification } from '@/store/useGamification';
import { triggerLabels, useRecovery } from '@/store/useRecovery';
import type { TriggerSituation } from '@/store/useRecovery';
import { radius, spacing, typography, useTheme } from '@/theme';

const triggerOptions = Object.keys(triggerLabels) as TriggerSituation[];

export default function CoachScreen() {
  const { colors } = useTheme();
  const recovery = useRecovery();
  const gamification = useGamification();
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [journalText, setJournalText] = useState('');
  const [emotionalState, setEmotionalState] = useState('overwhelmed');
  const [trigger, setTrigger] = useState<TriggerSituation>('stress');
  const [notes, setNotes] = useState('');
  const timerActive = remainingSeconds > 0;

  useEffect(() => {
    if (!timerActive) return;
    const timer = setTimeout(() => setRemainingSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [timerActive, remainingSeconds]);

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
    const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [remainingSeconds]);

  const completeUrgeTimer = () => {
    setRemainingSeconds(0);
    recovery.recordUrgeSurfed();
    gamification.recordUrgeSurfed();
  };

  const saveJournal = () => {
    recovery.addJournalEntry(journalText);
    if (journalText.trim()) {
      setJournalText('');
      gamification.awardXP(15, 'journal_entry');
    }
  };

  const saveRelapse = () => {
    recovery.addRelapseLog({ emotionalState, trigger, notes });
    setNotes('');
    gamification.resetStreak();
    gamification.awardXP(20, 'honest_relapse_log');
  };

  const completeChallenge = () => {
    recovery.completeChallenge();
    gamification.awardXP(recovery.activeChallenge.xp, 'weekly_challenge');
  };

  return (
    <ScreenScaffold title="Coach" subtitle="Support for urges, reflection, and next steps." iconName="coach">
      <AnimatedCard>
        <Card
          accent="green"
          title="I'm struggling right now"
          subtitle="Ride the urge for a few minutes. It will rise, peak, and pass."
        >
          <View style={s.timerRow}>
            {[5, 10].map((minutes) => (
              <Pressable
                accessibilityRole="button"
                key={minutes}
                onPress={() => setTimerMinutes(minutes)}
                style={[
                  s.choice,
                  {
                    backgroundColor: timerMinutes === minutes ? colors.green[50] : colors.bg.primary,
                    borderColor: timerMinutes === minutes ? colors.border.green : colors.border.subtle,
                  },
                ]}
              >
                <Text style={[s.choiceText, { color: colors.text.primary }]}>{minutes} min</Text>
              </Pressable>
            ))}
          </View>

          {timerActive ? (
            <View style={s.breathingPanel}>
              <Text style={[s.timer, { color: colors.green[600] }]}>{timerLabel}</Text>
              <Text style={[s.breathingText, { color: colors.text.secondary }]}>Breathe in 4, hold 7, out 8.</Text>
              <Button onPress={completeUrgeTimer}>I made it through</Button>
            </View>
          ) : (
            <Button icon="play" onPress={() => setRemainingSeconds(timerMinutes * 60)}>
              Start urge surfing
            </Button>
          )}
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={60}>
        <Card
          accent="teal"
          title="Daily journal"
          subtitle="One sentence is enough. This stays private on your device."
        >
          <Field
            label="What challenged you today?"
            onChangeText={setJournalText}
            placeholder="Late night scrolling, stress, loneliness..."
            value={journalText}
          />
          <Button onPress={saveJournal}>Save reflection</Button>
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={100}>
        <Card
          accent="amber"
          title="Log what happened"
          subtitle="No punishment. Awareness is useful data."
        >
          <Field label="Emotional state before" onChangeText={setEmotionalState} value={emotionalState} />
          <View style={s.triggerGrid}>
            {triggerOptions.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option}
                onPress={() => setTrigger(option)}
                style={[
                  s.triggerChip,
                  {
                    backgroundColor: trigger === option ? colors.amber[50] : colors.bg.primary,
                    borderColor: trigger === option ? colors.border.amber : colors.border.subtle,
                  },
                ]}
              >
                <Text style={[s.triggerText, { color: colors.text.primary }]}>{triggerLabels[option]}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Notes, optional" onChangeText={setNotes} placeholder="What might help next time?" value={notes} />
          <Button tone="neutral" onPress={saveRelapse}>Save honestly</Button>
          <Text style={[s.gentleCopy, { color: colors.text.secondary }]}>
            Thank you for your honesty. Awareness is the first step.
          </Text>
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={140}>
        <Card
          accent="purple"
          title="This week's challenge"
          subtitle={recovery.activeChallenge.detail}
          action={
            recovery.activeChallenge.completed ? (
              <Text style={[s.completed, { color: colors.green[600] }]}>Done</Text>
            ) : null
          }
        >
          <Text style={[s.challengeTitle, { color: colors.text.primary }]}>{recovery.activeChallenge.title}</Text>
          <View style={s.challengeActions}>
            <Button disabled={recovery.activeChallenge.completed} onPress={completeChallenge}>
              Complete +{recovery.activeChallenge.xp} XP
            </Button>
            <Button tone="neutral" onPress={recovery.swapChallenge}>Swap</Button>
          </View>
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={180}>
        <Card accent="none" title="Private pattern insight" subtitle={recovery.topTriggerInsight}>
          <Text style={[s.gentleCopy, { color: colors.text.secondary }]}>
            Urges surfed: {recovery.urgesSurfed}. Journal entries: {recovery.journalEntries.length}. Honest logs:{' '}
            {recovery.relapseLogs.length}.
          </Text>
        </Card>
      </AnimatedCard>
    </ScreenScaffold>
  );
}

const s = StyleSheet.create({
  breathingPanel: {
    gap: spacing.md,
  },
  breathingText: {
    ...typography.body,
    textAlign: 'center',
  },
  challengeActions: {
    gap: spacing.sm,
  },
  challengeTitle: {
    ...typography.h3,
  },
  choice: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    flex: 1,
    padding: spacing.sm,
  },
  choiceText: {
    ...typography.bodyMd,
  },
  completed: {
    ...typography.captionMd,
  },
  gentleCopy: {
    ...typography.body,
  },
  timer: {
    ...typography.display,
    textAlign: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  triggerChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  triggerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  triggerText: {
    ...typography.captionMd,
  },
});
