import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { getDailyCoachingNudge } from '@/services/coaching';
import type { CoachingStats } from '@/services/coaching';
import { useTheme } from '@/theme';
import { spacing, typography } from '@/theme';

type CoachingCardProps = {
  message?: string;
  isLoading?: boolean;
  stats?: CoachingStats;
};

function TypingDots() {
  const { colors } = useTheme();
  return (
    <View style={s.dots}>
      <View style={[s.dot, { backgroundColor: colors.green[400] }]} />
      <View style={[s.dot, s.dotMuted, { backgroundColor: colors.green[400] }]} />
      <View style={[s.dot, { backgroundColor: colors.green[400] }]} />
    </View>
  );
}

export function CoachingCard({ message, isLoading = false, stats }: CoachingCardProps) {
  const { colors } = useTheme();
  const [generatedMessage, setGeneratedMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!stats) return;
    void getDailyCoachingNudge(stats).then(setGeneratedMessage);
  }, [stats?.streak, stats?.level, stats?.blocksYesterday, stats?.cleanHoursYesterday, stats?.mood]);

  const displayedMessage = message ?? generatedMessage;
  if (!isLoading && !displayedMessage) return null;

  return (
    <Card accent="teal" style={s.card}>
      <View style={s.header}>
        <Badge label="Daily guidance" variant="teal" />
      </View>
      {isLoading ? <TypingDots /> : <Text style={[s.message, { color: colors.text.primary }]}>{displayedMessage}</Text>}
    </Card>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 0,
  },
  dot: {
    borderRadius: 4,
    height: 6,
    width: 6,
  },
  dotMuted: {
    opacity: 0.2,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  message: {
    ...typography.body,
    lineHeight: 22,
    fontWeight: '500',
  },
});
