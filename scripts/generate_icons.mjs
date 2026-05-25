import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const ASSETS = join(import.meta.dirname, '..', 'assets');
const UI_ICONS = join(ASSETS, 'ui', 'icons');
mkdirSync(UI_ICONS, { recursive: true });

const PRIMARY = '#6C5CE7';
const PRIMARY_DARK = '#4834D4';
const ACCENT = '#00CEC9';
const BG = '#1E1E2E';
const WHITE = '#FFFFFF';

function svgWrap(size, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${content}</svg>`;
}

// ── App icon (1024x1024): shield with lock ──
const appIconSvg = svgWrap(1024, `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}"/>
      <stop offset="100%" stop-color="${PRIMARY_DARK}"/>
    </linearGradient>
    <linearGradient id="shield" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="${WHITE}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${WHITE}" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
  <!-- shield -->
  <path d="M512 160 C512 160 280 260 280 260 L280 520 C280 700 512 864 512 864 C512 864 744 700 744 520 L744 260 Z"
        fill="url(#shield)" opacity="0.95"/>
  <!-- lock body -->
  <rect x="432" y="480" width="160" height="130" rx="20" fill="${PRIMARY_DARK}"/>
  <!-- lock shackle -->
  <path d="M460 480 L460 420 C460 380 480 350 512 350 C544 350 564 380 564 420 L564 480"
        fill="none" stroke="${PRIMARY_DARK}" stroke-width="28" stroke-linecap="round"/>
  <!-- keyhole -->
  <circle cx="512" cy="530" r="18" fill="${WHITE}"/>
  <rect x="505" y="540" width="14" height="30" rx="5" fill="${WHITE}"/>
`);

// ── Adaptive icon (1024x1024): just the shield on transparent ──
const adaptiveIconSvg = svgWrap(1024, `
  <defs>
    <linearGradient id="abg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}"/>
      <stop offset="100%" stop-color="${PRIMARY_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="0" fill="url(#abg)"/>
  <path d="M512 180 C512 180 300 270 300 270 L300 520 C300 690 512 844 512 844 C512 844 724 690 724 520 L724 270 Z"
        fill="${WHITE}" opacity="0.95"/>
  <rect x="440" y="490" width="144" height="120" rx="18" fill="${PRIMARY_DARK}"/>
  <path d="M466 490 L466 435 C466 398 484 370 512 370 C540 370 558 398 558 435 L558 490"
        fill="none" stroke="${PRIMARY_DARK}" stroke-width="26" stroke-linecap="round"/>
  <circle cx="512" cy="536" r="16" fill="${WHITE}"/>
  <rect x="506" y="546" width="12" height="28" rx="4" fill="${WHITE}"/>
`);

// ── Splash icon (200x200 centered) ──
const splashIconSvg = svgWrap(200, `
  <defs>
    <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}"/>
      <stop offset="100%" stop-color="${PRIMARY_DARK}"/>
    </linearGradient>
  </defs>
  <path d="M100 20 C100 20 30 55 30 55 L30 105 C30 145 100 185 100 185 C100 185 170 145 170 105 L170 55 Z"
        fill="url(#sg)"/>
  <rect x="80" y="95" width="40" height="32" rx="5" fill="${WHITE}"/>
  <path d="M87 95 L87 82 C87 73 92 67 100 67 C108 67 113 73 113 82 L113 95"
        fill="none" stroke="${WHITE}" stroke-width="7" stroke-linecap="round"/>
  <circle cx="100" cy="107" r="5" fill="${PRIMARY_DARK}"/>
  <rect x="98" y="110" width="4" height="8" rx="2" fill="${PRIMARY_DARK}"/>
`);

// ── Favicon (48x48) ──
const faviconSvg = svgWrap(48, `
  <defs>
    <linearGradient id="fg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}"/>
      <stop offset="100%" stop-color="${PRIMARY_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="48" height="48" rx="10" fill="url(#fg)"/>
  <path d="M24 6 L8 13 L8 25 C8 35 24 44 24 44 C24 44 40 35 40 25 L40 13 Z"
        fill="${WHITE}" opacity="0.95"/>
  <rect x="19" y="23" width="10" height="8" rx="2" fill="${PRIMARY_DARK}"/>
  <path d="M21 23 L21 20 C21 18 22 17 24 17 C26 17 27 18 27 20 L27 23"
        fill="none" stroke="${PRIMARY_DARK}" stroke-width="2.5" stroke-linecap="round"/>
`);

// ── UI Icons (64x64 each) ──
function uiIcon(content) {
  return svgWrap(64, `
    ${content}
  `);
}

const uiIcons = {
  shield: uiIcon(`
    <path d="M32 4 L8 16 L8 32 C8 48 32 60 32 60 C32 60 56 48 56 32 L56 16 Z"
          fill="${PRIMARY}" opacity="0.9"/>
    <path d="M26 32 L30 36 L40 26" fill="none" stroke="${WHITE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  `),
  block: uiIcon(`
    <circle cx="32" cy="32" r="24" fill="none" stroke="#E74C3C" stroke-width="5"/>
    <line x1="15" y1="15" x2="49" y2="49" stroke="#E74C3C" stroke-width="5" stroke-linecap="round"/>
  `),
  focus: uiIcon(`
    <circle cx="32" cy="32" r="8" fill="${ACCENT}"/>
    <circle cx="32" cy="32" r="18" fill="none" stroke="${ACCENT}" stroke-width="3"/>
    <circle cx="32" cy="32" r="26" fill="none" stroke="${ACCENT}" stroke-width="2" opacity="0.5"/>
  `),
  rules: uiIcon(`
    <rect x="12" y="8" width="40" height="48" rx="6" fill="${PRIMARY}" opacity="0.15"/>
    <rect x="12" y="8" width="40" height="48" rx="6" fill="none" stroke="${PRIMARY}" stroke-width="3"/>
    <line x1="22" y1="22" x2="42" y2="22" stroke="${PRIMARY}" stroke-width="3" stroke-linecap="round"/>
    <line x1="22" y1="32" x2="38" y2="32" stroke="${PRIMARY}" stroke-width="3" stroke-linecap="round"/>
    <line x1="22" y1="42" x2="34" y2="42" stroke="${PRIMARY}" stroke-width="3" stroke-linecap="round"/>
  `),
  admin: uiIcon(`
    <circle cx="32" cy="22" r="10" fill="${PRIMARY}"/>
    <path d="M12 54 C12 40 22 34 32 34 C42 34 52 40 52 54" fill="${PRIMARY}" opacity="0.8"/>
    <circle cx="44" cy="18" r="8" fill="${ACCENT}"/>
    <path d="M40 18 L43 21 L49 15" fill="none" stroke="${WHITE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  `),
  streak: uiIcon(`
    <path d="M32 4 C32 4 18 22 18 36 C18 46 24 56 32 56 C28 48 30 40 32 34 C34 40 36 48 32 56 C40 56 46 46 46 36 C46 22 32 4 32 4Z"
          fill="#F39C12"/>
    <path d="M32 24 C32 24 24 34 24 40 C24 46 28 50 32 50 C36 50 40 46 40 40 C40 34 32 24 32 24Z"
          fill="#E74C3C"/>
  `),
  xp: uiIcon(`
    <polygon points="32,4 38,24 58,24 42,36 48,56 32,44 16,56 22,36 6,24 26,24"
             fill="#F1C40F"/>
    <polygon points="32,14 36,26 48,26 38,34 42,46 32,38 22,46 26,34 16,26 28,26"
             fill="#F39C12"/>
  `),
  progress: uiIcon(`
    <circle cx="32" cy="32" r="24" fill="none" stroke="${PRIMARY}" stroke-width="5" opacity="0.2"/>
    <path d="M32 8 A24 24 0 1 1 8 32" fill="none" stroke="${ACCENT}" stroke-width="5" stroke-linecap="round"/>
    <path d="M26 32 L30 36 L40 26" fill="none" stroke="${PRIMARY}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  `),
  'clean-hours': uiIcon(`
    <circle cx="32" cy="32" r="24" fill="${PRIMARY}" opacity="0.12"/>
    <circle cx="32" cy="32" r="24" fill="none" stroke="${PRIMARY}" stroke-width="3"/>
    <line x1="32" y1="32" x2="32" y2="16" stroke="${PRIMARY}" stroke-width="3" stroke-linecap="round"/>
    <line x1="32" y1="32" x2="44" y2="38" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="3" fill="${PRIMARY}"/>
  `),
};

async function generate() {
  // App icons
  await sharp(Buffer.from(appIconSvg)).resize(1024, 1024).png().toFile(join(ASSETS, 'icon.png'));
  await sharp(Buffer.from(adaptiveIconSvg)).resize(1024, 1024).png().toFile(join(ASSETS, 'adaptive-icon.png'));
  await sharp(Buffer.from(splashIconSvg)).resize(200, 200).png().toFile(join(ASSETS, 'splash-icon.png'));
  await sharp(Buffer.from(faviconSvg)).resize(48, 48).png().toFile(join(ASSETS, 'favicon.png'));

  // UI icons
  for (const [name, svg] of Object.entries(uiIcons)) {
    await sharp(Buffer.from(svg)).resize(128, 128).png().toFile(join(UI_ICONS, `${name}.png`));
  }

  console.log('All icons generated successfully!');
}

generate().catch(console.error);
