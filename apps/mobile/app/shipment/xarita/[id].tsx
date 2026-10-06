import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { Button, Card, EmptyState, IconButton, Txt } from '@/design/primitives';
import { dialog } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { Loader } from '@/design/loader';
import { radius, shadow, size, space } from '@/design/tokens';
import { config } from '@/core/config';
import { Circle, MapUnavailable, MapView, Marker, MeMarker, Polyline, type MapHandle } from '@/core/map';
import { useLiveRoute } from '@/core/route';
import { openInNavigator } from '@/core/navigate';
import { SITE_RADIUS_M, ensureForegroundLocation } from '@/core/location';
import { arrivalClock, distanceLabel, durationLabel, haversineMeters } from '@/core/geo';
import { useShipment } from '@/features/eco/api';

/**
 * Yuk yo'lda — to'liq ekranli xarita (ilova ichida, tashqi navigatorsiz).
 *
 * Mashina (o'z GPS'imiz, yo'nalish o'qi bilan), obyekt va uning 300 m doirasi ("Yetkazdim"
 * shu doira ichida ochiladi), qolgan masofa va taxminiy yetib borish vaqti, "kuzatish" rejimi.
 * Yo'l — Yandex MapKit'dan, ko'chalar bo'ylab va tirbandlik bilan (`core/route.tsx`). Topilmasa
 * (aloqa yo'q) to'g'ri chiziq punktir bilan va masofa "to'g'ri chiziq" deb halol yoziladi;
 * ovozli yo'l — "Navigatorda ochish".
 */

const MOVING_KMH = 4;
const HEADING_MIN_KMH = 3;
const SPEED_WINDOW_MS = 5 * 60_000;
/** Shahar ichidagi o'rtacha tezlik — hali yurilmagan bo'lsa ETA shu bilan. */
const CITY_KMH = 30;
/** To'g'ri chiziq yo'ldan qisqa — shahar ko'chalari uchun taxminiy koeffitsient. */
const ROAD_FACTOR = 1.3;

interface Fix { lat: number; lng: number; speedKmh: number; heading: number | null; at: number }

export default function ShipmentMap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  useKeepAwake();
  const q = useShipment(id!);
  const s = q.data;
  const [fix, setFix] = useState<Fix | null>(null);
  const [gps, setGps] = useState<'wait' | 'ok' | 'denied' | 'blocked' | 'off'>('wait');
  const [follow, setFollow] = useState(true);
  const speeds = useRef<{ kmh: number; at: number }[]>([]);
  const map = useRef<MapHandle | null>(null);
  // Android: ochilish animatsiyasi paytida yaratilgan xarita belgilarni chizmaydi (yolda/[id].tsx dagi izoh)
  const [canMap, setCanMap] = useState(false);
  useEffect(() => { const t = InteractionManager.runAfterInteractions(() => setCanMap(true)); return () => t.cancel(); }, []);

  useEffect(() => { nav.setOptions({ title: s ? `Yuk №${s.number}` : 'Xarita' }); }, [nav, s]);

  // Jonli joylashuv — ruxsat yo'q bo'lsa ekran baribir ishlaydi, sababi pastda aytiladi
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (follow && fix) map.current?.animateCamera({ latitude: fix.lat, longitude: fix.lng }, 600);
  }, [fix, follow]);

  const dest = useMemo(() => (s?.project.lat && s.project.lng ? { lat: s.project.lat, lng: s.project.lng } : null), [s?.project.lat, s?.project.lng]);
  const straightM = fix && dest ? haversineMeters(fix, dest) : null;
  const road = useLiveRoute(fix, dest);
  /** Qolgan yo'l: Yandex yo'li bo'ylab, u bo'lmasa to'g'ri chiziq. */
  const remainingM = road.along ? road.along.remainingM : straightM;
  const etaMin = useMemo(() => {
    if (remainingM == null) return null;
    const moving = speeds.current.filter((x) => x.kmh >= MOVING_KMH);
    const r = road.route;
    // Hali yurilmagan bo'lsa — Yandex'ning tirbandlik bilan hisoblagan tezligi
    const planned = r && r.seconds > 0 ? (r.meters / 1000) / (r.seconds / 3600) : CITY_KMH;
    const kmh = moving.length >= 3 ? moving.reduce((a, x) => a + x.kmh, 0) / moving.length : planned;
    return Math.round(((road.along ? remainingM : remainingM * ROAD_FACTOR) / 1000 / kmh) * 60);
  }, [remainingM, road.along, road.route]);

  const fitAll = useCallback(() => {
    if (!fix || !dest) return;
    setFollow(false);
    map.current?.fitToCoordinates([{ latitude: fix.lat, longitude: fix.lng }, { latitude: dest.lat, longitude: dest.lng }]);
  }, [fix, dest]);

  const centerOnMe = () => {
    if (!fix) { dialog('Joylashuv topilmadi', gps === 'ok' ? 'GPS hali nuqta bermadi — ochiq joyda bir necha soniya kuting.' : 'GPS yoqilganini va ilovaga joylashuv ruxsati berilganini tekshiring.'); return; }
    setFollow(true);
    map.current?.animateToRegion({ latitude: fix.lat, longitude: fix.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
  };

  if (!s) return q.isError ? <EmptyState icon="cloud-off" title="Yuk yuklanmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} /> : <Loader fill />;
  if (!dest) return <EmptyState icon="map-pin" title="Obyekt nuqtasi belgilanmagan" hint={`Manzil: ${s.project.address}. Dispetcherdan nuqtani aniqlang.`} />;

  const inside = straightM != null && straightM <= SITE_RADIUS_M;
  const gpsNote = gps === 'denied' || gps === 'blocked' ? 'Joylashuvga ruxsat yo\'q — mashina xaritada ko\'rinmaydi, masofa hisoblanmaydi'
    : gps === 'off' ? 'Telefonda GPS o\'chiq — yoqing' : null;

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
                <Polyline coordinates={road.line.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={c.brand} strokeWidth={6} />
              ) : fix && road.failed ? (
                <Polyline coordinates={[{ latitude: fix.lat, longitude: fix.lng }, { latitude: dest.lat, longitude: dest.lng }]} strokeColor={c.brand} strokeWidth={4} lineDashPattern={[8, 6]} />
              ) : null}
              <Circle center={{ latitude: dest.lat, longitude: dest.lng }} radius={SITE_RADIUS_M} strokeColor={c.successSolid + '99'} fillColor={c.successSolid + '1A'} />
              <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} tone="success" />
              {s.warehouse.lat && s.warehouse.lng ? <Marker coordinate={{ latitude: s.warehouse.lat, longitude: s.warehouse.lng }} tone="info" /> : null}
              {fix ? <MeMarker coordinate={{ latitude: fix.lat, longitude: fix.lng }} heading={fix.heading != null && fix.speedKmh >= HEADING_MIN_KMH ? fix.heading : null} /> : null}
            </MapView>
            <View style={{ position: 'absolute', right: space.lg, bottom: space.lg, gap: space.md }}>
              <IconButton icon="scan-line" label="Butun marshrut" variant="secondary" tone="strong" size={size.iconTile + space.sm} onPress={fitAll} style={[{ borderRadius: radius.pill }, shadow.card]} />
              <IconButton
                icon={follow ? 'locate-fixed' : 'locate'} label={follow ? 'Kuzatish yoqiq' : 'Meni top'} variant="secondary" tone={follow ? 'brand' : 'strong'} size={size.iconTile + space.sm}
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
        <Card style={{ flexDirection: 'row', padding: space.md, gap: space.md, marginTop: space.md, marginBottom: space.md }}>
          <Metric label="Qolgani" value={remainingM != null ? distanceLabel(remainingM) : '—'} unit={road.along ? "yo'l bo'yicha" : "to'g'ri chiziq"} tone="brand" />
          <Metric label="Yetib borish" value={etaMin != null ? arrivalClock(etaMin) : '—'} unit={etaMin != null ? `~${durationLabel(etaMin)}` : 'GPS kutilmoqda'} />
          <Metric label="Tezlik" value={`${Math.round(fix?.speedKmh ?? 0)}`} unit="km/soat" />
        </Card>
        {gpsNote ? <Txt v="caption" color="danger" align="center" style={{ marginBottom: space.sm }}>{gpsNote}</Txt> : null}
        {inside ? <Txt v="caption" color="success" align="center" style={{ marginBottom: space.sm }}>Obyekt doirasidasiz — yuk sahifasida «Yetkazdim»ni bosing</Txt> : null}
        <Button variant="secondary" icon="navigation" title="Navigatorda ochish" onPress={() => void openInNavigator({ lat: dest.lat, lng: dest.lng, label: `${s.project.name}, ${s.project.address}` })} />
      </View>
    </View>
  );
}

function Metric({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: 'brand' }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt v="caption" numberOfLines={1}>{label}</Txt>
      <Txt v="metric" color={tone === 'brand' ? 'brand' : 'strong'} numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
      <Txt v="caption" numberOfLines={1}>{unit}</Txt>
    </View>
  );
}
