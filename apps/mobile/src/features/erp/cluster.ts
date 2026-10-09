/**
 * Xaritadagi mashinalarni guruhlash (klaster) — sof hisob, React/MapKit'siz.
 *
 * Nega o'zimiz: kutubxonaning `ClusteredYamap` i polyline (yo'l, iz) chizolmaydi, park xaritasida
 * esa ikkalasi kerak. Shuning uchun oddiy `MapView` ustida JS'da guruhlaymiz: kamera to'xtaganda
 * (zoom ma'lum bo'lgach) ekranda bir-biriga `radiusPt` dan yaqin turgan mashinalar bitta nishonga
 * ("5") birlashadi.
 *
 * Masofa EKRAN birliklarida (pt): nuqtalar Web-Mercator "dunyo piksel" tekisligiga proyeksiya
 * qilinadi — zoom z da dunyo kengligi 256·2^z pt (MapKit plitkasi 256 pt). Shunda kenglik
 * (latitude) ta'siri o'zi hisobga olinadi va metr/gradus aylantirish kerak emas.
 *
 * Algoritm — ochko'z (greedy), panjara bilan: nuqtalar `id` bo'yicha tartiblanadi (har yangilanishda
 * bir xil natija — nishonlar sakramaydi), har bir hali guruhsiz nuqta yangi guruh "urug'i" bo'ladi va
 * radiusdagi guruhsiz qo'shnilarini oladi. Qo'shnilar faqat 3×3 panjara kataklaridan qidiriladi —
 * O(n) ga yaqin. Bu skript `scripts/cluster-check.mts` da tekshiriladi (node, RN'siz) — shuning
 * uchun bu faylda `@/` importlari yo'q.
 */

export interface ClusterInput<T> {
  id: string;
  lat: number;
  lng: number;
  item: T;
}

export interface Cluster<T> {
  /** Barqaror kalit: urug' nuqta id'si (eng kichik id). */
  id: string;
  /** Guruh markazi — a'zolar o'rtachasi. */
  lat: number;
  lng: number;
  members: ClusterInput<T>[];
}

export interface ClusterResult<T> {
  /** Yolg'iz qolgan (yoki guruhlanmaydigan) nuqtalar — oddiy belgisi bilan chiziladi. */
  singles: ClusterInput<T>[];
  /** Kamida 2 a'zoli guruhlar. */
  clusters: Cluster<T>[];
}

/** Shundan yaqin (pt) nishonlar bir-birini yopadi — birlashadi. Nishon 44 pt, yarmidan ko'prog'i ustma-ust. */
export const CLUSTER_RADIUS_PT = 48;
/** Shu zoom va undan yaqinda guruhlanmaydi (bir hovlidagi mashinalar baribir alohida ko'rinsin). */
export const CLUSTER_MAX_ZOOM = 17;

const TILE_PT = 256;

/** Web-Mercator: (lat, lng) → shu zoom'dagi "dunyo" koordinatasi, pt. */
export function worldPoint(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_PT * 2 ** zoom;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

/** Shu zoom va kenglikda bitta pt necha metr (ma'lumot uchun; guruhlash `worldPoint` bilan ishlaydi). */
export function metersPerPoint(zoom: number, lat: number): number {
  return (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (TILE_PT * 2 ** zoom);
}

/**
 * Nuqtalarni guruhlaydi.
 * @param keep true qaytsa nuqta HECH QACHON guruhga kirmaydi (masalan, tanlangan mashina).
 */
export function clusterPoints<T>(
  points: readonly ClusterInput<T>[],
  zoom: number,
  opts: { radiusPt?: number; maxZoom?: number; keep?: (p: ClusterInput<T>) => boolean } = {},
): ClusterResult<T> {
  const radius = opts.radiusPt ?? CLUSTER_RADIUS_PT;
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!Number.isFinite(zoom) || zoom >= (opts.maxZoom ?? CLUSTER_MAX_ZOOM) || valid.length < 2) {
    return { singles: [...valid], clusters: [] };
  }
  const singles: ClusterInput<T>[] = [];
  const pool: { p: ClusterInput<T>; x: number; y: number }[] = [];
  for (const p of valid) {
    if (opts.keep?.(p)) singles.push(p);
    else pool.push({ p, ...worldPoint(p.lat, p.lng, zoom) });
  }
  pool.sort((a, b) => (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0));

  // Panjara: katak = radius. Radius ichidagi har qanday qo'shni 3×3 kataklardan birida
  const grid = new Map<string, number[]>();
  const cellOf = (x: number, y: number) => [Math.floor(x / radius), Math.floor(y / radius)] as const;
  pool.forEach((e, i) => {
    const [cx, cy] = cellOf(e.x, e.y);
    const k = `${cx}:${cy}`;
    const list = grid.get(k);
    if (list) list.push(i); else grid.set(k, [i]);
  });

  const used = new Array<boolean>(pool.length).fill(false);
  const clusters: Cluster<T>[] = [];
  for (let i = 0; i < pool.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const seed = pool[i]!;
    const group = [seed];
    const [cx, cy] = cellOf(seed.x, seed.y);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (used[j]) continue;
          const o = pool[j]!;
          if (Math.hypot(o.x - seed.x, o.y - seed.y) <= radius) { used[j] = true; group.push(o); }
        }
      }
    }
    if (group.length === 1) { singles.push(seed.p); continue; }
    // a'zolar ham id bo'yicha — kalit va ro'yxat tartibi barqaror
    group.sort((a, b) => (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0));
    clusters.push({
      id: seed.p.id,
      lat: group.reduce((s, e) => s + e.p.lat, 0) / group.length,
      lng: group.reduce((s, e) => s + e.p.lng, 0) / group.length,
      members: group.map((e) => e.p),
    });
  }
  return { singles, clusters };
}

/** Guruh rangi — eng "yomon" holat: muammo > GPS eskirgan > yo'lda > yuklangan > kutilmoqda. */
const SEVERITY = ['issue', 'offline', 'moving', 'loaded', 'waiting'] as const;
export type ClusterStatus = (typeof SEVERITY)[number];

export function worstStatus(list: readonly ClusterStatus[]): ClusterStatus {
  let best: ClusterStatus = 'waiting';
  for (const s of list) if (SEVERITY.indexOf(s) < SEVERITY.indexOf(best)) best = s;
  return best;
}

/** A'zolarning chegarasi — guruh bosilganda kamera shunga moslanadi; `spanM` — eng katta tomoni, metr. */
export function boundsOf(pts: readonly { lat: number; lng: number }[]) {
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const spanM = Math.max(maxLat - minLat, (maxLng - minLng) * Math.cos((midLat * Math.PI) / 180)) * 111_195;
  return { minLat, maxLat, minLng, maxLng, center: { lat: midLat, lng: (minLng + maxLng) / 2 }, spanM };
}
