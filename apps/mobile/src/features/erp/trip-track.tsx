import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SectionHead, Txt, fmtDateFull, fmtTime } from '@/design/primitives';
import { KpiGrid } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { erpApi, type ErpLatLng, type ErpTripTrack } from '@/core/erp';
import { ApiException } from '@/core/api';
import { config } from '@/core/config';
import { distanceLabel, durationLabel } from '@/core/geo';
import { decodePolyline } from '@/core/polyline';
import { DriverMarker, MapView, Marker, Polyline, type LatLng, type MapHandle } from '@/core/map';
import { usePollInterval } from '@/shared/hooks';

/**
 * Reysning bosib o'tilgan yo'li (`GET /api/mobile/trip-track?id=`) — reys kartochkasi va "Mening reyslarim".
 * Server: ERP `src/lib/mobile/trip-track.ts`. Ruxsat: o'z reysi haydovchisi va direktor/logistika/mexanik.
 * Endpoint yo'q (eski server), ruxsat yo'q yoki reys topilmadi — `null`: bo'lim jimgina yashiriladi.
 * Tur — `core/erp.ts` (`ErpTripTrack`).
 */
export type { ErpTripTrack };

/** Eski serverda marshrut yo'q — bir marta bilib olinsa, qolgan qatorlar so'ramaydi. */
let endpointMissing = false;

/** Server javobi shu shartnomaga mosmi (eski/boshqa javob — bo'lim yashiriladi). */
const valid = (x: unknown): x is ErpTripTrack =>
  !!x && typeof x === 'object' && typeof (x as ErpTripTrack).meters === 'number' && typeof (x as ErpTripTrack).totalSec === 'number';

async function fetchTripTrack(id: string): Promise<ErpTripTrack | null> {
  try {
    const r = await erpApi<unknown>('/trip-track', { query: { id } });
    return valid(r) ? r : null;
  } catch (e) {
    // Next 404 sahifasi (JSON emas) yoki `NOT_FOUND` dan boshqa 404 — marshrut yo'q
    if ((e instanceof ApiException && e.status === 404 && e.code !== 'NOT_FOUND') || e instanceof SyntaxError) { endpointMissing = true; return null; }
    // Begona reys / ruxsat yo'q — xato emas, shunchaki ko'rsatilmaydi
    if (e instanceof ApiException && (e.status === 403 || e.status === 404)) return null;
    throw e;
  }
}

/** Shu holatlarda reys jonli — iz 30 s da yangilanadi. */
export const TRIP_LIVE_STATUSES = ['LOADED', 'ON_ROAD'];
const TRACK_POLL_MS = 30_000;

/**
 * Reys izi. `status` — reysning xom holati (bilinsa; bo'lmasa server javobidagi `status`):
 * LOADED/ON_ROAD bo'lsa 30 s da yangilanadi, tugagan (yoki hali boshlanmagan) reys — so'ralmaydi.
 * Server `since` (faqat yangi qism) bermaydi — har safar soddalashtirilgan butun chiziq keladi.
 * Yakunlangan reys (`final`) o'zgarmaydi — keshdan.
 */
export function useErpTripTrack(id: string | null | undefined, status?: string | null) {
  const poll = usePollInterval(TRACK_POLL_MS);
  return useQuery({
    queryKey: ['erp', 'trip-track', id ?? ''],
    queryFn: () => fetchTripTrack(id!),
    enabled: !!id && !endpointMissing,
    retry: 1,
    staleTime: (q) => (q.state.data?.final ? Infinity : 20_000),
    refetchInterval: (q) => {
      const d = q.state.data;
      const st = status ?? d?.status;
      return poll && d && !d.final && !!st && TRIP_LIVE_STATUSES.includes(st) ? poll : false;
    },
  });
}

/**
 * Reys boshi va oxiri: server `startedAt` / `endedAt` (yo'ldagi reysda oxiri — oxirgi nuqta vaqti).
 * Eski server ularni bermaydi — `last.at` va `totalSec` (birinchi → oxirgi nuqta) dan taxmin.
 */
export function trackSpan(t: ErpTripTrack): { from: string; to: string } | null {
  if (!(t.points > 0 || t.meters > 0)) return null;
  const okIso = (s: string | null | undefined): s is string => !!s && Number.isFinite(Date.parse(s));
  if (okIso(t.startedAt)) {
    const to = okIso(t.endedAt) ? t.endedAt : okIso(t.last?.at) ? t.last!.at : null;
    if (to && Date.parse(to) >= Date.parse(t.startedAt)) return { from: t.startedAt, to };
  }
  const end = t.last ? Date.parse(t.last.at) : NaN;
  if (!Number.isFinite(end)) return null;
  return { from: new Date(end - t.totalSec * 1000).toISOString(), to: t.last!.at };
}

/** Umumiy vaqt, daqiqa: server `durationMinutes` (reys boshi → oxiri), eski serverda — birinchi → oxirgi nuqta. */
export const tripMinutes = (t: ErpTripTrack) => t.durationMinutes ?? t.totalSec / 60;

/** Ko'rsatadigan narsa bormi: nuqta yoki masofa (reys hali boshlanmagan bo'lsa — yo'q). */
export const hasTrack = (t: ErpTripTrack | null | undefined): t is ErpTripTrack => !!t && (t.points > 0 || t.meters > 0);

/** Ro'yxat uchun qisqa: "12.4 km · 1 soat 20 daq". */
export const tripTrackShort = (t: ErpTripTrack) => `${distanceLabel(t.meters)} · ${durationLabel(tripMinutes(t))}`;

const toMap = (pts: ErpLatLng[]): LatLng[] => pts.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => ({ latitude: p.lat, longitude: p.lng }));
/** Chiziq: `line` bo'lsa o'shani, bo'lmasa `polyline` ni dekodlaymiz. */
const lineOf = (line: ErpLatLng[] | undefined, poly: string | undefined) => toMap(line?.length ? line : decodePolyline(poly));

/** Bosib o'tilgan yo'l xarita koordinatalarida (marshrut ekrani ham shuni chizadi). */
export const drivenLineOf = (t: ErpTripTrack): LatLng[] => lineOf(t.line, t.polyline);

const MAP_H = 220;
const kmh = (v: number | null) => (v == null ? '—' : `${Math.round(v)} km/soat`);

/** Kartochkadagi bo'lim: xarita (yurilgan — aksent, reja — brend punktir), km, vaqt, tezlik. */
export function TripTrackSection({ t, onTouchLock }: { t: ErpTripTrack; onTouchLock?: (locked: boolean) => void }) {
  const { c } = useTheme();
  const mapRef = useRef<MapHandle | null>(null);
  const driven = useMemo(() => lineOf(t.line, t.polyline), [t.line, t.polyline]);
  const planned = useMemo(() => (t.planned ? lineOf(t.planned.line, t.planned.polyline) : []), [t.planned]);
  const last = t.last && !t.final && TRIP_LIVE_STATUSES.includes(t.status) ? { latitude: t.last.lat, longitude: t.last.lng } : null;
  const all = useMemo(() => [...driven, ...planned, ...(last ? [last] : [])], [driven, planned, last]);

  // Android: kartochka ochilish animatsiyasi paytida yaratilgan xarita chiziqlarni chizmaydi (`yolda/[id].tsx`)
  const [canMap, setCanMap] = useState(false);
  useEffect(() => {
    const h = InteractionManager.runAfterInteractions(() => setCanMap(true));
    return () => h.cancel();
  }, []);

  // Boshlang'ich ko'rinish — birinchi chiziq bo'yicha (keyingi yangilanishlar kamerani sakratmaydi)
  const initial = useRef<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  if (!initial.current && all.length) {
    const lats = all.map((p) => p.latitude), lngs = all.map((p) => p.longitude);
    initial.current = {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max(0.01, (Math.max(...lats) - Math.min(...lats)) * 1.4),
      longitudeDelta: Math.max(0.01, (Math.max(...lngs) - Math.min(...lngs)) * 1.4),
    };
  }
  const span = trackSpan(t);
  const showMap = config.mapsEnabled && (driven.length >= 2 || planned.length >= 2) && !!initial.current;

  return (
    <View style={{ gap: space.sm }}>
      <SectionHead title="Yurilgan yo'l" unit={t.final ? 'yakuniy' : TRIP_LIVE_STATUSES.includes(t.status) ? 'jonli' : undefined} />
      {showMap ? (
        <View style={{ height: MAP_H, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault }}>
          {canMap ? (
            <MapView
              ref={(r) => { mapRef.current = r; }}
              style={{ flex: 1 }}
              initialRegion={initial.current!}
              rotateEnabled={false}
              pitchEnabled={false}
              zoomControls
              onTouchLock={onTouchLock}
            >
              {planned.length >= 2 ? <Polyline coordinates={planned} strokeColor={c.brand + '99'} strokeWidth={4} lineDashPattern={[8, 6]} /> : null}
              {driven.length >= 2 ? <Polyline coordinates={driven} strokeColor={c.accent} strokeWidth={5} /> : null}
              {driven[0] ? (
                <Marker coordinate={driven[0]} anchor={{ x: 0.5, y: 0.5 }} zIndex={2}>
                  <View style={{ width: size.iconSm, height: size.iconSm, borderRadius: radius.pill, backgroundColor: c.accent, borderWidth: size.ring, borderColor: c.bgSurface }} />
                </Marker>
              ) : null}
              {last ? <DriverMarker coordinate={last} heading={t.last?.heading ?? null} status="moving" /> : null}
            </MapView>
          ) : null}
        </View>
      ) : null}
      {showMap && planned.length >= 2 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs }}>
          <LegendLine color={c.accent} label="Yurilgan yo'l" />
          <LegendLine color={c.brand} label={`Reja${t.planned?.km != null ? ` · ${t.planned.km} km` : ''}`} />
        </View>
      ) : null}
      {span ? <Txt v="caption">{spanLabel(span)}</Txt> : null}
      <KpiGrid
        items={[
          { label: 'Masofa', value: distanceLabel(t.meters), icon: 'route', module: 'logistics' },
          { label: 'Umumiy vaqt', value: durationLabel(tripMinutes(t)), icon: 'clock', module: 'logistics' },
          { label: 'Harakatda', value: durationLabel(t.movingSec / 60), icon: 'activity', module: 'logistics' },
          {
            label: "O'rtacha tezlik", value: kmh(t.avgSpeedKmh), icon: 'gauge', module: 'logistics',
            ...(t.maxSpeedKmh != null ? { delta: { text: `eng yuqori ${Math.round(t.maxSpeedKmh)}`, tone: 'neutral' as const } } : {}),
          },
        ]}
      />
    </View>
  );
}

/** "08:12 → 09:40 · 09.10.2026" (ikki kunga o'tgan bo'lsa ikkala sana). */
export function spanLabel(sp: { from: string; to: string }) {
  const a = fmtDateFull(sp.from), b = fmtDateFull(sp.to);
  return `${fmtTime(sp.from)} → ${fmtTime(sp.to)} · ${a === b ? a : `${a} – ${b}`}`;
}

function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <View style={{ width: size.iconSm, height: size.ring + 1, borderRadius: radius.pill, backgroundColor: color }} />
      <Txt v="legend">{label}</Txt>
    </View>
  );
}
