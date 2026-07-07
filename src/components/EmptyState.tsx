import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/theme';
import { spacing, typography } from '@/theme';

type EmptyStateProps = {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

// Shared empty-state placeholder: icon + line(s) + optional action. Gives the
// "nothing here yet" surfaces one consistent look instead of ad-hoc markup.
export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={s.wrap}>
      <Feather name={icon} size={24} color={colors.text.muted} />
      <Text style={[s.title, { color: colors.text.secondary }]}>{title}</Text>
      {subtitle ? <Text style={[s.subtitle, { color: colors.text.muted }]}>{subtitle}</Text> : null}
      {action}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  title: {
    ...typography.body,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
  },
});
