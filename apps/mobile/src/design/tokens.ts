import { Platform } from 'react-native';

/**
 * Brend palitrasi — Insof ko'ki (#0A4CD5, logotip plitkasining rangi) va to'q sariq urg'u.
 * Ikonka, splash, bildirishnoma va auth ekranlari shu ranglarda: ilova ochilganda
 * splashdan keyin boshqa rangga sakrab tushmaydi.
 *
 * Qorong'i rejadagi fon — to'q dengiz ko'ki (navy), yashil emas: brend ko'ki bilan bitta
 * oilada turadi va oq matn kontrasti yuqori chiqadi.
 *
 * Rol skinlari (Tadbirkor / Quruvchi / Haydovchi) pastda, o'z ranglarida qoladi —
 * bu palitra rol tanlanmaguncha va umumiy ekranlarda ishlaydi.
 */
export const palette = {
  light: {
    brandPrimary: '#0A4CD5',
    brandPrimarySoft: '#DCE8FF',
    brandAccent: '#FFA800',
    bgCanvas: '#F4F7FD',
    bgSurface: '#FFFFFF',
    bgSurfaceMuted: '#E9EFFB',
    textPrimary: '#0E1726',
    textSecondary: '#68758A',
    textOnBrand: '#FFFFFF',
    border: '#DCE3EF',
    success: '#00B34D',
    warning: '#F08A00',
    danger: '#E60D28',
    info: '#0062F0',
  },
  dark: {
    brandPrimary: '#4D8DFF',
    brandPrimarySoft: '#123063',
    brandAccent: '#FFC233',
    bgCanvas: '#06172B',
    bgSurface: '#0E2340',
    bgSurfaceMuted: '#16304F',
    textPrimary: '#EAF1FB',
    textSecondary: '#9DB0C8',
    textOnBrand: '#04122A',
    border: '#22405F',
    success: '#2EE39B',
    warning: '#FFC233',
    danger: '#FF6070',
    info: '#5FA8FF',
  },
} as const;
export type Palette = Record<keyof typeof palette.light, string>;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Platforma odati: iOS — 12, Android (Material 3) — 20 tugma radiusi. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  button: Platform.select({ ios: 14, android: 20, default: 14 })!,
  card: Platform.select({ ios: 14, android: 16, default: 14 })!,
  full: 999,
} as const;

const androidBump = Platform.OS === 'android' ? 1 : 0;
/**
 * Tipografika — Apple HIG "Large Title / Title 1 / Title 3 / Body / Callout / Footnote" shkalasi.
 * Tizim shrifti (SF Pro iOS'da, Roboto/One UI Android'da) — fontFamily berilmaydi, letterSpacing HIG bo'yicha.
 */
export const type = {
  display: { fontSize: 34 + androidBump, fontWeight: '700' as const, lineHeight: 41, letterSpacing: Platform.OS === 'ios' ? 0.37 : 0 },
  title: { fontSize: 28 + androidBump, fontWeight: '700' as const, lineHeight: 34, letterSpacing: Platform.OS === 'ios' ? 0.36 : 0 },
  subtitle: { fontSize: 22 + androidBump, fontWeight: '600' as const, lineHeight: 28, letterSpacing: Platform.OS === 'ios' ? 0.35 : 0 },
  heading: { fontSize: 17 + androidBump, fontWeight: '600' as const, lineHeight: 22, letterSpacing: Platform.OS === 'ios' ? -0.41 : 0 },
  body: { fontSize: 17 + androidBump, fontWeight: '400' as const, lineHeight: 22, letterSpacing: Platform.OS === 'ios' ? -0.41 : 0 },
  bodyStrong: { fontSize: 17 + androidBump, fontWeight: '600' as const, lineHeight: 22, letterSpacing: Platform.OS === 'ios' ? -0.41 : 0 },
  callout: { fontSize: 16 + androidBump, fontWeight: '400' as const, lineHeight: 21, letterSpacing: Platform.OS === 'ios' ? -0.32 : 0 },
  caption: { fontSize: 13 + androidBump, fontWeight: '400' as const, lineHeight: 18, letterSpacing: Platform.OS === 'ios' ? -0.08 : 0 },
  /** Haydovchi rejimi */
  driverBody: { fontSize: 19, fontWeight: '500' as const, lineHeight: 25 },
  driverButton: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
} as const;

/** iOS soya, Android elevation. */
export const elevation = {
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    android: { elevation: 2 },
    default: {},
  })!,
} as const;

export const hit = { minTarget: 48, driverTarget: 64 } as const;

// ───────── Rol skinlari: 3 rol = 3 xil dizayn ─────────
// Auth ekranlari `palette` (ECO yashil) da qoladi; rol tanlangach ThemeProvider shu skinlardan birini beradi.
export type RoleKey = 'TADBIRKOR' | 'QURUVCHI' | 'HAYDOVCHI';

/** Shakl — har rolda burchak yumaloqligi turlicha: Tadbirkor o'tkir (biznes), Quruvchi yumaloq (do'stona), Haydovchi o'rta-katta (qo'lqop). */
export interface Shape { card: number; button: number; input: number; chip: number }

export interface Skin {
  name: string;
  tagline: string;
  light: Palette;
  dark: Palette;
  shape: Shape;
  /** Haydovchi: tizim rejimidan qat'i nazar qorong'i "kabina" (tungi haydash, chalg'itmaydigan fon). */
  forceDark?: boolean;
}

/**
 * Rol tanasi (skin). Rang — hamma bo'limda BITTA: ilova ikonkasining ko'ki (#0A4CD5).
 * Bo'limlar bir-biridan rang bilan emas, SHAKL bilan ajraladi (burchak radiusi, tugma
 * o'lchami): ilova bitta mahsulotdek ko'rinishi kerak, ikonkasi ko'k bo'lib ichi yashil
 * yoki to'q sariq bo'lsa, u boshqa ilovaga o'xshab qoladi.
 */
export const skins: Record<RoleKey, Skin> = {
  /** Tadbirkor — "Boshqaruv": brend ko'ki + amber, salqin fon, o'tkir burchaklar, zich ma'lumot. */
  TADBIRKOR: {
    name: 'Boshqaruv',
    tagline: 'KPI, moliya, jamoa — bitta ekranda',
    light: {
      brandPrimary: '#0A4CD5', brandPrimarySoft: '#DCE8FF', brandAccent: '#FFA800',
      bgCanvas: '#F2F7FF', bgSurface: '#FFFFFF', bgSurfaceMuted: '#E7EFFB',
      textPrimary: '#0F172A', textSecondary: '#64748B', textOnBrand: '#FFFFFF', border: '#D8E4F2',
      success: '#0F8544', warning: '#B25C00', danger: '#C0001C', info: '#0062F0',
    },
    dark: {
      brandPrimary: '#4D8DFF', brandPrimarySoft: '#123063', brandAccent: '#FFC233',
      bgCanvas: '#0E1B31', bgSurface: '#172642', bgSurfaceMuted: '#203255',
      textPrimary: '#EDF3FC', textSecondary: '#A3B3C9', textOnBrand: '#0A1424', border: '#2C3F66',
      success: '#2EE39B', warning: '#FFB524', danger: '#FF6070', info: '#5FA8FF',
    },
    shape: { card: 10, button: 10, input: 10, chip: 6 },
  },
  /** Quruvchi — "Qurilish": brend ko'ki, yumaloq shakllar, katta asosiy tugma. */
  QURUVCHI: {
    name: 'Qurilish',
    tagline: 'Buyurtma bering, obyektni yuriting',
    light: {
      brandPrimary: '#0A4CD5', brandPrimarySoft: '#DCE8FF', brandAccent: '#FFA800',
      bgCanvas: '#F5F8FF', bgSurface: '#FFFFFF', bgSurfaceMuted: '#E9F0FC',
      textPrimary: '#0F172A', textSecondary: '#64748B', textOnBrand: '#FFFFFF', border: '#D9E4F5',
      success: '#0F8544', warning: '#B25C00', danger: '#C0001C', info: '#0062F0',
    },
    dark: {
      brandPrimary: '#4D8DFF', brandPrimarySoft: '#123063', brandAccent: '#FFC233',
      bgCanvas: '#0E1522', bgSurface: '#182133', bgSurfaceMuted: '#222E44',
      textPrimary: '#EDF3FC', textSecondary: '#A3B3C9', textOnBrand: '#0A1424', border: '#2C3B57',
      success: '#2EE39B', warning: '#FFB524', danger: '#FF6070', info: '#5FA8FF',
    },
    shape: { card: 22, button: 26, input: 16, chip: 999 },
  },
  /** Haydovchi — "Kabina": doim qorong'i (tungi haydash), brend ko'ki, katta nishonlar. */
  HAYDOVCHI: {
    name: 'Kabina',
    tagline: 'Bitta yuk, bitta tugma',
    forceDark: true,
    light: {
      brandPrimary: '#0A4CD5', brandPrimarySoft: '#DCE8FF', brandAccent: '#FFA800',
      bgCanvas: '#FFFFFF', bgSurface: '#F2F7FC', bgSurfaceMuted: '#E3ECF6',
      textPrimary: '#020617', textSecondary: '#475569', textOnBrand: '#FFFFFF', border: '#C6D3E6',
      success: '#0F8544', warning: '#B25C00', danger: '#C0001C', info: '#0A4FC4',
    },
    dark: {
      brandPrimary: '#4D8DFF', brandPrimarySoft: '#123063', brandAccent: '#FFC233',
      bgCanvas: '#0A1017', bgSurface: '#16202C', bgSurfaceMuted: '#212D3D',
      textPrimary: '#F8FAFC', textSecondary: '#A8B6C9', textOnBrand: '#FFFFFF', border: '#2E3D51',
      success: '#4DEB90', warning: '#FFCB3D', danger: '#FF8089', info: '#5FA8FF',
    },
    shape: { card: 18, button: 18, input: 14, chip: 10 },
  },
};

/** Auth va rol tanlanmagan holat — ECO brend yashili, standart shakl. */
export const defaultSkin: Skin = {
  name: 'ECO', tagline: '', light: palette.light, dark: palette.dark,
  shape: { card: radius.card, button: radius.button, input: radius.md, chip: radius.full },
};

/** Fon rangiga qarab o'qiladigan matn rangi (yorqin yashil/apelsin ustida qora, to'q ko'k ustida oq). */
export function onColor(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6), 16);
  const lum = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lum((n >> 16) & 255) + 0.7152 * lum((n >> 8) & 255) + 0.0722 * lum(n & 255);
  return L > 0.4 ? '#0B1220' : '#FFFFFF';
}

// ───────────────────────── Insof ERP — maket bo'yicha ─────────────────────────
// Dizayn manbai: "ERP Mobil — 9 rol uchun dizayn" kanvasi.
// Yer rangi — iliq qog'oz (#F3F1EC), yuzalar oq, chegara issiq kulrang; asosiy ko'rsatkich
// qora siyoh kartochkada turadi. Har bo'limning o'z "ink" rangi va shu rangning ochiq "tint" i bor.

export type ErpRoleKey = 'DIRECTOR' | 'SALES' | 'PRODUCTION' | 'SUPERVISOR' | 'LOGISTICS' | 'WAREHOUSE' | 'PROCUREMENT' | 'ACCOUNTING' | 'FINANCE' | 'HR' | 'CASHIER' | 'DRIVER' | 'BRIGADIER';

/** Bo'lim rangi: [ink — matn va ikon, tint — ikon kvadrati foni, darkInk — qorong'i rejada]. */
/**
 * Bo'lim rangi: [ink — matn va ikon, tint — ikon kvadrati foni, darkInk — qorong'i rejada].
 *
 * Hamma bo'limda BITTA rang — ilova ikonkasining ko'ki. Ilgari har rolga alohida rang
 * berilgandi (haydovchi yashil, sotuv qizil...), lekin ilova ikonkasi ko'k bo'lib ichi
 * har xil rangda bo'lsa, u bitta mahsulotdek ko'rinmaydi. Bo'limlar bir-biridan nomi va
 * ikonkasi bilan ajraladi.
 */
const ERP_ROLE_COLOR: Record<ErpRoleKey, [ink: string, tint: string, darkInk: string]> = {
  DIRECTOR:    ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  SALES:       ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  PRODUCTION:  ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  SUPERVISOR:  ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  LOGISTICS:   ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  WAREHOUSE:   ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  PROCUREMENT: ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  ACCOUNTING:  ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  FINANCE:     ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  HR:          ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  CASHIER:     ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  DRIVER:      ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
  BRIGADIER:   ['#0A4CD5', '#DCE8FF', '#4D8DFF'],
};

export const ERP_ROLE_NAME: Record<ErpRoleKey, string> = {
  DIRECTOR: 'Direktor', SALES: 'Sotuv', PRODUCTION: 'Ishlab chiqarish', SUPERVISOR: 'Ish boshqaruvchi',
  LOGISTICS: 'Logistika', WAREHOUSE: 'Sklad', PROCUREMENT: 'Snabjeniye', ACCOUNTING: 'Buxgalteriya',
  FINANCE: 'Moliya', HR: 'Otdel kadr', CASHIER: 'Kassa / bank', DRIVER: 'Haydovchi', BRIGADIER: 'Brigadir',
};

/**
 * Bo'lim rangi — noma'lum rol uchun ham javob qaytaradi.
 * ERP'da yangi rol paydo bo'lsa (masalan DRIVER) ilova eski versiyada qulab tushmaydi,
 * shunchaki direktor rangida chiziladi.
 */
const roleColor = (role: ErpRoleKey): [string, string, string] => ERP_ROLE_COLOR[role] ?? ERP_ROLE_COLOR.DIRECTOR;

/** Bo'lim ikonlari ortidagi ochiq kvadrat rangi. */
export const erpTint = (role: ErpRoleKey, dark: boolean) => {
  const [, tint, darkInk] = roleColor(role);
  return dark ? darkInk + '33' : tint;
};

/** Qora siyoh kartochka — bosh ko'rsatkich shu yerda turadi. */
export const INK = { bg: '#1A1F29', text: '#F7F6F2', muted: '#A8B2C0' } as const;

/** Holat chiplari — maketdagi juftliklar. */
export const CHIP: Record<'neutral' | 'info' | 'brand' | 'success' | 'warning' | 'danger', [bg: string, ink: string]> = {
  neutral: ['#EDF1F7', '#4A5566'],
  info:    ['#DCEDFF', '#0D5AAD'],
  brand:   ['#D4F5EF', '#00756A'],
  success: ['#D9F7E2', '#0F8544'],
  warning: ['#FFF0CC', '#8C5E00'],
  danger:  ['#FFE3D9', '#C4360D'],
};

const erpBase = {
  light: {
    brandPrimarySoft: '#FDFCFA', brandAccent: '#FFBE3D',
    bgCanvas: '#F8F6F1', bgSurface: '#FFFFFF', bgSurfaceMuted: '#FDFCFA',
    textPrimary: '#1A1F29', textSecondary: '#69727E', textOnBrand: '#FFFFFF', border: '#EAE5DC',
    success: '#0F8544', warning: '#8C5E00', danger: '#C4360D', info: '#0D5AAD',
  },
  dark: {
    brandPrimarySoft: '#1D222B', brandAccent: '#FFBE3D',
    bgCanvas: '#12151B', bgSurface: '#1D222B', bgSurfaceMuted: '#252C37',
    textPrimary: '#F5F4EF', textSecondary: '#AEB6C1', textOnBrand: '#12151B', border: '#343C48',
    success: '#4FD97F', warning: '#F0C04D', danger: '#FF8F5E', info: '#66AEFF',
  },
};

export function erpSkin(role: ErpRoleKey): Skin {
  const [ink, tint, darkInk] = roleColor(role);
  return {
    name: ERP_ROLE_NAME[role] ?? 'Insof ERP',
    tagline: 'Insof ERP',
    light: { ...erpBase.light, brandPrimary: ink, brandPrimarySoft: tint },
    dark: { ...erpBase.dark, brandPrimary: darkInk, textOnBrand: onColor(darkInk) },
    shape: { card: 14, button: 14, input: 13, chip: 999 },
    // Haydovchi doim qorong'i "kabina" da — tungi haydashda ekran chalg'itmasin
    forceDark: role === 'DRIVER',
  };
}

// ───────────────────────── Maket shriftlari ─────────────────────────
/**
 * Archivo — sarlavhalar (qalin, siqiq), IBM Plex Sans — matn, IBM Plex Mono — raqamlar va kodlar.
 * Raqam monoshriftda bo'lgani uchun ustma-ust turgan qiymatlar bir chiziqda ko'rinadi.
 * Shrift yuklanmasa `Txt` tizim shriftiga tushadi — ekran baribir to'g'ri chiziladi.
 */
export const FONT = {
  display: 'Archivo_700Bold',
  displayMid: 'Archivo_600SemiBold',
  body: 'IBMPlexSans_400Regular',
  bodyMid: 'IBMPlexSans_500Medium',
  bodyStrong: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_500Medium',
  monoStrong: 'IBMPlexMono_600SemiBold',
} as const;

/** ERP ekranlaridagi matn uslublari — maketdagi o'lchamlar. */
/**
 * Matn qutisiga zaxira kenglik, dp.
 *
 * Android matn kengligini o'lchaganda haqiqiydan bir oz kam chiqaradi va bitta piksel
 * yetmagani uchun butun bir harfni tashlab yuboradi: "Yetkazildi" → "Yetkazil…",
 * "20 dona" → "20 d…". Harf soni va shrift o'lchamiga mutanosib zaxira beramiz —
 * quti shunchaga kengayadi, matn esa to'liq chiqadi.
 *
 * `extra` — harf oralig'i (`letterSpacing`) bo'lgan joylar uchun.
 */
export const textRoom = (text: string, fontSize: number, extra = 0) =>
  text.length * (fontSize * 0.59 + extra);

export const erpText = {
  /** Bo'lim nomi sarlavha ustida: kichik, katta harf, keng oraliq. */
  eyebrow: { fontFamily: FONT.bodyStrong, fontSize: 10.5, letterSpacing: 0.95, textTransform: 'uppercase' as const },
  /** Ekran sarlavhasi (ism, hujjat raqami). */
  title: { fontFamily: FONT.display, fontSize: 19, letterSpacing: -0.3 },
  titleLg: { fontFamily: FONT.display, fontSize: 25, letterSpacing: -0.5 },
  /** Bo'limlar orasidagi kichik sarlavha. */
  section: { fontFamily: FONT.bodyStrong, fontSize: 12, letterSpacing: 0.9, textTransform: 'uppercase' as const },
  /** Ro'yxat qatori sarlavhasi. */
  rowTitle: { fontFamily: FONT.bodyStrong, fontSize: 13.5 },
  /** Qator ostidagi tafsilot — mono, chunki raqam va kod ko'p. */
  meta: { fontFamily: FONT.mono, fontSize: 11 },
  /** Katta ko'rsatkich. */
  hero: { fontFamily: FONT.monoStrong, fontSize: 30, letterSpacing: -0.6 },
  /** Kichik kartochkadagi ko'rsatkich. */
  stat: { fontFamily: FONT.monoStrong, fontSize: 19, letterSpacing: -0.2 },
  body: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 20 },
  label: { fontFamily: FONT.bodyStrong, fontSize: 11.5 },
  chip: { fontFamily: FONT.bodyStrong, fontSize: 10.5 },
  button: { fontFamily: FONT.display, fontSize: 15.5, letterSpacing: 0.15 },
  tab: { fontFamily: FONT.bodyStrong, fontSize: 10 },
} as const;
