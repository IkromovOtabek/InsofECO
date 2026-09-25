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
const LAST_SENT = 'erp.gps.lastSentAt';
/** Bir yuborishda nechta nuqta — serverdagi chek bilan bir xil (`lib/mobile/track.ts`). */
const CHUNK = 200;
/**
 * Necha soniyada bir yuborish. Logistika xaritani 15 soniyada bir yangilaydi, shuning uchun
 * bundan ko'p kutish ma'nosiz — dispetcher mashinani kechikkan joyda ko'rardi.
 * Buferning o'zi aloqa uzilganda ishlaydi: nuqtalar yo'qolmaydi, aloqa tiklanganda ketadi.
 */
const SEND_EVERY_MS = 30_000;
/** Bufer shuncha to'lsa — vaqtni kutmaymiz (aloqasiz joydan chiqqanda darhol bo'shatish uchun). */
const SEND_AT_POINTS = 10;

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
  const last = Number(kv.getString(LAST_SENT) ?? 0);
  if (buf.length >= SEND_AT_POINTS || Date.now() - last >= SEND_EVERY_MS) await flushErpGps();
});

/** Buferni serverga yuborish. Yubora olmasa nuqtalar joyida qoladi — keyingi safar ketadi. */
export async function flushErpGps() {
  const tripId = kv.getString(ACTIVE);
  const buf = readBuf();
  if (!tripId || buf.length === 0) return;
  try {
    await erpApi('/track', { method: 'POST', body: { tripId, points: buf.slice(0, CHUNK) } });
    kv.set(BUF, JSON.stringify(buf.slice(CHUNK)));
    kv.set(LAST_SENT, String(Date.now()));
  } catch {
    /* keyingi safar */
  }
}

/**
 * Ekrandagi jonli nuqtani izga qo'shib, darhol yuborish.
 *
 * Reysni yopishdan oldin chaqiriladi: server "obyektga yetib keldimi?" degan qoidani
 * OXIRGI saqlangan nuqta bo'yicha tekshiradi (`lib/trips.ts`), fon vazifasi esa nuqtalarni
 * 15 soniyada bir oladi va 30 soniyada bir yuboradi. Yubormasdan tursak, obyektga endigina
 * yetib kelgan haydovchiga "hali uzoqdasiz" deb javob berilardi.
 */
export async function pushErpFix(p: { lat: number; lng: number; speedKmh?: number; at?: number }) {
  if (!kv.getString(ACTIVE)) return;
  const buf = readBuf();
  buf.push({ lat: p.lat, lng: p.lng, speedKmh: p.speedKmh, at: new Date(p.at ?? Date.now()).toISOString() });
  kv.set(BUF, JSON.stringify(buf));
  await flushErpGps();
}

/** Reys boshlanganda. `false` — fon ruxsati berilmagan: ilova ochiq turganda ishlaydi. */
export async function startErpTracking(tripId: string): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  kv.set(ACTIVE, tripId);
  kv.set(LAST_SENT, '0'); // birinchi nuqta darhol ketsin — dispetcher mashinani kutmasin
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
        notificationColor: '#0A4CD5',
      },
    });
  }
  return bg.status === 'granted';
}

/** Reys yopilganda: qolgan nuqtalarni yuboradi va kuzatuvni to'xtatadi. */
export async function stopErpTracking() {
  await flushErpGps();
  kv.delete(ACTIVE);
  kv.delete(LAST_SENT);
  if (await Location.hasStartedLocationUpdatesAsync(ERP_GPS_TASK)) await Location.stopLocationUpdatesAsync(ERP_GPS_TASK);
}

export const activeErpTripId = () => kv.getString(ACTIVE) ?? null;
