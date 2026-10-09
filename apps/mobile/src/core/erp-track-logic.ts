/**
 * ERP haydovchi GPS izining SOF mantig'i — React Native'siz, `scripts/erp-track-check.mts` shu faylni
 * to'g'ridan-to'g'ri sinaydi. Yon ta'sir (MMKV, tarmoq, fon vazifasi) `core/erp-track.ts` da.
 *
 * Server shartnomasi: ERP `src/lib/mobile/track.ts` (`POST /api/mobile/track`).
 */

/** Serverga ketadigan nuqta. Noma'lum maydon YUBORILMAYDI (iOS -1 beradi — u "noma'lum", nol emas). */
export interface TrackPoint { lat: number; lng: number; at: string; speedKmh?: number; heading?: number; accuracy?: number }

/** Bir yuborishda ko'pi bilan — serverdagi chek (`MAX_POINTS`). */
export const TRACK_CHUNK = 500;
/** Aniqligi shundan yomon nuqta (metr) server baribir tashlaydi — buferga ham qo'shilmaydi. */
export const MAX_ACCURACY_M = 100;
/** Reys faol, lekin shuncha vaqt hech narsa ketmagan bo'lsa — nuqtasiz "tirikman" (mashina turibdi). */
export const HEARTBEAT_MS = 60_000;
/** Bufer chegarasi (~8 soatlik iz) — server uzoq qabul qilmasa cheksiz o'smasin. */
export const MAX_BUF = 2000;

/** `expo-location` `LocationObject` ning bizga kerak qismi (testda soxtasi beriladi). */
export interface RawFix {
  timestamp: number;
  coords: { latitude: number; longitude: number; speed?: number | null; heading?: number | null; accuracy?: number | null };
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Tizim nuqtasi → yuboriladigan nuqta. `null` — buferga qo'shilmaydi (koordinata buzuq yoki
 * aniqligi 100 m dan yomon: shahar ichida ko'cha adashadi, server ham tashlaydi).
 * Tezlik m/s → km/soat (0–300), yo'nalish 0–360; manfiy yoki chegaradan tashqari — maydon yo'q.
 */
export function toTrackPoint(l: RawFix): TrackPoint | null {
  const { latitude: lat, longitude: lng, speed, heading, accuracy } = l.coords;
  if (!finite(lat) || !finite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  if (finite(accuracy) && accuracy > MAX_ACCURACY_M) return null;
  if (!finite(l.timestamp)) return null;
  const p: TrackPoint = { lat, lng, at: new Date(l.timestamp).toISOString() };
  if (finite(speed) && speed >= 0) { const kmh = speed * 3.6; if (kmh <= 300) p.speedKmh = Math.round(kmh * 10) / 10; }
  if (finite(heading) && heading >= 0 && heading <= 360) p.heading = Math.round(heading);
  if (finite(accuracy) && accuracy >= 0) p.accuracy = Math.round(accuracy);
  return p;
}

/** Lokal bufer — qaysi reysniki ekani bilan: boshqa reysning nuqtalari yangi reys iziga tushmasin. */
export interface TrackBuffer { tripId: string | null; points: TrackPoint[] }

/** Nuqtaning kaliti — bir xil vaqt + joy bitta nuqta (server ham `(tripId, at)` bo'yicha takrorni tashlaydi). */
const keyOf = (p: TrackPoint) => `${p.at}|${p.lat}|${p.lng}`;

/**
 * Buferga qo'shish. Boshqa reys buferi bo'lsa — almashtiriladi (eski nuqtalar chaqiruvchi
 * avval yuborib bo'lgan bo'ladi). Takror nuqta qo'shilmaydi, eng eskisi `MAX_BUF` dan oshsa tashlanadi.
 * Vaqti (`at`) bufer ichidagi nuqta bilan bir xil nuqta ham qo'shilmaydi: server izni `(tripId, at)`
 * bo'yicha saqlaydi va ikkinchisini baribir tashlaydi (`dropped`) — iOS bir fix'ni ikki marta berishi mumkin.
 */
export function appendPoints(buf: TrackBuffer, tripId: string, pts: TrackPoint[], max = MAX_BUF): TrackBuffer {
  const base = buf.tripId === tripId ? buf.points : [];
  const seen = new Set(base.map((p) => p.at));
  const next = [...base];
  for (const p of pts) { if (!seen.has(p.at)) { seen.add(p.at); next.push(p); } }
  return { tripId, points: next.slice(-max) };
}

/** Yuboriladigan bo'lak — eng eskilari, ko'pi bilan `TRACK_CHUNK`. */
export const nextChunk = (buf: TrackBuffer, size = TRACK_CHUNK) => buf.points.slice(0, size);

/**
 * Muvaffaqiyatli javobdan keyin: FAQAT yuborilganlar o'chiriladi. So'rov ketayotganda fon vazifasi
 * yangi nuqta qo'shgan bo'lishi mumkin — `slice(n)` ularni yo'qotib qo'yardi.
 */
export function ackSent(buf: TrackBuffer, tripId: string, sent: TrackPoint[]): TrackBuffer {
  if (buf.tripId !== tripId) return buf;
  const gone = new Set(sent.map(keyOf));
  return { tripId, points: buf.points.filter((p) => !gone.has(keyOf(p))) };
}

export type StopReason = 'CLOSED' | 'DELIVERED' | 'CANCELLED' | 'REASSIGNED' | 'NOT_FOUND' | string;

/**
 * Javobda (200 yoki 403/404 xato tanasi) `stop: true` bormi. Bor bo'lsa — kuzatuvni to'xtatish va shu reys
 * buferini tozalash kerak. Eski server `stop` bermaydi — `null`.
 */
export function stopOf(body: unknown, status?: number): StopReason | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as { stop?: unknown; reason?: unknown };
  if (o.stop !== true) return null;
  if (typeof o.reason === 'string' && o.reason) return o.reason;
  return status === 404 ? 'NOT_FOUND' : 'STOP';
}

/** "Tirikman" vaqti keldimi: oxirgi muvaffaqiyatli yuborishdan beri `HEARTBEAT_MS` o'tgan. */
export const heartbeatDue = (lastSentAt: number, now: number, every = HEARTBEAT_MS) => now - lastSentAt >= every;

/** Yuboriladigan so'rov tanasi. Bo'sh `points` — nuqtasiz "tirikman" (`heartbeat: true` + `ping`). */
export function trackBody(tripId: string, points: TrackPoint[], platform: 'ios' | 'android', now = Date.now()) {
  return points.length
    ? { tripId, points, platform }
    : { tripId, points: [] as TrackPoint[], heartbeat: true as const, ping: new Date(now).toISOString(), platform };
}

/** `runFlush` uchun tashqi dunyo (MMKV va tarmoq) — testda soxtasi beriladi. */
export interface FlushDeps {
  read: () => TrackBuffer;
  write: (b: TrackBuffer) => void;
  /** Hozir kuzatilayotgan reys (yo'q — `null`). */
  active: () => string | null;
  /**
   * Bitta so'rov. `stopped` — server `stop: true` dedi va chaqiruvchi shu reys buferini tozalab,
   * kuzatuvni to'xtatdi; `error` — tarmoq/server xatosi (bufer joyida qoladi).
   */
  send: (tripId: string, points: TrackPoint[]) => Promise<'ok' | 'stopped' | 'error'>;
}

/**
 * Buferni bo'laklab yuborish. Bufer bo'sh va reys faol — bitta nuqtasiz "tirikman".
 * Boshqa (eski) reysning qoldig'i — o'z `tripId` si bilan ketadi. Xatoda to'xtaydi (keyingi safar).
 */
export async function runFlush(d: FlushDeps, maxChunks = 4): Promise<void> {
  for (let i = 0; i < maxChunks; i++) {
    const buf = d.read();
    const tripId = buf.points.length ? buf.tripId : d.active();
    if (!tripId) return;
    const chunk = buf.tripId === tripId ? nextChunk(buf) : [];
    // Bo'sh bufer: faqat faol reysda va faqat birinchi aylanishda "tirikman"
    if (!chunk.length && (i > 0 || d.active() !== tripId)) return;
    const reply = await d.send(tripId, chunk);
    if (reply === 'error') return;
    if (reply === 'stopped') continue; // shu reys tozalandi — boshqa reys qoldig'i bo'lsa ham ketsin
    d.write(ackSent(d.read(), tripId, chunk));
    if (!chunk.length) return;
  }
}
