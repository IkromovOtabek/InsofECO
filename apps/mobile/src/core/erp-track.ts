import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { kv } from './storage';
import { erpApi } from './erp';

/**
 * Zavod haydovchisining fon GPS'i — faqat faol reys davomida (batareya + shaxsiy hayot).
 *
 * `core/location.ts` dan ajratilgan: u ECO ilovasidagi pudratchi haydovchi uchun va
 * nuqtalarni ECO serveriga yuboradi. Zavod haydovchisi ERP logini bilan kiradi, ECO
 * hisobiga ega emas — shuning uchun alohida vazifa nomi va alohida manzil.
 *
 * Nuqtalar lokal buferga yig'iladi va to'p-to'p yuboriladi: tunnel yoki aloqasiz joyda
 * yo'l yo'qolmasin.
 */
export const ERP_GPS_TASK = 'insof.erp.gps';
const BUF = 'erp.gps.buffer';
const ACTIVE = 'erp.gps.activeTripId';
/** Bir yuborishda nechta nuqta — serverdagi chek bilan bir xil (`lib/mobile/track.ts`). */
const CHUNK = 200;

interface Pt { lat: number; lng: number; speedKmh?: number; heading?: number; at: string }

const readBuf = (): Pt[] => { try { return JSON.parse(kv.getString(BUF) ?? '[]') as Pt[]; } catch { return []; } };

TaskManager.defineTask(ERP_GPS_TASK, async ({ data, error }) => {
  if (error || !data) return;
  if (!kv.getString(ACTIVE)) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const buf = readBuf();
  for (const l of locations) {
    buf.push({
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      speedKmh: l.coords.speed != null ? Math.max(0, l.coords.speed * 3.6) : undefined,
      heading: l.coords.heading ?? undefined,
      at: new Date(l.timestamp).toISOString(),
    });
  }
  kv.set(BUF, JSON.stringify(buf));
  if (buf.length >= 20) await flushErpGps();
});

/** Buferni serverga yuborish. Yubora olmasa nuqtalar joyida qoladi — keyingi safar ketadi. */
export async function flushErpGps() {
  const tripId = kv.getString(ACTIVE);
  const buf = readBuf();
  if (!tripId || buf.length === 0) return;
  try {
    await erpApi('/track', { method: 'POST', body: { tripId, points: buf.slice(0, CHUNK) } });
    kv.set(BUF, JSON.stringify(buf.slice(CHUNK)));
  } catch {
    /* keyingi safar */
  }
}

/** Reys boshlanganda. `false` — fon ruxsati berilmagan: ilova ochiq turganda ishlaydi. */
export async function startErpTracking(tripId: string): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  kv.set(ACTIVE, tripId);
  if (!(await Location.hasStartedLocationUpdatesAsync(ERP_GPS_TASK))) {
    await Location.startLocationUpdatesAsync(ERP_GPS_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15_000,
      distanceInterval: 50,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      // Android: majburiy bildirishnoma — Samsung One UI fon jarayonlarni o'ldiradi
      foregroundService: {
        notificationTitle: 'Insof ERP — reys davom etmoqda',
        notificationBody: 'Joylashuv logistika bo\'limiga uzatilmoqda',
        notificationColor: '#1B5E3F',
      },
    });
  }
  return bg.status === 'granted';
}

/** Reys yopilganda: qolgan nuqtalarni yuboradi va kuzatuvni to'xtatadi. */
export async function stopErpTracking() {
  await flushErpGps();
  kv.delete(ACTIVE);
  if (await Location.hasStartedLocationUpdatesAsync(ERP_GPS_TASK)) await Location.stopLocationUpdatesAsync(ERP_GPS_TASK);
}

export const activeErpTripId = () => kv.getString(ACTIVE) ?? null;
