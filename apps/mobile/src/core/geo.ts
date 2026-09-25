/**
 * Xarita hisoblari — marshrut ekrani uchun.
 *
 * Nega ilovada: qolgan masofa har soniyada yangilanadi, har safar serverga murojaat qilish
 * mumkin emas (aloqasiz joy, trafik, batareya). Server marshrut CHIZIG'ini beradi, ilova
 * esa mashinani shu chiziqqa "tushirib", qolgan qismini qo'shib chiqadi.
 */
export interface LatLng { lat: number; lng: number }

const R = 6371e3;
const rad = (x: number) => (x * Math.PI) / 180;

/** Ikki nuqta orasidagi to'g'ri masofa, metr (serverdagi `lib/geo.ts` bilan bir xil formula). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Nuqtani kichik maydonda tekis koordinataga o'tkazish (metrda).
 * Bir necha o'n kilometr ichida yer sharsimonligi sezilmaydi, formulalar esa soddalashadi.
 */
const flat = (p: LatLng, origin: LatLng) => ({
  x: rad(p.lng - origin.lng) * R * Math.cos(rad(origin.lat)),
  y: rad(p.lat - origin.lat) * R,
});

/** Kesmaga eng yaqin nuqtagacha masofa va kesma oxirigacha qolgan qism, metr. */
function onSegment(p: LatLng, a: LatLng, b: LatLng) {
  const P = flat(p, a), B = flat(b, a);
  const len2 = B.x * B.x + B.y * B.y;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (P.x * B.x + P.y * B.y) / len2));
  const dx = P.x - B.x * t, dy = P.y - B.y * t;
  const len = Math.sqrt(len2);
  return { away: Math.sqrt(dx * dx + dy * dy), toEnd: len * (1 - t) };
}

export interface AlongRoute {
  /** Marshrut oxirigacha qolgan yo'l, metr. */
  remainingM: number;
  /** Mashina chiziqdan qancha chetda, metr — ko'p bo'lsa yo'l qayta so'raladi. */
  offRouteM: number;
}

/**
 * Mashina marshrutning qayeridaligi: qolgan yo'l va chiziqdan chetlashish.
 * Chiziq bo'sh yoki bitta nuqta bo'lsa — to'g'ri chiziq bo'yicha hisoblanadi.
 */
export function alongRoute(line: LatLng[], pos: LatLng): AlongRoute {
  const first = line[0];
  if (line.length < 2 || !first) {
    return { remainingM: first ? Math.round(haversineMeters(pos, first)) : 0, offRouteM: 0 };
  }
  // Kesmalar uzunligi oxiridan boshlab yig'iladi: `tail[i]` — i-nuqtadan manzilgacha qolgan yo'l
  const tail = new Array<number>(line.length).fill(0);
  for (let i = line.length - 2; i >= 0; i--) {
    const a = line[i], b = line[i + 1];
    if (a && b) tail[i] = (tail[i + 1] ?? 0) + haversineMeters(a, b);
  }

  let bestAway = Infinity;
  let bestRemaining = tail[0] ?? 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    if (!a || !b) continue;
    const s = onSegment(pos, a, b);
    if (s.away < bestAway) { bestAway = s.away; bestRemaining = s.toEnd + (tail[i + 1] ?? 0); }
  }
  return { remainingM: Math.max(0, Math.round(bestRemaining)), offRouteM: Math.round(bestAway) };
}

/** `12437` → `12.4 km`, `840` → `840 m` — ERP dagi `distanceLabel` bilan bir xil. */
export const distanceLabel = (meters: number) => (meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`);

/** `95` → `1 soat 35 daq`, `20` → `20 daq`. */
export function durationLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} daq`;
  const h = Math.floor(m / 60);
  return m % 60 === 0 ? `${h} soat` : `${h} soat ${m % 60} daq`;
}

/** Yetib borish vaqti — soat:daqiqa. */
export const arrivalClock = (minutes: number) =>
  new Date(Date.now() + Math.max(0, minutes) * 60_000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
