import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Chevron } from '@/components/Chevron';
import { useTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme';

type FeatherName = ComponentProps<typeof Feather>['name'];
export type BannerTone = 'warning' | 'success';

type BannerProps = {
  icon: FeatherName;
  tone?: BannerTone;
  /** Emphasized first line. Optional so a banner can be a single body line. */
  title?: string;
  /** Body line. At least one of title/subtitle should be provided. */
  subtitle?: string;
  /** 'chevron' shows a trailing chevron; a node renders as-is (e.g. an action label). */
  trailing?: 'chevron' | ReactNode;
  iconSize?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
};

// Shared inline notice used across Home (permission notices), Settings (PIN
// banner) and Rules (lock banner). Consolidates three near-identical tinted
// callouts into one tone-driven primitive.
export function Banner({
  icon,
  tone = 'warning',
  title,
  subtitle,
  trailing,
  iconSize = 16,
  onPress,
  accessibilityLabel,
}: BannerProps) {
  const { colors } = useTheme();
  const palette =
    tone === 'success'
      ? {
          bg: colors.green[50],
          border: colors.border.green,
          icon: colors.green[600],
          title: colors.green[700],
          subtitle: colors.green[600],
        }
      : {
          bg: colors.amber[50],
          border: colors.border.amber,
          icon: colors.amber[700],
          title: colors.amber[900],
          subtitle: colors.amber[800],
        };

  const content = (
    <>
      <Feather name={icon} size={iconSize} color={palette.icon} />
      <View style={s.text}>
        {title ? <Text style={[s.title, { color: palette.title }]}>{title}</Text> : null}
        {subtitle ? <Text style={[s.subtitle, { color: palette.subtitle }]}>{subtitle}</Text> : null}
      </View>
      {trailing === 'chevron' ? (
        <Chevron size={16} color={palette.title} />
      ) : (
        trailing ?? null
      )}
    </>
  );

  const style = [s.banner, { backgroundColor: palette.bg, borderColor: palette.border }];

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={style}>
        {content}
      </Pressable>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} style={style}>
      {content}
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.captionMd,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
    lineHeight: 17,
  },
});
