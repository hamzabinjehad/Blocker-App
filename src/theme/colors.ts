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

// "Calm depth" palette: sage-tinted layered surfaces, one confident green,
// and desaturated real hues for the accent ramps (purple = XP/strictness,
// amber = warnings, teal = neutral-positive) instead of flat grayscale.

export const lightColors: ColorPalette = {
  bg: {
    primary: '#F4F7F5',
    secondary: '#FBFCFB',
    tertiary: '#EAF0EC',
    elevated: '#FFFFFF',
    wash: '#EDF3EF',
    green: '#238F5D',
    greenDark: '#176F47',
    greenLight: 'rgba(31,143,91,0.11)',
  },
  green: { 50: '#E5F4EB', 100: '#D6EDDF', 200: '#B4DDC5', 400: '#2DA66C', 500: '#1F8F5B', 600: '#19764B', 700: '#125E3A', 800: '#0B4329' },
  teal: { 50: '#EFF5F4', 200: '#CFE3E0', 400: '#4E9A8E', 500: '#3D8377', 600: '#2F6A60' },
  purple: { 50: '#F4F2F8', 100: '#EAE6F1', 200: '#D7CFE6', 400: '#8B7BA8', 500: '#716190', 600: '#5A4C77' },
  amber: { 50: '#FAF5EA', 100: '#F3E7D0', 200: '#E7D2A6', 400: '#C3963F', 500: '#AC8232', 700: '#836122', 800: '#664B1A', 900: '#4C3813' },
  red: { 50: '#FAEEEE', 100: '#F4D5D5', 400: '#D06A6A', 500: '#B04444', 600: '#8E3737' },
  blue: { 50: '#EEF4FA', 100: '#D8E7F4', 400: '#5B93C4', 500: '#3A78AD' },
  pink: { 50: '#FDF2F8', 100: '#FCE7F3' },
  text: {
    primary: '#15201A',
    secondary: '#526158',
    muted: '#748078',
    inverse: '#FFFFFF',
    onGreen: '#FFFFFF',
  },
  border: {
    subtle: '#E2E9E4',
    default: '#D4DED7',
    strong: '#ACB6B0',
    teal: 'rgba(61,131,119,0.22)',
    purple: 'rgba(113,97,144,0.22)',
    amber: 'rgba(172,130,50,0.28)',
    red: 'rgba(176,68,68,0.18)',
    green: 'rgba(33,154,100,0.22)',
  },
  gradient: {
    headerStart: '#E7F2EB',
    headerMid: '#EEF5F1',
    headerEnd: '#F4F7F5',
  },
};

export const darkColors: ColorPalette = {
  bg: {
    primary: '#0D1210',
    secondary: '#121814',
    tertiary: '#1B241F',
    elevated: '#151C18',
    wash: '#101C15',
    green: '#25995F',
    greenDark: '#176D45',
    greenLight: '#103723',
  },
  green: { 50: '#10331F', 100: '#15442A', 200: '#1B5C38', 400: '#32B973', 500: '#38C77A', 600: '#6DDD9B', 700: '#98E9B7', 800: '#C9F5D9' },
  teal: { 50: '#0F211E', 200: '#155E58', 400: '#2DD4BF', 500: '#5EEAD4', 600: '#99F6E4' },
  purple: { 50: '#1B1622', 100: '#2B2235', 200: '#453552', 400: '#A08AB8', 500: '#B8A4CF', 600: '#D7C8EA' },
  amber: { 50: '#211A0D', 100: '#3A2B10', 200: '#6F4815', 400: '#D9A441', 500: '#E7BD60', 700: '#F0D58F', 800: '#F8E8B8', 900: '#FFF7D6' },
  red: { 50: '#241313', 100: '#421D1D', 400: '#D97777', 500: '#F19999', 600: '#F5B8B8' },
  blue: { 50: '#111D29', 100: '#20364B', 400: '#79AEDD', 500: '#A7CDEF' },
  pink: { 50: '#1F0A18', 100: '#3B0D2E' },
  text: {
    primary: '#EEF4F0',
    secondary: '#AAB5AE',
    muted: '#7C8981',
    inverse: '#0B0F0D',
    onGreen: '#FFFFFF',
  },
  border: {
    subtle: '#263029',
    default: '#344038',
    strong: '#536158',
    teal: 'rgba(45,212,191,0.16)',
    purple: 'rgba(160,138,184,0.18)',
    amber: 'rgba(217,164,65,0.18)',
    red: 'rgba(217,119,119,0.18)',
    green: 'rgba(74,222,128,0.16)',
  },
  gradient: {
    headerStart: '#112119',
    headerMid: '#101914',
    headerEnd: '#0D1210',
  },
};
