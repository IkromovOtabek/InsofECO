import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { EmptyState, Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { erpText, hit } from '@/design/tokens';
import { PressScale } from '@/design/motion';
import { config } from '@/core/config';
import { ApiException } from '@/core/api';
import { openNavigation } from '@/core/navigate';
import { flushErpGps, pushErpFix, stopErpTracking } from '@/core/erp-track';
import { alongRoute, arrivalClock, distanceLabel, durationLabel, haversineMeters, type LatLng } from '@/core/geo';
import { useErpAction, useErpTripRoute } from '@/features/erp/api';
import { ActionSheet } from '@/features/erp/action-sheet';
import type { ErpAction } from '@/core/erp';

/**
 * Haydovchi marshruti — "Yo'lga chiqdim" bosilgandan keyin ochiladigan ekran.
 *
 * Nega ilova ichida: tashqi navigator ochilsa haydovchi ERP'dan chiqib ketadi va reysni
 * yopish uchun qaytib kirishi kerak bo'ladi. Bu yerda yo'l ham, raqamlar ham, "Yetkazdim"
 * tugmasi ham bitta ekranda.
 *
 * Mehnat taqsimoti: server yo'l CHIZIG'ini va bosib o'tilgan masofani beradi (logistika
 * ko'rayotgan raqam bilan bir xil bo'lishi uchun), ilova esa har GPS nuqtasida qolgan
 * masofani shu chiziq bo'ylab qayta hisoblaydi — aloqasiz joyda ham raqamlar tirik.
 *
 * Fon kuzatuvi bu ekranga bog'liq emas: u "Yo'lga chiqdim" da yoqilgan va ilova yopiq
 * bo'lsa ham ishlaydi (`core/erp-track.ts`). Bu yerdagi kuzatuv faqat ko'rsatkichlar uchun.
 */

/** Tezlik shu qiymatdan past bo'lsa "turibdi" deb hisoblanadi — svetoforda ETA cheksizga ketmasin. */
const MOVING_KMH = 4;
/** O'rtacha tezlik shuncha vaqt oynasi bo'yicha olinadi. */
const SPEED_WINDOW_MS = 5 * 60_000;
/** Chiziqdan shuncha chetga chiqilsa yo'l qayta quriladi (boshqa ko'chaga burilgan). */
const OFF_ROUTE_M = 300;
/** Yo'lni qayta so'rash chastotasi — chetlashish uzoq davom etsa ham serverni bosmaslik uchun. */
const REROUTE_EVERY_MS = 60_000;

interface Fix extends LatLng { speedKmh: number; at: number }

export default function TripRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const nav = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Yo'lda ekran o'chib qolmasin — haydovchi xaritaga qarab boradi
  useKeepAwake();

  const [fix, setFix] = useState<Fix | null>(null);
  const [noGps, setNoGps] = useState(false);
  const [follow, setFollow] = useState(true);
  const [form, setForm] = useState<ErpAction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const speedsRef = useRef<{ kmh: number; at: number }[]>([]);
  const rerouteRef = useRef(0);
  const mapRef = useRef<MapView | null>(null);

  /**
   * Yo'lning o'zi ilovada saqlanadi: ko'rsatkichlar har daqiqa-yarimda yangilanadi, lekin
   * chiziq faqat marshrut o'zgarganda qayta so'raladi (`needLine`) — 17 KB geometriya
   * har safar kelmasin va OSRM keraksiz chaqirilmasin.
   */
  const [route, setRoute] = useState<{ line: LatLng[]; meters: number; seconds: number; source: 'ROUTE' | 'LINE' } | null>(null);
  const haveLineRef = useRef(false);
  const needLineRef = useRef(true);

  const { data, isLoading, error, refetch } = useErpTripRoute(
    id!,
    () => fixRef.current,
    () => haveLineRef.current && !needLineRef.current,
  );
  const run = useErpAction();

  useEffect(() => { nav.setOptions({ title: data ? data.ref : 'Marshrut' }); }, [data, nav]);

  // Jonli joylashuv — ko'rsatkichlar uchun. Ruxsat "Yo'lga chiqdim" da so'ralgan;
  // berilmagan bo'lsa ekran baribir ochiladi, faqat raqamlar o'rniga ogohlantirish turadi.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    void (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      const ok = status === 'granted' || (await Location.requestForegroundPermissionsAsync()).status === 'granted';
      if (!ok) { if (alive) setNoGps(true); return; }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 10 },
        (l) => {
          const next: Fix = {
            lat: l.coords.latitude,
            lng: l.coords.longitude,
            speedKmh: l.coords.speed != null ? Math.max(0, l.coords.speed * 3.6) : 0,
            at: l.timestamp,
          };
          fixRef.current = next;
          const now = Date.now();
          speedsRef.current = [...speedsRef.current.filter((s) => now - s.at < SPEED_WINDOW_MS), { kmh: next.speedKmh, at: now }];
          setFix(next);
        },
      );
    })();
    return () => { alive = false; sub?.remove(); };
  }, []);

  // Xarita mashina ortidan yuradi; haydovchi xaritani qo'li bilan sursa — kuzatish to'xtaydi
  useEffect(() => {
    if (!follow || !fix || !mapRef.current) return;
    mapRef.current.animateCamera({ center: { latitude: fix.lat, longitude: fix.lng } }, { duration: 600 });
  }, [fix, follow]);

  // Yangi chiziq kelganda saqlab qo'yamiz; kelmagan javoblarda avvalgisi ishlayveradi
  useEffect(() => {
    if (!data?.lineIncluded || data.line.length === 0) return;
    haveLineRef.current = true;
    needLineRef.current = false;
    setRoute({ line: data.line, meters: data.routeMeters, seconds: data.routeSeconds, source: data.routeSource });
  }, [data]);

  const line = route?.line ?? [];
  const dest = data?.destination ?? null;

  /** Qolgan yo'l — marshrut chizig'i bo'ylab; chiziq yo'q bo'lsa to'g'ri masofa. */
  const along = useMemo(() => (fix && line.length ? alongRoute(line, fix) : null), [fix, line]);
  const remainingM = along ? along.remainingM : dest && fix ? Math.round(haversineMeters(fix, dest)) : route?.meters ?? 0;

  // Yo'ldan chiqib ketilgan bo'lsa marshrut qayta quriladi
  useEffect(() => {
    if (!along || along.offRouteM < OFF_ROUTE_M) return;
    if (Date.now() - rerouteRef.current < REROUTE_EVERY_MS) return;
    rerouteRef.current = Date.now();
    needLineRef.current = true; // boshqa ko'chaga burilgan — yo'l qayta qurilsin
    void refetch();
  }, [along, refetch]);

  /**
   * Yetib borish vaqti. Asos — so'nggi daqiqalardagi haqiqiy tezlik: haydovchi tirbandlikda
   * tursa ETA ham cho'ziladi. Hali yurilmagan bo'lsa yo'lning o'rtacha tezligi olinadi.
   */
  const etaMin = useMemo(() => {
    const moving = speedsRef.current.filter((s) => s.kmh >= MOVING_KMH);
    const live = moving.length >= 3 ? moving.reduce((s, x) => s + x.kmh, 0) / moving.length : 0;
    const planned = route && route.seconds > 0 ? (route.meters / 1000) / (route.seconds / 3600) : 0;
    const kmh = live || planned || 30;
    return Math.round((remainingM / 1000 / kmh) * 60);
  }, [remainingM, route, fix]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * "Yetkazdim" — obyektga 1 km qolgandan keyin ochiladi (radiusni server aytadi).
   * Zayavkada koordinata bo'lmasa tekshiradigan narsa yo'q: server qarorini olamiz.
   */
  const straightM = fix && dest ? haversineMeters(fix, dest) : null;
  const near = !dest ? (data?.canDeliver ?? false)
    : straightM == null ? false
    : straightM <= (data?.arriveWithinM ?? 1000);
  const nearHint = !dest ? data?.deliverHint ?? null
    : straightM == null ? 'Joylashuv aniqlanmoqda…'
    : near ? null
    : `Obyektgacha ${distanceLabel(straightM)} — ${distanceLabel(data?.arriveWithinM ?? 1000)} qolganda ochiladi`;

  /** Reysni yopish — maydonlar kartochkadagi bilan bir xil (server yuboradi). */
  const deliver = async (payload: Record<string, unknown>) => {
    try {
      // Hozirgi nuqtani avval serverga yetkazamiz: "1 km qoldimi?" qoidasi o'sha yerda ham
      // tekshiriladi va u oxirgi saqlangan nuqtaga qaraydi.
      if (fixRef.current) await pushErpFix(fixRef.current); else await flushErpGps();
      const r = await run.mutateAsync({ action: 'trip.delivered', id: id!, payload });
      setForm(null);
      await stopErpTracking(); // qolgan nuqtalar yuboriladi va kuzatuv to'xtaydi
      Alert.alert('Bajarildi', r.message, [{ text: 'Yopish', onPress: () => router.back() }]);
    } catch (e) {
      setFormError(e instanceof ApiException ? e.message : 'Tarmoq xatosi');
    }
  };

  // Maydonlarni server aytadi — kartochkadagi "Yetkazdim" bilan bir xil bo'lishi uchun
  const deliverAction: ErpAction = useMemo(() => ({
    id: 'trip.delivered', label: 'Yetkazdim', tone: 'success', form: data?.deliverForm ?? [],
  }), [data?.deliverForm]);

  const onDeliver = useCallback(() => {
    if (!near) { Alert.alert('Yetkazdim', nearHint ?? 'Obyektga yetib borilmagan'); return; }
    setFormError(null);
    setForm(deliverAction);
  }, [near, nearHint, deliverAction]);

  if (isLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.brandPrimary} /></View>;
  if (error || !data) return <EmptyState title="Marshrut ochilmadi" hint="Internetni tekshiring" />;

  const region = {
    latitude: dest?.lat ?? fix?.lat ?? data.origin?.lat ?? 41.2995,
    longitude: dest?.lng ?? fix?.lng ?? data.origin?.lng ?? 69.2401,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgCanvas }}>
      {/* Kalitsiz Android'da xarita ilovani yiqitadi — bunday holda faqat raqamlar qoladi
          (`core/config.ts`), ya'ni reys baribir olib boriladi va yopiladi. */}
      {config.mapsEnabled && dest ? (
        <View style={{ flex: 1 }}>
          <MapView
            ref={(r) => { mapRef.current = r; }}
            style={{ flex: 1 }}
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton={false}
            onPanDrag={() => setFollow(false)}
          >
            <Polyline coordinates={line.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={c.brandPrimary} strokeWidth={5} />
            {/* "Yetkazdim" shu doira ichida ochiladi — haydovchi qancha qolganini ko'rib turadi */}
            <Circle
              center={{ latitude: dest.lat, longitude: dest.lng }}
              radius={data.arriveWithinM}
              strokeColor={c.success + '99'}
              fillColor={c.success + '1A'}
            />
            <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} title="Obyekt" description={data.address} pinColor={c.brandPrimary} />
          </MapView>
          {!follow ? (
            <PressScale onPress={() => setFollow(true)} style={{ position: 'absolute', right: 14, bottom: 14 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="locate" size={22} color={c.brandPrimary} />
              </View>
            </PressScale>
          ) : null}
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Icon name="map-outline" size={34} color={c.textSecondary} />
          <Txt style={{ ...erpText.rowTitle, color: c.textPrimary, marginTop: 10, textAlign: 'center' }}>{data.address}</Txt>
          <Txt style={{ fontSize: 13, color: c.textSecondary, marginTop: 6, textAlign: 'center' }}>
            {dest ? 'Xarita bu qurilmada ko\'rsatilmaydi' : 'Zayavkada obyekt nuqtasi belgilanmagan'}
          </Txt>
        </View>
      )}

      {/* Pastki panel: mijoz, to'rtta raqam va keyingi qadam */}
      <View style={{ backgroundColor: c.bgSurface, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
        <Txt style={{ ...erpText.rowTitle, color: c.textPrimary }} numberOfLines={1}>{data.customer}</Txt>
        <Txt style={{ fontSize: 12.5, color: c.textSecondary, marginTop: 2 }} numberOfLines={1}>{data.address}</Txt>

        <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 14 }}>
          <Metric label="Tezlik" value={`${Math.round(fix?.speedKmh ?? 0)}`} unit="km/soat" />
          <Metric label="Bosib o'tildi" value={distanceLabel(data.traveledMeters)} unit={data.traveledMinutes > 0 ? durationLabel(data.traveledMinutes) : '—'} />
          <Metric label="Qolgani" value={distanceLabel(remainingM)} unit={route?.source === 'ROUTE' ? 'yo\'l bo\'yicha' : 'taxminan'} tone="brand" />
          <Metric label="Yetib borish" value={arrivalClock(etaMin)} unit={durationLabel(etaMin)} />
        </View>

        {noGps ? (
          <Txt style={{ fontSize: 12, color: c.danger, marginBottom: 10, textAlign: 'center' }}>
            Joylashuvga ruxsat berilmagan — tezlik va qolgan masofa ko&apos;rinmaydi
          </Txt>
        ) : null}

        <PressScale onPress={onDeliver} disabled={run.isPending} haptic={near}>
          <View style={{
            height: hit.driverTarget, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            backgroundColor: near ? c.success : c.bgCanvas, borderWidth: near ? 0 : 1, borderColor: c.border, opacity: run.isPending ? 0.6 : 1,
          }}>
            <Icon name={near ? 'flag' : 'lock-closed'} size={20} color={near ? '#FFFFFF' : c.textSecondary} />
            <Txt style={{ ...erpText.button, marginLeft: 8, color: near ? '#FFFFFF' : c.textSecondary }}>Yetkazdim</Txt>
          </View>
        </PressScale>
        {nearHint ? <Txt style={{ fontSize: 12, color: c.textSecondary, marginTop: 6, textAlign: 'center' }}>{nearHint}</Txt> : null}

        {/* Ovozli yo'l-yo'riq kerak bo'lsa — tashqi navigator. Ixtiyoriy: reysni olib borish
            uchun shart emas, shuning uchun ikkinchi darajali tugma. */}
        {dest ? (
          <PressScale onPress={() => void openNavigation(dest.lat, dest.lng, data.address)} style={{ marginTop: 8 }}>
            <View style={{ height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="navigate" size={16} color={c.brandPrimary} />
              <Txt style={{ ...erpText.label, marginLeft: 6, color: c.brandPrimary }}>Navigatorda ochish</Txt>
            </View>
          </PressScale>
        ) : null}
      </View>

      {form ? (
        <ActionSheet
          action={form}
          loading={run.isPending}
          error={formError}
          onClose={() => setForm(null)}
          onSubmit={(payload) => void deliver(payload)}
        />
      ) : null}
    </View>
  );
}

/** Pastki paneldagi bitta raqam — hammasi bir xil kenglikda, ustma-ust bir chiziqda. */
function Metric({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: 'brand' }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Txt style={{ fontSize: 11, color: c.textSecondary }} numberOfLines={1}>{label}</Txt>
      <Txt style={{ ...erpText.stat, color: tone === 'brand' ? c.brandPrimary : c.textPrimary, marginTop: 2 }} numberOfLines={1}>{value}</Txt>
      <Txt style={{ fontSize: 10.5, color: c.textSecondary }} numberOfLines={1}>{unit}</Txt>
    </View>
  );
}
