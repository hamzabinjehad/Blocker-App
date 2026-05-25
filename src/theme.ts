import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export { colors, lightColors, darkColors, radius, shadow, spacing, theme, typography, useTheme, ThemeProvider } from './theme/index';
export type { ColorPalette } from './theme/index';
import { lightColors, darkColors, radius } from './theme/index';
import type { ColorPalette } from './theme/index';

function buildPaperTheme(c: ColorPalette, isDark: boolean) {
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    roundness: radius.md,
    colors: {
      ...base.colors,
      primary: c.green[400],
      onPrimary: c.text.inverse,
      primaryContainer: c.green[50],
      onPrimaryContainer: c.green[700],
      secondary: c.purple[400],
      secondaryContainer: c.purple[50],
      onSecondaryContainer: c.purple[600],
      error: c.red[400],
      errorContainer: c.red[50],
      onErrorContainer: c.red[500],
      background: c.bg.primary,
      surface: c.bg.secondary,
      surfaceVariant: c.bg.tertiary,
      outline: c.border.default,
      outlineVariant: c.border.subtle,
      onSurface: c.text.primary,
      onSurfaceVariant: c.text.secondary,
    },
  };
}

export const appTheme = buildPaperTheme(lightColors, false);
export const appDarkTheme = buildPaperTheme(darkColors, true);
export { buildPaperTheme };
