import { StyleSheet, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';

type StreakCalendarProps = {
  currentStreak: number;
  longestStreak: number;
};

export function StreakCalendar({ currentStreak, longestStreak }: StreakCalendarProps) {
  const today = new Date();
  const days: Array<{ date: Date; status: 'clean' | 'future' | 'missed' }> = [];

  for (let i = 69; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    if (i === 0) {
      days.push({ date, status: currentStreak > 0 ? 'clean' : 'missed' });
    } else if (i < currentStreak) {
      days.push({ date, status: 'clean' });
    } else {
      days.push({ date, status: 'missed' });
    }
  }

  return (
    <Surface mode="flat" style={styles.card}>
      <Text selectable style={styles.title} variant="titleSmall">
        10-Week Streak Calendar
      </Text>
      <View style={styles.grid}>
        {days.map((day, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              day.status === 'clean' && styles.clean,
              day.status === 'missed' && styles.missed,
              day.status === 'future' && styles.future,
            ]}
          />
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.clean]} />
          <Text selectable style={styles.legendText} variant="labelSmall">Clean</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.missed]} />
          <Text selectable style={styles.legendText} variant="labelSmall">Missed</Text>
        </View>
        <Text selectable style={styles.legendText} variant="labelSmall">
          Best: {longestStreak}d
        </Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e0e5e2',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  title: {
    color: '#1c2420',
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  clean: {
    backgroundColor: '#4CB050',
  },
  missed: {
    backgroundColor: '#e0e5e2',
  },
  future: {
    backgroundColor: '#f5f7f5',
    borderWidth: 1,
    borderColor: '#e0e5e2',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    color: '#65726c',
  },
});
