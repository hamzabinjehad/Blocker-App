import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from '@/components/Card';
import { useTheme } from '@/theme';
import { radius, shadow, spacing, typography } from '@/theme';

const options = [
  { key: 'light' as const, icon: 'white-balance-sunny' as const, label: 'Light' },
  { key: 'dark' as const, icon: 'moon-waning-crescent' as const, label: 'Dark' },
  { key: 'system' as const, icon: 'cellphone' as const, label: 'System' },
];

export function ThemeSettingsCard() {
  const { colors, mode, setMode } = useTheme();

  return (
    <Card title="Appearance" subtitle="Choose your preferred theme">
      <View style={[s.options, { backgroundColor: colors.bg.tertiary }]}>
        {options.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setMode(opt.key)}
            style={[
              s.option,
              mode === opt.key && { backgroundColor: colors.bg.elevated, ...shadow.sm },
            ]}
          >
            <MaterialCommunityIcons
              name={opt.icon}
              size={20}
              color={mode === opt.key ? colors.green[500] : colors.text.muted}
            />
            <Text
              style={[
                s.optionText,
                { color: mode === opt.key ? colors.text.primary : colors.text.muted },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  options: {
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  option: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionText: {
    ...typography.bodyMd,
    fontSize: 13,
  },
});
