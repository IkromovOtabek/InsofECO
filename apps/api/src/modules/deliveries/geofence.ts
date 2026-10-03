import { DomainError } from '../../common/errors/domain.error';

/**
 * "Obyektdaman" degan holatlar (Yetib keldim, Tushirish, Yetkazdim) uchun joy tekshiruvi.
 *
 * Nega serverda ham: ilova tekshiruvini chetlab o'tish oson (eski versiya, oflayn navbat,
 * qo'lda so'rov). Server rad etsa haydovchi "Bajarildi" emas, aniq sababni ko'radi.
 *
 * 300 m — katta qurilish maydoni (darvoza bilan quyish nuqtasi orasi 100-200 m) va shahar
 * ichidagi GPS xatosi (30-80 m) sig'adigan, lekin qo'shni ko'chadan bosib bo'lmaydigan radius.
 * Avtomatik "yetib keldi" (tracking, DEFAULT_RULES.arrivalGeofenceMeters = 200) bundan
 * kichik — demak tizim o'zi belgilagan holat bu tekshiruvdan doim o'tadi.
 * Mobil ilovadagi `SITE_RADIUS_M` (apps/mobile/src/core/location.ts) bilan bir xil bo'lsin.
 */
export const SITE_RADIUS_M = 300;

export interface LatLng { lat: number; lng: number }

export function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371e3, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Obyekt nuqtasi haqiqiymi: null yoki (0, 0) — zayavkada belgilanmagan. */
export function knownPoint(lat: number | null | undefined, lng: number | null | undefined): LatLng | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

const label = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

/**
 * Haydovchi obyekt yonidami — bo'lmasa aniq xabar bilan rad etadi.
 *
 * - Obyekt nuqtasi noma'lum bo'lsa tekshirib bo'lmaydi: o'tkazamiz (xatoni haydovchiga emas, zayavkaga yuklash noto'g'ri).
 * - Haydovchi koordinata yubormasa — rad etiladi: "joylashuvsiz o'tadi" bo'shlig'i yopiladi.
 */
export function assertAtSite(location: LatLng | undefined | null, dest: LatLng | null, action: string) {
  if (!dest) return;
  if (!location) {
    throw new DomainError('DELIVERY_INVALID_TRANSITION', `«${action}» uchun joylashuv kerak — GPS yoqib, qayta urinib ko'ring`, { reason: 'LOCATION_REQUIRED', radiusM: SITE_RADIUS_M });
  }
  const distanceM = Math.round(haversineMeters(location, dest));
  if (distanceM > SITE_RADIUS_M) {
    throw new DomainError(
      'DELIVERY_INVALID_TRANSITION',
      `Obyektgacha ${label(distanceM)} — «${action}» faqat obyektdan ${SITE_RADIUS_M} m ichida belgilanadi`,
      { reason: 'TOO_FAR', distanceM, radiusM: SITE_RADIUS_M },
    );
  }
}
