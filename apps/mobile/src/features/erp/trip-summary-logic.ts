/**
 * Ro'yxat ekrani uchun reyslar yakuni (`GET /api/mobile/trip-track/summary?ids=`) — sof mantiq, RN'siz
 * (scripts/erp-track-check.mts shu faylni to'g'ridan-to'g'ri sinaydi).
 * Server: ERP `src/lib/mobile/trip-track.ts` → `mobileTripTrackSummary`. Chiziq (line/polyline) yo'q.
 */

/** Bitta reys yakuni — `trip-track` raqamlari bilan bir xil. */
export interface ErpTripSummary {
  distanceKm: number;
  totalSec: number;
  movingSec: number;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  /** true — yakun saqlangan, raqamlar endi o'zgarmaydi. */
  final: boolean;
  status: string;
}

/** Server bir so'rovda ko'pi bilan shuncha id qabul qiladi (ortig'i 400). */
export const SUMMARY_MAX_IDS = 100;

/** Takrorsiz, bo'shsiz, `max` tadan bo'laklar (oyda 100 dan ortiq reys bo'lsa bir necha so'rov). */
export function chunkIds(ids: readonly string[], max = SUMMARY_MAX_IDS): string[][] {
  const uniq = [...new Set(ids.filter((x) => typeof x === 'string' && x.length > 0))];
  const out: string[][] = [];
  for (let i = 0; i < uniq.length; i += max) out.push(uniq.slice(i, i + max));
  return out;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown): v is number | null => v === null || num(v);

/** Bitta element shartnomaga mosmi (eski/boshqa javob — tashlanadi). */
export const validSummary = (x: unknown): x is ErpTripSummary => {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return num(s.distanceKm) && num(s.totalSec) && num(s.movingSec) && numOrNull(s.avgSpeedKmh) && numOrNull(s.maxSpeedKmh)
    && typeof s.final === 'boolean' && typeof s.status === 'string';
};

/** Javob `{items: {[tripId]: ...}}` → yaroqli elementlar; shakli boshqa bo'lsa `null` (eski server). */
export function parseSummaryItems(r: unknown): Record<string, ErpTripSummary> | null {
  const items = r && typeof r === 'object' ? (r as { items?: unknown }).items : undefined;
  if (!items || typeof items !== 'object' || Array.isArray(items)) return null;
  const out: Record<string, ErpTripSummary> = {};
  for (const [id, v] of Object.entries(items as Record<string, unknown>)) if (validSummary(v)) out[id] = v;
  return out;
}

/** Ko'rsatadigan narsa bormi (reys hali yurmagan yoki iz yo'q — yo'q). */
export const summaryHasTrack = (s: ErpTripSummary | null | undefined): s is ErpTripSummary => !!s && (s.distanceKm > 0 || s.totalSec > 0);

/** Hammasi yakunlanganmi — unda qayta so'rash shart emas. */
export const allFinal = (items: Record<string, ErpTripSummary> | null | undefined, ids: readonly string[]) =>
  !!items && ids.every((id) => !items[id] || items[id]!.final);
