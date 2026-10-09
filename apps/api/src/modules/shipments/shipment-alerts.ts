import { LatLng, SITE_RADIUS_M, haversineMeters } from '../deliveries/geofence';

/**
 * Yuk reysi kuzatuvining sof mantiqi (baza va vaqtsiz — testlanadi):
 *  - obyektga yetib kelish (GPS izi birinchi marta obyekt doirasiga kirdi);
 *  - "uzoq turibdi" — yo'lda (EN_ROUTE) mashina 20 daqiqadan beri joyidan siljimagan;
 *  - "GPS jim" — yo'lda 10 daqiqadan beri birorta nuqta kelmagan.
 *
 * Xabarlar bir marta ketadi: holat (incident) boshlanganda yuboriladi va vaqti `Shipment` ga
 * yoziladi; holat tugagach (mashina yurdi / GPS qaytdi) belgi tozalanadi — keyingi holat yana xabar beradi.
 */

/** Shundan uzoq turish — dispetcherga ogohlantirish. */
export const STOP_ALERT_MIN = 20;
/** Shundan uzoq GPS kelmasa — ogohlantirish. */
export const SILENT_ALERT_MIN = 10;
/**
 * iOS'da turgan telefon: tizim joylashuv yangilanishini ko'pincha butunlay to'xtatadi (harakat
 * yo'q — yangi nuqta ham yo'q). Oxirgi nuqtalar "turibdi" desa, jimlik shuncha kutiladi — bu
 * orada "uzoq turibdi" mantiqi ishlaydi (dispetcher baribir xabar oladi, lekin to'g'ri sabab bilan).
 */
export const IOS_STILL_SILENT_MIN = 30;
/** "Turibdi" tezligi (km/soat) — mobil `core/location.ts` dagi STILL_KMH bilan bir xil. */
export const STILL_KMH = 3;
/**
 * "Joyidan siljimagan" radiusi. Turgan telefonning GPS'i 20–80 m "yuradi"; 150 m — shahar ichidagi
 * xato sig'adi, lekin mashina bir ko'chadan ikkinchisiga o'tsa harakat deb hisoblanadi.
 */
export const STOP_RADIUS_M = 150;

export interface GpsFix extends LatLng { at: Date }
export interface GpsFixSpeed extends GpsFix { speedKmh?: number | null }

const valid = (p: LatLng) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);

/**
 * Obyekt doirasiga kirgan birinchi nuqta (vaqt bo'yicha). Obyekt nuqtasi noma'lum bo'lsa — null.
 * Nuqtalar tartibsiz kelishi mumkin (bufer, qayta yuborish) — shu yerda saralanadi.
 */
export function firstInsideSite(points: GpsFix[], site: LatLng | null, radiusM = SITE_RADIUS_M): GpsFix | null {
  if (!site) return null;
  const sorted = points.filter(valid).sort((a, b) => a.at.getTime() - b.at.getTime());
  return sorted.find((p) => haversineMeters(p, site) <= radiusM) ?? null;
}

/**
 * Mashina qachondan beri shu joyda turibdi: oxirgi nuqtadan orqaga — `STOP_RADIUS_M` ichidagi
 * uzluksiz nuqtalarning eng birinchisi vaqti. Nuqta yo'q — null.
 * Oxirgi nuqtagacha kelgan harakat bu vaqtni "yangilaydi" — demak u turishning boshlanishi.
 */
export function standingSince(points: GpsFix[], radiusM = STOP_RADIUS_M): Date | null {
  const sorted = points.filter(valid).sort((a, b) => a.at.getTime() - b.at.getTime());
  const last = sorted[sorted.length - 1];
  if (!last) return null;
  let since = last.at;
  for (let i = sorted.length - 2; i >= 0; i--) {
    const p = sorted[i]!;
    if (haversineMeters(p, last) > radiusM) break;
    since = p.at;
  }
  return since;
}

/**
 * Oxirgi nuqtalar mashina turganini ko'rsatadimi: oxirgi nuqta tezligi < 3 km/soat (noma'lum —
 * oldingi nuqtaga qarab) va undan oldingi nuqta 150 m ichida. Bitta nuqta — bilmaymiz (false).
 */
export function lastSeenStationary(points: GpsFixSpeed[], radiusM = STOP_RADIUS_M): boolean {
  const sorted = points.filter(valid).sort((a, b) => a.at.getTime() - b.at.getTime());
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  if (!last || !prev) return false;
  if (last.speedKmh != null && last.speedKmh >= STILL_KMH) return false;
  return haversineMeters(prev, last) <= radiusM;
}

/** Ikki vaqtdan kechrog'i (biri yo'q bo'lsa — ikkinchisi). */
export const latest = (a: Date | null | undefined, b: Date | null | undefined): Date | null =>
  !a ? b ?? null : !b ? a : a.getTime() >= b.getTime() ? a : b;

export interface WatchInput {
  now: Date;
  /** "Yo'lga chiqdim" vaqti — GPS jimligi shundan hisoblanadi (hali nuqta kelmagan bo'lsa). */
  departedAt: Date | null;
  /**
   * Telefondan oxirgi "tiriklik" vaqti: oxirgi nuqta yoki nuqtasiz `ping` (ilova tirik, kuzatuv
   * yoqiq, GPS xizmati yoqiq) — qaysi biri kechroq bo'lsa (`latest`).
   */
  lastGpsAt: Date | null;
  /** Telefon iOS va oxirgi nuqtalar "turibdi" — jimlik chegarasi `IOS_STILL_SILENT_MIN`. */
  iosStill?: boolean;
  /** `standingSince` natijasi. */
  standingSince: Date | null;
  stopAlertAt: Date | null;
  silentAlertAt: Date | null;
}

export interface WatchDecision {
  /** Necha daqiqadan beri GPS yo'q (jim bo'lsa), aks holda null. */
  silentMin: number | null;
  /** Necha daqiqadan beri turibdi (uzoq tursa), aks holda null. */
  stoppedMin: number | null;
  silent: 'send' | 'clear' | null;
  stop: 'send' | 'clear' | null;
}

const minutes = (ms: number) => Math.floor(ms / 60_000);

/**
 * Bitta yo'ldagi reys bo'yicha qaror: qaysi ogohlantirish yuborilsin / qaysi belgisi tozalansin.
 *
 * - GPS jim bo'lsa "turibdi" baholanmaydi (oxirgi ma'lumot eskirgan — turganini bilmaymiz)
 *   va uning belgisi ham tozalanmaydi.
 * - Turish vaqti hozirgacha hisoblanadi: GPS tirik (oxirgi nuqta 10 daqiqadan yangi) va hamma
 *   nuqtalar bir joyda bo'lsa, mashina hozir ham o'sha yerda.
 * - iOS'da turgan mashina (`iosStill`): jimlik 30 daqiqagacha kutiladi — iOS turgan telefonda
 *   nuqta bermaydi; bu orada "turibdi" ogohlantirishi o'z vaqtida (20 daq) ketadi.
 */
export function decideWatch(s: WatchInput): WatchDecision {
  const now = s.now.getTime();
  const ref = s.lastGpsAt ?? s.departedAt;
  const silentMs = ref ? now - ref.getTime() : 0;
  const silentLimit = (s.iosStill ? IOS_STILL_SILENT_MIN : SILENT_ALERT_MIN) * 60_000;
  const isSilent = !!ref && silentMs >= silentLimit;

  const standMs = s.standingSince ? now - s.standingSince.getTime() : 0;
  const isStopped = !isSilent && !!s.standingSince && standMs >= STOP_ALERT_MIN * 60_000;

  return {
    silentMin: isSilent ? minutes(silentMs) : null,
    stoppedMin: isStopped ? minutes(standMs) : null,
    silent: isSilent ? (s.silentAlertAt ? null : 'send') : s.silentAlertAt ? 'clear' : null,
    stop: isStopped ? (s.stopAlertAt ? null : 'send') : !isSilent && s.stopAlertAt ? 'clear' : null,
  };
}

// ───────────────── Marshrutdan chetlashish ─────────────────

/** Oxirgi nuqtalar rejadagi yo'ldan shundan uzoq bo'lsa — "chetga chiqdi". */
export const OFF_ROUTE_M = 500;
/** Yo'lga shundan yaqin qaytsa — holat tugadi (belgi tozalanadi). 300–500 m — oraliq, o'zgarmaydi. */
export const BACK_ON_ROUTE_M = 300;
/** Chetlashish shuncha davom etsa xabar beriladi (bitta sakrash yoki qisqa aylanib o'tish emas). */
export const OFF_ROUTE_MIN_MS = 2 * 60_000;
/** Kamida shuncha ketma-ket nuqta. */
export const OFF_ROUTE_MIN_FIXES = 3;
/** Oxirgi nuqta bundan eski bo'lsa baholanmaydi (GPS jim — u alohida ogohlantirish). */
export const OFF_ROUTE_FRESH_MS = 10 * 60_000;

/**
 * Nuqtadan kesmagacha masofa, metr. Kichik masofalarda (bir necha km) tekis proeksiya
 * (ekvirektangulyar, nuqta kengligida) — xato < 0.1 %, haversine'dan ancha arzon.
 */
export function pointToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const k = Math.cos((p.lat * Math.PI) / 180);
  const x = (q: LatLng) => ((q.lng - p.lng) * Math.PI / 180) * k * R;
  const y = (q: LatLng) => ((q.lat - p.lat) * Math.PI / 180) * R;
  const ax = x(a), ay = y(a), bx = x(b), by = y(b);
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Nuqtadan siniq chiziqqacha eng qisqa masofa, metr. Chiziq bo'sh bo'lsa — Infinity. */
export function distanceToPolyline(p: LatLng, line: LatLng[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return haversineMeters(p, line[0]!);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const d = pointToSegmentMeters(p, line[i - 1]!, line[i]!);
    if (d < best) best = d;
  }
  return best;
}

/** Saqlangan rejadagi yo'l (JSON) — o'qib bo'lmasa bo'sh. */
export function parseRoute(v: unknown): LatLng[] {
  if (!Array.isArray(v)) return [];
  return v.filter((p): p is LatLng => !!p && typeof p === 'object' && valid(p as LatLng));
}

export interface OffRouteInput {
  now: Date;
  /** Rejadagi yo'l (haydovchi ilovasidagi Yandex yo'li). Yo'q bo'lsa — baholanmaydi. */
  route: LatLng[];
  /** Oxirgi nuqtalar (vaqt oynasi, masalan oxirgi 40 daqiqa). */
  points: GpsFix[];
  offRouteAlertAt: Date | null;
}

export interface OffRouteDecision {
  /** Oxirgi nuqtaning yo'ldan masofasi, metr (baholangan bo'lsa). */
  distanceM: number | null;
  /** Yo'ldan uzoq uzluksiz nuqtalarning birinchisi vaqti (chetlashish boshlangan), `send` da. */
  since: Date | null;
  action: 'send' | 'clear' | null;
}

/**
 * Marshrutdan chetlashish: oxirgi nuqtadan orqaga — yo'ldan 500 m dan uzoq uzluksiz nuqtalar;
 * ular kamida 3 ta va 2 daqiqadan uzoq davom etgan bo'lsa — "chetga chiqdi" (bir marta).
 * Oxirgi nuqta yo'lga 300 m dan yaqin — belgi tozalanadi. Eski (10 daq+) ma'lumotda qaror yo'q.
 */
export function decideOffRoute(s: OffRouteInput): OffRouteDecision {
  const sorted = s.points.filter(valid).sort((a, b) => a.at.getTime() - b.at.getTime());
  const last = sorted[sorted.length - 1];
  if (s.route.length < 2 || !last || s.now.getTime() - last.at.getTime() > OFF_ROUTE_FRESH_MS) return { distanceM: null, since: null, action: null };
  const lastD = distanceToPolyline(last, s.route);
  if (lastD <= BACK_ON_ROUTE_M) return { distanceM: Math.round(lastD), since: null, action: s.offRouteAlertAt ? 'clear' : null };
  if (lastD <= OFF_ROUTE_M || s.offRouteAlertAt) return { distanceM: Math.round(lastD), since: null, action: null };
  let first = last, n = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    if (distanceToPolyline(p, s.route) <= OFF_ROUTE_M) break;
    first = p; n++;
  }
  const off = n >= OFF_ROUTE_MIN_FIXES && last.at.getTime() - first.at.getTime() >= OFF_ROUTE_MIN_MS;
  return { distanceM: Math.round(lastD), since: off ? first.at : null, action: off ? 'send' : null };
}

/**
 * Yangi rejadagi yo'l qabul qilinadimi. Haydovchi ilovasi yo'ldan chiqqanda yo'lni yangi joydan
 * QAYTA QURADI — agar shu yo'l darhol saqlansa, chetlashish hech qachon aniqlanmasdi. Shuning uchun:
 *  - saqlangan yo'l yo'q yoki mashina saqlangan yo'lda (300 m ichida) — qabul (tirbandlik bo'yicha
 *    yangilangan yo'l, birinchi yo'l);
 *  - mashina yo'ldan chiqqan va dispetcher allaqachon xabar olgan (`offRouteAlertAt`) — qabul:
 *    yangi yo'l endi asos, belgi tozalanadi;
 *  - aks holda (chetlashish hali baholanmoqda) — rad: yo'l eski bo'yicha qoladi, ilova keyinroq qayta yuboradi.
 * Mashina joyi noma'lum (hali nuqta yo'q) — qabul.
 */
export function acceptPlannedRoute(s: { stored: LatLng[]; next: LatLng[]; pos: LatLng | null; offRouteAlertAt: Date | null }): { accept: boolean; clearAlert: boolean } {
  // Belgi faqat mashina YANGI yo'lda bo'lsa tozalanadi
  const onNext = !s.pos || distanceToPolyline(s.pos, s.next) <= BACK_ON_ROUTE_M;
  const clear = !!s.offRouteAlertAt && onNext;
  if (s.stored.length < 2 || !s.pos) return { accept: true, clearAlert: clear };
  if (distanceToPolyline(s.pos, s.stored) <= BACK_ON_ROUTE_M) return { accept: true, clearAlert: clear };
  if (s.offRouteAlertAt) return { accept: true, clearAlert: clear };
  return { accept: false, clearAlert: false };
}
