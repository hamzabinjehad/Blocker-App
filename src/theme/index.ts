export { lightColors as colors, lightColors, darkColors } from './colors';
export type { ColorPalette } from './colors';
export { ThemeProvider, useTheme } from './ThemeContext';

export const shadow = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 0,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.055,
    shadowRadius: 28,
    elevation: 4,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 5,
  }),
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  full: 9999,
} as const;

export const typography = {
  display: { fontSize: 36, fontWeight: '800' as const, letterSpacing: 0 },
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: 0, lineHeight: 34 },
  h2: { fontSize: 21, fontWeight: '800' as const, letterSpacing: 0, lineHeight: 27 },
  h3: { fontSize: 16, fontWeight: '700' as const, letterSpacing: 0, lineHeight: 21 },
  bodyLg: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyMd: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  captionMd: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0 },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0 },
} as const;

export const theme = { colors: undefined as never, shadow, spacing, radius, typography };
export default theme;
