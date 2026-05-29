type ColorShade = { [key: string]: string };
type ColorBg = { primary: string; secondary: string; tertiary: string; elevated: string; wash: string; green: string; greenDark: string; greenLight: string };
type ColorText = { primary: string; secondary: string; muted: string; inverse: string; onGreen: string };
type ColorBorder = { subtle: string; default: string; strong: string; teal: string; purple: string; amber: string; red: string; green: string };
type ColorGradient = { headerStart: string; headerMid: string; headerEnd: string };

export type ColorPalette = {
  bg: ColorBg;
  green: ColorShade;
  teal: ColorShade;
  purple: ColorShade;
  amber: ColorShade;
  red: ColorShade;
  blue: ColorShade;
  pink: ColorShade;
  text: ColorText;
  border: ColorBorder;
  gradient: ColorGradient;
};

export const lightColors: ColorPalette = {
  bg: {
    primary: '#F7F8FA',
    secondary: '#FFFFFF',
    tertiary: '#EEF1F4',
    elevated: '#FFFFFF',
    wash: '#F1F6F4',
    green: '#15803D',
    greenDark: '#166534',
    greenLight: '#DCFCE7',
  },
  green: { 50: '#EFF6F2', 100: '#DCFCE7', 200: '#BBF7D0', 400: '#22A35A', 500: '#15803D', 600: '#166534', 700: '#14532D', 800: '#052E16' },
  teal: { 50: '#F0F7F6', 200: '#B9E4DF', 400: '#2FAE9E', 500: '#12796F', 600: '#0F5F58' },
  purple: { 50: '#F4F1F8', 100: '#E9E2F0', 200: '#D9CDE5', 400: '#8F73AD', 500: '#6D5387', 600: '#55416A' },
  amber: { 50: '#FBF7EA', 100: '#F5E9BF', 200: '#ECD891', 400: '#D9A441', 500: '#B7791F', 700: '#8A5B18', 800: '#6F4815', 900: '#54350F' },
  red: { 50: '#FAEEEE', 100: '#F4D5D5', 400: '#D97777', 500: '#B94747', 600: '#943A3A' },
  blue: { 50: '#EEF4FA', 100: '#D8E7F4', 400: '#629CCF', 500: '#3A78AD' },
  pink: { 50: '#FDF2F8', 100: '#FCE7F3' },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
    inverse: '#FFFFFF',
    onGreen: '#FFFFFF',
  },
  border: {
    subtle: '#E2E8F0',
    default: '#CBD5E1',
    strong: '#94A3B8',
    teal: 'rgba(20,184,166,0.1)',
    purple: 'rgba(168,85,247,0.1)',
    amber: 'rgba(251,191,36,0.1)',
    red: 'rgba(248,113,113,0.1)',
    green: 'rgba(16,185,129,0.1)',
  },
  gradient: {
    headerStart: '#F8FAFC',
    headerMid: '#F8FAFC',
    headerEnd: '#F8FAFC',
  },
};

export const darkColors: ColorPalette = {
  bg: {
    primary: '#101418',
    secondary: '#171B20',
    tertiary: '#20262C',
    elevated: '#171B20',
    wash: '#122018',
    green: '#22C55E',
    greenDark: '#16A34A',
    greenLight: '#14532D',
  },
  green: { 50: '#10251A', 100: '#14532D', 200: '#166534', 400: '#22C55E', 500: '#4ADE80', 600: '#86EFAC', 700: '#BBF7D0', 800: '#DCFCE7' },
  teal: { 50: '#102221', 200: '#155E58', 400: '#2DD4BF', 500: '#5EEAD4', 600: '#99F6E4' },
  purple: { 50: '#1C1822', 100: '#2B2235', 200: '#453552', 400: '#A08AB8', 500: '#B8A4CF', 600: '#D7C8EA' },
  amber: { 50: '#211A0D', 100: '#3A2B10', 200: '#6F4815', 400: '#D9A441', 500: '#E7BD60', 700: '#F0D58F', 800: '#F8E8B8', 900: '#FFF7D6' },
  red: { 50: '#241313', 100: '#421D1D', 400: '#D97777', 500: '#F19999', 600: '#F5B8B8' },
  blue: { 50: '#111D29', 100: '#20364B', 400: '#79AEDD', 500: '#A7CDEF' },
  pink: { 50: '#1F0A18', 100: '#3B0D2E' },
  text: {
    primary: '#E6EDF3',
    secondary: '#8B949E',
    muted: '#484F58',
    inverse: '#0D1117',
    onGreen: '#FFFFFF',
  },
  border: {
    subtle: '#21262D',
    default: '#30363D',
    strong: '#484F58',
    teal: 'rgba(20,184,166,0.15)',
    purple: 'rgba(168,85,247,0.15)',
    amber: 'rgba(251,191,36,0.15)',
    red: 'rgba(248,113,113,0.15)',
    green: 'rgba(16,185,129,0.15)',
  },
  gradient: {
    headerStart: '#0D1117',
    headerMid: '#0D1117',
    headerEnd: '#0D1117',
  },
};
