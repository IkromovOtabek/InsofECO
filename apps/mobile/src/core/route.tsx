import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transport } from 'react-native-yamap-plus';
import { useTheme } from '@/design/theme';
import { config } from './config';
import { alongRoute, haversineMeters, type AlongRoute, type LatLng } from './geo';
import { initMaps, Polyline, type LatLng as MapLatLng } from './map';

/**
 * Yo'l bo'yicha marshrut — Yandex MapKit'ning o'z DrivingRouter'i, telefonning o'zida.
 *
 * Nega ilovada: ilgari xaritalarda zavod/mashinadan obyektgacha TO'G'RI CHIZIQ chizilardi
 * (yuk sahifalari), haydovchi marshruti esa server chizig'iga tayanardi — server Yandex/OSRM'dan
 * javob ololmasa, u ham to'g'ri chiziqqa tushardi. Endi chiziq Yandex Navigator'dagi bilan bir
 * xil: ko'chalar bo'ylab, joriy tirbandlik hisobga olingan vaqt bilan. Kalit — o'sha MapKit kaliti,
 * alohida HTTP kalit kerak emas (Full SDK build'da, `plugins/withYandexMapKit.js`).
 *
 * Yo'l topilmasa (internet yo'q, kalit cheklangan) chaqiruvchi zaxiraga o'tadi: server chizig'i
 * yoki punktir to'g'ri chiziq — punktir "taxminiy" degani.
 */

export interface DriveRoute {
  line: LatLng[];
  meters: number;
  /** Tirbandlik bilan, soniya. */
  seconds: number;
}

/** Yandex vaqtni o'qib bo'lmasa — shahar ichidagi o'rtacha tezlik. */
const FALLBACK_KMH = 30;
/** Native javob kelmasa kutish chegarasi: iOS'da yangi so'rov eskisining sessiyasini almashtiradi va u jim qoladi. */
const TIMEOUT_MS = 15_000;
/** Mashina chiziqdan shuncha chetga chiqsa yo'l qayta quriladi (qo'shni ko'cha — 30-60 m). */
const OFF_ROUTE_M = 120;
/** Qayta qurish chastotasi — chetlashish uzoq davom etsa ham MapKit'ni bosmaslik uchun. */
const REROUTE_EVERY_MS = 20_000;

const NOT_LETTER = '(?![a-zа-яё])';
const UNITS: [RegExp, number][] = [
  [new RegExp(`(\\d+)\\s*(?:д|дн|d|day|days|kun)${NOT_LETTER}`), 86_400],
  [new RegExp(`(\\d+)\\s*(?:ч|час|часа|часов|h|hr|hrs|hour|hours|soat)${NOT_LETTER}`), 3600],
  [new RegExp(`(\\d+)\\s*(?:мин|min|mins|minute|minutes|daq|daqiqa)${NOT_LETTER}`), 60],
  [new RegExp(`(\\d+)\\s*(?:с|сек|s|sec|secs|soniya)${NOT_LETTER}`), 1],
];

/** MapKit vaqtni faqat matn sifatida beradi ("1 ч 6 мин", "1 h 6 min") — soniyaga. O'qilmasa `null`. */
export function parseDurationText(text: string | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  let sec = 0, hit = false;
  for (const [re, k] of UNITS) {
    const m = t.match(re);
    if (m?.[1]) { sec += Number(m[1]) * k; hit = true; }
  }
  return hit ? sec : null;
}

/** So'rovlar navbat bilan: iOS modulida sessiya bitta, parallel so'rov oldingisini bekor qiladi. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Marshrut vaqtida kelmadi')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e: unknown) => { clearTimeout(t); reject(e); });
  });
}

async function drivingRoute(from: LatLng, to: LatLng): Promise<DriveRoute> {
  initMaps();
  const res = await serial(() => withTimeout(
    Transport.findDrivingRoutes([{ lat: from.lat, lon: from.lng }, { lat: to.lat, lon: to.lng }]),
    TIMEOUT_MS,
  ));
  const sections = res.routes?.[0]?.sections ?? [];
  const line: LatLng[] = [];
  for (const s of sections) {
    for (const p of s.points) {
      const last = line[line.length - 1];
      // Bo'limlar chegarasidagi nuqta ikki marta keladi
      if (!last || last.lat !== p.lat || last.lng !== p.lon) line.push({ lat: p.lat, lng: p.lon });
    }
  }
  if (line.length < 2) throw new Error("Yo'l topilmadi");
  const info = sections[0]?.routeInfo;
  let meters = info?.distance ?? 0;
  if (!meters) for (let i = 1; i < line.length; i++) meters += haversineMeters(line[i - 1]!, line[i]!);
  const seconds = parseDurationText(info?.timeWithTraffic) ?? parseDurationText(info?.time) ?? (meters / 1000 / FALLBACK_KMH) * 3600;
  return { line, meters: Math.round(meters), seconds: Math.round(seconds) };
}

/** ~10 m aniqlik: GPS titrashi har safar yangi so'rov yubormasin. */
const cell = (p: LatLng | null) => (p ? `${p.lat.toFixed(4)},${p.lng.toFixed(4)}` : null);

/**
 * Ikki nuqta orasidagi yo'l. Keshda 5 daqiqa yangi hisoblanadi; davriy yangilanmaydi —
 * harakatdagi mashina uchun `useLiveRoute` kerak bo'lganda o'zi qayta so'raydi.
 */
export function useDrivingRoute(from: LatLng | null, to: LatLng | null) {
  return useQuery({
    queryKey: ['drive', cell(from), cell(to)],
    queryFn: () => drivingRoute(from!, to!),
    enabled: config.mapsEnabled && !!from && !!to,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export interface LiveRoute {
  route: DriveRoute | null;
  /** Mashinaning yo'ldagi holati (`pos` va chiziq bo'lsa). */
  along: AlongRoute | null;
  /** Xaritada chiziladigani — o'tilmagan qism; yo'l hali yo'q bo'lsa bo'sh. */
  line: LatLng[];
  /** Yo'l qurilmadi — chaqiruvchi zaxiraga (server chizig'i yoki punktir) o'tadi. */
  failed: boolean;
}

/**
 * Harakatdagi mashina uchun yo'l: birinchi nuqtadan bir marta quriladi va mashina yo'ldan
 * chiqib ketgandagina (`OFF_ROUTE_M`, ko'pi bilan 20 s da bir) yangi joyidan qayta quriladi.
 * Har GPS nuqtasida emas — aks holda daqiqasiga o'nlab so'rov ketardi.
 */
export function useLiveRoute(pos: LatLng | null, to: LatLng | null): LiveRoute {
  const [anchor, setAnchor] = useState<LatLng | null>(pos);
  const lastReroute = useRef(0);
  useEffect(() => { if (pos && !anchor) setAnchor(pos); }, [pos, anchor]);

  const q = useDrivingRoute(anchor, to);
  // Yo'l qayta qurilayotganda yoki qayta qurish xato bersa (aloqa uzildi) oxirgi topilgan yo'l
  // o'rnida turadi — xarita bir lahza ham bo'sh qolmaydi. Faqat o'sha manzil uchun bo'lsa.
  const good = useRef<{ to: string | null; route: DriveRoute } | null>(null);
  if (q.data) good.current = { to: cell(to), route: q.data };
  const route = q.data ?? (good.current?.to === cell(to) ? good.current.route : null);
  const along = useMemo(() => (pos && route ? alongRoute(route.line, pos) : null), [pos, route]);

  useEffect(() => {
    if (!pos || !anchor) return;
    // Yo'ldan chiqib ketdi — yoki yo'l umuman topilmagan edi (aloqa yo'q edi): yangi joydan so'raymiz
    const lost = along ? along.offRouteM >= OFF_ROUTE_M : q.isError;
    if (!lost) return;
    // Turgan joyida (hovli ichida, yo'ldan uzoqda) har safar qayta so'ramasin — avval siljisin
    if (haversineMeters(anchor, pos) < OFF_ROUTE_M) return;
    if (Date.now() - lastReroute.current < REROUTE_EVERY_MS) return;
    lastReroute.current = Date.now();
    setAnchor(pos);
  }, [along, pos, anchor, q.isError]);

  return {
    route,
    along,
    line: along?.ahead ?? route?.line ?? [],
    failed: !config.mapsEnabled || (q.isError && !route),
  };
}

/**
 * Xaritadagi marshrut chizig'i (`MapView` ichida, `Marker` kabi koordinatalar bilan): `from` dan
 * `to` gacha yo'l bo'ylab. `from` — harakatdagi mashina bo'lsa ham bo'ladi (orqada qolgan qism
 * chizilmaydi). Yo'l topilmasa punktir to'g'ri chiziq — "taxminiy" degani; yuklanayotganda
 * hech narsa chizilmaydi.
 */
export function RouteLine({ from, to, color, width = 5 }: { from: MapLatLng | null; to: MapLatLng; color?: string; width?: number }) {
  const { c } = useTheme();
  const a = useMemo(() => (from ? { lat: from.latitude, lng: from.longitude } : null), [from?.latitude, from?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = useMemo(() => ({ lat: to.latitude, lng: to.longitude }), [to.latitude, to.longitude]);
  const live = useLiveRoute(a, b);
  const stroke = color ?? c.brand;
  if (!from) return null;
  if (live.line.length >= 2) {
    return <Polyline coordinates={live.line.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={stroke} strokeWidth={width} />;
  }
  if (live.failed) {
    return <Polyline coordinates={[from, to]} strokeColor={stroke} strokeWidth={Math.max(3, width - 1)} lineDashPattern={[8, 6]} />;
  }
  return null;
}
