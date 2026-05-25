import { StyleSheet, View } from 'react-native';
import { ProgressBar, Surface, Text } from 'react-native-paper';

type LevelCardProps = {
  level: number;
  xp: number;
  xpProgress: { current: number; required: number };
};

const LEVEL_NAMES = [
  '', 'Seedling', 'Sprout', 'Sapling', 'Grower', 'Bloomer',
  'Thriver', 'Guardian', 'Sentinel', 'Champion', 'Legend',
];

export function LevelCard({ level, xp, xpProgress }: LevelCardProps) {
  const progress = xpProgress.required > 0 ? xpProgress.current / xpProgress.required : 1;
  const levelName = LEVEL_NAMES[level] ?? `Level ${level}`;

  return (
    <Surface mode="flat" style={styles.card}>
      <View style={styles.header}>
        <Text selectable style={styles.levelLabel} variant="titleMedium">
          Level {level}
        </Text>
        <Text selectable style={styles.levelName} variant="labelLarge">
          {levelName}
        </Text>
      </View>
      <ProgressBar progress={progress} color="#25694b" style={styles.bar} />
      <Text selectable style={styles.xpText} variant="bodySmall">
        {xpProgress.current} / {xpProgress.required} XP to next level ({xp} total)
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#d8efe1',
    borderColor: '#badcc9',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  levelLabel: {
    color: '#1c2420',
    fontWeight: '800',
  },
  levelName: {
    color: '#4CB050',
    fontWeight: '700',
  },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#badcc9',
  },
  xpText: {
    color: '#65726c',
  },
});
