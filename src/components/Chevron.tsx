import type { ComponentProps } from 'react';
import { I18nManager } from 'react-native';
import { Feather } from '@expo/vector-icons';

type ChevronProps = {
  color: string;
  size?: number;
  /** 'forward' points along the reading direction (right in LTR, left in RTL). */
  direction?: 'forward' | 'back';
};

// Disclosure chevron that respects layout direction. Feather's chevron icons
// don't auto-mirror under RTL, so we pick the name from I18nManager.isRTL.
export function Chevron({ color, size = 16, direction = 'forward' }: ChevronProps) {
  const forward = I18nManager.isRTL ? 'chevron-left' : 'chevron-right';
  const back = I18nManager.isRTL ? 'chevron-right' : 'chevron-left';
  const name = (direction === 'forward' ? forward : back) as ComponentProps<typeof Feather>['name'];
  return <Feather name={name} size={size} color={color} />;
}
