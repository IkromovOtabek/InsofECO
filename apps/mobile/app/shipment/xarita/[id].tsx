import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { Button, Card, EmptyState, FitTxt, IconButton, Txt, fmtDateFull, fmtTime } from '@/design/primitives';
import { dialog } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { Loader } from '@/design/loader';
import { radius, shadow, size, space } from '@/design/tokens';
import { config } from '@/core/config';
import { useSession } from '@/core/session';
import { Circle, MapUnavailable, MapView, Marker, DriverMarker, Polyline, type MapHandle } from '@/core/map';
import { useLiveRoute } from '@/core/route';
import { openInNavigator } from '@/core/navigate';
import { SITE_RADIUS_M, ensureForegroundLocation } from '@/core/location';
import { arrivalClock, distanceLabel, durationLabel, haversineMeters } from '@/core/geo';
import { useShipment } from '@/features/eco/api';
import { SHIPMENT_HAS_TRACK, SHIPMENT_TRACKED, usePlannedRouteSync, useShipmentGps, useShipmentTrack } from '@/features/eco/shipment-track';

/**
 * Yuk yo'lda — to'liq ekranli xarita (ilova ichida, tashqi navigatorsiz).
 *
 * Mashina (o'z GPS'imiz, yo'nalish o'qi bilan), obyekt va uning 300 m doirasi ("Yetkazdim"
 * shu doira ichida ochiladi), qolgan masofa va taxminiy yetib borish vaqti, "kuzatish" rejimi.
 * Yo'l — Yandex MapKit'dan, ko'chalar bo'ylab va tirbandlik bilan (`core/route.tsx`). Topilmasa
 * (aloqa yo'q) to'g'ri chiziq punktir bilan va masofa "to'g'ri chiziq" deb halol yoziladi;
 * ovozli yo'l — "Navigatorda ochish".
 *
 * Bosib o'tilgan yo'l (yuklangan, yo'lda, yetkazilgan): haqiqiy GPS izi — qaysi ko'chalardan
 * yurilgani alohida rangda, boshlanish nuqtasi, necha km va qancha vaqt (`GET /shipments/:id/track`).
 * Yetkazilgan reysda jonli GPS ham, qolgan yo'l ham yo'q — faqat tarix: kamera butun izga
 * moslanadi, xarita erkin suriladi va kattalashtiriladi.
 *
 * Kim ochganiga qarab "mashina" ikki xil: shu yukning haydovchisi — telefonning o'z GPS'i (3 s da).
 * Dispetcher (TADBIRKOR) va quruvchi esa mashinada emas — ularning telefoni joylashuvi so'ralmaydi,
 * mashina serverdagi oxirgi nuqtada (`/track` → `last`, 30 s da yangilanadi): qolgan yo'l, ETA,
 * tezlik va kuzatish o'sha nuqtadan. 10 daqiqadan eski nuqta — kulrang belgi va "N daq oldin".
 */

const MOVING_KMH = 4;
const HEADING_MIN_KMH = 3;
const SPEED_WINDOW_MS = 5 * 60_000;
/** Shahar ichidagi o'rtacha tezlik — hali yurilmagan bo'lsa ETA shu bilan. */
const CITY_KMH = 30;
/** To'g'ri chiziq yo'ldan qisqa — shahar ko'chalari uchun taxminiy koeffitsient. */
const ROAD_FACTOR = 1.3;
/** Reys tugagan — xarita faqat tarixni ko'rsatadi. */
const FINISHED = ['DELIVERED', 'CONFIRMED'];
/** Dispetcher/quruvchi: serverdagi oxirgi nuqta shundan eski bo'lsa — "GPS eskirgan" (kulrang belgi). */
const STALE_MIN = 10;
/** "N daq oldin" yozuvi va eskirish shu oraliqda qayta hisoblanadi. */
const CLOCK_TICK_MS = 30_000;

function agoLabel(min: number) {
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daq oldin`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} soat oldin` : `${Math.floor(h / 24)} kun oldin`;
}

interface Fix { lat: number; lng: number; speedKmh: number; heading: number | null; at: number }

export default function ShipmentMap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  useKeepAwake();
  const q = useShipment(id!);
  const s = q.data;
  /** `null` — yuk hali yuklanmagan; `true` — tugagan reys (jonli GPS va qolgan yo'l kerak emas). */
  const finished = s ? FINISHED.includes(s.status) : null;
  const live = !!s && SHIPMENT_TRACKED.includes(s.status);
  const track = useShipmentTrack(id, { enabled: !!s && SHIPMENT_HAS_TRACK.includes(s.status), live });
  const tr = track.data;
  // Haydovchi o'z yukini ochgan bo'lsa — fon GPS holatga moslanadi (yo'lda yoqiq, tugagach to'xtaydi)
  useShipmentGps(s);
  /**
   * Kim ko'ryapti. Rol — `shipment/[id].tsx` dagi kabi (HAYDOVCHI emasmi), egalik — `useShipmentGps`
   * dagi kabi (`driver.id`). `true` — haydovchining o'zi, `false` — dispetcher/quruvchi, `null` — yuk hali yo'q.
   */
  const me = useSession((x) => x.user?.id);
  const role = useSession((x) => x.active?.role) as string | undefined;
  const driverView = s ? role === 'HAYDOVCHI' && (!s.driver || s.driver.id === me) : null;
  const [ownFix, setFix] = useState<Fix | null>(null);
  const [gps, setGps] = useState<'wait' | 'ok' | 'denied' | 'blocked' | 'off'>('wait');
  const [follow, setFollow] = useState(true);
  const speeds = useRef<{ kmh: number; at: number }[]>([]);
  const map = useRef<MapHandle | null>(null);
  // Android: ochilish animatsiyasi paytida yaratilgan xarita belgilarni chizmaydi (yolda/[id].tsx dagi izoh)
  const [canMap, setCanMap] = useState(false);
  useEffect(() => { const t = InteractionManager.runAfterInteractions(() => setCanMap(true)); return () => t.cancel(); }, []);

  useEffect(() => { nav.setOptions({ title: s ? `Yuk №${s.number}` : 'Xarita' }); }, [nav, s]);

  // Jonli joylashuv — ruxsat yo'q bo'lsa ekran baribir ishlaydi, sababi pastda aytiladi.
  // Tugagan reysda kerak emas: ruxsat so'ralmaydi, mashina belgisi va kuzatish yo'q.
  // Faqat haydovchining o'zida: dispetcher/quruvchi telefonining joyi "mashina" emas.
  useEffect(() => {
    if (finished !== false || driverView !== true) { setFix(null); return; }
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    void (async () => {
      const access = await ensureForegroundLocation();
      if (!alive) return;
      if (access !== 'granted') { setGps(access === 'services-off' ? 'off' : access); return; }
      setGps('ok');
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (last && alive) setFix({ lat: last.coords.latitude, lng: last.coords.longitude, speedKmh: 0, heading: null, at: last.timestamp });
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 10 }, (l) => {
        const kmh = l.coords.speed != null ? Math.max(0, l.coords.speed * 3.6) : 0;
        const now = Date.now();
        speeds.current = [...speeds.current.filter((x) => now - x.at < SPEED_WINDOW_MS), { kmh, at: now }];
        setFix({ lat: l.coords.latitude, lng: l.coords.longitude, speedKmh: kmh, heading: l.coords.heading != null && l.coords.heading >= 0 ? l.coords.heading : null, at: l.timestamp });
      });
      if (!alive) sub.remove();
    })();
    return () => { alive = false; sub?.remove(); };
  }, [finished, driverView]);

  // Dispetcher/quruvchi: "N daq oldin" va eskirish yangi ma'lumot kelmasa ham o'zgarib borsin
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (driverView !== false || !live) return;
    const t = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, [driverView, live]);
  /** Serverdagi mashina nuqtasi. Eski serverda `last` yo'q — izning oxirgi nuqtasi (tezlik/yo'nalishsiz). */
  const remoteFix = useMemo<Fix | null>(() => {
    if (driverView !== false || finished !== false || !tr) return null;
    const tail = tr.points[tr.points.length - 1];
    const l = tr.last ?? (tail ? { ...tail, speedKmh: null, heading: null } : null);
    if (!l || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) return null;
    return { lat: l.lat, lng: l.lng, speedKmh: l.speedKmh ?? 0, heading: l.heading ?? null, at: Date.parse(l.at) };
  }, [driverView, finished, tr]);
  // Server bergan har yangi tezlik ETA o'rtachasiga qo'shiladi (haydovchida bu `watchPositionAsync` ichida)
  const remoteKmh = tr?.last?.speedKmh;
  useEffect(() => {
    if (!remoteFix || remoteKmh == null) return;
    const at = remoteFix.at;
    speeds.current = [...speeds.current.filter((x) => at - x.at < SPEED_WINDOW_MS && x.at !== at), { kmh: remoteKmh, at }];
  }, [remoteFix, remoteKmh]);
  /** Xaritadagi mashina: haydovchida — o'z GPS'i, boshqalarda — serverdagi oxirgi nuqta. */
  const fix = driverView ? ownFix : remoteFix;
  /** Serverdagi nuqta yoshi, daqiqa (faqat dispetcher/quruvchi). */
  const ageMin = driverView === false && fix ? Math.max(0, Math.round((now - fix.at) / 60_000)) : null;
  const stale = ageMin != null && ageMin >= STALE_MIN;

  useEffect(() => {
    if (follow && fix) map.current?.animateCamera({ latitude: fix.lat, longitude: fix.lng }, 600);
  }, [fix, follow]);

  const dest = useMemo(() => (s?.project.lat && s.project.lng ? { lat: s.project.lat, lng: s.project.lng } : null), [s?.project.lat, s?.project.lng]);
  const straightM = fix && dest ? haversineMeters(fix, dest) : null;
  const road = useLiveRoute(fix, finished ? null : dest);
  usePlannedRouteSync(s, road.route);
  /** Qolgan yo'l: Yandex yo'li bo'ylab, u bo'lmasa to'g'ri chiziq. */
  const remainingM = road.along ? road.along.remainingM : straightM;
  const etaMin = useMemo(() => {
    if (remainingM == null) return null;
    // GPS eskirgan bo'lsa eski tezlikka ishonilmaydi — rejadagi tezlik
    const moving = stale ? [] : speeds.current.filter((x) => x.kmh >= MOVING_KMH);
    const r = road.route;
    // Hali yurilmagan bo'lsa — Yandex'ning tirbandlik bilan hisoblagan tezligi
    const planned = r && r.seconds > 0 ? (r.meters / 1000) / (r.seconds / 3600) : CITY_KMH;
    const kmh = moving.length >= 3 ? moving.reduce((a, x) => a + x.kmh, 0) / moving.length : planned;
    return Math.round(((road.along ? remainingM : remainingM * ROAD_FACTOR) / 1000 / kmh) * 60);
  }, [remainingM, road.along, road.route, stale]);

  /**
   * Bosib o'tilgan yo'l chizig'i. Yo'lda bo'lsa oxiriga telefonning hozirgi nuqtasi qo'shiladi —
   * server izi 30 s da bir yangilanadi, chiziq mashinadan uzilib qolmasin.
   */
  const driven = useMemo(() => {
    const pts = (tr?.points ?? []).map((p) => ({ latitude: p.lat, longitude: p.lng }));
    const tail = pts[pts.length - 1];
    if (live && fix && tail && haversineMeters({ lat: tail.latitude, lng: tail.longitude }, fix) < 2000) pts.push({ latitude: fix.lat, longitude: fix.lng });
    return pts;
  }, [tr?.points, live, fix]);
  const start = tr?.points[0] ?? null;

  const fitAll = useCallback(() => {
    const coords = [...driven];
    if (fix) coords.push({ latitude: fix.lat, longitude: fix.lng });
    if (dest) coords.push({ latitude: dest.lat, longitude: dest.lng });
    if (coords.length < 2) return;
    setFollow(false);
    map.current?.fitToCoordinates(coords);
  }, [driven, fix, dest]);

  // Tugagan reys: iz kelgach kamera bir marta butun yo'lga moslanadi (keyin foydalanuvchi erkin suradi)
  const fitted = useRef(false);
  useEffect(() => {
    if (!finished || !canMap || fitted.current || driven.length < 2) return;
    fitted.current = true;
    setFollow(false);
    // Xarita o'lchamga ega bo'lishini kutamiz — aks holda fitMarkers e'tiborsiz qoladi
    const t = setTimeout(fitAll, 400);
    return () => clearTimeout(t);
  }, [finished, canMap, driven.length, fitAll]);

  const centerOnMe = () => {
    if (!fix && !driverView) { dialog('Mashina joylashuvi yo\'q', "Haydovchi telefonidan hali GPS kelmadi — u yuklashni boshlab, ilovada kuzatuv yoqilganda xaritada ko'rinadi."); return; }
    if (!fix) { dialog('Joylashuv topilmadi', gps === 'ok' ? 'GPS hali nuqta bermadi — ochiq joyda bir necha soniya kuting.' : 'GPS yoqilganini va ilovaga joylashuv ruxsati berilganini tekshiring.'); return; }
    setFollow(true);
    map.current?.animateToRegion({ latitude: fix.lat, longitude: fix.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
  };

  if (!s) return q.isError ? <EmptyState icon="cloud-off" title="Yuk yuklanmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} /> : <Loader fill />;
  if (finished) return <FinishedTrip s={s} track={track} driven={driven} start={start} dest={dest} canMap={canMap} mapRef={map} onFit={fitAll} />;
  if (!dest) return <EmptyState icon="map-pin" title="Obyekt nuqtasi belgilanmagan" hint={`Manzil: ${s.project.address}. Dispetcherdan nuqtani aniqlang.`} />;

  const inside = straightM != null && straightM <= SITE_RADIUS_M;
  const gpsNote = driverView
    ? gps === 'denied' || gps === 'blocked' ? 'Joylashuvga ruxsat yo\'q — mashina xaritada ko\'rinmaydi, masofa hisoblanmaydi'
      : gps === 'off' ? 'Telefonda GPS o\'chiq — yoqing' : null
    : fix || track.isLoading ? null
      : live ? "Haydovchi telefonidan GPS hali kelmadi — mashina xaritada ko'rinmaydi"
        : "Reys hali boshlanmagan — yuklash boshlangach mashina xaritada ko'rinadi";
  const staleNote = stale && ageMin != null ? `GPS eskirgan — mashina ${agoLabel(ageMin)} shu yerda edi` : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      {config.mapsEnabled ? (
        canMap ? (
          <View style={{ flex: 1 }}>
            <MapView
              ref={(r) => { map.current = r; }} style={{ flex: 1 }}
              initialRegion={{ latitude: fix?.lat ?? dest.lat, longitude: fix?.lng ?? dest.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
              onPanDrag={() => setFollow(false)}
              traffic
            >
              {road.line.length >= 2 ? (
                <Polyline coordinates={road.line.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={c.brand} strokeWidth={5} />
              ) : fix && road.failed ? (
                <Polyline coordinates={[{ latitude: fix.lat, longitude: fix.lng }, { latitude: dest.lat, longitude: dest.lng }]} strokeColor={c.brand} strokeWidth={4} lineDashPattern={[8, 6]} />
              ) : null}
              {/* Bosib o'tilgan yo'l — qolgan yo'ldan (brend) boshqa rangda, ustida */}
              <Polyline coordinates={driven} strokeColor={c.accent} strokeWidth={5} />
              {start ? <StartMarker coordinate={{ latitude: start.lat, longitude: start.lng }} /> : null}
              <Circle center={{ latitude: dest.lat, longitude: dest.lng }} radius={SITE_RADIUS_M} strokeColor={c.successSolid + '99'} fillColor={c.successSolid + '1A'} />
              <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} tone="success" />
              {s.warehouse.lat && s.warehouse.lng ? <Marker coordinate={{ latitude: s.warehouse.lat, longitude: s.warehouse.lng }} tone="info" /> : null}
              {fix ? <DriverMarker coordinate={{ latitude: fix.lat, longitude: fix.lng }} status={stale ? 'offline' : 'moving'} heading={fix.heading != null && fix.speedKmh >= HEADING_MIN_KMH && !stale ? fix.heading : null} /> : null}
            </MapView>
            <View style={{ position: 'absolute', right: space.lg, bottom: space.lg, gap: space.md }}>
              <IconButton icon="scan-line" label="Butun marshrut" variant="secondary" tone="strong" size={size.iconTile + space.sm} onPress={fitAll} style={[{ borderRadius: radius.pill }, shadow.card]} />
              <IconButton
                icon={follow ? 'locate-fixed' : 'locate'} label={follow ? 'Kuzatish yoqiq' : driverView ? 'Meni top' : 'Mashinani top'} variant="secondary" tone={follow ? 'brand' : 'strong'} size={size.iconTile + space.sm}
                onPress={centerOnMe} style={[{ borderRadius: radius.pill }, follow && { backgroundColor: c.brandSoft, borderColor: c.brand }, shadow.card]}
              />
            </View>
          </View>
        ) : <Loader fill />
      ) : (
        <MapUnavailable style={{ flex: 1 }}>
          {straightM != null ? <Txt v="metric" color="brand" align="center" style={{ marginTop: space.sm }}>{distanceLabel(straightM)}</Txt> : null}
        </MapUnavailable>
      )}

      <View style={{ backgroundColor: c.bgSurface, borderTopWidth: size.hairline, borderTopColor: c.borderDefault, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md }}>
        <Txt v="bodyStrong" numberOfLines={1}>{s.project.name}</Txt>
        <Txt v="caption" numberOfLines={1}>{s.project.address}</Txt>
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', padding: space.md, gap: space.md, marginTop: space.md, marginBottom: space.md }}>
          <Metric label="Qolgani" value={remainingM != null ? distanceLabel(remainingM) : '—'} unit={road.along ? "yo'l bo'yicha" : "to'g'ri chiziq"} tone="brand" />
          <Metric label="Yetib borish" value={etaMin != null ? arrivalClock(etaMin) : '—'} unit={etaMin != null ? `~${durationLabel(etaMin)}` : 'GPS kutilmoqda'} />
          {tr ? <Metric label="Bosib o'tildi" value={distanceLabel(tr.meters)} unit={tr.durationMinutes != null ? `yo'lda ${durationLabel(tr.durationMinutes)}` : '—'} tone="accent" /> : null}
          {driverView ? (
            <Metric label="Tezlik" value={`${Math.round(fix?.speedKmh ?? 0)}`} unit="km/soat" />
          ) : (
            <Metric
              label="Tezlik"
              value={fix && !stale && remoteKmh != null ? `${Math.round(remoteKmh)}` : '—'}
              unit={ageMin != null ? `km/soat · ${agoLabel(ageMin)}` : 'km/soat'}
            />
          )}
        </Card>
        {gpsNote ? <Txt v="caption" color="danger" align="center" style={{ marginBottom: space.sm }}>{gpsNote}</Txt> : null}
        {staleNote ? <Txt v="caption" color="warning" align="center" style={{ marginBottom: space.sm }}>{staleNote}</Txt> : null}
        {inside ? (
          <Txt v="caption" color="success" align="center" style={{ marginBottom: space.sm }}>
            {driverView ? 'Obyekt doirasidasiz — yuk sahifasida «Yetkazdim»ni bosing' : 'Mashina obyekt doirasida'}
          </Txt>
        ) : null}
        <Button variant="secondary" icon="navigation" title="Navigatorda ochish" onPress={() => void openInNavigator({ lat: dest.lat, lng: dest.lng, label: `${s.project.name}, ${s.project.address}` })} />
      </View>
    </View>
  );
}

/** Pastki paneldagi bitta raqam — ikkitadan qator (4 ta bo'lsa 2×2), hammasi bir xil kenglikda. */
function Metric({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: 'brand' | 'accent' }) {
  const { c } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: '40%' }}>
      <Txt v="caption" numberOfLines={1}>{label}</Txt>
      <FitTxt v="metric" color={tone === 'brand' ? 'brand' : 'strong'} min={0.7} style={tone === 'accent' ? { color: c.accent } : undefined}>{value}</FitTxt>
      <Txt v="caption" numberOfLines={1}>{unit}</Txt>
    </View>
  );
}

/** Izning boshlanish nuqtasi — oq hoshiyali kichik doira (iz rangida), pin emas: manzil pini bilan adashmasin. */
function StartMarker({ coordinate }: { coordinate: { latitude: number; longitude: number } }) {
  const { c } = useTheme();
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} zIndex={2}>
      <View style={{ width: size.iconSm + space.xs, height: size.iconSm + space.xs, borderRadius: radius.pill, backgroundColor: c.accent, borderWidth: size.ring, borderColor: c.bgSurface }} />
    </Marker>
  );
}

/**
 * Tugagan reys (yetkazildi / tasdiqlandi): faqat tarix. Haqiqiy iz, boshlanish va manzil,
 * pastda — necha km, qancha vaqt va soat oralig'i. Jonli GPS, qolgan yo'l, tirbandlik yo'q.
 */
function FinishedTrip({ s, track, driven, start, dest, canMap, mapRef, onFit }: {
  s: NonNullable<ReturnType<typeof useShipment>['data']>;
  track: ReturnType<typeof useShipmentTrack>;
  driven: { latitude: number; longitude: number }[];
  start: { lat: number; lng: number } | null;
  dest: { lat: number; lng: number } | null;
  canMap: boolean;
  mapRef: React.MutableRefObject<MapHandle | null>;
  onFit: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const t = track.data;
  const center = dest ?? start ?? (s.warehouse.lat && s.warehouse.lng ? { lat: s.warehouse.lat, lng: s.warehouse.lng } : null);
  const hasLine = driven.length >= 2;
  const from = t?.startedAt ?? null, to = t?.endedAt ?? s.deliveredAt ?? null;
  const sameDay = from && to && fmtDateFull(from) === fmtDateFull(to);
  const clock = from && to ? `${fmtTime(from)} → ${fmtTime(to)}` : '—';
  const day = from ? (sameDay || !to ? fmtDateFull(from) : `${fmtDateFull(from)} – ${fmtDateFull(to!)}`) : '';

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      {!center ? (
        <EmptyState icon="map-pin" title="Xaritada ko'rsatib bo'lmaydi" hint={`Obyekt nuqtasi ham, GPS izi ham yo'q. Manzil: ${s.project.address}`} />
      ) : config.mapsEnabled ? (
        canMap ? (
          <View style={{ flex: 1 }}>
            <MapView
              ref={(r) => { mapRef.current = r; }} style={{ flex: 1 }}
              initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
              zoomControls
            >
              <Polyline coordinates={driven} strokeColor={c.accent} strokeWidth={6} />
              {start ? <StartMarker coordinate={{ latitude: start.lat, longitude: start.lng }} /> : null}
              {s.warehouse.lat && s.warehouse.lng ? <Marker coordinate={{ latitude: s.warehouse.lat, longitude: s.warehouse.lng }} tone="info" /> : null}
              {dest ? <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} tone="success" /> : null}
            </MapView>
            {hasLine ? (
              <View style={{ position: 'absolute', right: space.lg, bottom: space.lg }}>
                <IconButton icon="scan-line" label="Butun yo'l" variant="secondary" tone="strong" size={size.iconTile + space.sm} onPress={onFit} style={[{ borderRadius: radius.pill }, shadow.card]} />
              </View>
            ) : null}
          </View>
        ) : <Loader fill />
      ) : (
        <MapUnavailable style={{ flex: 1 }}>
          {t ? <Txt v="metric" align="center" style={{ marginTop: space.sm, color: c.accent }}>{distanceLabel(t.meters)}</Txt> : null}
        </MapUnavailable>
      )}

      <View style={{ backgroundColor: c.bgSurface, borderTopWidth: size.hairline, borderTopColor: c.borderDefault, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md }}>
        <Txt v="bodyStrong" numberOfLines={1}>{s.warehouse.name} → {s.project.name}</Txt>
        <Txt v="caption" numberOfLines={1}>{s.project.address}</Txt>
        {track.isLoading ? <Loader style={{ marginVertical: space.lg }} /> : t ? (
          <Card style={{ flexDirection: 'row', flexWrap: 'wrap', padding: space.md, gap: space.md, marginTop: space.md }}>
            <Metric label="Bosib o'tildi" value={distanceLabel(t.meters)} unit="GPS izi bo'yicha" tone="accent" />
            <Metric label="Yo'lda" value={t.durationMinutes != null ? durationLabel(t.durationMinutes) : '—'} unit={t.movingMinutes > 0 ? `harakatda ${durationLabel(t.movingMinutes)}` : '—'} />
            <Metric label="Vaqt" value={clock} unit={day} />
            <Metric label="O'rtacha tezlik" value={t.avgSpeedKmh != null ? `${t.avgSpeedKmh}` : '—'} unit={t.maxSpeedKmh != null ? `km/soat · eng yuqori ${t.maxSpeedKmh}` : 'km/soat'} />
          </Card>
        ) : (
          <Txt v="caption" color="danger" align="center" style={{ marginTop: space.md }}>Yo'l ma'lumoti yuklanmadi — internetni tekshiring</Txt>
        )}
        {t && !hasLine ? (
          <Txt v="caption" align="center" style={{ marginTop: space.sm }}>Bu reys uchun GPS izi yozilmagan — yo&apos;l chizig&apos;i yo&apos;q, vaqt holat belgilaridan olindi</Txt>
        ) : null}
      </View>
    </View>
  );
}
