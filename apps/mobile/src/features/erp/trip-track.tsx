import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SectionHead, Txt } from '@/design/primitives';
import { KpiGrid } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { erpApi, type ErpLatLng } from '@/core/erp';
import { ApiException } from '@/core/api';
import { config } from '@/core/config';
import { distanceLabel, durationLabel } from '@/core/geo';
import { decodePolyline } from '@/core/polyline';
import { DriverMarker, MapView, Marker, Polyline, type LatLng, type MapHandle } from '@/core/map';
import { usePollInterval } from '@/shared/hooks';
import { allFinal, chunkIds, parseSummaryItems, type ErpTripSummary } from './trip-summary-logic';

export { summaryHasTrack, type ErpTripSummary } from './trip-summary-logic';

/**
 * Reysning bosib o'tilgan yo'li (`GET /api/mobile/trip-track?id=`) — reys kartochkasi va "Mening reyslarim".
 * Server: ERP `src/lib/mobile/trip-track.ts`. Ruxsat: o'z reysi haydovchisi va direktor/logistika/mexanik.
 * Endpoint yo'q (eski server), ruxsat yo'q yoki reys topilmadi — `null`: bo'lim jimgina yashiriladi.
 */
export interface ErpTripTrack {
  tripId: string;
  ref: string;
  status: string;
  /** true — yakun saqlangan, raqamlar endi o'zgarmaydi. */
  final: boolean;
  distanceKm: number;
  meters: number;
  totalSec: number;
  movingSec: number;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  points: number;
  line: ErpLatLng[];
  polyline: string;
  last: { lat: number; lng: number; at: string; speedKmh: number | null; heading: number | null } | null;
  lastSeenAt: string | null;
  planned: { line: ErpLatLng[]; polyline: string; km: number | null; min: number | null } | null;
  arrivedAt: string | null;
  deliveredAt: string | null;
}

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

/**
 * Reys izi. `live` — ochiq reysda 30 s da yangilanadi (kartochka); ro'yxatda — yo'q.
 * Yakunlangan reys o'zgarmaydi — qayta so'ralmaydi.
 */
export function useErpTripTrack(id: string | null | undefined, opts: { live?: boolean } = {}) {
  const poll = usePollInterval(opts.live ? 30_000 : false);
  return useQuery({
    queryKey: ['erp', 'trip-track', id ?? ''],
    queryFn: () => fetchTripTrack(id!),
    enabled: !!id && !endpointMissing,
    retry: 1,
    staleTime: (q) => (q.state.data?.final ? Infinity : 20_000),
    refetchInterval: (q) => (poll && q.state.data && !q.state.data.final ? poll : false),
  });
}

/** Ko'rsatadigan narsa bormi: nuqta yoki masofa (reys hali boshlanmagan bo'lsa — yo'q). */
export const hasTrack = (t: ErpTripTrack | null | undefined): t is ErpTripTrack => !!t && (t.points > 0 || t.meters > 0);

/** Ro'yxat uchun qisqa: "12.4 km · 1 soat 20 daq". */
export const tripTrackShort = (t: ErpTripTrack) => `${distanceLabel(t.meters)} · ${durationLabel(t.totalSec / 60)}`;

/** Eski serverda `trip-track/summary` yo'q — bir marta bilib olinsa, qayta so'ralmaydi. */
let summaryMissing = false;

async function fetchTripSummaries(ids: string[]): Promise<Record<string, ErpTripSummary> | null> {
  const out: Record<string, ErpTripSummary> = {};
  try {
    // Odatda bitta so'rov (oyda ~60 reys); 100 dan ortig'i bo'laklarga — parallel
    const parts = await Promise.all(chunkIds(ids).map((c) => erpApi<unknown>('/trip-track/summary', { query: { ids: c.join(',') } })));
    for (const r of parts) {
      const items = parseSummaryItems(r);
      if (!items) return null;
      Object.assign(out, items);
    }
    return out;
  } catch (e) {
    // Marshrut yo'q (eski server: Next 404 sahifasi yoki JSON emas) — bo'lim jimgina yashiriladi, qatorda taxminiy km
    if ((e instanceof ApiException && e.status === 404) || e instanceof SyntaxError) { summaryMissing = true; return null; }
    // Ruxsat yo'q (xodim kartasi bog'lanmagan va h.k.) — xato emas, shunchaki ko'rsatilmaydi
    if (e instanceof ApiException && e.status === 403) return null;
    throw e;
  }
}

/**
 * Ro'yxat ekrani ("Mening reyslarim", haydovchi oyi): ko'rinadigan barcha reyslar yakuni BITTA so'rovda
 * (avval har qator alohida `trip-track` so'rardi — oyda 60 reys → 60 so'rov). Chiziq yo'q; kartochka
 * to'liq izni avvalgidek `useErpTripTrack` bilan oladi. `null` — eski server yoki ruxsat yo'q.
 */
export function useErpTripSummaries(ids: readonly string[]) {
  const key = useMemo(() => chunkIds(ids).flat().sort(), [ids]);
  return useQuery({
    queryKey: ['erp', 'trip-track-summary', key.join(',')],
    queryFn: () => fetchTripSummaries(key),
    enabled: key.length > 0 && !summaryMissing,
    retry: 1,
    // Hammasi yakunlangan (o'tgan oy) — o'zgarmaydi; ochiq reys bo'lsa — 20 s dan keyin yangilanadi
    staleTime: (q) => (allFinal(q.state.data, key) ? Infinity : 20_000),
  });
}

/** Ro'yxat uchun qisqa (yakundan): "12.4 km · 1 soat 20 daq". */
export const tripSummaryShort = (s: ErpTripSummary) => `${distanceLabel(Math.round(s.distanceKm * 1000))} · ${durationLabel(s.totalSec / 60)}`;

const toMap = (pts: ErpLatLng[]): LatLng[] => pts.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => ({ latitude: p.lat, longitude: p.lng }));
/** Chiziq: `line` bo'lsa o'shani, bo'lmasa `polyline` ni dekodlaymiz. */
const lineOf = (line: ErpLatLng[] | undefined, poly: string | undefined) => toMap(line?.length ? line : decodePolyline(poly));

const MAP_H = 220;
const kmh = (v: number | null) => (v == null ? '—' : `${Math.round(v)} km/soat`);

/** Kartochkadagi bo'lim: xarita (yurilgan — aksent, reja — brend punktir), km, vaqt, tezlik. */
export function TripTrackSection({ t, onTouchLock }: { t: ErpTripTrack; onTouchLock?: (locked: boolean) => void }) {
  const { c } = useTheme();
  const mapRef = useRef<MapHandle | null>(null);
  const driven = useMemo(() => lineOf(t.line, t.polyline), [t.line, t.polyline]);
  const planned = useMemo(() => (t.planned ? lineOf(t.planned.line, t.planned.polyline) : []), [t.planned]);
  const last = t.last && !t.final ? { latitude: t.last.lat, longitude: t.last.lng } : null;
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
  const showMap = config.mapsEnabled && (driven.length >= 2 || planned.length >= 2) && !!initial.current;

  return (
    <View style={{ gap: space.sm }}>
      <SectionHead title="Yurilgan yo'l" unit={t.final ? 'yakuniy' : 'jonli'} />
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
      <KpiGrid
        items={[
          { label: 'Masofa', value: distanceLabel(t.meters), icon: 'route', module: 'logistics' },
          { label: 'Umumiy vaqt', value: durationLabel(t.totalSec / 60), icon: 'clock', module: 'logistics' },
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

function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <View style={{ width: size.iconSm, height: size.ring + 1, borderRadius: radius.pill, backgroundColor: color }} />
      <Txt v="legend">{label}</Txt>
    </View>
  );
}
