import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/theme';

export type AppIconName =
  | 'admin'
  | 'block'
  | 'clean-hours'
  | 'focus'
  | 'progress'
  | 'rules'
  | 'shield'
  | 'streak'
  | 'xp'
  | 'check'
  | 'coach'
  | 'guardian'
  | 'control'
  | 'alerts'
  | 'appearance'
  | 'search'
  | 'list'
  | 'apps';

const iconSources = {
  admin: 'lock',
  alerts: 'bell',
  appearance: 'sliders',
  apps: 'grid',
  block: 'slash',
  'clean-hours': 'clock',
  coach: 'heart',
  control: 'sliders',
  focus: 'target',
  guardian: 'users',
  progress: 'trending-up',
  rules: 'sliders',
  search: 'search',
  list: 'list',
  shield: 'shield',
  streak: 'zap',
  xp: 'award',
  check: 'check',
} as const;

type FeatherIconName = ComponentProps<typeof Feather>['name'];

const iconNames: Record<AppIconName, FeatherIconName> = iconSources;

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
};

export function AppIcon({
  name,
  size = 24,
  color,
}: AppIconProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.text.primary;

  return <Feather color={resolvedColor} name={iconNames[name]} size={size} />;
}
