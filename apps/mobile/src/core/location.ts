import { brand } from '@/design/tokens';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { DEFAULT_RULES } from '@insof/shared';
import { kv } from './storage';
import { api } from './api';
import { discloseBackgroundLocation } from './bg-disclosure';

/**
 * Fon GPS — faqat faol reys davomida (batareya + shaxsiy hayot).
 * Nuqtalar lokal buferga → har 20 nuqta yoki flush() da HTTP orqali (WS bo'lmasa ham ishlaydi).
 */
export const GPS_TASK = 'insof.gps';
const BUF = 'gps.buffer';
const ACTIVE = 'gps.activeDeliveryId';
/**
 * Faol reys turi: beton reysi (`Delivery`, standart) yoki yuk (`Shipment`). Ikkalasi bitta
 * fon vazifasi va bitta bufer bilan ishlaydi — faqat yuboriladigan manzil farq qiladi.
 */
const KIND = 'gps.activeKind';
export type TrackKind = 'delivery' | 'shipment';
/** ~10 soatlik iz (har 15–30 s da nuqta) — undan eskisi tashlanadi. */
const MAX_BUF = 2000;
/** Bufer shu vaqtdan ko'p yuborilmay tursa — 20 nuqtani kutmay yuboriladi (server jonli xarita va "GPS jim" ogohlantirishi uchun). */
const FLUSH_EVERY_MS = 90_000;
const LAST_FLUSH = 'gps.lastFlushAt';

// ───────────────── Batareya tejash: yurish / turish rejimi ─────────────────

/**
 * Fon GPS ikki rejimda:
 *  - `moving` — odatdagi: har 15 s (Android), iOS'da har 50 m;
 *  - `still` — mashina turibdi (tezlik < 3 km/soat ketma-ket 4 nuqtada, ~1 daqiqa): Android'da
 *    daqiqada bir nuqta, iOS'da past aniqlik (~100 m, GPS kam ishlaydi) va masofa chegarasi YO'Q.
 * Yurish boshlansa (tezlik ≥ 8 km/soat yoki turgan joydan 100 m) — darhol `moving`.
 *
 * Ishonchlilik: Android'da ikkala rejimda ham masofa chegarasi 0 — turgan telefon ham daqiqada bir
 * nuqta yuboradi (server buni "tirik, lekin turibdi" deb biladi; aks holda "GPS jim" deyilardi).
 * iOS vaqt oralig'ini qo'llamaydi: ilgari `still` da 100 m masofa chegarasi bor edi — turgan telefon
 * umuman nuqta bermas va server soxta "GPS jim" ko'tarardi. Endi chegara 0: iOS joy o'zgarganda
 * (turganda ham GPS/Wi-Fi titrashi) nuqta beradi, JS esa `deferredUpdatesInterval` bilan daqiqada
 * bir uyg'otiladi. Bu KAFOLAT emas — iOS turgan telefonda yangilanishni baribir siyraklashtirishi
 * mumkin; shuning uchun server iOS'da turgan mashina jimligini 30 daqiqa kutadi va ilova ochiq
 * bo'lsa nuqtasiz `ping` yuboriladi (`gpsHeartbeat`).
 * Rejim almashganda vazifa yangi sozlama bilan qayta beriladi (foreground service to'xtamaydi).
 */
export type GpsMode = 'moving' | 'still';
const MODE = 'gps.mode';
const STILL_KMH = 3;
const MOVE_KMH = 8;
const STILL_FIXES = 4;
const WAKE_M = 100;

export function trackingOptions(mode: GpsMode): Location.LocationTaskOptions {
  const ios = Platform.OS === 'ios';
  const still = mode === 'still';
  return {
    accuracy: still && ios ? Location.Accuracy.Balanced : Location.Accuracy.High,
    timeInterval: (still ? 60 : DEFAULT_RULES.gpsIntervalSeconds) * 1000,
    distanceInterval: ios ? (still ? 0 : DEFAULT_RULES.gpsDistanceMeters) : 0,
    // iOS: ilova fonda bo'lsa JS vazifa shu oraliqda bir uyg'otiladi (nuqtalar native tomonda yig'iladi).
    // Android'da nuqtalar baribir shu oraliqda keladi — kechiktirish chegaradagi nuqtani keyingisiga surib yuborardi
    deferredUpdatesInterval: ios ? (still ? 60 : DEFAULT_RULES.gpsIntervalSeconds) * 1000 : 0,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    // Android: majburiy foreground service bildirishnomasi (Samsung One UI fon jarayonlarni o'ldiradi).
    // Har qayta berishda ham bo'lishi shart — bo'lmasa expo xizmatni to'xtatadi
    foregroundService: { notificationTitle: 'Insof ECO — reys davom etmoqda', notificationBody: 'Joylashuv dispetcher va quruvchiga uzatilmoqda', notificationColor: brand[500] },
  };
}

interface ModeState { mode: GpsMode; slow: number; anchor: { lat: number; lng: number } | null; last: { lat: number; lng: number; at: number } | null }
const readMode = (): ModeState => {
  try { const v = JSON.parse(kv.getString(MODE) ?? '') as ModeState; if (v && (v.mode === 'moving' || v.mode === 'still')) return v; } catch { /* yangi */ }
  return { mode: 'moving', slow: 0, anchor: null, last: null };
};

/** Bitta nuqta bo'yicha keyingi rejim (sof funksiya). Tezlik noma'lum bo'lsa — oldingi nuqtadan hisoblanadi. */
export function nextGpsMode(st: ModeState, fix: { lat: number; lng: number; at: number; speedKmh: number | null }): ModeState {
  const dt = st.last ? (fix.at - st.last.at) / 3_600_000 : 0;
  const kmh = fix.speedKmh ?? (st.last && dt > 0 ? metersBetween(st.last, fix) / 1000 / dt : null);
  const last = { lat: fix.lat, lng: fix.lng, at: fix.at };
  if (st.mode === 'moving') {
    const slow = kmh != null && kmh < STILL_KMH ? st.slow + 1 : 0;
    return slow >= STILL_FIXES ? { mode: 'still', slow: 0, anchor: { lat: fix.lat, lng: fix.lng }, last } : { ...st, slow, last };
  }
  const woke = (kmh != null && kmh >= MOVE_KMH) || (!!st.anchor && metersBetween(st.anchor, fix) >= WAKE_M);
  return woke ? { mode: 'moving', slow: 0, anchor: null, last } : { ...st, last };
}

interface Pt { lat: number; lng: number; speedKmh?: number; heading?: number; at: string }
/** Buferdagi buzilgan JSON fon vazifasini har safar yiqitmasin. */
const readBuf = (): Pt[] => { try { const v = JSON.parse(kv.getString(BUF) ?? '[]') as unknown; return Array.isArray(v) ? (v as Pt[]) : []; } catch { return []; } };

// Import paytidagi YAGONA yon ta'sir — vazifani ro'yxatga olish (app/_layout.tsx sovuq startda import qiladi,
// aks holda OS ilovani fonda uyg'otganda vazifa topilmaydi va nuqtalar yo'qoladi).

TaskManager.defineTask(GPS_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const deliveryId = kv.getString(ACTIVE);
  if (!deliveryId) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const buf = readBuf();
  const before = readMode();
  let mode = before;
  for (const l of locations) {
    // iOS noma'lum tezlikni -1 beradi — noma'lum, nol emas
    const speedKmh = l.coords.speed != null && l.coords.speed >= 0 ? l.coords.speed * 3.6 : undefined;
    // Yo'nalish noma'lum bo'lsa iOS -1 beradi — server 0..360 ni kutadi, aks holda butun paket rad etiladi
    buf.push({ lat: l.coords.latitude, lng: l.coords.longitude, speedKmh, heading: l.coords.heading != null && l.coords.heading >= 0 ? l.coords.heading : undefined, at: new Date(l.timestamp).toISOString() });
    mode = nextGpsMode(mode, { lat: l.coords.latitude, lng: l.coords.longitude, at: l.timestamp, speedKmh: speedKmh ?? null });
  }
  // Server uzoq vaqt qabul qilmasa bufer cheksiz o'smasin (har nuqtada butun JSON qayta yoziladi)
  kv.set(BUF, JSON.stringify(buf.slice(-MAX_BUF)));
  kv.set(MODE, JSON.stringify(mode));
  if (mode.mode !== before.mode) {
    // Xato bo'lsa eski sozlama bilan davom etadi — kuzatuv to'xtamaydi
    try { await Location.startLocationUpdatesAsync(GPS_TASK, trackingOptions(mode.mode)); } catch { /* keyingi nuqtada qayta */ }
  }
  const lastFlush = Number(kv.getString(LAST_FLUSH) ?? 0);
  if (buf.length >= 20 || Date.now() - lastFlush >= FLUSH_EVERY_MS) await flushGps();
});

/** Server "GPS jim" chegarasini platformaga moslaydi (iOS turgan telefonda nuqta bermaydi). */
const PLATFORM = Platform.OS === 'ios' ? 'ios' : 'android';

/**
 * Buferni yuborish. `ping: true` va bufer bo'sh bo'lsa (faqat yuk reysi) — nuqtasiz "tiriklik"
 * belgisi: ilova tirik, fon kuzatuvi yoqiq va GPS xizmati yoqiq. Joy O'YLAB TOPILMAYDI (oxirgi
 * nuqta qayta yuborilmaydi) — server faqat "telefon tirik" deb biladi.
 */
export async function flushGps(opts: { ping?: boolean } = {}) {
  const deliveryId = kv.getString(ACTIVE);
  const buf = readBuf();
  if (!deliveryId) return;
  const shipment = kv.getString(KIND) === 'shipment';
  if (buf.length === 0) {
    if (!opts.ping || !shipment) return;
    try {
      if (!(await Location.hasServicesEnabledAsync()) || !(await Location.hasStartedLocationUpdatesAsync(GPS_TASK))) return;
      kv.set(LAST_FLUSH, String(Date.now()));
      await api(`/shipments/${deliveryId}/gps`, { method: 'POST', body: { points: [], ping: new Date().toISOString(), platform: PLATFORM } });
    } catch { /* keyingi safar */ }
    return;
  }
  kv.set(LAST_FLUSH, String(Date.now()));
  try {
    if (shipment) await api(`/shipments/${deliveryId}/gps`, { method: 'POST', body: { points: buf.slice(0, 200), platform: PLATFORM } });
    else await api('/tracking/gps', { method: 'POST', body: { deliveryId, points: buf.slice(0, 200) } });
    kv.set(BUF, JSON.stringify(buf.slice(200)));
  } catch {
    /* keyingi safar */
  }
}

/**
 * Yurak urishi: oxirgi yuborishdan `FLUSH_EVERY_MS` o'tgan bo'lsa — bufer (bo'lsa) yoki nuqtasiz ping.
 * Fon vazifasi faqat joylashuv kelganda uyg'onadi — iOS turgan telefonda u jim qolishi mumkin;
 * shuning uchun buni ilova ochiq paytdagi taymer chaqiradi (`useShipmentGps`).
 */
export async function gpsHeartbeat() {
  const last = Number(kv.getString(LAST_FLUSH) ?? 0);
  if (Date.now() - last < FLUSH_EVERY_MS - 5_000) return;
  await flushGps({ ping: true });
}

export async function startTracking(deliveryId: string, kind: TrackKind = 'delivery') {
  // Tushuntirish oynasi tizim so'rovlaridan oldin — Google Play talabi (bg-disclosure.ts)
  const allowBg = await discloseBackgroundLocation(`eco:${deliveryId}`, 'dispetcher va quruvchiga');
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = allowBg ? await Location.requestBackgroundPermissionsAsync() : await Location.getBackgroundPermissionsAsync();
  // Boshqa reysning yuborilmagan nuqtalari yangi reys iziga tushmasin
  const prev = kv.getString(ACTIVE);
  if (prev && prev !== deliveryId) { await flushGps(); kv.delete(BUF); }
  kv.set(ACTIVE, deliveryId);
  kv.set(KIND, kind);
  kv.delete(MODE);
  // Fon kuzatuvi ishga tushmasa (iOS'da "Doimo" ruxsati yo'q, Android'da GPS o'chiq) ilova
  // yiqilmasin — reys baribir olib boriladi, faqat jonli iz bo'lmaydi.
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(GPS_TASK);
    if (!already) {
      await Location.startLocationUpdatesAsync(GPS_TASK, trackingOptions('moving'));
    }
  } catch {
    return false;
  }
  return bg.status === 'granted';
}

/** `onlyId` berilsa — faqat shu reys kuzatilayotgan bo'lsa to'xtatadi (boshqa reysga tegmaydi). */
export async function stopTracking(onlyId?: string) {
  if (onlyId && kv.getString(ACTIVE) !== onlyId) return;
  await flushGps();
  kv.delete(ACTIVE);
  kv.delete(KIND);
  kv.delete(MODE);
  // Yuborilmay qolganlari endi hech qaysi reysga tegishli emas — keyingi reys iziga tushmasin
  kv.delete(BUF);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK)) await Location.stopLocationUpdatesAsync(GPS_TASK);
  } catch { /* vazifa ro'yxatda yo'q — to'xtatadigan narsa ham yo'q */ }
}

export const activeTrackingId = () => kv.getString(ACTIVE) ?? null;

// ───────────────── Obyekt yonidami? (geofence) ─────────────────

/**
 * "Yetib keldim" / "Yetkazdim" faqat obyektdan shuncha metr ichida bosiladi.
 * Server ham aynan shu radius bilan tekshiradi (apps/api/src/modules/deliveries/geofence.ts) —
 * birini o'zgartirsangiz, ikkinchisini ham.
 */
export const SITE_RADIUS_M = 300;
/** GPS aniqligi bundan yomon bo'lsa haydovchiga "ochiq joyga chiqing" deb aytiladi. */
export const POOR_ACCURACY_M = 100;

export type LocationAccess = 'granted' | 'denied' | 'blocked' | 'services-off';

/**
 * Joylashuv ruxsati va GPS holati.
 * `blocked` — foydalanuvchi "boshqa so'ralmasin" degan: tizim oynasi endi chiqmaydi,
 * faqat Sozlamalardan yoqiladi (shuni aytmasak tugma "ishlamayapti" bo'lib ko'rinadi).
 */
export async function ensureForegroundLocation(): Promise<LocationAccess> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return 'services-off';
    let p = await Location.getForegroundPermissionsAsync();
    if (p.status !== 'granted' && p.canAskAgain) p = await Location.requestForegroundPermissionsAsync();
    if (p.status === 'granted') return 'granted';
    return p.canAskAgain ? 'denied' : 'blocked';
  } catch {
    return 'denied';
  }
}

export interface Fix { lat: number; lng: number; accuracyM: number | null; at: number; mocked: boolean }

/**
 * Hozirgi aniq nuqta. Eski (keshdagi) nuqta OLINMAYDI: geofence uchun 10 daqiqa oldingi
 * joy — yolg'on. GPS javob bermasa `null` (cheksiz kutilmaydi).
 */
export async function currentFix(timeoutMs = 12_000): Promise<Fix | null> {
  try {
    const l = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!l) return null;
    return { lat: l.coords.latitude, lng: l.coords.longitude, accuracyM: l.coords.accuracy ?? null, at: l.timestamp, mocked: !!l.mocked };
  } catch {
    return null;
  }
}

export type SiteCheck =
  | { ok: true; fix: Fix; distanceM: number }
  | { ok: false; reason: 'services-off' | 'denied' | 'blocked' | 'no-fix' | 'mocked'; fix?: Fix }
  | { ok: false; reason: 'far'; fix: Fix; distanceM: number };

const R = 6371e3;
const rad = (x: number) => (x * Math.PI) / 180;
export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Haydovchi obyekt yonidami — ruxsat, GPS va masofa bitta joyda tekshiriladi. */
export async function checkAtSite(dest: { lat: number; lng: number }, radiusM = SITE_RADIUS_M): Promise<SiteCheck> {
  const access = await ensureForegroundLocation();
  if (access !== 'granted') return { ok: false, reason: access };
  const fix = await currentFix();
  if (!fix) return { ok: false, reason: 'no-fix' };
  // Android "soxta joylashuv" ilovalari — masofa tekshiruvini aldash uchun ishlatiladi
  if (fix.mocked) return { ok: false, reason: 'mocked', fix };
  const distanceM = Math.round(metersBetween(fix, dest));
  return distanceM <= radiusM ? { ok: true, fix, distanceM } : { ok: false, reason: 'far', fix, distanceM };
}
