import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { Button } from '@/components/controls';
import { AppIcon } from '@/components/AppIcon';
import type { ChallengeInput } from '@/services/challenges';
import { generatePersonalizedChallenge } from '@/services/challenges';
import { useTheme } from '@/theme';
import { spacing, typography } from '@/theme';

type PersonalizedChallengeCardProps = {
  input: ChallengeInput;
  onComplete: (xp: number) => void;
};

export function PersonalizedChallengeCard({ input, onComplete }: PersonalizedChallengeCardProps) {
  const { colors } = useTheme();
  const [completedId, setCompletedId] = useState<string | null>(null);
  const challenge = useMemo(() => generatePersonalizedChallenge(input), [input]);
  const completed = completedId === challenge.id;

  return (
    <Card accent="purple" style={s.card}>
      <View style={s.header}>
        <View style={s.titleGroup}>
          <View style={s.badgeRow}>
            <Badge label="Personal challenge" variant="purple" />
            <Text selectable style={[s.xp, { color: colors.purple[500] }]}>+{challenge.xp} XP</Text>
          </View>
          <Text selectable style={[s.title, { color: colors.text.primary }]}>{challenge.title}</Text>
        </View>
        <AppIcon name="progress" size={24} color={colors.purple[400]} />
      </View>
      <Text selectable style={[s.target, { color: colors.text.primary }]}>{challenge.target}</Text>
      <Text selectable style={[s.reason, { color: colors.text.secondary }]}>{challenge.reason}</Text>
      <Button
        disabled={completed}
        onPress={() => {
          setCompletedId(challenge.id);
          onComplete(challenge.xp);
        }}
      >
        {completed ? 'Completed' : 'Complete Challenge'}
      </Button>
    </Card>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 0,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reason: {
    ...typography.body,
    fontStyle: 'italic',
  },
  target: {
    ...typography.bodyLg,
    fontWeight: '600',
  },
  title: {
    ...typography.h3,
  },
  titleGroup: {
    flex: 1,
    gap: spacing.sm,
  },
  xp: {
    ...typography.captionMd,
  },
});
