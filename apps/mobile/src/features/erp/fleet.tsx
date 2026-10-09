import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Callout, EmptyState, IconButton, KVList, ListGroup, ListItem, Txt, fmtUnit } from '@/design/primitives';
import { ChipGroup, PageHeader, SectionHead, SkeletonList } from '@/design/blocks';
import { Sheet, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { mapDriver, radius, size, space, type Tone } from '@/design/tokens';
import { useHeaderRaise } from '@/design/motion';
import { ClusterMarker, DriverMarker, MapUnavailable, MapView, Marker, Polyline, useMapScrollLock, zoomOf, type DriverStatus, type MapHandle, type LatLng } from '@/core/map';
import { Icon } from '@/design/icons';
import { RouteLine } from '@/core/route';
import { config } from '@/core/config';
import { openInNavigator } from '@/core/navigate';
import { FLEET_POLL_MS, useErpFleet, type ErpFleetItem } from './api';
import { boundsOf, clusterPoints, worstStatus, type Cluster } from './cluster';

/** Eski server `stale`/`staleMin` bermasa — shundan eski GPS nuqtasi "eskirgan": belgi kulrang, kartochkada ogohlantirish. */
const STALE_MS = 5 * 60_000;
/** `stale` — `withStale` qo'yadi (server bergan yoki o'zimiz hisoblagan); GPS yo'q — eskirgan. */
const isStale = (t: ErpFleetItem) => !t.gps || !!t.stale;
/**
 * Server `stale` bersa (yangi ERP: telefondan oxirgi aloqa, "tirikman" ham) — shuni olamiz; bermasa
 * oxirgi nuqta vaqtidan `staleMin` (bo'lmasa 5 daq) bo'yicha hisoblaymiz.
 */
export const withStale = (t: ErpFleetItem, staleMin: number | undefined, now = Date.now()): ErpFleetItem => ({
  ...t,
  stale: typeof t.stale === 'boolean' ? t.stale : !t.gps || now - Date.parse(t.gps.at) > (staleMin != null ? staleMin * 60_000 : STALE_MS),
});
/** Tezlik/yo'nalish: yangi server yuqori darajada, eskisi `gps` ichida (yoki umuman yo'q). */
const speedOf = (t: ErpFleetItem) => (t.speedKmh != null ? t.speedKmh : t.gps?.speedKmh ?? null);
const rawHeading = (t: ErpFleetItem) => (t.heading != null ? t.heading : t.gps?.heading ?? null);

/** Mashina ortidagi iz — oxirgi shuncha vaqt (server ko'proq bersa ham). */
const TRAIL_MS = 15 * 60_000;
/** Shundan sekin — turibdi: yo'nalish ko'rsatilmaydi (turgan mashinaning GPS "yo'nalishi" tasodifiy). */
const HEADING_MIN_KMH = 3;

/**
 * Xaritadagi xira iz: server `trail` bersa (ixtiyoriy maydon), oxirgi 15 daqiqasi + hozirgi nuqta.
 * Server bermasa — chizilmaydi (o'ylab topilgan iz yo'q).
 */
function trailOf(t: ErpFleetItem): LatLng[] {
  if (!t.gps || !t.trail?.length) return [];
  const from = Date.parse(t.gps.at) - TRAIL_MS;
  const pts = t.trail.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (!p.at || Date.parse(p.at) >= from));
  const line = pts.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const tail = pts[pts.length - 1];
  if (!tail || tail.lat !== t.gps.lat || tail.lng !== t.gps.lng) line.push({ latitude: t.gps.lat, longitude: t.gps.lng });
  return line.length >= 2 ? line : [];
}

/** Yo'nalish (server bersa): eskirgan GPS yoki turgan mashinada — yo'q. */
const headingOf = (t: ErpFleetItem): number | null => {
  const h = rawHeading(t), v = speedOf(t);
  if (!t.gps || h == null || !Number.isFinite(h) || isStale(t)) return null;
  return v != null && v < HEADING_MIN_KMH ? null : h;
};

const COMPASS = ['shimolga', 'shimoli-sharqqa', 'sharqqa', 'janubi-sharqqa', 'janubga', "janubi-g'arbga", "g'arbga", "shimoli-g'arbga"];
const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** "34 km/soat · shimolga" / "turibdi"; server tezlik bermasa — null. */
function speedLabel(t: ErpFleetItem): string | null {
  const v = speedOf(t);
  if (!t.gps || v == null || !Number.isFinite(v) || isStale(t)) return null;
  if (v < HEADING_MIN_KMH) return 'turibdi';
  const h = headingOf(t);
  return `${Math.round(v)} km/soat${h != null ? ` · ${compass(h)}` : ''}`;
}

/** Xaritadagi belgi ostidagi qisqa tezlik — faqat yurayotgan (eskirmagan) mashinada. */
function markerCaption(t: ErpFleetItem): string | null {
  const v = speedOf(t);
  if (!t.gps || v == null || !Number.isFinite(v) || isStale(t) || v < HEADING_MIN_KMH) return null;
  return `${Math.round(v)} km/soat`;
}

/** "GPS 12 daq oldin" + telefon nuqtasiz "tirikman" yuborib turgan bo'lsa — "aloqa 1 daq oldin". */
function gpsAgo(t: ErpFleetItem): string {
  if (!t.gps) return "GPS yo'q";
  const gpsAt = Date.parse(t.gps.at);
  const seen = t.lastSeenAt ? Date.parse(t.lastSeenAt) : NaN;
  const alive = Number.isFinite(seen) && seen - gpsAt > 2 * 60_000 ? ` · aloqa ${agoLabel(t.lastSeenAt!)}` : '';
  return `GPS ${agoLabel(t.gps.at)}${alive}`;
}

const alertsOf = (t: ErpFleetItem) => (Array.isArray(t.alerts) ? t.alerts : []);

/**
 * Jonli reyslar xaritasi — direktor (bosh sahifa → "Reyslar xaritada", menyu) va logistika uchun.
 *
 * Ma'lumot `GET /api/mobile/fleet` dan, 12 s da yangilanadi. Belgilar holat rangida: yo'lda — brend,
 * yuklangan — sariq, kutilmoqda — ko'k, muammo bor — qizil. Belgi yoki qator bosilsa pastdan oyna:
 * davlat raqami, haydovchi, zayavka, ETA, qo'ng'iroq, navigatorda ochish, reys kartochkasi.
 * Yo'ldagi mashinalardan obyektgacha — Yandex yo'li (ko'chalar bo'ylab, `core/route.tsx`),
 * xaritada tirbandlik qatlami; tanlangan mashinaning yo'li va obyekt pini ajralib turadi.
 * Ekranda bir-birini yopadigan mashinalar bitta guruh nishoniga (son bilan) birlashadi — rangi
 * guruhdagi eng yomon holat; bosilsa yaqinlashadi (`cluster.ts`). Tanlangan mashina guruhlanmaydi.
 * Xarita kaliti yo'q build'da (`config.mapsEnabled` false) — ro'yxat va administrator uchun izoh.
 */

type Filter = 'all' | 'road' | 'loaded' | 'planned' | 'issue';

/** Holat → rang. Server `tone` beradi (muammo — danger); eski javobda holatdan hisoblanadi. */
const toneOf = (t: ErpFleetItem): Tone =>
  t.openIssues ? 'danger' : t.status === 'ON_ROAD' ? 'brand' : t.status === 'LOADED' ? 'warning' : t.status === 'PLANNED' ? 'info' : (t.tone ?? 'brand');

const groupOf = (t: ErpFleetItem): Exclude<Filter, 'all'> =>
  t.openIssues ? 'issue' : t.status === 'LOADED' ? 'loaded' : t.status === 'PLANNED' ? 'planned' : 'road';

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: 'brand', label: "Yo'lda" }, { tone: 'warning', label: 'Yuklangan' }, { tone: 'info', label: 'Kutilmoqda' }, { tone: 'danger', label: 'Muammo' },
];

/** Holat rangi → xaritadagi nishon (rasm). GPS 5 daqiqadan eski bo'lsa — kulrang. */
const STATUS_OF: Record<Tone, DriverStatus> = { brand: 'moving', warning: 'loaded', info: 'waiting', danger: 'issue', success: 'moving', neutral: 'offline' };
/** Yo'l chizig'i nishon rangida (GPS eskirgan bo'lsa ham holat rangi qoladi). */
const lineColor = (t: ErpFleetItem) => mapDriver[STATUS_OF[toneOf(t)]];
/** Iz chizig'i: eskirgan GPS — kulrang (mashina hozir u yerda bo'lmasligi mumkin). */
const trailColor = (t: ErpFleetItem) => (isStale(t) ? mapDriver.offline : lineColor(t));
const driverStatus = (t: ErpFleetItem): DriverStatus => (isStale(t) ? 'offline' : STATUS_OF[toneOf(t)]);
const MAP_LEGEND: { status: DriverStatus; label: string }[] = [
  { status: 'moving', label: "Yo'lda" }, { status: 'loaded', label: 'Yuklangan' }, { status: 'waiting', label: 'Kutilmoqda' }, { status: 'issue', label: 'Muammo' }, { status: 'offline', label: 'GPS eskirgan' },
];

/** Tanlangan mashinaga yaqinlashish (~1 km). */
const FOCUS_DELTA = 0.012;
/** Shuncha mashinagacha hammasining yo'li chiziladi; ko'p bo'lsa — faqat tanlanganiniki (xarita chalkashmasin). */
const MAX_ROUTES = 6;
/** Guruh a'zolari shundan yaqin (bir hovlida) — "hammasini sig'dirish" o'rniga guruhlanmaydigan yaqinlikka tushamiz. */
const CLUSTER_TIGHT_M = 150;
/** ~zoom 17.5 — `CLUSTER_MAX_ZOOM` dan yaqin: bir joydagi mashinalar alohida chiqadi. */
const CLUSTER_TIGHT_DELTA = 0.002;

type Located = ErpFleetItem & { gps: NonNullable<ErpFleetItem['gps']> };
type Routable = ErpFleetItem & { gps: NonNullable<ErpFleetItem['gps']>; dest: NonNullable<ErpFleetItem['dest']> };
const routable = (t: ErpFleetItem | null): t is Routable => !!t?.gps && !!t.dest;

function agoLabel(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return 'hozir';
  if (m < 60) return `${m} daq oldin`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} soat oldin` : `${Math.floor(h / 24)} kun oldin`;
}

const hms = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };

export function FleetScreen({ onBack, title = 'Reyslar xaritada' }: { onBack?: () => void; title?: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raise = useHeaderRaise();
  const { height } = useWindowDimensions();
  // Ekran stekda ostda qolganda (reys kartochkasi ochilgan) 12 s so'rovlar to'xtaydi — qaytganda darhol yangilanadi
  const focused = useIsFocused();
  const { data, isLoading, error, refetch, isRefetching, dataUpdatedAt } = useErpFleet(focused);
  const mapRef = useRef<MapHandle | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  // Pastki kartochka tanlovdan alohida: yopilsa ham mashina belgilangan qoladi (yorliq, kuzatish)
  const [sheet, setSheet] = useState(false);
  /** Tanlangan mashina ortidan yurish — har yangilanishda kamera unga suriladi; xarita qo'lda surilsa o'chadi. */
  const [follow, setFollow] = useState(false);
  const lock = useMapScrollLock();

  const all = useMemo(() => (data?.trucks ?? []).map((t) => withStale(t, data?.staleMin)), [data]);
  const counts = useMemo(() => {
    const n: Record<Filter, number> = { all: all.length, road: 0, loaded: 0, planned: 0, issue: 0 };
    for (const t of all) n[groupOf(t)]++;
    return n;
  }, [all]);
  const trucks = useMemo(() => (filter === 'all' ? all : all.filter((t) => groupOf(t) === filter)), [all, filter]);
  const located = useMemo(() => trucks.filter((t): t is Located => !!t.gps), [trucks]);
  const coords = located.map((t) => ({ latitude: t.gps.lat, longitude: t.gps.lng }));
  const sel = selected ? all.find((t) => t.tripId === selected) ?? null : null;
  const onRoad = trucks.filter(routable).filter((t) => t.status === 'ON_ROAD');
  const routed = (onRoad.length <= MAX_ROUTES ? onRoad : []).filter((t) => t.tripId !== selected);
  const selRoute = routable(sel) ? sel : null;

  // Boshlang'ich ko'rinish — birinchi yuklangan nuqtalar bo'yicha (keyingi yangilanishlar kamerani sakratmaydi)
  const initial = useRef<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  if (!initial.current && coords.length) {
    const lats = coords.map((p) => p.latitude), lngs = coords.map((p) => p.longitude);
    initial.current = {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max(0.04, (Math.max(...lats) - Math.min(...lats)) * 1.6),
      longitudeDelta: Math.max(0.04, (Math.max(...lngs) - Math.min(...lngs)) * 1.6),
    };
  }

  /**
   * Guruhlash zoom'i — faqat kamera TO'XTAGANDA yangilanadi (`onCameraIdle`), har kadrda emas: belgilar
   * surish paytida qayta yaratilmaydi. Chorak zoom'ga yaxlitlanadi — kuzatish animatsiyasidagi mayda
   * tebranish guruhlarni qayta hisoblatmaydi. Kamera hali xabar bermagan bo'lsa — boshlang'ich region zoom'i.
   */
  const [camZoom, setCamZoom] = useState<number | null>(null);
  const zoom = camZoom ?? (initial.current ? Math.round(zoomOf(initial.current) * 4) / 4 : null);
  const grouped = useMemo(
    () => zoom == null
      ? { singles: located.map((t) => ({ id: t.tripId, lat: t.gps.lat, lng: t.gps.lng, item: t })), clusters: [] as Cluster<Located>[] }
      // Tanlangan mashina hech qachon guruhga kirmaydi — yorlig'i va kuzatuvi ko'rinib tursin
      : clusterPoints(located.map((t) => ({ id: t.tripId, lat: t.gps.lat, lng: t.gps.lng, item: t })), zoom, { keep: (p) => p.id === selected }),
    [located, zoom, selected],
  );

  /** Guruh bosildi — a'zolari ekranga sig'adigan qilib yaqinlashadi (bir hovlidagilar — juda yaqin, alohida ko'rinadi). */
  const openCluster = (cl: Cluster<Located>) => {
    setFollow(false);
    const b = boundsOf(cl.members);
    if (b.spanM < CLUSTER_TIGHT_M) {
      mapRef.current?.animateToRegion({ latitude: b.center.lat, longitude: b.center.lng, latitudeDelta: CLUSTER_TIGHT_DELTA, longitudeDelta: CLUSTER_TIGHT_DELTA }, 500);
    } else {
      mapRef.current?.fitToCoordinates(cl.members.map((m) => ({ latitude: m.lat, longitude: m.lng })));
    }
  };

  const fitAll = () => {
    if (coords.length > 1) mapRef.current?.fitToCoordinates(coords);
    else if (coords[0]) mapRef.current?.animateToRegion({ ...coords[0], latitudeDelta: 0.04, longitudeDelta: 0.04 }, 400);
    else toast.info("Xaritada ko'rsatadigan GPS nuqtasi yo'q");
  };

  const focus = (t: ErpFleetItem) => {
    if (t.tripId !== selected) setFollow(false);
    setSelected(t.tripId);
    setSheet(true);
    if (t.gps && config.mapsEnabled) mapRef.current?.animateToRegion({ latitude: t.gps.lat, longitude: t.gps.lng, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA }, 500);
  };

  const clearSel = () => { setSelected(null); setSheet(false); setFollow(false); };

  const followLat = follow ? sel?.gps?.lat : undefined;
  const followLng = follow ? sel?.gps?.lng : undefined;
  useEffect(() => {
    if (followLat != null && followLng != null) mapRef.current?.animateCamera({ latitude: followLat, longitude: followLng }, 600);
  }, [followLat, followLng]);

  const call = (phone: string) => { void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => toast.error("Qo'ng'iroq qilib bo'lmadi")); };
  const navigate = async (t: ErpFleetItem) => {
    const p = t.dest ?? (t.gps ? { lat: t.gps.lat, lng: t.gps.lng } : null);
    if (!p) { toast.warning("Na obyekt nuqtasi, na GPS bor — navigatorga yo'nalish berib bo'lmaydi"); return; }
    // "Bekor qilish" ham `false` qaytaradi, xato holatini esa `openInNavigator` o'zi aytadi — bu yerda qo'shimcha toast yo'q
    await openInNavigator({ lat: p.lat, lng: p.lng, label: t.dest ? `${t.customer}${t.address ? ` · ${t.address}` : ''}` : `${t.plate} · ${t.driver}` });
  };

  const mapH = Math.round(Math.min(420, Math.max(260, height * 0.45)));
  const updated = dataUpdatedAt ? hms(new Date(dataUpdatedAt).toISOString()) : null;

  const chips: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: 'Hammasi', count: counts.all },
    { key: 'road', label: "Yo'lda", count: counts.road },
    { key: 'loaded', label: 'Yuklangan', count: counts.loaded },
    { key: 'planned', label: 'Kutilmoqda', count: counts.planned },
    ...(counts.issue ? [{ key: 'issue' as const, label: 'Muammo', count: counts.issue }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader
        title={title}
        overline={updated ? `Jonli · ${Math.round(FLEET_POLL_MS / 1000)} s da yangilanadi · ${updated}` : 'Jonli kuzatuv'}
        onBack={onBack}
        raised={raise.raised}
        actions={[
          ...(config.mapsEnabled && coords.length ? [{ icon: 'locate-fixed' as const, label: 'Hammasini ko\'rsatish', onPress: () => { clearSel(); fitAll(); } }] : []),
          { icon: 'refresh-cw' as const, label: 'Yangilash', onPress: () => void refetch() },
        ]}
        style={{ paddingTop: insets.top + space.sm }}
      />
      <ScrollView
        // Xaritani surish/yaqinlashtirish paytida sahifa aylanmaydi
        scrollEnabled={lock.scrollEnabled}
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl, gap: space.stack }}
        refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        {isLoading ? <SkeletonList rows={5} /> : error && !data ? (
          <EmptyState icon="cloud-off" title="Reyslar yuklanmadi" hint={(error as Error).message || "Internetni tekshirib, qayta urinib ko'ring"} onRetry={() => void refetch()} />
        ) : (
          <>
            {all.length > 1 ? <ChipGroup items={chips} value={filter} onChange={(k) => { setFilter(k); clearSel(); }} /> : null}

            {!config.mapsEnabled ? (
              <MapUnavailable compact hint="Bu versiyaga Yandex xarita kaliti ulanmagan — telefoningizda nuqson yo'q. Reyslar quyida ro'yxatda: har birini bosib, «Navigatorda» orqali joyini ko'ring. Xaritani yoqish uchun administratorga ayting." />
            ) : initial.current ? (
              <View style={{ height: mapH, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault }}>
                <MapView
                  ref={(r) => { mapRef.current = r; }}
                  style={{ flex: 1 }}
                  initialRegion={initial.current}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  traffic
                  zoomControls
                  onTouchLock={lock.onTouchLock}
                  onPanDrag={follow ? () => setFollow(false) : undefined}
                  onCameraIdle={(cam) => { const z = Math.round(cam.zoom * 4) / 4; setCamZoom((p) => (p === z ? p : z)); }}
                >
                  {routed.map((t) => (
                    <RouteLine key={`r:${t.tripId}`} from={{ latitude: t.gps.lat, longitude: t.gps.lng }} to={{ latitude: t.dest.lat, longitude: t.dest.lng }} color={lineColor(t)} width={4} />
                  ))}
                  {selRoute ? <RouteLine key={`r:${selRoute.tripId}`} from={{ latitude: selRoute.gps.lat, longitude: selRoute.gps.lng }} to={{ latitude: selRoute.dest.lat, longitude: selRoute.dest.lng }} color={lineColor(selRoute)} width={5} /> : null}
                  {located.map((t) => {
                    const line = trailOf(t);
                    return line.length ? <Polyline key={`t:${t.tripId}`} coordinates={line} strokeColor={trailColor(t) + (selected === t.tripId ? 'aa' : '59')} strokeWidth={selected === t.tripId ? 4 : 3} /> : null;
                  })}
                  {selRoute ? <Marker key={`d:${selRoute.tripId}`} coordinate={{ latitude: selRoute.dest.lat, longitude: selRoute.dest.lng }} tone="success" /> : null}
                  {grouped.clusters.map((cl) => (
                    <ClusterMarker
                      key={`cl:${cl.id}`}
                      coordinate={{ latitude: cl.lat, longitude: cl.lng }}
                      count={cl.members.length}
                      status={worstStatus(cl.members.map((m) => driverStatus(m.item)))}
                      zIndex={cl.members.some((m) => m.item.openIssues) ? 11 : 9}
                      onPress={() => openCluster(cl)}
                    />
                  ))}
                  {grouped.singles.map(({ item: t }) => {
                    const active = selected === t.tripId;
                    return (
                      <DriverMarker
                        key={t.tripId}
                        coordinate={{ latitude: t.gps.lat, longitude: t.gps.lng }}
                        status={driverStatus(t)}
                        heading={headingOf(t)}
                        selected={active}
                        label={t.plate}
                        caption={markerCaption(t)}
                        alert={alertsOf(t).length > 0}
                        zIndex={active ? 14 : t.openIssues ? 11 : 10}
                        onPress={() => focus(t)}
                      />
                    );
                  })}
                </MapView>
                <View style={{ position: 'absolute', right: space.sm, bottom: space.sm }}>
                  <IconButton icon="locate-fixed" label="Hamma mashinani ko'rsatish" variant="secondary" onPress={() => { clearSel(); fitAll(); }} />
                </View>
                {follow && sel ? (
                  <Pressable
                    onPress={() => setFollow(false)}
                    accessibilityRole="button"
                    accessibilityLabel={`${sel.plate} kuzatilmoqda. To'xtatish`}
                    style={{ position: 'absolute', left: space.sm, top: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: c.bgSurface, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, borderWidth: size.hairline, borderColor: c.borderDefault }}
                  >
                    <Icon name="navigation" size={size.iconSm} tone="brand" />
                    <Txt v="label" color="brand" numberOfLines={1}>{sel.plate}</Txt>
                    <Icon name="x" size={size.iconSm} tone="muted" />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Callout tone="neutral" icon="map-pin">
                {all.length ? "Hozircha birorta haydovchidan GPS kelmayapti — mashina yo'lga chiqib, ilovada kuzatuv yoqilsa xaritada ko'rinadi." : "Faol reys yo'q."}
              </Callout>
            )}

            {config.mapsEnabled && located.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs }}>
                {MAP_LEGEND.map((l) => (
                  <View key={l.status} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    <View style={{ width: size.legend, height: size.legend, borderRadius: radius.pill, backgroundColor: mapDriver[l.status] }} />
                    <Txt v="legend">{l.label}</Txt>
                  </View>
                ))}
              </View>
            ) : null}

            {data?.gpsError ? <Callout tone="warning" icon="triangle-alert">{`GPS manbasi bilan aloqa yo'q: ${data.gpsError}`}</Callout> : null}

            <SectionHead title="Faol reyslar" count={trucks.length || undefined} action={trucks.length ? 'Ro\'yxat' : undefined} onAction={() => router.push('/erp/list/trips' as never)} />
            {trucks.length === 0 ? (
              <EmptyState compact icon="truck" title={all.length ? "Bu holatda reys yo'q" : "Faol reys yo'q"} hint={all.length ? undefined : 'Reys ochilib, haydovchi yo\'lga chiqqanda shu yerda ko\'rinadi'} />
            ) : (
              <ListGroup>
                {trucks.map((t) => {
                  const tone = toneOf(t);
                  const gps = t.gps;
                  const stale = !!gps && isStale(t);
                  const speed = speedLabel(t);
                  const al = alertsOf(t);
                  const line2 = [
                    t.phase,
                    t.delay,
                    gps ? `${gpsAgo(t)}${stale ? ' · eskirgan' : ''}${speed ? ` · ${speed}` : ''}${gps.etaMin != null ? ` · ~${gps.etaMin} daq` : ''}` : "GPS yo'q",
                  ].filter(Boolean).join(' · ');
                  return (
                    <ListItem
                      key={t.tripId}
                      icon="truck"
                      module="logistics"
                      tone={t.openIssues ? 'danger' : al.length ? 'warning' : undefined}
                      title={`${t.plate} · ${t.driver}`}
                      subtitle={`${t.customer}${t.address ? ` · ${t.address}` : ''}${t.product ? `\n${t.product}${t.qty ? ` · ${t.qty}` : ''}` : ''}\n${line2}`}
                      subtitleLines={3}
                      badge={t.openIssues || !al.length
                        ? { text: t.openIssues ? `${t.openIssues} muammo` : t.delay && t.delayTone ? t.delay : LEGEND.find((l) => l.tone === tone)?.label ?? t.phase, tone }
                        : { text: al.length > 1 ? `${al[0]!.title} +${al.length - 1}` : al[0]!.title, tone: 'warning' }}
                      style={selected === t.tripId ? { backgroundColor: c.bgMuted } : undefined}
                      onPress={() => focus(t)}
                    />
                  );
                })}
              </ListGroup>
            )}
          </>
        )}
      </ScrollView>

      <Sheet open={!!sel && sheet} onClose={() => setSheet(false)} title={sel ? `${sel.plate} · ${sel.ref}` : ''}>
        {sel ? (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <Badge label={sel.phase} tone={toneOf(sel)} />
              {sel.delay ? <Badge label={sel.delay} tone={sel.delayTone ?? 'success'} /> : null}
              {sel.openIssues ? <Badge label={`${sel.openIssues} ochiq muammo`} tone="danger" /> : null}
            </View>
            <KVList
              rows={[
                { label: 'Haydovchi', value: sel.driverPhone ? `${sel.driver} · ${sel.driverPhone}` : sel.driver },
                { label: 'Zayavka', value: `${sel.orderNo ? `${sel.orderNo} · ` : ''}${sel.customer}` },
                ...(sel.address ? [{ label: 'Manzil', value: sel.address }] : []),
                ...(sel.qty ? [{ label: 'Yuk', value: sel.qty }] : []),
                ...(sel.plannedAt ? [{ label: 'Reja', value: sel.plannedAt }] : []),
                { label: 'ETA', value: sel.gps?.etaMin != null ? `~${sel.gps.etaMin} daq` : "noma'lum", tone: sel.delayTone && sel.delayTone !== 'success' ? sel.delayTone : undefined },
                ...(speedLabel(sel) ? [{ label: 'Tezlik', value: speedLabel(sel)! }] : []),
                { label: 'GPS', value: sel.gps ? `${gpsAgo(sel)}${isStale(sel) ? ' · eskirgan' : ''}${sel.gps.km != null ? ` · ${fmtUnit(sel.gps.km, 'km')} yurdi` : ''}` : "Signal yo'q", tone: isStale(sel) ? 'warning' : undefined },
              ]}
            />
            {alertsOf(sel).map((a) => (
              <Callout key={`${a.kind}:${a.openedAt}`} tone={a.kind === 'OFF_ROUTE' || a.kind === 'SILENT' ? 'danger' : 'warning'} icon="triangle-alert">
                {`${a.title}${a.info ? ` — ${a.info}` : ''} · ${agoLabel(a.since ?? a.openedAt)}`}
              </Callout>
            ))}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button title="Qo'ng'iroq" icon="phone" variant="secondary" disabled={!sel.driverPhone} onPress={() => sel.driverPhone && call(sel.driverPhone)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Navigatorda" icon="navigation" variant="secondary" disabled={!sel.dest && !sel.gps} onPress={() => void navigate(sel)} />
              </View>
            </View>
            {sel.gps && config.mapsEnabled ? (
              <Button
                title={follow ? "Kuzatishni to'xtatish" : 'Xaritada kuzatib borish'}
                icon="navigation"
                variant={follow ? 'secondary' : 'primary'}
                onPress={() => {
                  if (follow) { setFollow(false); return; }
                  // Kamera mashinaga effekt orqali suriladi (yaqinlik `focus` da allaqachon qo'yilgan)
                  setFollow(true);
                  setSheet(false);
                }}
              />
            ) : null}
            {!sel.driverPhone ? <Txt v="caption" color="muted" align="center">Haydovchi telefoni xodim kartasida yozilmagan</Txt> : null}
            {!sel.tripId.startsWith('ref:') ? <Button title="Reys kartochkasi" icon="truck" onPress={() => { clearSel(); router.push(`/erp/trips/${sel.tripId}` as never); }} /> : null}
            {sel.orderId ? <Button title="Zayavkani ochish" icon="file-text" variant="ghost" onPress={() => { clearSel(); router.push(`/erp/orders/${sel.orderId}` as never); }} /> : null}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
