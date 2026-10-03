/**
 * Beton kalkulyatori — SOF funksiyalar (React'siz, serverga hech narsa ketmaydi).
 *
 * Birliklar: har maydonning o'z birligi bor (m / sm / dona) va hisobdan OLDIN metrga o'tkaziladi
 * (`toMeters`). Natija doim m³.
 *
 * Formulalar:
 *   Lenta poydevor  V = L(m) × B(sm→m) × H(sm→m)
 *   Plita           V = L(m) × B(m)    × T(sm→m)
 *   Ustun (kvadrat) V = N(dona) × a(sm→m)² × H(m)
 *   Ustun (dumaloq) V = N(dona) × π × (D(sm→m) / 2)² × H(m)
 *   Pol (styajka)   V = L(m) × B(m)    × T(sm→m)
 *
 * Zaxira: +5% (to'kilish, cho'kish, notekis qazilma). Buyurtma hajmi zaxirali hajmni 0,1 m³ gacha
 * YUQORIGA yaxlitlaydi (savat va mahsulot sahifasi ham 0,1 qadam bilan ishlaydi).
 * Mikserlar: ceil(buyurtma / MIXER_CAPACITY_M3) — serverdagi reyslarga bo'lish bilan bir xil
 * (`splitVolumeIntoTrips`, `@insof/shared/rules.ts`).
 *
 * Tekshiruv misollari (qo'lda hisoblangan, `calcResult` shu qiymatlarni beradi):
 *   Lenta: 48 m × 40 sm × 60 sm = 48 × 0,4 × 0,6 = 11,52 m³ → +5% = 12,096 → 12,1 m³ → 2 mikser (8 + 4,1)
 *   Plita: 10 m × 6 m × 20 sm   = 10 × 6 × 0,2   = 12 m³    → +5% = 12,6 m³           → 2 mikser
 *   Ustun: 8 × (40 sm)² × 3 m   = 8 × 0,16 × 3   = 3,84 m³  → +5% = 4,032 → 4,1 m³    → 1 mikser
 *   Ustun ⌀: 4 × π × 0,15² × 3  = 0,848 m³ (⌀30 sm, 3 m)    → +5% = 0,891 → 0,9 m³    → 1 mikser
 *   Pol:   12 m × 8 m × 10 sm   = 12 × 8 × 0,1   = 9,6 m³   → +5% = 10,08 → 10,1 m³   → 2 mikser
 *   Narx:  12,1 m³ × 780 000 so'm/m³ = 9 438 000 so'm
 *   Yaxlitlash: 10 m³ × 1,05 = 10,500000000000002 (float) → 10,5 m³ (10,6 EMAS — EPS bilan)
 */

export type ShapeKey = 'strip' | 'slab' | 'column' | 'round' | 'floor';
export type CalcUnit = 'm' | 'sm' | 'dona';
export type FieldKey = 'a' | 'b' | 'c';

export interface CalcField {
  key: FieldKey;
  label: string;
  unit: CalcUnit;
  placeholder: string;
  /** Ruxsat etilgan eng katta qiymat (shu maydon birligida) — xato kiritishdan himoya. */
  max: number;
  /** Faqat butun son (dona). */
  integer?: boolean;
}

export interface ShapeDef {
  label: string;
  fields: [CalcField, CalcField, CalcField];
}

export const SHAPES: Record<ShapeKey, ShapeDef> = {
  strip: {
    label: 'Lenta poydevor',
    fields: [
      { key: 'a', label: 'Uzunlik', unit: 'm', placeholder: '48', max: 2000 },
      { key: 'b', label: 'Kenglik', unit: 'sm', placeholder: '40', max: 300 },
      { key: 'c', label: 'Balandlik', unit: 'sm', placeholder: '60', max: 500 },
    ],
  },
  slab: {
    label: 'Plita',
    fields: [
      { key: 'a', label: 'Uzunlik', unit: 'm', placeholder: '10', max: 300 },
      { key: 'b', label: 'Eni', unit: 'm', placeholder: '6', max: 300 },
      { key: 'c', label: 'Qalinlik', unit: 'sm', placeholder: '20', max: 200 },
    ],
  },
  column: {
    label: 'Ustun',
    fields: [
      { key: 'a', label: 'Soni', unit: 'dona', placeholder: '8', max: 1000, integer: true },
      { key: 'b', label: 'Kesim tomoni', unit: 'sm', placeholder: '40', max: 300 },
      { key: 'c', label: 'Balandlik', unit: 'm', placeholder: '3', max: 100 },
    ],
  },
  round: {
    label: 'Svay',
    fields: [
      { key: 'a', label: 'Soni', unit: 'dona', placeholder: '4', max: 1000, integer: true },
      { key: 'b', label: 'Diametr', unit: 'sm', placeholder: '30', max: 300 },
      { key: 'c', label: 'Chuqurlik', unit: 'm', placeholder: '3', max: 60 },
    ],
  },
  floor: {
    label: 'Pol',
    fields: [
      { key: 'a', label: 'Uzunlik', unit: 'm', placeholder: '12', max: 300 },
      { key: 'b', label: 'Eni', unit: 'm', placeholder: '8', max: 300 },
      { key: 'c', label: 'Qalinlik', unit: 'sm', placeholder: '10', max: 100 },
    ],
  },
};

export const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[];

/** Zaxira ulushi: +5%. */
export const RESERVE = 0.05;
/**
 * Bitta mikser reysi, m³. Server ham shu standartni oladi: `dispatch.service.ts → defaultCapacity()`
 * (`?? 8`) va ERP integratsiyasi `vehicleCapacityM3 ?? 8`; seed'dagi mikserlar 7–10 m³.
 */
export const MIXER_CAPACITY_M3 = 8;
/** Bir hisobdagi eng katta hajm — undan katta bo'lsa kiritishda xato bor deb hisoblanadi. */
export const MAX_VOLUME_M3 = 5000;
/** Suzuvchi nuqta xatosini yutish uchun (10,5 × 10 = 105,00000000000001). */
const EPS = 1e-9;

export const toMeters = (v: number, u: CalcUnit) => (u === 'sm' ? v / 100 : v);

export type ParsedNum =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'zero' | 'negative' | 'tooBig' | 'notInteger' };

/**
 * Foydalanuvchi matnini songa: "0,4" va "0.4" ikkalasi ham 0,4; bo'shliqlar e'tiborsiz ("1 200" → 1200).
 * "1,2,3", "1.2.3", ",", "." → invalid; "0" → zero; "-3" → negative; max'dan katta → tooBig.
 *   parseNum('0,4') → 0.4   parseNum('12.') → 12   parseNum('') → empty   parseNum('1,2,3') → invalid
 */
export function parseNum(raw: string | undefined, f?: Pick<CalcField, 'max' | 'integer'>): ParsedNum {
  const s = (raw ?? '').replace(/[\s ]/g, '').replace(',', '.');
  if (!s) return { ok: false, reason: 'empty' };
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return { ok: false, reason: 'invalid' };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false, reason: 'invalid' };
  if (n < 0) return { ok: false, reason: 'negative' };
  if (n === 0) return { ok: false, reason: 'zero' };
  if (f?.integer && !Number.isInteger(n)) return { ok: false, reason: 'notInteger' };
  if (f && n > f.max) return { ok: false, reason: 'tooBig' };
  return { ok: true, value: n };
}

/** Kiritish maydoni uchun: faqat raqam va BITTA ajratgich (vergul yoki nuqta) qoladi. */
export function sanitizeInput(t: string, integer?: boolean): string {
  // Butun son maydonida kasr qismi tashlanadi ("12,5" → "12", "125" EMAS)
  if (integer) return (t.split(/[.,]/)[0] ?? '').replace(/[^0-9]/g, '').slice(0, 6);
  const digits = t.replace(/[^0-9.,]/g, '');
  const i = digits.search(/[.,]/);
  const out = i < 0 ? digits : digits.slice(0, i + 1) + digits.slice(i + 1).replace(/[.,]/g, '');
  return out.slice(0, 9);
}

export function fieldError(f: CalcField, raw: string | undefined): string | null {
  const p = parseNum(raw, f);
  if (p.ok || p.reason === 'empty') return null;
  if (p.reason === 'zero') return "0 dan katta";
  if (p.reason === 'negative') return 'Manfiy bo\'lmaydi';
  if (p.reason === 'notInteger') return 'Butun son';
  if (p.reason === 'tooBig') return `≤ ${f.max} ${f.unit}`;
  return "Noto'g'ri son";
}

/**
 * Birlikni adashtirish ehtimoli: sm maydoniga 1 dan kichik son (0,4 sm — ehtimol 0,4 m = 40 sm).
 * Hisob baribir kiritilgan qiymat bilan qilinadi — faqat ogohlantirish.
 */
export function unitHint(f: CalcField, raw: string | undefined): string | null {
  const p = parseNum(raw, f);
  if (!p.ok || f.unit !== 'sm' || p.value >= 1) return null;
  return `${f.label}: ${String(p.value).replace('.', ',')} sm? Ehtimol ${fmtPlain(p.value * 100)} sm`;
}

/** Hajm, m³. Biror maydon bo'sh yoki xato bo'lsa — null. */
export function volumeOf(shape: ShapeKey, raw: Partial<Record<FieldKey, string>>): number | null {
  const [fa, fb, fc] = SHAPES[shape].fields;
  const pa = parseNum(raw.a, fa), pb = parseNum(raw.b, fb), pc = parseNum(raw.c, fc);
  if (!pa.ok || !pb.ok || !pc.ok) return null;
  const a = toMeters(pa.value, fa.unit), b = toMeters(pb.value, fb.unit), c = toMeters(pc.value, fc.unit);
  switch (shape) {
    case 'column': return a * b * b * c;
    case 'round': return a * Math.PI * (b / 2) ** 2 * c;
    default: return a * b * c;
  }
}

/** Yuqoriga 0,1 gacha yaxlitlash (float xatosiz): 12,096 → 12,1; 10,5 → 10,5; 4,032 → 4,1. */
export const ceil01 = (n: number) => Math.ceil(n * 10 - EPS) / 10;
/** Oddiy 0,01 gacha yaxlitlash — ko'rsatish uchun. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CalcResult {
  /** Sof hajm, m³ (zaxirasiz). */
  volume: number;
  /** +5% bilan, 0,1 gacha yuqoriga. */
  withReserve: number;
  /** Buyurtma hajmi: zaxirali yoki mahsulotning eng kam hajmi (qaysi katta bo'lsa). */
  amount: number;
  /** Eng kam buyurtma qo'llandimi. */
  minApplied: boolean;
  /** Reyslar: [8, 4.1] — oxirgisi qoldiq. */
  trips: number[];
  /** amount × narx (so'm), narx bo'lmasa null. */
  sum: number | null;
  /** Hajm juda katta — kiritishda xato bo'lishi mumkin. */
  tooBig: boolean;
}

export function calcResult(volume: number | null, opts: { price?: number | null; minQty?: number | null; capacity?: number } = {}): CalcResult | null {
  if (volume == null || !(volume > 0)) return null;
  const capacity = opts.capacity && opts.capacity > 0 ? opts.capacity : MIXER_CAPACITY_M3;
  const withReserve = ceil01(volume * (1 + RESERVE));
  const min = opts.minQty && opts.minQty > 0 ? opts.minQty : 0;
  const minApplied = withReserve < min;
  const amount = minApplied ? min : withReserve;
  const count = Math.ceil(amount / capacity - EPS);
  const trips = Array.from({ length: count }, (_, i) => (i < count - 1 ? capacity : round2(amount - capacity * (count - 1))));
  const sum = opts.price != null && opts.price > 0 ? Math.round(amount * opts.price) : null;
  return { volume, withReserve, amount, minApplied, trips, sum, tooBig: volume > MAX_VOLUME_M3 };
}

/** "12,1" / "12" / "11,52" — keraksiz nollarsiz, vergul bilan (ko'pi 2 xona). */
export function fmtPlain(n: number, maxDigits = 2): string {
  const v = Number(n.toFixed(maxDigits));
  const [i, f] = String(v).split('.');
  return `${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${f ? `,${f}` : ''}`;
}
