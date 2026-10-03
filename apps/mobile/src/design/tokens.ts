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

/** Tashqi xizmatlarning o'z brend ranglari — faqat ularning belgisi uchun (Telegram ko'k, SMS yashil). */
export const social = {
  telegram: '#26a5e4',
  sms: '#34c759',
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
 * Eski palitra — FAQAT ochilish sahnasi (`components/launch.tsx`) uchun saqlangan, u o'zgarmaydi.
 * Ilova ekranlari `palettes` dan (useTheme().c) oladi.
 */
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
      textOnSolid: '#ffffff',
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
      textOnSolid: '#ffffff',
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
      textOnSolid: '#ffffff',
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
      textOnSolid: '#ffffff',
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
} as const;

export const radius = {
  xs: 6,
  /** Input. */
  sm: 12,
  /** Tugma (asosiy tugmalar pill — radius.pill). */
  md: 14,
  /** Ikonka plitkasi. */
  lg: 14,
  /** BARCHA kartalar — yumshoq, katta radius. */
  card: 20,
  /** Modal / sheet. */
  xl: 24,
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

/** Ierarxiya chegara bilan emas, yumshoq soya bilan. Soya rangi palitraning to'q matnidan. */
export const shadow = {
  card: Platform.select({
    ios: { shadowColor: palettes.chizma.light.textStrong, shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 2 },
    default: {},
  })!,
  /** Dropdown / modal / suzuvchi tab bar. */
  pop: Platform.select({
    ios: { shadowColor: palettes.chizma.light.textStrong, shadowOpacity: 0.14, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 10 },
    default: {},
  })!,
} as const;

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
export const duration = { micro: 120, state: 220, screen: 320, loop: 1200, enter: 520, stagger: 55 } as const;

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
