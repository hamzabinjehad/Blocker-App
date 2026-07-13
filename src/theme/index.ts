export { lightColors as colors, lightColors, darkColors } from './colors';
export type { ColorPalette } from './colors';
export { ThemeProvider, useTheme } from './ThemeContext';

// Soft, low-opacity shadows: enough to layer surfaces, never to shout.
export const shadow = {
  sm: {
    shadowColor: '#0A100D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0A100D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0A100D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 6,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
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

// Softer, larger corners — cards feel like rounded slabs, controls stay tidy.
export const radius = {
  sm: 10,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  display: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.6 },
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5, lineHeight: 34 },
  h2: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2, lineHeight: 26 },
  h3: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1, lineHeight: 22 },
  bodyLg: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyMd: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 17 },
  captionMd: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.1, lineHeight: 16 },
} as const;

export const theme = { colors: undefined as never, shadow, spacing, radius, typography };
export default theme;
