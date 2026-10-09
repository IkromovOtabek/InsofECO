import { haversineMeters } from '../tracking/tracking.service';

/** Xaritaga chiziladigan nuqta. */
export interface TrackPoint { lat: number; lng: number; at: string }

export interface TrackSummary {
  /** Soddalashtirilgan iz — xaritadagi chiziq (vaqt bo'yicha tartiblangan). */
  points: TrackPoint[];
  /** Bosib o'tilgan yo'l, metr (iz bo'yicha, to'g'ri chiziq emas). */
  meters: number;
  /** Shu, km (0.1 aniqlikda) — ilova to'g'ridan-to'g'ri yozadi. */
  distanceKm: number;
  /** Harakatda o'tgan vaqt, daqiqa (svetofor/tirbandlikdagi turishlar chiqarilgan). */
  movingMinutes: number;
  /** Izdagi eng yuqori tezlik, km/soat. */
  maxSpeedKmh: number | null;
  /** Birinchi va oxirgi (soddalashtirilmagan) nuqta vaqti. */
  firstAt: string | null;
  lastAt: string | null;
  /** Serverdagi xom nuqtalar soni. */
  rawPoints: number;
}

/** Bundan yaqin nuqta — GPS drifti yoki turgan mashina: chiziqqa ham, masofaga ham qo'shilmaydi. */
const MIN_STEP_M = 15;
/** Bundan tez "harakat" — GPS sakrashi (shahar ichida yuk mashinasi bunday yurmaydi). */
const MAX_KMH = 180;
/** Harakat vaqti: shundan sekin bo'lgan oraliq — turish. */
const MOVING_KMH = 4;
/** Harakat vaqti: shundan uzun bo'shliq — aloqa/GPS uzilgan, vaqt hisobga olinmaydi. */
const MAX_GAP_MS = 5 * 60_000;
/** Xaritaga yuboriladigan nuqtalar chegarasi — uzun reysda javob og'irlashmasin. */
const MAX_POINTS = 1500;

/**
 * GPS izidan xarita chizig'i va statistikasi.
 *
 * Filtr: oldingi QABUL QILINGAN nuqtadan 15 m dan yaqini tashlanadi (turganda ham GPS bir
 * necha metr "yuradi"), 180 km/soat dan tez sakrash ham tashlanadi (tunnel, ko'p qavatli
 * uylar orasida nuqta yuz metrlab otiladi). Masofa — qolgan nuqtalar orasidagi haversine
 * yig'indisi. Uzoq aloqa uzilishidan keyingi kesma ham qo'shiladi (oraliq yo'l noma'lum, lekin
 * to'g'ri chiziq — eng kichik baho), faqat tezligi real bo'lsa.
 */
export function summarizeTrack(raw: { lat: number; lng: number; at: Date; speedKmh?: number | null }[]): TrackSummary {
  const pts = raw.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0));
  const kept: typeof pts = [];
  let meters = 0;
  let movingMs = 0;
  let maxSpeed: number | null = null;

  for (const p of pts) {
    const prev = kept[kept.length - 1];
    if (!prev) { kept.push(p); continue; }
    const step = haversineMeters(prev.lat, prev.lng, p.lat, p.lng);
    if (step < MIN_STEP_M) continue;
    const dtMs = p.at.getTime() - prev.at.getTime();
    const kmh = dtMs > 0 ? (step / 1000) / (dtMs / 3_600_000) : Infinity;
    if (kmh > MAX_KMH) continue; // sakrash — keyingi nuqta oldingi ishonchli nuqtaga solishtiriladi
    kept.push(p);
    meters += step;
    if (kmh >= MOVING_KMH && dtMs <= MAX_GAP_MS) movingMs += dtMs;
    if (p.speedKmh != null && p.speedKmh <= MAX_KMH && (maxSpeed == null || p.speedKmh > maxSpeed)) maxSpeed = p.speedKmh;
  }

  // Juda uzun izni siyraklashtiramiz (oxirgi nuqta har doim qoladi — chiziq manzilga yetsin)
  let line = kept;
  if (kept.length > MAX_POINTS) {
    const stride = Math.ceil(kept.length / MAX_POINTS);
    line = kept.filter((_, i) => i % stride === 0);
    const last = kept[kept.length - 1]!;
    if (line[line.length - 1] !== last) line.push(last);
  }

  const first = pts[0], last = pts[pts.length - 1];
  return {
    points: line.map((p) => ({ lat: p.lat, lng: p.lng, at: p.at.toISOString() })),
    meters: Math.round(meters),
    distanceKm: Math.round(meters / 100) / 10,
    movingMinutes: Math.round(movingMs / 60_000),
    maxSpeedKmh: maxSpeed != null ? Math.round(maxSpeed) : null,
    firstAt: first ? first.at.toISOString() : null,
    lastAt: last ? last.at.toISOString() : null,
    rawPoints: raw.length,
  };
}
