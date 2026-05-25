import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { useTheme } from '@/theme';
import { radius, shadow, spacing, typography } from '@/theme';

export function StreakCard({ streak }: { streak: number }) {
  const { colors } = useTheme();
  const active = streak > 0;

  return (
    <View style={[s.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }, shadow.sm]}>
      <View
        style={[
          s.iconBox,
          {
            backgroundColor: active ? colors.amber[50] : colors.bg.primary,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        <AppIcon name="streak" size={24} color={active ? colors.amber[500] : colors.text.muted} />
      </View>
      <View style={s.textColumn}>
        <Text selectable style={[s.number, { color: colors.text.primary }]}>{streak}</Text>
        <Text selectable style={[s.label, { color: colors.text.muted }]}>Day streak</Text>
      </View>
      {streak >= 7 ? (
        <View style={[s.badge, { backgroundColor: colors.amber[50], borderColor: colors.border.amber }]}>
          <AppIcon name="streak" size={14} color={colors.amber[500]} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.md,
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  textColumn: {
    flex: 1,
  },
  label: {
    ...typography.caption,
  },
  number: {
    ...typography.h3,
  },
  badge: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
});
