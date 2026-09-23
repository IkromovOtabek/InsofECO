import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { DEFAULT_RULES } from '@insof/shared';
import { kv } from './storage';
import { api } from './api';

/**
 * Fon GPS — faqat faol reys davomida (batareya + shaxsiy hayot).
 * Nuqtalar lokal buferga → har 20 nuqta yoki flush() da HTTP orqali (WS bo'lmasa ham ishlaydi).
 */
export const GPS_TASK = 'insof.gps';
const BUF = 'gps.buffer';
const ACTIVE = 'gps.activeDeliveryId';

interface Pt { lat: number; lng: number; speedKmh?: number; heading?: number; at: string }

TaskManager.defineTask(GPS_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const deliveryId = kv.getString(ACTIVE);
  if (!deliveryId) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const buf: Pt[] = JSON.parse(kv.getString(BUF) ?? '[]');
  for (const l of locations) {
    buf.push({ lat: l.coords.latitude, lng: l.coords.longitude, speedKmh: l.coords.speed != null ? Math.max(0, l.coords.speed * 3.6) : undefined, heading: l.coords.heading ?? undefined, at: new Date(l.timestamp).toISOString() });
  }
  kv.set(BUF, JSON.stringify(buf));
  if (buf.length >= 20) await flushGps();
});

export async function flushGps() {
  const deliveryId = kv.getString(ACTIVE);
  const buf: Pt[] = JSON.parse(kv.getString(BUF) ?? '[]');
  if (!deliveryId || buf.length === 0) return;
  try {
    await api('/tracking/gps', { method: 'POST', body: { deliveryId, points: buf.slice(0, 200) } });
    kv.set(BUF, JSON.stringify(buf.slice(200)));
  } catch {
    /* keyingi safar */
  }
}

export async function startTracking(deliveryId: string) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  kv.set(ACTIVE, deliveryId);
  const already = await Location.hasStartedLocationUpdatesAsync(GPS_TASK);
  if (!already) {
    await Location.startLocationUpdatesAsync(GPS_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: DEFAULT_RULES.gpsIntervalSeconds * 1000,
      distanceInterval: DEFAULT_RULES.gpsDistanceMeters,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      // Android: majburiy foreground service bildirishnomasi (Samsung One UI fon jarayonlarni o'ldiradi)
      foregroundService: { notificationTitle: 'Insof ECO — reys davom etmoqda', notificationBody: 'Joylashuv dispetcher va quruvchiga uzatilmoqda', notificationColor: '#1B5E3F' },
    });
  }
  return bg.status === 'granted';
}

export async function stopTracking() {
  await flushGps();
  kv.delete(ACTIVE);
  if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK)) await Location.stopLocationUpdatesAsync(GPS_TASK);
}

export const activeTrackingId = () => kv.getString(ACTIVE) ?? null;
