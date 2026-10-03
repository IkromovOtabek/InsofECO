import { brand } from '@/design/tokens';
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
  for (const l of locations) {
    buf.push({ lat: l.coords.latitude, lng: l.coords.longitude, speedKmh: l.coords.speed != null ? Math.max(0, l.coords.speed * 3.6) : undefined, heading: l.coords.heading ?? undefined, at: new Date(l.timestamp).toISOString() });
  }
  kv.set(BUF, JSON.stringify(buf));
  if (buf.length >= 20) await flushGps();
});

export async function flushGps() {
  const deliveryId = kv.getString(ACTIVE);
  const buf = readBuf();
  if (!deliveryId || buf.length === 0) return;
  try {
    await api('/tracking/gps', { method: 'POST', body: { deliveryId, points: buf.slice(0, 200) } });
    kv.set(BUF, JSON.stringify(buf.slice(200)));
  } catch {
    /* keyingi safar */
  }
}

export async function startTracking(deliveryId: string) {
  // Tushuntirish oynasi tizim so'rovlaridan oldin — Google Play talabi (bg-disclosure.ts)
  const allowBg = await discloseBackgroundLocation(`eco:${deliveryId}`, 'dispetcher va quruvchiga');
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = allowBg ? await Location.requestBackgroundPermissionsAsync() : await Location.getBackgroundPermissionsAsync();
  kv.set(ACTIVE, deliveryId);
  // Fon kuzatuvi ishga tushmasa (iOS'da "Doimo" ruxsati yo'q, Android'da GPS o'chiq) ilova
  // yiqilmasin — reys baribir olib boriladi, faqat jonli iz bo'lmaydi.
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(GPS_TASK);
    if (!already) {
      await Location.startLocationUpdatesAsync(GPS_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: DEFAULT_RULES.gpsIntervalSeconds * 1000,
        distanceInterval: DEFAULT_RULES.gpsDistanceMeters,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        // Android: majburiy foreground service bildirishnomasi (Samsung One UI fon jarayonlarni o'ldiradi)
        foregroundService: { notificationTitle: 'Insof ECO — reys davom etmoqda', notificationBody: 'Joylashuv dispetcher va quruvchiga uzatilmoqda', notificationColor: brand[500] },
      });
    }
  } catch {
    return false;
  }
  return bg.status === 'granted';
}

export async function stopTracking() {
  await flushGps();
  kv.delete(ACTIVE);
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
