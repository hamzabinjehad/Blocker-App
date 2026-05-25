import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme';

type CardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  accent?: 'teal' | 'purple' | 'amber' | 'red' | 'none';
  padding?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function Card({
  title,
  subtitle,
  action,
  accent = 'none',
  padding = spacing.lg,
  style,
  children,
}: CardProps) {
  const { colors } = useTheme();

  const accentColors: Record<string, string> = {
    teal: colors.green[500],
    purple: colors.purple[500],
    amber: colors.amber[500],
    red: colors.red[500],
  };

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.bg.elevated,
          borderColor: colors.border.subtle,
          padding,
        },
        style,
      ]}
    >
      {accent !== 'none' && (
        <View style={[s.accentStripe, { backgroundColor: accentColors[accent] }]} />
      )}
      {title || subtitle || action ? (
        <View style={s.header}>
          <View style={s.titleGroup}>
            {title ? <Text selectable style={[s.title, { color: colors.text.primary }]}>{title}</Text> : null}
            {subtitle ? <Text selectable style={[s.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    overflow: 'hidden',
  },
  accentStripe: {
    position: 'absolute',
    left: spacing.sm,
    top: 0,
    right: spacing.sm,
    opacity: 0.85,
    height: 3,
    borderBottomLeftRadius: radius.full,
    borderBottomRightRadius: radius.full,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  titleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
  },
  subtitle: {
    ...typography.body,
  },
});
