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
    primary: '#F8FAFC',
    secondary: '#FFFFFF',
    tertiary: '#EEF2F7',
    elevated: '#FFFFFF',
    wash: '#EAF8F2',
    green: '#10B981',
    greenDark: '#059669',
    greenLight: '#D1FAE5',
  },
  green: { 50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 400: '#10B981', 500: '#059669', 600: '#047857', 700: '#065F46', 800: '#064E3B' },
  teal: { 50: '#F0FDFA', 200: '#99F6E4', 400: '#14B8A6', 500: '#0D9488', 600: '#0F766E' },
  purple: { 50: '#FAF5FF', 100: '#F3E8FF', 200: '#E9D5FF', 400: '#A855F7', 500: '#9333EA', 600: '#7E22CE' },
  amber: { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 400: '#FBBF24', 500: '#F59E0B', 700: '#B45309', 800: '#92400E', 900: '#78350F' },
  red: { 50: '#FEF2F2', 100: '#FEE2E2', 400: '#F87171', 500: '#EF4444', 600: '#DC2626' },
  blue: { 50: '#EFF6FF', 100: '#DBEAFE', 400: '#60A5FA', 500: '#3B82F6' },
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
    primary: '#0D1117',
    secondary: '#161B22',
    tertiary: '#1C2128',
    elevated: '#1C2128',
    wash: '#0D2818',
    green: '#10B981',
    greenDark: '#059669',
    greenLight: '#064E3B',
  },
  green: { 50: '#0D2818', 100: '#064E3B', 200: '#065F46', 400: '#10B981', 500: '#34D399', 600: '#6EE7B7', 700: '#A7F3D0', 800: '#D1FAE5' },
  teal: { 50: '#042F2E', 200: '#0F766E', 400: '#14B8A6', 500: '#2DD4BF', 600: '#5EEAD4' },
  purple: { 50: '#1E1030', 100: '#2E1065', 200: '#4C1D95', 400: '#A855F7', 500: '#C084FC', 600: '#D8B4FE' },
  amber: { 50: '#1C1508', 100: '#451A03', 200: '#78350F', 400: '#FBBF24', 500: '#FCD34D', 700: '#FDE68A', 800: '#FEF3C7', 900: '#FFFBEB' },
  red: { 50: '#1F0A0A', 100: '#450A0A', 400: '#F87171', 500: '#FB7185', 600: '#FDA4AF' },
  blue: { 50: '#0C1929', 100: '#1E3A5F', 400: '#60A5FA', 500: '#93C5FD' },
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
