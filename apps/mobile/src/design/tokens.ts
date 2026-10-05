import type { ViewStyle } from 'react-native';

/**
 * Insof dizayn tizimi — yagona manba.
 *
 * Rang, o'lcham, radius, soya, tipografika va harakat tezligi FAQAT shu yerdan olinadi.
 * Ekran kodida hex, fontSize, borderRadius raqami yozilmaydi (`scripts/design-lint.mjs`
 * tekshiradi). Qorong'i mavzu yorug'ning teskarisi emas — alohida qiymatlar.
 */

// ───────────────────────── Ranglar ─────────────────────────

/** Brend — logotip ko'ki (ikonka, push, xizmat bildirishnomasi). Ekranlar `c.brand` dan oladi. */
export const brand = {
  500: '#0b4fd6',
  600: '#0a3fb0',
  100: '#e2e5fd',
  /** Brend fonidagi (100) matn. */
  ink: '#0b1c8e',
  ring: '#0b4fd680',
} as const;

/** Tashqi xizmatlarning o'z brend ranglari — faqat ularning belgisi uchun (Telegram ko'k; telefon raqam bilan kirish — yashil). */
export const social = {
  telegram: '#26a5e4',
  phone: '#34c759',
  onSocial: '#ffffff',
} as const;

/** Grafik palitrasi — tartib qat'iy, beshinchi qator yo'q. */
export const chart = {
  1: '#155dfc',
  2: '#d97706',
  3: '#009966',
  4: '#be185d',
} as const;

/**
 * Ochilish sahnasi (izometrik qurilish maydoni) — faqat `components/launch-scene.tsx`.
 * Oq fonda turadi (native splash ham oq), shuning uchun mavzuga bog'liq emas.
 * Yuzalar: top — yorug', left — o'rta, right — soya (yorug'lik chap-yuqoridan).
 */
export const illus = {
  ground: { top: '#eef1f6', left: '#dde2ea', right: '#c9d0db', grid: '#e1e6ee' },
  concrete: { top: '#f6f7fb', left: '#dfe3ed', right: '#bfc6d6', slab: '#ffffff', window: '#8f9bb3', windowDark: '#7483a0' },
  crane: { top: '#fbbf24', left: '#f59e0b', right: '#d97706', lattice: '#b45309' },
  digger: { top: '#fb923c', left: '#f97316', right: '#c2410c' },
  metal: { top: '#64748b', left: '#475569', right: '#334155', track: '#1e293b' },
  glass: '#9bd4f5',
  rope: '#9aa9bd',
  fence: { post: '#3b82f6', mesh: '#93c5fd' },
  sand: { top: '#e3c193', shade: '#c39d6c' },
  person: { skin: '#f2c29b', pants: '#1e3a8a', vest: '#f59e0b', vestAlt: '#22c55e', helmet: '#fde047' },
} as const;

/**
 * Ochilish sahnasi (`components/launch.tsx`) uchun 3 ta qiymat — sahna o'zgarmaydi.
 * Eski amber mavzu olib tashlangan; ilova ekranlari faqat `palettes` dan (useTheme().c) oladi.
 */
export const palette = {
  light: { bgSurface: '#ffffff', brand: '#f59e0b', chartTrack: '#f1f5f9' },
} as const;

/**
 * Ilova palitralari: foydalanuvchi Sozlamalarda tanlaydi (Chizma yoki Marjon) va har birida
 * yorug'/qorong'i rejim alohida sozlangan. Yorug' rejimda fon sof oq emas — palitra tusidagi
 * yumshoq rang (ko'z charchamaydi). Barcha matn juftliklari WCAG AA (4.5:1) dan o'tadi.
 * Kalitlar ikkala palitrada bir xil — ekranlar faqat `c.*` ni biladi.
 */
export const palettes = {
  /** Chizma — brend ko'k (logotip), aksent marjon. */
  chizma: {
    light: {
      bgApp: '#f0f2f8', bgSurface: '#fafbfd', bgSubtle: '#f5f7fb', bgMuted: '#e6e9f2',
      bgChrome: '#f8f9fc', borderSubtle: '#e9ecf3', borderDefault: '#d7dbe7', borderStrong: '#bcc1d2',
      textStrong: '#0e1430', textBody: '#2d3554', textMuted: '#535c7a', textFaint: '#7a829c',
      textOnBrand: '#ffffff', brand: '#5266ee', brandHover: '#394feb', brandSoft: '#e2e5fd',
      brandInk: '#0b1c8e', brandRing: '#5266ee80', accent: '#ff7a52', bgInverse: '#0b1341',
      bgInverseChip: '#131f68', textOnInverse: '#f2f4ff', textOnInverseMuted: '#aab4e6', success: '#087c48',
      successBg: '#e7f7ef', successSolid: '#07854c', warning: '#914a09', warningBg: '#fff4e5',
      warningSolid: '#bd580a', danger: '#d60e17', dangerBg: '#fdeeee', dangerSolid: '#ea0c15',
      info: '#0a6f9f', infoBg: '#e6f4fb', infoSolid: '#097bb1', moduleProduction: '#7523ed',
      moduleProductionBg: '#f2ecff', moduleLogistics: '#0d6e9c', moduleLogisticsBg: '#e6f4fb', moduleWarehouse: '#b5410f',
      moduleWarehouseBg: '#fff0e8', chart1: '#5266ee', chart2: '#e85033', chart3: '#0f9b8e',
      chart4: '#d81895', chartGrid: '#d7dbe7', chartTrack: '#e6e9f2', scrim: '#0e143099',
      textOnSolid: '#ffffff', brandTile: '#ffffff40',
    },
    dark: {
      bgApp: '#090c1d', bgSurface: '#121735', bgSubtle: '#181e40', bgMuted: '#1f274d',
      bgChrome: '#0a0e22', borderSubtle: '#181e40', borderDefault: '#29325c', borderStrong: '#3a4474',
      textStrong: '#eef0fb', textBody: '#c6cbe6', textMuted: '#959cc0', textFaint: '#848bb0',
      textOnBrand: '#0a0e22', brand: '#8fa0ff', brandHover: '#a9b6ff', brandSoft: '#1d2558',
      brandInk: '#b7c2fb', brandRing: '#8fa0ff80', accent: '#ff8a6b', bgInverse: '#1c2a7a',
      bgInverseChip: '#2a3a96', textOnInverse: '#f2f4ff', textOnInverseMuted: '#b2bcef', success: '#4fd59a',
      successBg: '#0d2a22', successSolid: '#0f7a4a', warning: '#ffb35c', warningBg: '#2b1f10',
      warningSolid: '#b45309', danger: '#ff8a8f', dangerBg: '#2d1520', dangerSolid: '#d42a31',
      info: '#5cc4f0', infoBg: '#0d2536', infoSolid: '#0a6d9c', moduleProduction: '#c3a3ff',
      moduleProductionBg: '#251a45', moduleLogistics: '#5cc4f0', moduleLogisticsBg: '#0d2536', moduleWarehouse: '#ff9a6b',
      moduleWarehouseBg: '#2e1a12', chart1: '#8fa0ff', chart2: '#ff8a6b', chart3: '#23edd6',
      chart4: '#f474c6', chartGrid: '#29325c', chartTrack: '#181e40', scrim: '#000000b3',
      textOnSolid: '#ffffff', brandTile: '#ffffff40',
    },
  },
  /** Marjon — qizg'ish marjon, aksent firuza. */
  marjon: {
    light: {
      bgApp: '#f8f2f0', bgSurface: '#fdfbfa', bgSubtle: '#fbf7f5', bgMuted: '#f2e9e6',
      bgChrome: '#fcf9f8', borderSubtle: '#f3ece9', borderDefault: '#e7dbd7', borderStrong: '#d2c1bc',
      textStrong: '#1f140f', textBody: '#483a32', textMuted: '#6b5e57', textFaint: '#90847f',
      textOnBrand: '#ffffff', brand: '#dc3316', brandHover: '#bc2b13', brandSoft: '#fde6e2',
      brandInk: '#8e1f0b', brandRing: '#dc331680', accent: '#58c6c2', bgInverse: '#320f09',
      bgInverseChip: '#541e15', textOnInverse: '#fff2ee', textOnInverseMuted: '#e0b2a6', success: '#087c48',
      successBg: '#e7f7ef', successSolid: '#07854c', warning: '#914a09', warningBg: '#fff4e5',
      warningSolid: '#bd580a', danger: '#aa0b25', dangerBg: '#fdecef', dangerSolid: '#e90c31',
      info: '#0a6f9f', infoBg: '#e6f4fb', infoSolid: '#097bb1', moduleProduction: '#7523ed',
      moduleProductionBg: '#f2ecff', moduleLogistics: '#0d6e9c', moduleLogisticsBg: '#e6f4fb', moduleWarehouse: '#b5410f',
      moduleWarehouseBg: '#fff0e8', chart1: '#dc3316', chart2: '#1570bc', chart3: '#0f8a6a',
      chart4: '#712ce8', chartGrid: '#e7dbd7', chartTrack: '#f2e9e6', scrim: '#1f140f99',
      textOnSolid: '#ffffff', brandTile: '#ffffff40',
    },
    dark: {
      bgApp: '#140e0b', bgSurface: '#201713', bgSubtle: '#281f1a', bgMuted: '#342823',
      bgChrome: '#100c09', borderSubtle: '#281f1a', borderDefault: '#42352e', borderStrong: '#584941',
      textStrong: '#f6f1ee', textBody: '#d9cec9', textMuted: '#aca09a', textFaint: '#9c918b',
      textOnBrand: '#2a0c06', brand: '#ff8a6e', brandHover: '#ffa58f', brandSoft: '#3a1a13',
      brandInk: '#faae9b', brandRing: '#ff8a6e80', accent: '#58c6c2', bgInverse: '#4a2219',
      bgInverseChip: '#613024', textOnInverse: '#fff2ee', textOnInverseMuted: '#e8bcb0', success: '#4fd59a',
      successBg: '#0d2a22', successSolid: '#0f7a4a', warning: '#ffb35c', warningBg: '#2b1f10',
      warningSolid: '#b45309', danger: '#ff8aa0', dangerBg: '#2d1520', dangerSolid: '#b8142f',
      info: '#5cc4f0', infoBg: '#0d2536', infoSolid: '#0a6d9c', moduleProduction: '#c3a3ff',
      moduleProductionBg: '#251a45', moduleLogistics: '#5cc4f0', moduleLogisticsBg: '#0d2536', moduleWarehouse: '#ff9a6b',
      moduleWarehouseBg: '#2e1a12', chart1: '#ff8a6e', chart2: '#6eb4ff', chart3: '#35efbb',
      chart4: '#b49bff', chartGrid: '#42352e', chartTrack: '#281f1a', scrim: '#000000b3',
      textOnSolid: '#ffffff', brandTile: '#ffffff40',
    },
  },
} as const;
export type PaletteName = keyof typeof palettes;
export const PALETTE_NAMES: { key: PaletteName; label: string }[] = [
  { key: 'chizma', label: 'Chizma' },
  { key: 'marjon', label: 'Marjon' },
];

export type Palette = Record<keyof typeof palettes.chizma.light, string>;
export type ColorKey = keyof Palette;

/** Holat toni — faqat holat uchun (grafikda ishlatilmaydi). */
export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
/** Modul toni — faqat ikonka plitkasi foni + ikonka rangi. */
export type ModuleTone = 'production' | 'logistics' | 'warehouse' | 'brand';

/** Ton → [matn/ikonka rangi, fon] juftligi. */
export function toneColors(c: Palette, tone: Tone = 'neutral'): { ink: string; bg: string; solid: string } {
  switch (tone) {
    case 'brand': return { ink: c.brandInk, bg: c.brandSoft, solid: c.brand };
    case 'success': return { ink: c.success, bg: c.successBg, solid: c.successSolid };
    case 'warning': return { ink: c.warning, bg: c.warningBg, solid: c.warningSolid };
    case 'danger': return { ink: c.danger, bg: c.dangerBg, solid: c.dangerSolid };
    case 'info': return { ink: c.info, bg: c.infoBg, solid: c.infoSolid };
    default: return { ink: c.textMuted, bg: c.bgMuted, solid: c.textMuted };
  }
}

export function moduleColors(c: Palette, m: ModuleTone = 'brand'): { ink: string; bg: string } {
  switch (m) {
    case 'production': return { ink: c.moduleProduction, bg: c.moduleProductionBg };
    case 'logistics': return { ink: c.moduleLogistics, bg: c.moduleLogisticsBg };
    case 'warehouse': return { ink: c.moduleWarehouse, bg: c.moduleWarehouseBg };
    default: return { ink: c.brandInk, bg: c.brandSoft };
  }
}

/** Fon rangiga qarab o'qiladigan matn rangi (yorqin fon ustida to'q, to'q fon ustida oq). */
export function onColor(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6), 16);
  const lum = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lum((n >> 16) & 255) + 0.7152 * lum((n >> 8) & 255) + 0.0722 * lum(n & 255);
  return L > 0.4 ? palettes.chizma.light.textStrong : '#ffffff';
}

// ───────────────────────── O'lcham, shakl, soya ─────────────────────────

/** 4 px setkasi. */
export const space = {
  none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x7: 28, xxxl: 32, x10: 40, x12: 48,
  /** Ma'noli nomlar. */
  card: 16, panel: 20, grid: 12, section: 24, pageX: 20, pageY: 24,
  /** Demo `.scroll` gap (10–12 css × 1.38): bloklar orasidagi vertikal bo'shliq. */
  stack: 14,
  /** Demo `.kpi2` / `.chips` gap 8 css → 11 dp. */
  tight: 11,
} as const;

/**
 * Demo masshtabi: HTML demo telefon ekrani 282 css px, haqiqiy telefon ~390 dp → 1.38×.
 * Yangi tokenlar shu koeffitsient bilan hisoblangan (izohda demo qiymati).
 */
export const DEMO_SCALE = 390 / 282;

export const radius = {
  xs: 6,
  /** Input. */
  sm: 12,
  /** Tugma (asosiy tugmalar pill — radius.pill). */
  md: 14,
  /** Ikonka plitkasi. */
  lg: 14,
  /** BARCHA kartalar — demo `--rCard` 20 css → 28 dp. */
  card: 28,
  /** Modal / sheet. */
  xl: 24,
  pill: 9999,
  /** Hero karta — rCard + 4 css (24) → 32 dp. */
  hero: 32,
  /** Tezkor amal kartasi (`.qa .q`) — rCard + 2 css (22) → 30 dp. */
  action: 30,
  /** Ikonka plitkasi — rCard × .55 (11 css) → 15 dp. */
  tile: 15,
  /** Hero ichidagi davr tanlagich treki (`.seg2`) — 9 css → 12; elementi 7 css → 10. */
  seg: 12,
  segItem: 10,
  /** Suzuvchi tab paneli (`.tabbar`) — 26 css → 36 dp. */
  tabBar: 36,
  /** Grafik legenda kvadrati — 3 css → 4 dp. */
  legend: 4,
} as const;

export const size = {
  touch: 44,
  driverTouch: 64,
  input: 44,
  button: 44,
  buttonLg: 52,
  topBar: 56,
  tabBar: 56,
  row: 44,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 28,
  iconTile: 40,
  iconTileSm: 32,
  avatar: 40,
  avatarLg: 56,
  hairline: 1,
  ring: 2,
  dot: 8,
  progress: 6,
  // ── Demo 1:1 (css × 1.38) ──
  /** Sarlavha avatari / qo'ng'iroq tugmasi (`.av`, `.ib`) — 32 css. */
  headerAvatar: 44,
  /** Qo'ng'iroqdagi qizil nuqta — 6 css. */
  bellDot: 8,
  /** Chip / segment elementi balandligi — 28 css. */
  chip: 40,
  /** Chip treki ichki paddingi — 3 css. */
  chipPad: 4,
  /** Hero aksent chizig'i — 14×3 css. */
  heroAccentW: 20,
  heroAccentH: 4,
  /** Hero sparkline balandligi — 40 css. */
  heroSpark: 56,
  /** Hero davr tanlagichi elementi — ~20 css. */
  heroSeg: 28,
  /** KPI / ro'yxat qatori plitkasi — 28 css. */
  tile: 40,
  /** Tezkor amal plitkasi — 30 css. */
  actionTile: 42,
  /** Tab paneli pill'i — 44×24 css; ikonka 16 css. */
  tabPillW: 60,
  tabPillH: 32,
  tabIcon: 22,
  /** Haydovchi tab paneli — kattaroq nishon. */
  tabPillWDriver: 72,
  tabPillHDriver: 40,
  tabIconDriver: 28,
  /** Pastki amal paneli tugmasi — 44 css; haydovchi `xl` — 56 css. */
  stickyButton: 60,
  stickyButtonXl: 76,
  /** Qidiruv maydoni — 38 css. */
  search: 52,
  /** Grafik legenda kvadrati — 8 css. */
  legend: 11,
  /** Gorizontal grafik chizig'i — 8 css; taqsimot chizig'i — 10 css; reja chizig'i — 6 css. */
  hbar: 11,
  breakdownBar: 14,
  progressLg: 8,
  /** Timeline nuqtasi — 10 css. */
  timelineDot: 14,
} as const;

/** Ierarxiya chegara bilan emas, yumshoq soya bilan. Soya rangi palitraning to'q matnidan. */
export const shadow: Record<'card' | 'pop', ViewStyle> = {
  /** Demo sh1 (yorug' Chizma rangida). Palitraga mos variant — `elevation(c).sh1`. */
  card: { boxShadow: `0px 1.4px 2.8px 0px ${palettes.chizma.light.textStrong}0d, 0px 8px 25px -11px ${palettes.chizma.light.textStrong}24` },
  /** Dropdown / modal / suzuvchi tab bar. */
  pop: { boxShadow: `0px 3px 8px 0px ${palettes.chizma.light.textStrong}0f, 0px 22px 44px -19px ${palettes.chizma.light.textStrong}38` },
} as const;

/** `#rrggbb` + shaffoflik → `#rrggbbaa` (demo `color-mix(… X%, transparent)`). */
export const alpha = (hex: string, a: number) => `${hex.slice(0, 7)}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;

/**
 * Demo "Yumshoq qatlam" soyalari (CSS `box-shadow` × 1.38) — palitraga bog'liq (rangi `textStrong` dan).
 * RN 0.76 New Architecture `boxShadow` — ko'p qatlamli, spread bilan, demo bilan 1:1.
 *  sh1 — karta, chip treki, qidiruv; sh2 — suzuvchi tab paneli; hero — to'q karta;
 *  raised — scroll paytida ko'tarilgan sarlavha; glow(rang) — asosiy tugma / faol chip nuri.
 */
export function elevation(c: Palette) {
  const ink = c.textStrong;
  return {
    sh1: { boxShadow: `0px 1.4px 2.8px 0px ${alpha(ink, 0.05)}, 0px 8px 25px -11px ${alpha(ink, 0.14)}` },
    sh2: { boxShadow: `0px 3px 8px 0px ${alpha(ink, 0.06)}, 0px 22px 44px -19px ${alpha(ink, 0.22)}` },
    hero: { boxShadow: `0px 25px 50px -25px ${alpha(c.bgInverse, 0.7)}` },
    raised: { boxShadow: `0px 11px 28px -19px ${alpha(ink, 0.4)}` },
    /** Asosiy tugma: `0 10px 20px -10px brand`. */
    glow: (color: string): ViewStyle => ({ boxShadow: `0px 14px 28px -14px ${color}` }),
    /** Faol chip indikatori: `0 6px 14px -8px brand`. */
    chipGlow: (color: string): ViewStyle => ({ boxShadow: `0px 8px 19px -11px ${color}` }),
  } satisfies Record<string, ViewStyle | ((color: string) => ViewStyle)>;
}

// ───────────────────────── Tipografika ─────────────────────────

/**
 * Nunito — yumshoq, yumaloq uchli shrift. Har bir vazn bir pog'ona qalinroq faylga ulanadi
 * (400 → Medium, 700 → ExtraBold): matn yumshoq va o'qilishi oson. Mono — faqat tekislanadigan ustunlar.
 */
export const FONT = {
  400: 'Nunito_500Medium',
  500: 'Nunito_600SemiBold',
  600: 'Nunito_700Bold',
  700: 'Nunito_800ExtraBold',
  mono: 'IBMPlexMono_500Medium',
} as const;
export type FontWeight = 400 | 500 | 600 | 700;

/** Shrift yuklanmasa tizim shrifti ishlaydi — ekran baribir chiziladi. */
const f = (w: FontWeight, fontSize: number, lineHeight: number, letterSpacing = 0, upper = false) => ({
  fontFamily: FONT[w], fontSize, lineHeight, letterSpacing,
  ...(upper ? { textTransform: 'uppercase' as const } : null),
});

export const type = {
  /** Faqat kirish ekrani. */
  display: f(700, 32, 38, -0.64),
  /** Sahifa sarlavhasi — har sahifada BITTA. */
  titleLg: f(600, 24, 32),
  titleMd: f(600, 18, 26),
  titleSm: f(600, 16, 24),
  body: f(400, 14, 20),
  bodyStrong: f(600, 14, 20),
  bodySm: f(400, 13, 19),
  label: f(500, 13, 19),
  caption: f(400, 12, 16),
  overline: f(600, 11, 16, 0.55, true),
  overlineXs: f(600, 10.5, 14, 1.47, true),
  /** Sahifada bittadan ko'p emas. */
  metricHero: f(600, 34, 40),
  metric: f(600, 22, 28),
  /** Tekislanadigan ustun (mono). */
  mono: { fontFamily: FONT.mono, fontSize: 13, lineHeight: 19, letterSpacing: 0 },

  // ── Demo 1:1 (css px × 1.38; Nunito: demo 600 → FONT[500], 700 → FONT[600], 800 → FONT[700]) ──
  /** `.appbar .t-over` — 9 css, 700, .06em, katta harf. */
  appbarOverline: f(600, 12.5, 16, 0.75, true),
  /** `.appbar` sarlavhasi — 13 css, 800. */
  appbarTitle: f(700, 18, 23, -0.18),
  /** `.av` bosh harflar — 11 css, 700. */
  avatarInitials: f(600, 15, 19),
  /** `.hero .big` — 27 css, 800, −.02em, lh 1.05. */
  heroValue: f(700, 37, 39, -0.74),
  /** Hero birligi — 12–13 css, 600. */
  heroUnit: f(500, 17, 21),
  /** `.delta` — 9.5 css, 700. */
  heroDelta: f(600, 13, 17),
  /** `.seg2 span` — 9 css, 600. */
  heroSeg: f(500, 12.5, 16),
  /** `.t-sm` — 10.5 css, 600: izoh, KPI yorlig'i, ro'yxat izohi. */
  tSm: f(500, 14.5, 19),
  /** `.kpi .v` — 13.5 css, 800, lh 1.1. */
  kpiValue: f(700, 19, 21),
  /** KPI o'zgarishi — 9 css, 700. */
  kpiDelta: f(600, 12.5, 16),
  /** `.qa .q` yorlig'i — 8.5 css, 600, lh 1.15. */
  actionLabel: f(500, 12, 14),
  /** `.sh b` — 12.5 css, 800. */
  sectionTitle: f(700, 17, 22),
  /** `.sh a` — 10 css, 600. */
  sectionLink: f(500, 14, 18),
  /** `.li .m b` — 11.5 css, 700. */
  listTitle: f(600, 16, 21),
  /** `.li .r b` — 11 css, 700. */
  listValue: f(600, 15, 19),
  /** `.badge` — 9 css, 700. */
  badge: f(600, 12.5, 16),
  /** `.chip` — 10 css, 600. */
  chip: f(500, 14, 18),
  /** `.tab` yorlig'i — 8.5 css, 600. */
  tabLabel: f(500, 12, 15),
  /** Haydovchi tab yorlig'i. */
  tabLabelDriver: f(600, 14, 18),
  /** Grafik legendasi — 9.5 css. */
  legend: f(500, 13, 17),
  /** Gorizontal grafik / taqsimot qatori — 10 css. */
  chartRow: f(500, 14, 18),
  /** `.btn` — 12 css, 800; `.btn.xl` — 14 css. */
  button: f(700, 16.5, 21),
  buttonXl: f(700, 19, 24),
  /** `.search` — 11 css. */
  search: f(500, 15, 20),
  /** `.kv` — 10.5 css. */
  kv: f(500, 14.5, 19),
} as const;
export type TypeVariant = keyof typeof type;

/**
 * Matn qutisiga zaxira kenglik, dp.
 * Android matn kengligini bir oz kam o'lchaydi va oxirgi harfni qirqadi ("Yetkazildi" → "Yetkazil…").
 * Harf soniga mutanosib zaxira beriladi. `extra` — harf oralig'i bo'lgan joylar uchun.
 */
export const textRoom = (text: string, fontSize: number, extra = 0) => text.length * (fontSize * 0.59 + extra);

// ───────────────────────── Harakat ─────────────────────────

/** Yagona tezliklar: mikro (hover/fokus), holat, ekran o'tishi, yuklanish sikli. */
export const duration = {
  micro: 120, state: 220, screen: 320, loop: 1200,
  /** Navigatsiya o'tishi (stack push/pop, modal) — 300 ms; tab almashishi — cross-fade 200 ms. */
  nav: 300, tab: 200,
  /** Demo "Animatsiya v2": `enter .6s`, qadam 60 ms. */
  enter: 600, stagger: 60,
  /** Raqam sanash — 1 s (ease-out quart). */
  count: 1000,
  /** Sparkline chizilishi 1.2 s (+ .25 s kechikish); maydon .8 s (+ .9 s). */
  draw: 1200, drawDelay: 250, areaDelay: 900, area: 800,
  /** Pulse halqa — 1.8 s sikl, 1.4 s kechikish. */
  pulse: 1800, pulseDelay: 1400,
  /** Ustun o'sishi: kechikish 250 + i × 45 ms. */
  barDelay: 250, barStep: 45,
  /** Progress / gorizontal ustun to'lishi — 1.1 s (+ .35 s). */
  fill: 1100, fillDelay: 350,
} as const;

// ───────────────────────── Rollar (kontent, dizayn emas) ─────────────────────────

export type RoleKey = 'TADBIRKOR' | 'QURUVCHI' | 'HAYDOVCHI';
export const ECO_ROLE_NAME: Record<RoleKey, { name: string; tagline: string }> = {
  TADBIRKOR: { name: 'Boshqaruv', tagline: 'KPI, moliya, jamoa — bitta ekranda' },
  QURUVCHI: { name: 'Qurilish', tagline: 'Buyurtma bering, obyektni yuriting' },
  HAYDOVCHI: { name: 'Kabina', tagline: 'Bitta yuk, bitta tugma' },
};

export type ErpRoleKey = 'DIRECTOR' | 'SALES' | 'PRODUCTION' | 'SUPERVISOR' | 'LOGISTICS' | 'WAREHOUSE' | 'PROCUREMENT' | 'ACCOUNTING' | 'FINANCE' | 'HR' | 'CASHIER' | 'MECHANIC' | 'DRIVER' | 'BRIGADIER';
export const ERP_ROLE_NAME: Record<ErpRoleKey, string> = {
  DIRECTOR: 'Direktor', SALES: 'Sotuv', PRODUCTION: 'Ishlab chiqarish', SUPERVISOR: 'Ish boshqaruvchi',
  LOGISTICS: 'Logistika', WAREHOUSE: 'Sklad', PROCUREMENT: 'Snabjeniye', ACCOUNTING: 'Buxgalteriya',
  FINANCE: 'Moliya', HR: 'Otdel kadr', CASHIER: 'Kassa / bank', MECHANIC: 'Mexanik', DRIVER: 'Haydovchi', BRIGADIER: 'Brigadir',
};

/** Rol → modul toni (ikonka plitkasi). Boshqa rollar brend tonida. */
export const ERP_ROLE_MODULE: Partial<Record<ErpRoleKey, ModuleTone>> = {
  PRODUCTION: 'production', BRIGADIER: 'production', SUPERVISOR: 'production',
  LOGISTICS: 'logistics', DRIVER: 'logistics', MECHANIC: 'logistics',
  WAREHOUSE: 'warehouse', PROCUREMENT: 'warehouse',
};

/** Ro'yxat kaliti → modul toni. */
export const LIST_MODULE: Record<string, ModuleTone> = {
  production: 'production', tasks: 'production', brigades: 'production', recipes: 'production',
  'brig-issues': 'production', 'brig-shifts': 'production',
  trips: 'logistics', drivers: 'logistics',
  stock: 'warehouse', receipts: 'warehouse', supply: 'warehouse', snabjeniye: 'warehouse', suppliers: 'warehouse',
};
