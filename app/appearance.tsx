import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ScreenScaffold } from '@/components/ScreenScaffold';
import { radius, spacing, typography, useTheme } from '@/theme';

const options = [
  { key: 'light' as const, label: 'Light' },
  { key: 'dark' as const, label: 'Dark' },
  { key: 'system' as const, label: 'System' },
];

export default function AppearanceScreen() {
  const { colors, mode, setMode } = useTheme();

  return (
    <ScreenScaffold title="Appearance" subtitle="Theme selection." iconName="appearance">
      <View style={[s.list, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        {options.map((option) => {
          const selected = mode === option.key;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.key}
              onPress={() => setMode(option.key)}
              style={({ pressed }) => [
                s.row,
                pressed ? { backgroundColor: colors.bg.tertiary } : null,
              ]}
            >
              <Feather name={selected ? 'disc' : 'circle'} size={18} color={selected ? colors.green[500] : colors.text.muted} />
              <Text style={[s.label, { color: colors.text.primary }]}>{option.label}</Text>
              {selected ? <Feather name="check" size={20} color={colors.green[500]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScreenScaffold>
  );
}

const s = StyleSheet.create({
  label: {
    ...typography.bodyMd,
    flex: 1,
  },
  list: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
