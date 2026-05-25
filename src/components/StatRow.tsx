import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export type StatItem = {
  label: string;
  value: string | number;
};

type StatRowProps = {
  stats: StatItem[];
};

export function StatRow({ stats }: StatRowProps) {
  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.stat}>
          <Text selectable style={styles.value} variant="headlineSmall">
            {stat.value}
          </Text>
          <Text selectable style={styles.label} variant="labelSmall">
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  value: {
    color: '#1c2420',
    fontWeight: '800',
  },
  label: {
    color: '#65726c',
  },
});
