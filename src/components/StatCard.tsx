import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import type { AppIconName } from '@/components/AppIcon';
import { useTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme';

type Color = 'teal' | 'purple' | 'amber' | 'red';

type StatCardProps = {
  label: string;
  value: string | number;
  color?: Color;
  iconName?: AppIconName;
};

export function StatCard({ label, value, color = 'teal', iconName }: StatCardProps) {
  const { colors } = useTheme();

  const colorMap = {
    teal: { accent: colors.green[500], bg: colors.green[50] },
    purple: { accent: colors.purple[500], bg: colors.purple[50] },
    amber: { accent: colors.amber[500], bg: colors.amber[50] },
    red: { accent: colors.red[500], bg: colors.red[50] },
  };

  const selected = colorMap[color];

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.bg.elevated,
          borderColor: colors.border.subtle,
        },
      ]}
    >
      <View style={s.topRow}>
        <Text selectable style={[s.label, { color: colors.text.muted }]}>{label}</Text>
        <View style={[s.iconBox, { backgroundColor: selected.bg, borderColor: colors.border.subtle }]}>
          {iconName ? <AppIcon name={iconName} size={17} color={selected.accent} /> : null}
        </View>
      </View>
      <Text selectable style={[s.value, { color: colors.text.primary }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 88,
    padding: spacing.md,
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  label: {
    ...typography.captionMd,
    flex: 1,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  value: {
    ...typography.h2,
    fontVariant: ['tabular-nums'],
  },
});
