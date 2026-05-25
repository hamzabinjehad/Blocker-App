import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from '@/components/Card';
import { moodOptions } from '@/services/mood';
import type { MoodCheckIn } from '@/services/mood';
import { useTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme';

type MoodCheckInCardProps = {
  value: MoodCheckIn;
  onChange: (mood: MoodCheckIn) => void;
};

export function MoodCheckInCard({ value, onChange }: MoodCheckInCardProps) {
  const { colors } = useTheme();

  return (
    <Card accent="amber" style={s.card}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text.primary }]}>How are you feeling?</Text>
        <Text style={[s.caption, { color: colors.text.muted }]}>{toneLabel(value)}</Text>
      </View>
      <View style={s.options}>
        {moodOptions.map((option) => (
          <Chip
            compact
            key={option.value}
            mode={value === option.value ? 'flat' : 'outlined'}
            onPress={() => onChange(option.value)}
            selected={value === option.value}
            showSelectedOverlay
            style={[
              value === option.value
                ? { backgroundColor: colors.amber[50], borderColor: colors.amber[200] }
                : { backgroundColor: 'transparent', borderColor: colors.border.subtle },
              { borderRadius: radius.full },
            ]}
          >
            {option.label}
          </Chip>
        ))}
      </View>
    </Card>
  );
}

function toneLabel(mood: MoodCheckIn) {
  switch (mood) {
    case 'stressed':
      return 'Calm coaching';
    case 'bored':
      return 'Action coaching';
    case 'tempted':
      return 'Stronger support';
    case 'tired':
      return 'Gentle coaching';
    default:
      return 'Steady coaching';
  }
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 0,
  },
  caption: {
    ...typography.caption,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
  },
});
