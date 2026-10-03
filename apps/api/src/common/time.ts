/**
 * Kun/hafta/oy chegaralari — O'zbekiston vaqti (Asia/Tashkent, UTC+5, yozgi vaqt yo'q).
 *
 * Server UTC (yoki boshqa TZ) da ishlaydi: `new Date().setHours(0)` server yarim tuni bo'ladi —
 * UTC da bu Toshkentda 05:00, ya'ni 00:00–05:00 oralig'idagi yozuvlar oldingi kunga tushardi.
 * "Bugun", "shu hafta", "shu oy" degan har bir so'rov SHU yerdagi funksiyalardan foydalansin.
 *
 * Qaytadigan qiymatlar — haqiqiy lahza (UTC Date): Toshkentdagi 00:00 = oldingi kun 19:00Z.
 * Yozgi vaqt yo'qligi sababli doimiy siljish yetarli (Intl/tz bazasi shart emas).
 */
export const TASHKENT_OFFSET_MS = 5 * 3600_000;
const DAY_MS = 86_400_000;

/** Toshkentdagi kalendar qismlari: yil, oy (0-11), kun, hafta kuni (0 = yakshanba). */
export function tashkentParts(date: Date = new Date()) {
  const s = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return { year: s.getUTCFullYear(), month: s.getUTCMonth(), day: s.getUTCDate(), weekday: s.getUTCDay() };
}

/** Toshkent kalendaridagi sana (y, m, d) 00:00 lahzasi. Oy/kun toshib ketsa Date.UTC o'zi to'g'rilaydi. */
export function tashkentMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - TASHKENT_OFFSET_MS);
}

/** `date` tushgan Toshkent kuni: [start, end). Yaroqsiz sana berilsa — bugun. */
export function tashkentDayRange(date: Date = new Date()) {
  const d = Number.isNaN(date.getTime()) ? new Date() : date;
  const p = tashkentParts(d);
  const start = tashkentMidnight(p.year, p.month, p.day);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export const startOfTashkentDay = (date: Date = new Date()) => tashkentDayRange(date).start;

/** Toshkent bo'yicha hafta boshi (dushanba 00:00). */
export function startOfTashkentWeek(date: Date = new Date()): Date {
  const p = tashkentParts(date);
  return tashkentMidnight(p.year, p.month, p.day - ((p.weekday + 6) % 7));
}

/** Toshkent bo'yicha oy boshi; `shift` — necha oy oldin/keyin. */
export function startOfTashkentMonth(date: Date = new Date(), shift = 0): Date {
  const p = tashkentParts(date);
  return tashkentMidnight(p.year, p.month + shift, 1);
}
