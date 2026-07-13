import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme';

type CardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  accent?: 'teal' | 'purple' | 'amber' | 'red' | 'green' | 'none';
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
  const { colors, isDark } = useTheme();

  const accentColors: Record<string, string> = {
    teal: colors.green[500],
    purple: colors.purple[500],
    amber: colors.amber[500],
    red: colors.red[500],
    green: colors.green[500],
  };

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.bg.elevated,
          borderColor: colors.border.subtle,
          boxShadow: isDark ? '0 1px 0 rgba(255,255,255,0.02)' : '0 8px 24px rgba(21,32,26,0.06)',
          padding,
        },
        style,
      ]}
    >
      {accent !== 'none' && <View style={[s.accentStripe, { backgroundColor: accentColors[accent] }]} />}
      {title || subtitle || action ? (
        <View style={s.header}>
          <View style={s.titleGroup}>
            {title ? <Text maxFontSizeMultiplier={1.5} selectable style={[s.title, { color: colors.text.primary }]}>{title}</Text> : null}
            {subtitle ? <Text maxFontSizeMultiplier={1.5} selectable style={[s.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text> : null}
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
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    overflow: 'hidden',
  },
  accentStripe: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    top: 0,
    width: 4,
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
