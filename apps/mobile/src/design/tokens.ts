import { Platform } from 'react-native';

/**
 * Insof dizayn tizimi — yagona manba.
 *
 * Rang, o'lcham, radius, soya, tipografika va harakat tezligi FAQAT shu yerdan olinadi.
 * Ekran kodida hex, fontSize, borderRadius raqami yozilmaydi (`scripts/design-lint.mjs`
 * tekshiradi). Qorong'i mavzu yorug'ning teskarisi emas — alohida qiymatlar.
 */

// ───────────────────────── Ranglar ─────────────────────────

/** Brend — ikkala mavzuda bir xil. */
export const brand = {
  500: '#f59e0b',
  600: '#d97706',
  100: '#fef3c7',
  /** Brend fonidagi (100) matn — 4.5:1 uchun to'q amber. */
  ink: '#92400e',
  ring: '#f59e0b80',
} as const;

/** Grafik palitrasi — tartib qat'iy, beshinchi qator yo'q. */
export const chart = {
  1: '#155dfc',
  2: '#d97706',
  3: '#009966',
  4: '#be185d',
} as const;

export const palette = {
  light: {
    bgApp: '#f5f6f8',
    bgSurface: '#ffffff',
    bgSubtle: '#f8fafc',
    bgMuted: '#f1f5f9',
    bgChrome: '#ffffff',
    borderSubtle: '#f1f5f9',
    borderDefault: '#e2e8f0',
    borderStrong: '#cad5e2',
    textStrong: '#0f172b',
    textBody: '#314158',
    textMuted: '#5f7088',
    textFaint: '#7f8da5',
    textOnBrand: '#0f172b',

    brand: brand[500],
    brandHover: brand[600],
    brandSoft: brand[100],
    brandInk: brand.ink,
    brandRing: brand.ring,

    success: '#007a55', successBg: '#ecfdf5', successSolid: '#009966',
    warning: '#bb4d00', warningBg: '#fffbeb', warningSolid: '#e17100',
    danger: '#c10007', dangerBg: '#fef2f2', dangerSolid: '#e7000b',
    info: '#1447e6', infoBg: '#eff6ff', infoSolid: '#155dfc',

    moduleProduction: '#7008e7', moduleProductionBg: '#f5f3ff',
    moduleLogistics: '#0069a8', moduleLogisticsBg: '#f0f9ff',
    moduleWarehouse: '#ca3500', moduleWarehouseBg: '#fff7ed',

    chart1: chart[1], chart2: chart[2], chart3: chart[3], chart4: chart[4],
    chartGrid: '#e2e8f0',
    chartTrack: '#f1f5f9',

    /** Modal/sheet ortidagi parda. */
    scrim: '#0f172b99',
    /** Yorqin holat rangi ustidagi matn (success/danger solid). */
    textOnSolid: '#ffffff',
  },
  dark: {
    bgApp: '#0f172a',
    bgSurface: '#1e293b',
    bgSubtle: '#243044',
    bgMuted: '#2c3a50',
    bgChrome: '#0b1120',
    borderSubtle: '#243044',
    borderDefault: '#334155',
    borderStrong: '#42536c',
    textStrong: '#f1f5f9',
    textBody: '#cbd5e1',
    textMuted: '#94a3b8',
    textFaint: '#8794a9',
    textOnBrand: '#0f172b',

    brand: brand[500],
    brandHover: brand[600],
    brandSoft: '#3b2a0c',
    brandInk: '#fbbf24',
    brandRing: brand.ring,

    success: '#34d399', successBg: '#0f2a22', successSolid: '#009966',
    warning: '#fbbf24', warningBg: '#2a2110', warningSolid: '#e17100',
    danger: '#f87171', dangerBg: '#2b1517', dangerSolid: '#e7000b',
    info: '#60a5fa', infoBg: '#14213a', infoSolid: '#155dfc',

    moduleProduction: '#a78bfa', moduleProductionBg: '#251b3d',
    moduleLogistics: '#38bdf8', moduleLogisticsBg: '#0f2436',
    moduleWarehouse: '#fb923c', moduleWarehouseBg: '#2e1a0e',

    chart1: chart[1], chart2: chart[2], chart3: chart[3], chart4: chart[4],
    chartGrid: '#334155',
    chartTrack: '#243044',

    scrim: '#020617b3',
    textOnSolid: '#ffffff',
  },
} as const;
export type Palette = Record<keyof typeof palette.light, string>;
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
  return L > 0.4 ? palette.light.textStrong : palette.light.bgSurface;
}

// ───────────────────────── O'lcham, shakl, soya ─────────────────────────

/** 4 px setkasi. */
export const space = {
  none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x7: 28, xxxl: 32, x10: 40, x12: 48,
  /** Ma'noli nomlar. */
  card: 16, panel: 20, grid: 12, section: 24, pageX: 20, pageY: 24,
} as const;

export const radius = {
  xs: 4,
  /** Input. */
  sm: 6,
  /** Tugma. */
  md: 8,
  /** Ikonka plitkasi. */
  lg: 12,
  /** BARCHA kartalar — tizimning imzosi. */
  card: 14,
  /** Modal / sheet. */
  xl: 16,
  pill: 9999,
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
} as const;

/** Ierarxiya soya bilan emas, chegara bilan — soya juda yengil. */
export const shadow = {
  card: Platform.select({
    ios: { shadowColor: palette.light.textStrong, shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    android: { elevation: 1 },
    default: {},
  })!,
  /** Faqat dropdown / modal. */
  pop: Platform.select({
    ios: { shadowColor: palette.light.textStrong, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 8 },
    default: {},
  })!,
} as const;

// ───────────────────────── Tipografika ─────────────────────────

/** Plus Jakarta Sans (400/500/600/700). Mono — faqat tekislanadigan ustunlar uchun. */
export const FONT = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  mono: 'IBMPlexMono_500Medium',
} as const;
export type FontWeight = 400 | 500 | 600 | 700;

/** Shrift yuklanmasa tizim shrifti (Inter → system-ui) ishlaydi — ekran baribir chiziladi. */
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
export const duration = { micro: 120, state: 200, screen: 280, loop: 1200 } as const;

// ───────────────────────── Rollar (kontent, dizayn emas) ─────────────────────────

export type RoleKey = 'TADBIRKOR' | 'QURUVCHI' | 'HAYDOVCHI';
export const ECO_ROLE_NAME: Record<RoleKey, { name: string; tagline: string }> = {
  TADBIRKOR: { name: 'Boshqaruv', tagline: 'KPI, moliya, jamoa — bitta ekranda' },
  QURUVCHI: { name: 'Qurilish', tagline: 'Buyurtma bering, obyektni yuriting' },
  HAYDOVCHI: { name: 'Kabina', tagline: 'Bitta yuk, bitta tugma' },
};

export type ErpRoleKey = 'DIRECTOR' | 'SALES' | 'PRODUCTION' | 'SUPERVISOR' | 'LOGISTICS' | 'WAREHOUSE' | 'PROCUREMENT' | 'ACCOUNTING' | 'FINANCE' | 'HR' | 'CASHIER' | 'DRIVER' | 'BRIGADIER';
export const ERP_ROLE_NAME: Record<ErpRoleKey, string> = {
  DIRECTOR: 'Direktor', SALES: 'Sotuv', PRODUCTION: 'Ishlab chiqarish', SUPERVISOR: 'Ish boshqaruvchi',
  LOGISTICS: 'Logistika', WAREHOUSE: 'Sklad', PROCUREMENT: 'Snabjeniye', ACCOUNTING: 'Buxgalteriya',
  FINANCE: 'Moliya', HR: 'Otdel kadr', CASHIER: 'Kassa / bank', DRIVER: 'Haydovchi', BRIGADIER: 'Brigadir',
};

/** Rol → modul toni (ikonka plitkasi). Boshqa rollar brend tonida. */
export const ERP_ROLE_MODULE: Partial<Record<ErpRoleKey, ModuleTone>> = {
  PRODUCTION: 'production', BRIGADIER: 'production', SUPERVISOR: 'production',
  LOGISTICS: 'logistics', DRIVER: 'logistics',
  WAREHOUSE: 'warehouse', PROCUREMENT: 'warehouse',
};

/** Ro'yxat kaliti → modul toni. */
export const LIST_MODULE: Record<string, ModuleTone> = {
  production: 'production', tasks: 'production',
  trips: 'logistics',
  stock: 'warehouse', receipts: 'warehouse',
};
