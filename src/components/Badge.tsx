import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import { radius, typography } from '@/theme';

type Variant = 'teal' | 'purple' | 'amber' | 'red' | 'muted';

export function Badge({ label, variant = 'muted' }: { label: string; variant?: Variant }) {
  const { colors } = useTheme();

  const variants = {
    teal: { bg: colors.green[50], text: colors.green[600] },
    purple: { bg: colors.purple[50], text: colors.purple[500] },
    amber: { bg: colors.amber[50], text: colors.amber[500] },
    red: { bg: colors.red[50], text: colors.red[500] },
    muted: { bg: colors.bg.tertiary, text: colors.text.muted },
  };

  const selected = variants[variant];

  return (
    <View style={[s.base, { backgroundColor: selected.bg }]}>
      <Text style={[s.text, { color: selected.text }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    ...typography.label,
  },
});
