import { FlatList, StyleSheet, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';

import type { Badge } from '@/store/useGamification';

type BadgeShelfProps = {
  badges: Badge[];
};

export function BadgeShelf({ badges }: BadgeShelfProps) {
  return (
    <Surface mode="flat" style={styles.card}>
      <Text selectable style={styles.title} variant="titleSmall">
        Badges
      </Text>
      <FlatList
        data={badges}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.badge, !item.earned && styles.locked]}>
            <Text style={styles.icon}>{item.earned ? item.icon : '\u{1F512}'}</Text>
            <Text selectable style={styles.label} variant="labelSmall" numberOfLines={2}>
              {item.label}
            </Text>
          </View>
        )}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e0e5e2',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  title: {
    color: '#1c2420',
    fontWeight: '700',
  },
  list: {
    gap: 12,
    paddingVertical: 4,
  },
  badge: {
    alignItems: 'center',
    width: 72,
    gap: 4,
  },
  locked: {
    opacity: 0.4,
  },
  icon: {
    fontSize: 28,
  },
  label: {
    color: '#405148',
    textAlign: 'center',
    lineHeight: 14,
  },
});
