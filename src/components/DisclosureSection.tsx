import type { PropsWithChildren, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme';

type DisclosureSectionProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  action?: ReactNode;
}>;

export function DisclosureSection({
  title,
  subtitle,
  defaultOpen = false,
  action,
  children,
}: DisclosureSectionProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={[s.section, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [s.header, pressed && { backgroundColor: colors.bg.tertiary }]}
      >
        <View style={s.copy}>
          <Text selectable style={[s.title, { color: colors.text.primary }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text selectable style={[s.subtitle, { color: colors.text.secondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text.muted} />
      </Pressable>
      {open ? <View style={[s.content, { borderTopColor: colors.border.subtle }]}>{children}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.h3,
  },
  subtitle: {
    ...typography.body,
  },
  content: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.md,
  },
});
