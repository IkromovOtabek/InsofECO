import { brand } from '@/design/tokens';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { kv } from './storage';
import { erpApi } from './erp';
import { ApiException } from './api';
import { discloseBackgroundLocation } from './bg-disclosure';
import { nextGpsMode, type GpsMode } from './location';
import {
  appendPoints, heartbeatDue, runFlush, stopOf, toTrackPoint, trackBody,
  type TrackBuffer, type TrackPoint,
} from './erp-track-logic';

/**
 * Zavod haydovchisining fon GPS'i — faqat faol reys davomida (batareya + shaxsiy hayot).
 *
 * `core/location.ts` dan ajratilgan: u ECO ilovasidagi pudratchi haydovchi uchun va
 * nuqtalarni ECO serveriga yuboradi. Zavod haydovchisi ERP logini bilan kiradi, ECO
 * hisobiga ega emas — shuning uchun alohida vazifa nomi va alohida manzil.
 *
 * Nuqtalar lokal buferga (qaysi reysniki ekani bilan) yig'iladi va 500 tadan bo'lib yuboriladi:
 * tunnel yoki aloqasiz joyda yo'l yo'qolmasin. Server `stop: true` desa (reys yopilgan, bekor
 * qilingan, boshqa haydovchiga o'tgan) — kuzatuv to'xtaydi va shu reys buferi tozalanadi.
 * Sof mantiq (filtr, bo'lish, stop) — `erp-track-logic.ts` (unit test bilan).
 */
export const ERP_GPS_TASK = 'insof.erp.gps';
const BUF = 'erp.gps.buffer';
const ACTIVE = 'erp.gps.activeTripId';
const LAST_SENT = 'erp.gps.lastSentAt';
const MODE = 'erp.gps.mode';
/**
 * Necha soniyada bir yuborish. Logistika xaritani 12–15 soniyada bir yangilaydi, shuning uchun
 * bundan ko'p kutish ma'nosiz — dispetcher mashinani kechikkan joyda ko'rardi.
 */
const SEND_EVERY_MS = 30_000;
/** Bufer shuncha to'lsa — vaqtni kutmaymiz (aloqasiz joydan chiqqanda darhol bo'shatish uchun). */
const SEND_AT_POINTS = 10;
/** Bitta flush'da ko'pi bilan shuncha bo'lak (2000 nuqtalik bufer — 4 so'rov) — fon vazifasi uzoq osilmasin. */
const MAX_CHUNKS_PER_FLUSH = 4;
const PLATFORM: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

// ───────────────── Bufer ─────────────────

/** Eski ilova buferi oddiy massiv edi — faol reysga tegishli deb olinadi. */
function readBuf(): TrackBuffer {
  try {
    const v = JSON.parse(kv.getString(BUF) ?? 'null') as unknown;
    if (Array.isArray(v)) return { tripId: kv.getString(ACTIVE) ?? null, points: v as TrackPoint[] };
    if (v && typeof v === 'object' && Array.isArray((v as TrackBuffer).points)) return v as TrackBuffer;
  } catch { /* buzilgan JSON — bo'sh */ }
  return { tripId: null, points: [] };
}
const writeBuf = (b: TrackBuffer) => { if (b.points.length) kv.set(BUF, JSON.stringify(b)); else kv.delete(BUF); };

// ───────────────── Batareya tejash: yurish / turish ─────────────────

/**
 * ECO kuzatuvidagi bilan bir xil ikki rejim (`location.ts` → `nextGpsMode`):
 *  - `moving` — har 15 s, aniq GPS; iOS'da 50 m masofa chegarasi;
 *  - `still` — turibdi (~1 daqiqa sekin): daqiqada bir nuqta, iOS'da past aniqlik.
 * Android'da masofa chegarasi 0: turgan telefon ham vazifani uyg'otadi — shu payt "tirikman" ketadi.
 */
type ModeState = Parameters<typeof nextGpsMode>[0];
const readMode = (): ModeState => {
  try { const v = JSON.parse(kv.getString(MODE) ?? '') as ModeState; if (v && (v.mode === 'moving' || v.mode === 'still')) return v; } catch { /* yangi */ }
  return { mode: 'moving', slow: 0, anchor: null, last: null };
};

function erpTrackingOptions(mode: GpsMode): Location.LocationTaskOptions {
  const ios = PLATFORM === 'ios';
  const still = mode === 'still';
  return {
    accuracy: still && ios ? Location.Accuracy.Balanced : Location.Accuracy.High,
    timeInterval: (still ? 60 : 15) * 1000,
    distanceInterval: ios && !still ? 50 : 0,
    // iOS: fonda JS shu oraliqda bir uyg'otiladi — "tirikman" ham shu payt ketadi
    deferredUpdatesInterval: ios ? (still ? 60 : 15) * 1000 : 0,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    // Android: majburiy bildirishnoma — Samsung One UI fon jarayonlarni o'ldiradi (har qayta berishda ham)
    foregroundService: {
      notificationTitle: 'Insof ERP — reys davom etmoqda',
      notificationBody: 'Joylashuv logistika bo\'limiga uzatilmoqda',
      notificationColor: brand[500],
    },
  };
}

// ───────────────── Fon vazifasi ─────────────────

TaskManager.defineTask(ERP_GPS_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const tripId = kv.getString(ACTIVE);
  if (!tripId) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const pts: TrackPoint[] = [];
  const before = readMode();
  let mode = before;
  for (const l of locations) {
    const p = toTrackPoint(l);
    if (!p) continue; // aniqligi yomon yoki buzuq — server baribir tashlaydi
    pts.push(p);
    mode = nextGpsMode(mode, { lat: p.lat, lng: p.lng, at: l.timestamp, speedKmh: p.speedKmh ?? null });
  }
  // Boshqa reysning qolgan nuqtalari — avval o'z reysi bilan yuboriladi (startErpTracking odatda buni qilgan)
  const prev = readBuf();
  if (prev.tripId && prev.tripId !== tripId && prev.points.length) await flushErpGps();
  const next = appendPoints(readBuf(), tripId, pts);
  writeBuf(next);
  kv.set(MODE, JSON.stringify(mode));
  if (mode.mode !== before.mode) {
    try { await Location.startLocationUpdatesAsync(ERP_GPS_TASK, erpTrackingOptions(mode.mode)); } catch { /* eski sozlama bilan davom */ }
  }
  const last = Number(kv.getString(LAST_SENT) ?? 0);
  const now = Date.now();
  // Nuqta bo'lsa — 30 s / 10 nuqtada; bo'lmasa (turibdi, aniqlik yomon) — 60 s da nuqtasiz "tirikman"
  const due = next.points.length ? next.points.length >= SEND_AT_POINTS || now - last >= SEND_EVERY_MS : heartbeatDue(last, now);
  if (due) await flushErpGps();
});

// ───────────────── Yuborish ─────────────────

let flushing: Promise<void> | null = null;

/**
 * Buferni serverga yuborish (500 tadan bo'lib). Bufer bo'sh va reys faol bo'lsa — nuqtasiz "tirikman".
 * Yubora olmasa nuqtalar joyida qoladi — keyingi safar ketadi (server takrorni tashlaydi, xavfsiz).
 * Bir vaqtda bitta yuborish: fon vazifasi va ekran bir nuqtani ikki marta jo'natmasin.
 */
export function flushErpGps(): Promise<void> {
  if (flushing) return flushing;
  flushing = doFlush().finally(() => { flushing = null; });
  return flushing;
}

const doFlush = () => runFlush({ read: readBuf, write: writeBuf, active: () => kv.getString(ACTIVE) ?? null, send: sendTrack }, MAX_CHUNKS_PER_FLUSH);

/** Bitta so'rov. `stopped` — server to'xtating dedi (buferi tozalandi). */
async function sendTrack(tripId: string, points: TrackPoint[]): Promise<'ok' | 'stopped' | 'error'> {
  try {
    const r = await erpApi<unknown>('/track', { method: 'POST', body: trackBody(tripId, points, PLATFORM) });
    kv.set(LAST_SENT, String(Date.now()));
    if (stopOf(r, 200)) { await handleStop(tripId); return 'stopped'; }
    return 'ok';
  } catch (e) {
    // 403 REASSIGNED / 404 — xato tanasida ham `stop: true` bo'lishi mumkin
    if (e instanceof ApiException && stopOf(e.body, e.status)) { await handleStop(tripId); return 'stopped'; }
    return 'error';
  }
}

/** Server "to'xtating" dedi: shu reys buferi tozalanadi, faol reys shu bo'lsa — fon kuzatuvi ham to'xtaydi. */
async function handleStop(tripId: string) {
  if (readBuf().tripId === tripId) kv.delete(BUF);
  if (kv.getString(ACTIVE) !== tripId) return;
  kv.delete(ACTIVE);
  kv.delete(LAST_SENT);
  kv.delete(MODE);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(ERP_GPS_TASK)) await Location.stopLocationUpdatesAsync(ERP_GPS_TASK);
  } catch { /* vazifa yo'q */ }
}

/**
 * "Tirikman" — ilova ochiq paytdagi taymerdan (`useErpHeartbeat`). Fon vazifasi faqat joylashuv kelganda
 * uyg'onadi, iOS turgan telefonda esa u jim qolishi mumkin. 60 s ichida hech narsa ketmagan bo'lsa —
 * bufer (bo'lsa) yoki nuqtasiz belgi. GPS o'chiq yoki kuzatuv yoqilmagan bo'lsa "tirik" deyilmaydi.
 */
export async function erpHeartbeat() {
  const buf = readBuf();
  if (!kv.getString(ACTIVE) && !buf.points.length) return;
  if (!heartbeatDue(Number(kv.getString(LAST_SENT) ?? 0), Date.now())) return;
  if (!buf.points.length) {
    try {
      if (!(await Location.hasServicesEnabledAsync()) || !(await Location.hasStartedLocationUpdatesAsync(ERP_GPS_TASK))) return;
    } catch { return; }
  }
  await flushErpGps();
}

/** Ilova ochiq turganda 20 s da bir `erpHeartbeat` (o'zi 60 s qoidasini tekshiradi). Root layout'da bir marta. */
export function useErpHeartbeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const on = () => { if (!timer) timer = setInterval(() => { void erpHeartbeat().catch(() => undefined); }, 20_000); };
    const off = () => { if (timer) clearInterval(timer); timer = null; };
    if (AppState.currentState === 'active') on();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? on() : off()));
    return () => { off(); sub.remove(); };
  }, []);
}

/**
 * Ekrandagi jonli nuqtani izga qo'shib, darhol yuborish.
 *
 * Reysni yopishdan oldin chaqiriladi: server "obyektga yetib keldimi?" degan qoidani
 * OXIRGI saqlangan nuqta bo'yicha tekshiradi (`lib/trips.ts`), fon vazifasi esa nuqtalarni
 * 15 soniyada bir oladi va 30 soniyada bir yuboradi. Yubormasdan tursak, obyektga endigina
 * yetib kelgan haydovchiga "hali uzoqdasiz" deb javob berilardi.
 */
export async function pushErpFix(p: { lat: number; lng: number; speedKmh?: number; at?: number; accuracyM?: number | null }) {
  const tripId = kv.getString(ACTIVE);
  if (!tripId) return;
  const pt = toTrackPoint({
    timestamp: p.at ?? Date.now(),
    coords: { latitude: p.lat, longitude: p.lng, speed: p.speedKmh != null ? p.speedKmh / 3.6 : null, accuracy: p.accuracyM ?? null },
  });
  if (pt) writeBuf(appendPoints(readBuf(), tripId, [pt]));
  await flushErpGps();
}

/**
 * Hozirgi joylashuvni olib, darhol serverga yuborish.
 *
 * "Yetkazdim" qulflangan bo'lsa shu chaqiriladi. Muammo shunda: reys yo'lda, lekin ilova
 * yopilgan yoki telefon qayta yoqilgan bo'lsa, fon vazifasi qayta boshlanmaydi va server
 * oxirgi nuqtani eski deb biladi. Haydovchi esa obyektda turibdi va tugma ochilmaydi —
 * chiqish yo'li yo'q. Bu funksiya o'sha tuzoqni ochadi.
 */
export async function refreshErpPosition(tripId: string): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted' && (await Location.requestForegroundPermissionsAsync()).status !== 'granted') return false;
    const l = (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null))
      ?? (await Location.getLastKnownPositionAsync());
    if (!l) return false;
    // Kuzatuv to'xtagan bo'lsa ham nuqta ketishi kerak — buferni shu reysga bog'laymiz
    if (!kv.getString(ACTIVE)) kv.set(ACTIVE, tripId);
    await pushErpFix({ lat: l.coords.latitude, lng: l.coords.longitude, at: l.timestamp, accuracyM: l.coords.accuracy });
    return true;
  } catch {
    return false;
  }
}

/** Reys boshlanganda. `false` — fon ruxsati berilmagan: ilova ochiq turganda ishlaydi. */
export async function startErpTracking(tripId: string): Promise<boolean> {
  // Tushuntirish oynasi tizim so'rovlaridan oldin — Google Play talabi (bg-disclosure.ts)
  const allowBg = await discloseBackgroundLocation(`erp:${tripId}`, 'logistika bo\'limiga');
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = allowBg ? await Location.requestBackgroundPermissionsAsync() : await Location.getBackgroundPermissionsAsync();
  // Boshqa reysning yuborilmagan nuqtalari — o'z reysi bilan yuboriladi; ketmasa tashlanadi (yangi izga tushmasin)
  const old = readBuf();
  if (old.tripId && old.tripId !== tripId && old.points.length) {
    await flushErpGps();
    if (readBuf().tripId !== tripId) kv.delete(BUF);
  }
  const fresh = kv.getString(ACTIVE) !== tripId;
  kv.set(ACTIVE, tripId);
  kv.set(LAST_SENT, '0'); // birinchi nuqta darhol ketsin — dispetcher mashinani kutmasin
  if (fresh) kv.delete(MODE);
  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(ERP_GPS_TASK))) {
      await Location.startLocationUpdatesAsync(ERP_GPS_TASK, erpTrackingOptions(readMode().mode));
    }
  } catch {
    // Fon kuzatuvi ishga tushmadi (iOS'da "Doimo" yo'q, Android'da GPS o'chiq) — reys baribir davom etadi
    return false;
  }
  return bg.status === 'granted';
}

/**
 * Reys yopilganda: qolgan nuqtalarni yuboradi va kuzatuvni to'xtatadi. Yubora olmagan nuqtalar
 * buferda o'z reysi bilan qoladi — keyingi taymer/flush ularni yuboradi (server yetkazilgan reysga
 * `deliveredAt` gacha bo'lganini qabul qiladi, keyin `stop` deydi). `discard` — hisobdan chiqildi: tashlanadi.
 */
export async function stopErpTracking(opts: { discard?: boolean } = {}) {
  if (!opts.discard) await flushErpGps();
  kv.delete(ACTIVE);
  kv.delete(LAST_SENT);
  kv.delete(MODE);
  if (opts.discard) kv.delete(BUF);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(ERP_GPS_TASK)) await Location.stopLocationUpdatesAsync(ERP_GPS_TASK);
  } catch { /* vazifa ro'yxatda yo'q */ }
}

export const activeErpTripId = () => kv.getString(ACTIVE) ?? null;
