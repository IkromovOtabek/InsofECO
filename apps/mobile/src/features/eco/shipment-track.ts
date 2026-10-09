/**
 * Yuk reysining GPS izi: haydovchi telefonidan yozish va xaritada bosib o'tilgan yo'lni o'qish.
 *
 * Yozish — umumiy fon vazifasi (`core/location.ts`, `kind: 'shipment'`): "Yuklashni
 * boshladim"dan "Yetkazdim"gacha. O'qish — `GET /shipments/:id/track`: server izni
 * soddalashtiradi (15 m dan yaqin va 180 km/soat dan tez sakrashlar tashlanadi) va km, vaqtni
 * o'zi hisoblaydi — dispetcher va haydovchi bir xil raqamni ko'radi.
 */
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/core/api';
import { activeTrackingId, flushGps, gpsHeartbeat, startTracking, stopTracking } from '@/core/location';
import { alongRoute, type LatLng } from '@/core/geo';
import type { DriveRoute } from '@/core/route';
import { useSession } from '@/core/session';
import { usePollInterval } from '@/shared/hooks';
import type { Shipment } from './api';

/** Server shu holatlarda iz yozadi (`shipments.service.ts → TRACKED`). */
export const SHIPMENT_TRACKED = ['LOADING', 'EN_ROUTE'];
/** Xaritada bosib o'tilgan yo'l ko'rsatiladigan holatlar: yuklangan, yo'lda, yetkazilgan. */
export const SHIPMENT_HAS_TRACK = ['LOADING', 'EN_ROUTE', 'DELIVERED', 'CONFIRMED'];
const SHIPMENT_DONE = ['DELIVERED', 'CONFIRMED', 'CANCELLED'];

export interface ShipmentTrack {
  shipmentId: string;
  status: string;
  /** Reys hali davom etmoqda (iz o'sib boradi). */
  live: boolean;
  points: { lat: number; lng: number; at: string }[];
  meters: number;
  distanceKm: number;
  /** Yo'lga chiqqan vaqt (bo'lmasa yuklash, bo'lmasa birinchi GPS nuqta). */
  startedAt: string | null;
  /** Yetkazilgan vaqt; yo'lda bo'lsa null. */
  endedAt: string | null;
  /** startedAt → endedAt (yo'lda bo'lsa — hozirgacha), daqiqa. */
  durationMinutes: number | null;
  /** Shundan harakatda, daqiqa (turishlar chiqarilgan). */
  movingMinutes: number;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  loadedAt: string | null;
  departedAt: string | null;
  deliveredAt: string | null;
  rawPoints: number;
  /** Eng oxirgi xom nuqta — mashina belgisi shu yerda (eski serverda yo'q). */
  last?: { lat: number; lng: number; at: string; speedKmh: number | null; heading: number | null } | null;
  /** GPS izi obyekt doirasiga kirgan vaqt (eski serverda yo'q). */
  nearSiteAt?: string | null;
}

/** Jonli xaritadagi "dum" — mashina ortidagi oxirgi shuncha daqiqalik iz. */
export const TRAIL_MIN = 15;

/**
 * Bosib o'tilgan yo'l. Reys yo'lda bo'lsa yarim daqiqada yangilanadi va so'rovdan oldin
 * telefondagi bufer yuboriladi — aks holda chiziq oxirgi 20 nuqtaga (~5 daq) orqada qolardi.
 */
export function useShipmentTrack(id: string | undefined, opts: { enabled?: boolean; live?: boolean } = {}) {
  const live = !!opts.live;
  return useQuery({
    queryKey: ['shipments', 'track', id],
    queryFn: async () => {
      if (live && id && activeTrackingId() === id) await flushGps().catch(() => {});
      return api<ShipmentTrack>(`/shipments/${id}/track`);
    },
    enabled: !!id && opts.enabled !== false,
    refetchInterval: usePollInterval(live ? 30_000 : false),
  });
}

/**
 * Mashina ortidagi qisqa iz (oxirgi 15 daqiqa) va oxirgi nuqta — dispetcher/quruvchi xaritasi uchun.
 * Server `?since=` ni bilmasa (eski versiya) butun iz keladi — shuning uchun shu yerda ham kesiladi.
 */
export function useShipmentTrail(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['shipments', 'track', id, 'trail'],
    queryFn: async () => {
      const since = Date.now() - TRAIL_MIN * 60_000;
      const t = await api<ShipmentTrack>(`/shipments/${id}/track?since=${encodeURIComponent(new Date(since).toISOString())}`);
      // Eski server `since` ni bilmaydi va butun izni beradi — oxirgi nuqtadan 15 daqiqa orqaga kesamiz
      const tail = t.points[t.points.length - 1];
      const from = tail ? Date.parse(tail.at) - TRAIL_MIN * 60_000 : since;
      return { ...t, points: t.points.filter((p) => Date.parse(p.at) >= from) };
    },
    enabled: !!id && enabled,
    refetchInterval: usePollInterval(enabled ? 30_000 : false),
  });
}

/**
 * Haydovchining o'z yuki uchun fon GPS'ini holatga moslaydi: yuklash/yo'lda — yoqiladi,
 * yetkazilgach — to'xtaydi (qolgan nuqtalar yuboriladi). Yuk kartochkasi va bosh ekran chaqiradi.
 */
export function useShipmentGps(s: Pick<Shipment, 'id' | 'status' | 'driver'> | null | undefined) {
  const me = useSession((x) => x.user?.id);
  const role = useSession((x) => x.active?.role) as string | undefined;
  const id = s?.id, status = s?.status, mine = !!s && role === 'HAYDOVCHI' && !!me && s.driver?.id === me;
  useEffect(() => {
    if (!id || !status || !mine) return;
    if (SHIPMENT_TRACKED.includes(status)) { if (activeTrackingId() !== id) void startTracking(id, 'shipment'); }
    else if (SHIPMENT_DONE.includes(status)) void stopTracking(id);
  }, [id, status, mine]);
  // Ilova ochiq bo'lsa — yurak urishi: iOS turgan telefonda fon vazifasi nuqta bermay jim qolishi
  // mumkin; server "GPS jim" demasin (joy o'ylab topilmaydi — faqat "tirik" belgisi, `core/location.ts`)
  const tracked = mine && !!status && SHIPMENT_TRACKED.includes(status);
  useEffect(() => {
    if (!tracked || !id) return;
    const t = setInterval(() => { if (activeTrackingId() === id) void gpsHeartbeat(); }, HEARTBEAT_CHECK_MS);
    return () => clearInterval(t);
  }, [tracked, id]);
}

/** Yurak urishi tekshiruvi oralig'i (yuborish o'zi 90 s da bir — `gpsHeartbeat`). */
const HEARTBEAT_CHECK_MS = 30_000;

// ───────────────── Rejadagi yo'l (marshrutdan chetlashish kuzatuvi uchun) ─────────────────

/** Serverga ko'pi bilan shuncha nuqta. */
const ROUTE_MAX_POINTS = 500;
/** Ikki yuborish orasida kamida. */
const ROUTE_POST_EVERY_MS = 2 * 60_000;
/** Yangi yo'l eskisidan shundan uzoqqa ketsa — "sezilarli o'zgardi" (qo'shni ko'cha emas). */
const ROUTE_CHANGED_M = 200;

/** Douglas–Peucker (tekis proeksiya) — chiziq shakli saqlanib, nuqtalar kamayadi. */
function simplify(line: LatLng[], tolM: number): LatLng[] {
  if (line.length <= 2) return line;
  const k = 111_195 * Math.cos(((line[0]!.lat) * Math.PI) / 180);
  const xy = line.map((p) => ({ x: p.lng * k, y: p.lat * 111_195 }));
  const keep = new Uint8Array(line.length);
  keep[0] = 1; keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const A = xy[a]!, B = xy[b]!;
    const dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const P = xy[i]!;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2)) : 0;
      const d = Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy));
      if (d > best) { best = d; bi = i; }
    }
    if (best > tolM && bi > 0) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return line.filter((_, i) => keep[i]);
}

/** ≤ `ROUTE_MAX_POINTS` nuqtagacha soddalashtirish: aniqlik 5 m dan boshlab kerakligicha qo'pollashadi. */
export function simplifyRoute(line: LatLng[], max = ROUTE_MAX_POINTS): LatLng[] {
  let tol = 5, out = simplify(line, tol);
  while (out.length > max && tol < 5000) { tol *= 2; out = simplify(line, tol); }
  return out.length > max ? out.filter((_, i) => i % Math.ceil(out.length / max) === 0).slice(0, max - 1).concat(out[out.length - 1]!) : out;
}

/** Yangi yo'l eskisidan sezilarli farq qiladimi: yangi chiziqning biror nuqtasi eskisidan 200 m+ uzoqda. */
function routeChanged(prev: LatLng[], next: LatLng[]): boolean {
  if (prev.length < 2) return true;
  const step = Math.max(1, Math.floor(next.length / 60));
  for (let i = 0; i < next.length; i += step) if (alongRoute(prev, next[i]!).offRouteM > ROUTE_CHANGED_M) return true;
  return false;
}

/**
 * Haydovchi ilovasidagi Yandex yo'lini serverga yuboradi (`PUT /shipments/:id/planned-route`):
 * server oxirgi GPS nuqtalarni shu bilan solishtirib, mashina yo'ldan 500 m+ chiqib 2 daqiqadan
 * oshsa dispetcherga xabar beradi. Faqat o'z yuki, yuklash/yo'lda; yo'l birinchi qurilganda yoki
 * sezilarli o'zgarganda, 2 daqiqada ko'pi bilan bir marta. Server chetlashish paytidagi yangi yo'lni
 * rad etishi mumkin (`accepted: false`) — keyingi qayta qurishda (2 daqiqadan keyin) yana yuboriladi.
 */
export function usePlannedRouteSync(s: Pick<Shipment, 'id' | 'status' | 'driver'> | null | undefined, route: DriveRoute | null) {
  const me = useSession((x) => x.user?.id);
  const role = useSession((x) => x.active?.role) as string | undefined;
  const ok = !!s && role === 'HAYDOVCHI' && !!me && s.driver?.id === me && SHIPMENT_TRACKED.includes(s.status);
  const id = s?.id;
  const sent = useRef<{ id: string; line: LatLng[]; at: number } | null>(null);
  const lastTry = useRef(0);
  // Kechiktirilgan qayta urinish: 2 daqiqalik chegaraga tushgan yoki server rad etgan yo'l yo'qolmasin
  // (yo'l o'zgarmasa effekt o'zi qayta ishlamaydi)
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!ok || !id || !route || route.line.length < 2) return;
    const now = Date.now();
    const wait = ROUTE_POST_EVERY_MS - (now - lastTry.current);
    if (wait > 0) {
      const t = setTimeout(() => setRetry((x) => x + 1), wait + 1000);
      return () => clearTimeout(t);
    }
    const line = simplifyRoute(route.line);
    const prev = sent.current?.id === id ? sent.current.line : [];
    if (!routeChanged(prev, line)) return;
    lastTry.current = now;
    let alive = true;
    let t: ReturnType<typeof setTimeout> | null = null;
    void api<{ accepted: boolean }>(`/shipments/${id}/planned-route`, { method: 'PUT', body: { line, meters: route.meters, seconds: route.seconds } })
      .then((r) => {
        if (r.accepted) sent.current = { id, line, at: now };
        else if (alive) t = setTimeout(() => setRetry((x) => x + 1), ROUTE_POST_EVERY_MS + 1000);
      })
      .catch(() => { if (alive) t = setTimeout(() => setRetry((x) => x + 1), ROUTE_POST_EVERY_MS + 1000); });
    return () => { alive = false; if (t) clearTimeout(t); };
  }, [ok, id, route, retry]);
}
