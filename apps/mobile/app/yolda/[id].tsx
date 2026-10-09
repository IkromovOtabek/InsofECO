import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { Button, Card, EmptyState, FitTxt, IconButton, Txt, fmtDateFull, fmtTime } from '@/design/primitives';
import { dialog, Icon } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { Appear } from '@/design/motion';
import { radius, shadow, size, space } from '@/design/tokens';
import { config } from '@/core/config';
import { ApiException } from '@/core/api';
import { openInNavigator } from '@/core/navigate';
import { Circle, MapUnavailable, MapView, Marker, DriverMarker, Polyline, type MapHandle } from '@/core/map';
import { useLiveRoute } from '@/core/route';
import { SITE_RADIUS_M, type Fix as SiteFix } from '@/core/location';
import { confirmAtSite } from '@/features/address/site-check';
import { activeErpTripId, flushErpGps, pushErpFix, startErpTracking, stopErpTracking } from '@/core/erp-track';
import { alongRoute, arrivalClock, distanceLabel, durationLabel, haversineMeters, type LatLng } from '@/core/geo';
import { useErpAction, useErpTripRoute } from '@/features/erp/api';
import { TRIP_LIVE_STATUSES, drivenLineOf, trackSpan, tripMinutes, useErpTripTrack } from '@/features/erp/trip-track';
import { useSession } from '@/core/session';
import { ActionSheet } from '@/features/erp/action-sheet';
import type { ErpAction } from '@/core/erp';
import { Loader } from '@/design/loader';

/**
 * Haydovchi marshruti — "Yo'lga chiqdim" bosilgandan keyin ochiladigan ekran.
 *
 * Nega ilova ichida: tashqi navigator ochilsa haydovchi ERP'dan chiqib ketadi va reysni
 * yopish uchun qaytib kirishi kerak bo'ladi. Bu yerda yo'l ham, raqamlar ham, "Yetkazdim"
 * tugmasi ham bitta ekranda.
 *
 * Mehnat taqsimoti: yo'l CHIZIG'I — Yandex MapKit'dan, telefonning o'zida (`core/route.tsx`):
 * ko'chalar bo'ylab, tirbandlik hisobga olingan vaqt bilan, Yandex Navigator'dagidek. Server
 * bosib o'tilgan masofani beradi (logistika ko'rayotgan raqam bilan bir xil bo'lishi uchun) va
 * zaxira chiziqni — MapKit yo'l topa olmasa (aloqa yo'q, kalit cheklangan) o'sha chiziladi.
 * Ilova har GPS nuqtasida qolgan masofani chiziq bo'ylab qayta hisoblaydi — aloqasiz joyda ham
 * raqamlar tirik.
 *
 * Fon kuzatuvi bu ekranga bog'liq emas: u "Yo'lga chiqdim" da yoqilgan va ilova yopiq
 * bo'lsa ham ishlaydi (`core/erp-track.ts`). Bu yerdagi kuzatuv faqat ko'rsatkichlar uchun.
 *
 * Bosib o'tilgan yo'l (`GET /api/mobile/trip-track`, 30 s da) — ECO yuk xaritasidagi kabi aksent rangda,
 * qolgan yo'l (brend) ustida. Tugagan reys (yetkazildi / bekor) — faqat tarix: iz, km, vaqt, tezlik.
 *
 * Kim ochganiga qarab "mashina" ikki xil (`shipment/xarita/[id].tsx` qoidasi): haydovchining o'zi — telefon
 * GPS'i; logistika/direktor esa mashinada emas — ularning joylashuvi so'ralmaydi va serverga yuborilmaydi,
 * mashina serverdagi oxirgi nuqtada (`trip-track` → `last`), 10 daqiqadan eski bo'lsa — kulrang.
 */

/** Tezlik shu qiymatdan past bo'lsa "turibdi" deb hisoblanadi — svetoforda ETA cheksizga ketmasin. */
const MOVING_KMH = 4;
/** O'rtacha tezlik shuncha vaqt oynasi bo'yicha olinadi. */
const SPEED_WINDOW_MS = 5 * 60_000;
/**
 * Chiziqdan shuncha chetga chiqilsa yo'l qayta quriladi.
 *
 * 120 m — qo'shni ko'cha masofasi. Ilgari 300 m edi va noto'g'ri burilish deyarli hech
 * qachon sezilmasdi: shahar ichida yonma-yon ko'chalar 30-60 m narida, ya'ni haydovchi
 * butunlay boshqa yo'ldan ketayotgan bo'lsa ham "marshrutda" hisoblanardi.
 */
const OFF_ROUTE_M = 120;
/** Yo'lni qayta so'rash chastotasi — chetlashish uzoq davom etsa ham serverni bosmaslik uchun. */
const REROUTE_EVERY_MS = 20_000;

interface Fix extends LatLng {
  speedKmh: number;
  at: number;
  /** Qaysi tomonga qarab ketyapti, gradus (0 — shimol). Aniqlanmasa `null`. */
  heading: number | null;
}

/**
 * Tezlik shundan past bo'lsa yo'nalish ko'rsatilmaydi.
 *
 * Turgan mashinada GPS yo'nalishi tasodifiy raqam beradi va o'q aylanib turadi —
 * bu xaritaga ishonchni yo'qotadi. Turganda oddiy nuqta ko'rsatilgani halolroq.
 */
const HEADING_MIN_KMH = 3;
/** Logistika ko'rinishi: serverdagi oxirgi nuqta shundan eski bo'lsa — "GPS eskirgan" (kulrang belgi). */
const STALE_MIN = 10;
/** "N daq oldin" yozuvi shu oraliqda qayta hisoblanadi. */
const CLOCK_TICK_MS = 30_000;

function agoLabel(min: number) {
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daq oldin`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} soat oldin` : `${Math.floor(h / 24)} kun oldin`;
}

export default function TripRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const nav = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Yo'lda ekran o'chib qolmasin — haydovchi xaritaga qarab boradi
  useKeepAwake();

  const [ownFix, setFix] = useState<Fix | null>(null);
  const [noGps, setNoGps] = useState(false);
  const [follow, setFollow] = useState(true);
  const [form, setForm] = useState<ErpAction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const speedsRef = useRef<{ kmh: number; at: number }[]>([]);
  const rerouteRef = useRef(0);
  const mapRef = useRef<MapHandle | null>(null);

  /**
   * Yo'l faqat kerak bo'lganda qayta quriladi: birinchi ochilishda va yo'ldan chiqib
   * ketilganda. Chiziqning o'zi so'rov keshida saqlanadi (`useErpTripRoute`), shuning
   * uchun ekrandan chiqib qaytilganda ham joyida turadi va 17 KB geometriya har
   * yangilashda qayta kelmaydi.
   */
  const needLineRef = useRef(true);
  /**
   * Xarita HAQIQIY o'lchamga ega bo'lgunicha belgi va chiziqlar qo'shilmaydi.
   *
   * `flex: 1` li xarita birinchi renderda balandligi 0 bilan mount bo'ladi. O'sha payt
   * qo'shilgan Marker/Polyline/Circle yo'qoladi: xarita keyin o'lchamga ega bo'lib
   * plitkalarni chizadi, lekin bolalarni qayta qo'shmaydi. Bosh ekrandagi xarita
   * qat'iy balandlikda bo'lgani uchun u yerda bu muammo yo'q edi.
   */
  /**
   * Xarita ekran ochilish ANIMATSIYASI tugagandan keyin yaratiladi.
   *
   * Android'da animatsiya paytida yaratilgan xarita `initialRegion` ni ham e'tiborga
   * olmaydi, unga qo'shilgan belgi va chiziqlarni ham chizmaydi — xarita o'zi ishlaydi,
   * usti esa bo'sh qoladi. Bosh ekrandagi xarita animatsiyasiz ochilgani uchun u yerda
   * bu muammo sezilmasdi.
   */
  const [canMap, setCanMap] = useState(false);
  useEffect(() => {
    const t = InteractionManager.runAfterInteractions(() => setCanMap(true));
    return () => t.cancel();
  }, []);

  /** Haydovchining o'zi — telefon GPS'i "mashina"; boshqalar (logistika) — serverdagi oxirgi nuqta. */
  const isDriver = useSession((x) => x.kind === 'erp' && x.erp?.role === 'DRIVER');
  // Logistika telefonining joyi serverga "mashina joyi" bo'lib ketmasin — marshrut zavoddan/yuk olingan joydan quriladi
  const { data, isLoading, error, refetch } = useErpTripRoute(id!, () => (isDriver ? fixRef.current : null), () => needLineRef.current);
  const run = useErpAction();
  /** `null` — reys hali yuklanmagan; `true` — yetkazilgan/bekor: faqat tarix. */
  const finished = data ? !['PLANNED', ...TRIP_LIVE_STATUSES].includes(data.status) : null;
  const live = !!data && TRIP_LIVE_STATUSES.includes(data.status);
  const track = useErpTripTrack(id, data?.status);
  const tr = track.data ?? null;

  useEffect(() => { nav.setOptions({ title: data ? data.ref : 'Marshrut' }); }, [data, nav]);

  /**
   * Fon kuzatuvi to'xtab qolgan bo'lsa tiklaymiz.
   *
   * Reys yo'lda, lekin ilova yopilgan yoki telefon o'chib yongan bo'lsa, fon vazifasi
   * qayta boshlanmaydi va server oxirgi nuqtani eski deb biladi — natijada "Yetkazdim"
   * abadiy qulf bo'lib qolardi. Marshrut ekrani ochilishi shu holatni to'g'rilaydi.
   */
  useEffect(() => {
    if (!id || !isDriver || data?.status !== 'ON_ROAD') return;
    if (activeErpTripId() === id) return;
    void startErpTracking(id);
  }, [id, isDriver, data?.status]);

  // Jonli joylashuv — ko'rsatkichlar uchun. Ruxsat "Yo'lga chiqdim" da so'ralgan;
  // berilmagan bo'lsa ekran baribir ochiladi, faqat raqamlar o'rniga ogohlantirish turadi.
  // Faqat haydovchida va tugamagan reysda (reys hali yuklanmagan bo'lsa ham — birinchi marshrut shu nuqtadan
  // quriladi): logistika telefonining joyi "mashina" emas
  const done = finished === true;
  useEffect(() => {
    if (!isDriver || done) return;
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    void (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      const ok = status === 'granted' || (await Location.requestForegroundPermissionsAsync()).status === 'granted';
      if (!ok) { if (alive) setNoGps(true); return; }

      // Aniq nuqta kelguncha 5-30 soniya ketadi. Shuncha vaqt mashina xaritada
      // ko'rinmay tursa, haydovchi "yo'qolib qoldim" deb o'ylaydi — shuning uchun avval
      // tizimdagi oxirgi ma'lum nuqtani olamiz: u darhol keladi va xarita bo'sh qolmaydi.
      const last = await Location.getLastKnownPositionAsync();
      if (last && alive && !fixRef.current) {
        const p: Fix = { lat: last.coords.latitude, lng: last.coords.longitude, speedKmh: 0, heading: null, at: last.timestamp };
        fixRef.current = p;
        setFix(p);
      }

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 10 },
        (l) => {
          const next: Fix = {
            lat: l.coords.latitude,
            lng: l.coords.longitude,
            speedKmh: l.coords.speed != null ? Math.max(0, l.coords.speed * 3.6) : 0,
            heading: l.coords.heading != null && l.coords.heading >= 0 ? l.coords.heading : null,
            at: l.timestamp,
          };
          fixRef.current = next;
          const now = Date.now();
          speedsRef.current = [...speedsRef.current.filter((s) => now - s.at < SPEED_WINDOW_MS), { kmh: next.speedKmh, at: now }];
          setFix(next);
        },
      );
      // Ekran kutish paytida yopilgan bo'lsa — obuna oqib qolmasin
      if (!alive) sub.remove();
    })().catch(() => { /* GPS xatosi — ekran raqamsiz ishlayveradi */ });
    return () => { alive = false; sub?.remove(); };
  }, [isDriver, done]);

  // Logistika: "N daq oldin" va eskirish yangi ma'lumot kelmasa ham o'zgarib borsin
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (isDriver || !live) return;
    const t = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, [isDriver, live]);
  /** Serverdagi mashina nuqtasi (logistika ko'rinishi, jonli reys). */
  const remoteFix = useMemo<Fix | null>(() => {
    const l = tr?.last;
    if (isDriver || !live || !l || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) return null;
    return { lat: l.lat, lng: l.lng, speedKmh: l.speedKmh ?? 0, heading: l.heading ?? null, at: Date.parse(l.at) };
  }, [isDriver, live, tr?.last]);
  // Server bergan har yangi tezlik ETA o'rtachasiga qo'shiladi (haydovchida bu `watchPositionAsync` ichida)
  const remoteKmh = tr?.last?.speedKmh ?? null;
  useEffect(() => {
    if (!remoteFix || remoteKmh == null) return;
    const at = remoteFix.at;
    speedsRef.current = [...speedsRef.current.filter((x) => at - x.at < SPEED_WINDOW_MS && x.at !== at), { kmh: remoteKmh, at }];
  }, [remoteFix, remoteKmh]);
  /** Xaritadagi mashina: haydovchida — o'z GPS'i, logistikada — serverdagi oxirgi nuqta. */
  const fix = isDriver ? ownFix : remoteFix;
  const ageMin = !isDriver && fix ? Math.max(0, Math.round((now - fix.at) / 60_000)) : null;
  const stale = ageMin != null && ageMin >= STALE_MIN;

  // Xarita mashina ortidan yuradi; haydovchi xaritani qo'li bilan sursa — kuzatish to'xtaydi
  useEffect(() => {
    if (!follow || !fix || !mapRef.current) return;
    mapRef.current.animateCamera({ latitude: fix.lat, longitude: fix.lng }, 600);
  }, [fix, follow]);

  // Chiziq kelgach qayta so'rash shart emas — keyingi safar keshdagisi ishlatiladi
  useEffect(() => { if (data?.line.length) needLineRef.current = false; }, [data]);

  const dest = data?.destination ?? null;
  /** Yandex yo'li — mashina turgan joydan; yo'ldan chiqilsa o'zi qayta quriladi. */
  const road = useLiveRoute(finished ? null : fix ?? data?.origin ?? null, finished ? null : dest);
  const serverLine = data?.line ?? [];
  const onRoad = !!road.route || data?.routeSource === 'ROUTE';

  /** Qolgan yo'l — marshrut chizig'i bo'ylab; chiziq yo'q bo'lsa to'g'ri masofa. */
  const serverAlong = useMemo(() => (!road.route && fix && serverLine.length ? alongRoute(serverLine, fix) : null), [road.route, fix, serverLine]);
  const along = road.along ?? serverAlong;
  const remainingM = along ? along.remainingM : dest && fix ? Math.round(haversineMeters(fix, dest)) : road.route?.meters ?? data?.routeMeters ?? 0;
  /**
   * Xaritadagi chiziq: Yandex yo'lining o'tilmagan qismi; u bo'lmasa server yo'li. Server ham
   * faqat to'g'ri chiziq bergan bo'lsa — Yandex javobi kutiladi, topilmasa punktir (taxminiy).
   */
  const drawLine = road.line.length >= 2 ? road.line
    : data?.routeSource === 'ROUTE' ? serverAlong?.ahead ?? serverLine
    : road.failed ? serverLine : [];
  const dashed = road.line.length < 2 && data?.routeSource !== 'ROUTE';

  // Server chizig'i ishlatilayotgan bo'lsa va yo'ldan chiqib ketilgan bo'lsa — u qayta quriladi
  // (Yandex yo'li `useLiveRoute` ichida o'zi qayta quriladi)
  useEffect(() => {
    if (!along || road.route || along.offRouteM < OFF_ROUTE_M) return;
    if (Date.now() - rerouteRef.current < REROUTE_EVERY_MS) return;
    rerouteRef.current = Date.now();
    needLineRef.current = true; // boshqa ko'chaga burilgan — yo'l qayta qurilsin
    void refetch();
  }, [along, road.route, refetch]);

  /**
   * Yetib borish vaqti. Asos — so'nggi daqiqalardagi haqiqiy tezlik: haydovchi tirbandlikda
   * tursa ETA ham cho'ziladi. Hali yurilmagan bo'lsa yo'lning o'rtacha tezligi olinadi.
   */
  const etaMin = useMemo(() => {
    // GPS eskirgan bo'lsa eski tezlikka ishonilmaydi — rejadagi tezlik
    const moving = stale ? [] : speedsRef.current.filter((s) => s.kmh >= MOVING_KMH);
    const live = moving.length >= 3 ? moving.reduce((s, x) => s + x.kmh, 0) / moving.length : 0;
    // Yandex vaqti joriy tirbandlik bilan — server vaqtidan aniqroq
    const r = road.route;
    const planned = r && r.seconds > 0 ? (r.meters / 1000) / (r.seconds / 3600)
      : data && data.routeSeconds > 0 ? (data.routeMeters / 1000) / (data.routeSeconds / 3600) : 0;
    const kmh = live || planned || 30;
    return Math.round((remainingM / 1000 / kmh) * 60);
  }, [remainingM, data, road.route, fix, stale]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Bosib o'tilgan yo'l chizig'i (server izi). Jonli reysda oxiriga mashinaning hozirgi nuqtasi
   * qo'shiladi — iz 30 s da bir yangilanadi, chiziq mashinadan uzilib qolmasin.
   */
  const driven = useMemo(() => {
    const pts = tr ? drivenLineOf(tr) : [];
    const tail = pts[pts.length - 1];
    if (live && fix && tail && haversineMeters({ lat: tail.latitude, lng: tail.longitude }, fix) < 2000) pts.push({ latitude: fix.lat, longitude: fix.lng });
    return pts;
  }, [tr, live, fix]);
  const start = driven[0] ?? null;
  /** Bosib o'tildi: trip-track (yangi server) bo'lsa — o'sha, bo'lmasa marshrut javobidagi. */
  const traveledM = tr ? tr.meters : data?.traveledMeters ?? 0;
  const traveledMin = tr ? tr.movingSec / 60 : data?.traveledMinutes ?? 0;

  /**
   * "Yetkazdim" radiusi — server aytgani (ERP, odatda 1 km) va ilovadagi `SITE_RADIUS_M`
   * (300 m) dan kichigi. Ilgari 1 km edi: haydovchi obyektga yetmay, qo'shni mahallada
   * turib reysni yopa olardi. Bosilganda YANGI GPS nuqta bilan qayta tekshiriladi
   * (`confirmAtSite`) — kuzatuvdagi nuqta bir necha daqiqa eski bo'lishi mumkin.
   * Zayavkada koordinata bo'lmasa tekshiradigan narsa yo'q: server qarorini olamiz.
   */
  const radiusM = Math.min(data?.arriveWithinM || SITE_RADIUS_M, SITE_RADIUS_M);
  const straightM = fix && dest ? haversineMeters(fix, dest) : null;
  const near = !dest ? (data?.canDeliver ?? false)
    : straightM == null ? false
    : straightM <= radiusM;
  const nearHint = !dest ? data?.deliverHint ?? null
    : straightM == null ? (noGps ? "Joylashuvga ruxsat yo'q — «Yetkazdim»ni bosing, ruxsat so'raladi" : "Joylashuv aniqlanmoqda… GPS sekin bo'lsa «Yetkazdim»ni bosib tekshiring")
    : near ? null
    : `Obyektgacha ${distanceLabel(straightM)} — ${distanceLabel(radiusM)} qolganda ochiladi`;
  /** Obyekt yonida ekani tasdiqlangan aniq nuqta — "Yetkazdim" shu bilan yuboriladi. */
  const siteFixRef = useRef<SiteFix | null>(null);

  /** Reysni yopish — maydonlar kartochkadagi bilan bir xil (server yuboradi). */
  const deliver = async (payload: Record<string, unknown>) => {
    try {
      // Obyekt yonida tasdiqlangan nuqtani avval serverga yetkazamiz: ERP qoidasi ("yetib
      // keldimi?") oxirgi saqlangan nuqtaga qaraydi — eski nuqta bilan rad etilmasin.
      const here = siteFixRef.current ?? fixRef.current;
      if (here) {
        await pushErpFix({
          lat: here.lat, lng: here.lng, at: here.at,
          accuracyM: 'accuracyM' in here ? here.accuracyM : null,
          speedKmh: 'speedKmh' in here ? here.speedKmh : null,
          heading: 'heading' in here ? here.heading : null,
        });
      } else await flushErpGps();
      // Koordinata amalning o'zida ham — ERP 300 m qoidasini shu nuqta bilan tekshiradi
      const r = await run.mutateAsync({ action: 'trip.delivered', id: id!, payload: here ? { ...payload, lat: here.lat, lng: here.lng } : payload });
      setForm(null);
      await stopErpTracking(); // qolgan nuqtalar yuboriladi va kuzatuv to'xtaydi
      // Aniq nima bo'lganini aytamiz — umumiy "Bajarildi" emas. Server rad etsa bu yerga kelinmaydi (catch).
      dialog('Yetkazildi', r.message || `${data?.ref ?? 'Reys'} yopildi — yuk mijozga topshirildi.`, [{ text: 'Yopish', onPress: () => router.back() }], { tone: 'success' });
    } catch (e) {
      setFormError(e instanceof ApiException ? e.message : 'Tarmoq xatosi');
    }
  };

  // Maydonlarni server aytadi — kartochkadagi "Yetkazdim" bilan bir xil bo'lishi uchun
  const deliverAction: ErpAction = useMemo(() => ({
    id: 'trip.delivered', label: 'Yetkazdim', tone: 'success', form: data?.deliverForm ?? [],
  }), [data?.deliverForm]);

  /**
   * "Meni top" — xaritani mashinaga qaytaradi va kuzatuvni yoqadi.
   *
   * Nuqta hali yo'q bo'lsa (ekranga endi kirilgan, GPS tutmagan) shu yerda so'rab olamiz:
   * tugma bosilganda bir-ikki soniya kutish maqbul, xaritada mashinaning umuman
   * ko'rinmasligi esa yo'q.
   */
  const centerOnMe = useCallback(async () => {
    if (!isDriver) {
      if (!fix) { dialog("Mashina joylashuvi yo'q", "Haydovchi telefonidan hali GPS kelmadi — u yo'lga chiqib, ilovada kuzatuv yoqilganda xaritada ko'rinadi."); return; }
      setFollow(true);
      mapRef.current?.animateToRegion({ latitude: fix.lat, longitude: fix.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
      return;
    }
    setFollow(true);
    let p = fixRef.current;
    if (!p) {
      try {
        // GPS ba'zan uzoq javob bermaydi — cheksiz kutmaymiz, 6 soniyadan keyin sabab aytiladi
        const l = (await Location.getLastKnownPositionAsync()) ?? (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((r) => setTimeout(() => r(null), 6000)),
        ]));
        if (l) {
          p = { lat: l.coords.latitude, lng: l.coords.longitude, speedKmh: 0, heading: null, at: l.timestamp };
          fixRef.current = p;
          setFix(p);
        }
      } catch { /* quyida aytiladi */ }
    }
    if (!p) {
      // Jim qolmaymiz: tugma bosilib hech narsa bo'lmasa, haydovchi ilova buzuq deb o'ylaydi
      dialog('Joylashuv topilmadi', "GPS yoqilganini va ilovaga joylashuv ruxsati berilganini tekshiring.");
      return;
    }
    // Bosilganda yaqinlashtiramiz ham — `animateToRegion` iOS'da ham, Android'da ham bir xil ishlaydi
    mapRef.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
  }, [isDriver, fix]);

  /** Mashina va obyekt bir ekranga sig'adi. Kuzatuv o'chadi — aks holda kamera darhol qaytib ketardi. */
  const fitAll = useCallback(() => {
    const here = isDriver ? fixRef.current : fix;
    const coords = [...driven];
    if (here) coords.push({ latitude: here.lat, longitude: here.lng });
    if (dest && !finished) coords.push({ latitude: dest.lat, longitude: dest.lng });
    if (coords.length < 2) { if (!finished) void centerOnMe(); return; }
    setFollow(false);
    mapRef.current?.fitToCoordinates(coords);
  }, [isDriver, fix, driven, dest, finished, centerOnMe]);

  // Tugagan reys: iz kelgach kamera bir marta butun yo'lga moslanadi (keyin erkin suriladi)
  const fitted = useRef(false);
  useEffect(() => {
    if (!finished || !canMap || fitted.current || driven.length < 2) return;
    fitted.current = true;
    setFollow(false);
    // Xarita o'lchamga ega bo'lishini kutamiz — aks holda fitToCoordinates e'tiborsiz qoladi
    const t = setTimeout(fitAll, 400);
    return () => clearTimeout(t);
  }, [finished, canMap, driven.length, fitAll]);

  /**
   * "Yetkazdim": avval YANGI GPS nuqta bilan obyekt yonidami tekshiriladi. Uzoq bo'lsa —
   * masofa va "Qayta tekshirish" (site-check.ts); forma faqat obyekt yonida ochiladi.
   */
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const onDeliver = useCallback(async () => {
    if (!dest && !near) { dialog('Hali yopib bo\'lmaydi', nearHint ?? 'Obyektga yetib borilmagan', undefined, { tone: 'warning' }); return; }
    if (checkingRef.current) return; // tez ikki bosish — ikki GPS oynasi chiqmasin
    checkingRef.current = true;
    setChecking(true);
    const here = await confirmAtSite(dest, 'Yetkazdim').finally(() => { checkingRef.current = false; setChecking(false); });
    if (here === null) return;
    siteFixRef.current = here ?? null;
    if (here) {
      const p: Fix = { lat: here.lat, lng: here.lng, speedKmh: fixRef.current?.speedKmh ?? 0, heading: fixRef.current?.heading ?? null, at: here.at };
      fixRef.current = p;
      setFix(p);
    }
    setFormError(null);
    setForm(deliverAction);
  }, [dest, near, nearHint, deliverAction]);

  if (isLoading) return <Loader fill />;
  if (error || !data) return <EmptyState title="Marshrut ochilmadi" hint="Internetni tekshiring" />;
  if (finished) return <FinishedTrip data={data} track={track} driven={driven} start={start} canMap={canMap} mapRef={mapRef} onFit={fitAll} />;

  const region = {
    latitude: dest?.lat ?? fix?.lat ?? data.origin?.lat ?? 41.2995,
    longitude: dest?.lng ?? fix?.lng ?? data.origin?.lng ?? 69.2401,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      {/* Xarita kalitisiz build'da faqat raqamlar qoladi (`core/config.ts`),
          ya'ni reys baribir olib boriladi va yopiladi. */}
      {config.mapsEnabled && dest && canMap ? (
        <View style={{ flex: 1 }}>
          <MapView
            ref={(r) => { mapRef.current = r; }}
            style={{ flex: 1 }}
            initialRegion={region}
            traffic
            // Tizimning ko'k nuqtasi emas, o'z belgimiz (pastda): u har doim chiziladi
            // va ko'rinishini biz boshqaramiz — haydovchi "men qayerdaman?" degan savolga
            // bir qarashda javob topishi kerak.
            onPanDrag={() => setFollow(false)}
          >
            {/* Yo'l — brend; obyekt va yetib borish doirasi — yashil; mashina — ko'k */}
            <Polyline coordinates={drawLine.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={c.brand} strokeWidth={dashed ? 4 : 5} lineDashPattern={dashed ? [8, 6] : undefined} />
            {/* Bosib o'tilgan yo'l — qolgan yo'ldan (brend) boshqa rangda, ustida (ECO yuk xaritasi bilan bir xil) */}
            {driven.length >= 2 ? <Polyline coordinates={driven} strokeColor={c.accent} strokeWidth={5} /> : null}
            {start ? <StartMarker coordinate={start} /> : null}
            {/* "Yetkazdim" shu doira ichida ochiladi — haydovchi qancha qolganini ko'rib turadi */}
            <Circle
              center={{ latitude: dest.lat, longitude: dest.lng }}
              radius={radiusM}
              strokeColor={c.successSolid + '99'}
              fillColor={c.successSolid + '1A'}
            />
            <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} tone="success" />
            {/* Yurayotganda — yo'nalishga qaragan o'q, turganda — oddiy nuqta */}
            {fix ? (
              <DriverMarker
                coordinate={{ latitude: fix.lat, longitude: fix.lng }}
                status={stale ? 'offline' : 'moving'}
                heading={fix.heading != null && fix.speedKmh >= HEADING_MIN_KMH && !stale ? fix.heading : null}
              />
            ) : null}
          </MapView>
          {/* "Meni top" — HAR DOIM ko'rinadi. Ilgari faqat xarita qo'l bilan surilganda
              chiqardi, ya'ni ekranga qaytib kirilganda mashina ko'rinmay qolsa, uni
              qaytaradigan tugma ham yo'q edi. Brend chegarali holat — kuzatuv yoqiq. */}
          <View style={{ position: 'absolute', right: space.lg, bottom: space.lg, gap: space.md }}>
            {/* Butun marshrutni ko'rish — mashina ham, obyekt ham bir ekranga sig'adi */}
            <IconButton
              icon="scan-line" label="Butun marshrut" variant="secondary" tone="strong" size={size.iconTile + space.sm}
              onPress={fitAll}
              style={[{ borderRadius: radius.pill }, shadow.card]}
            />
            <IconButton
              icon={follow ? 'locate-fixed' : 'locate'} label={isDriver ? 'Meni top' : 'Mashinani top'} variant="secondary" tone={follow ? 'brand' : 'strong'} size={size.iconTile + space.sm}
              onPress={() => void centerOnMe()}
              style={[{ borderRadius: radius.pill }, follow && { backgroundColor: c.brandSoft, borderColor: c.brand }, shadow.card]}
            />
          </View>
        </View>
      ) : (
        !dest ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.sm }}>
            <Icon name="map-pin" size={size.iconXl} tone="muted" />
            <Txt v="bodyStrong" align="center">{data.address}</Txt>
            <Txt v="bodySm" color="muted" align="center">Zayavkada obyekt nuqtasi belgilanmagan — yo&apos;lni manzil bo&apos;yicha toping yoki logistga qo&apos;ng&apos;iroq qiling</Txt>
          </View>
        ) : !config.mapsEnabled ? (
          // Sabab — build'da MapKit kaliti yo'q (core/map.tsx → MapUnavailable). Xaritasiz ham
          // to'g'ri chiziq masofasi, yo'nalish va tashqi navigator ishlaydi.
          <MapUnavailable style={{ flex: 1 }}>
            {straightM != null ? <Txt v="metric" color="brand" align="center" style={{ marginTop: space.sm }}>{distanceLabel(straightM)}</Txt> : null}
            {straightM != null ? <Txt v="caption" align="center">obyektgacha to&apos;g&apos;ri chiziq bo&apos;yicha</Txt> : null}
          </MapUnavailable>
        ) : (
          <Loader fill />
        )
      )}

      {/* Pastki panel: mijoz, to'rtta raqam va keyingi qadam — ochilganda pastdan yumshoq ko'tariladi */}
      <Appear from={24} scale={1}>
        <View style={{ backgroundColor: c.bgSurface, borderTopWidth: size.hairline, borderTopColor: c.borderDefault, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md }}>
          <Txt v="bodyStrong" numberOfLines={1}>{data.customer}</Txt>
          <Txt v="caption" numberOfLines={1}>{data.address}</Txt>

          <Card style={{ flexDirection: 'row', flexWrap: 'wrap', padding: space.md, gap: space.md, marginTop: space.md, marginBottom: space.md }}>
            {isDriver ? (
              <Metric label="Tezlik" value={`${Math.round(fix?.speedKmh ?? 0)}`} unit="km/soat" />
            ) : (
              <Metric
                label="Tezlik"
                value={fix && !stale && remoteKmh != null ? `${Math.round(remoteKmh)}` : '—'}
                unit={ageMin != null ? `km/soat · ${agoLabel(ageMin)}` : 'km/soat'}
              />
            )}
            <Metric label="Bosib o'tildi" value={distanceLabel(traveledM)} unit={traveledMin > 0 ? durationLabel(traveledMin) : '—'} tone="accent" />
            <Metric label="Qolgani" value={distanceLabel(remainingM)} unit={onRoad ? 'yo\'l bo\'yicha' : 'taxminan'} tone="brand" />
            <Metric label="Yetib borish" value={arrivalClock(etaMin)} unit={durationLabel(etaMin)} />
          </Card>

          {!isDriver && !fix && !track.isLoading ? (
            <Txt v="caption" color="danger" align="center" style={{ marginBottom: space.sm }}>
              {live ? "Haydovchi telefonidan GPS hali kelmadi — mashina xaritada ko'rinmaydi" : "Reys hali yuklanmagan — yuklangach mashina xaritada ko'rinadi"}
            </Txt>
          ) : null}
          {stale && ageMin != null ? (
            <Txt v="caption" color="warning" align="center" style={{ marginBottom: space.sm }}>{`GPS eskirgan — mashina ${agoLabel(ageMin)} shu yerda edi`}</Txt>
          ) : null}
          {isDriver && noGps ? (
            <Txt v="caption" color="danger" align="center" style={{ marginBottom: space.sm }}>
              Joylashuvga ruxsat berilmagan — tezlik va qolgan masofa ko&apos;rinmaydi
            </Txt>
          ) : null}

          {/* Obyektga yetilmaguncha tugma yopiq turadi; sababi ostidagi izohda */}
          {/* Nuqta hali yo'q (GPS sekin yoki ruxsat yo'q) — qulf emas: bosilsa yangi nuqta olinadi yoki sababi
              aytiladi (site-check.ts). Aks holda ruxsatsiz haydovchi "aniqlanmoqda…" bilan abadiy qolib ketardi. */}
          {isDriver ? (
            <>
              <Button size="lg" title="Yetkazdim" icon={near ? 'flag' : 'lock'} disabled={(!near && !(dest && straightM == null)) || run.isPending || checking} loading={checking} onPress={() => void onDeliver()} />
              {nearHint ? <Txt v="caption" align="center" style={{ marginTop: space.xs }}>{nearHint}</Txt> : null}
            </>
          ) : straightM != null && straightM <= radiusM ? (
            <Txt v="caption" color="success" align="center" style={{ marginBottom: space.xs }}>Mashina obyekt doirasida</Txt>
          ) : null}

          {/* Ovozli yo'l-yo'riq kerak bo'lsa — tashqi navigator. Ixtiyoriy: reysni olib borish
              uchun shart emas, shuning uchun ikkinchi darajali tugma. */}
          {dest ? (
            <Button variant={config.mapsEnabled ? 'ghost' : 'secondary'} icon="navigation" title="Navigatorda ochish" onPress={() => void openInNavigator({ lat: dest.lat, lng: dest.lng, label: data.address })} style={{ marginTop: space.sm }} />
          ) : null}
        </View>
      </Appear>

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

/** Pastki paneldagi bitta raqam — ikkitadan qator, hammasi bir xil kenglikda. */
function Metric({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: 'brand' | 'accent' }) {
  const { c } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%' }}>
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

/** "09.10.2026" yoki ikki kunga o'tgan bo'lsa "09.10.2026 – 10.10.2026". */
const spanDay = (sp: { from: string; to: string }) => { const a = fmtDateFull(sp.from), b = fmtDateFull(sp.to); return a === b ? a : `${a} – ${b}`; };
const kmh = (v: number | null) => (v == null ? '—' : `${Math.round(v)}`);

/**
 * Tugagan reys (yetkazildi / bekor qilindi): faqat tarix — `shipment/xarita/[id].tsx` dagi `FinishedTrip` kabi.
 * Haqiqiy iz, boshlanish va obyekt, pastda — km, yo'lda/harakatda vaqt, soat oralig'i, o'rtacha/eng yuqori tezlik.
 * Jonli GPS, qolgan yo'l, tirbandlik va "Yetkazdim" yo'q.
 */
function FinishedTrip({ data, track, driven, start, canMap, mapRef, onFit }: {
  data: NonNullable<ReturnType<typeof useErpTripRoute>['data']>;
  track: ReturnType<typeof useErpTripTrack>;
  driven: { latitude: number; longitude: number }[];
  start: { latitude: number; longitude: number } | null;
  canMap: boolean;
  mapRef: React.MutableRefObject<MapHandle | null>;
  onFit: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const t = track.data;
  const dest = data.destination;
  const origin = data.origin;
  const center = dest ?? (start ? { lat: start.latitude, lng: start.longitude } : null) ?? origin;
  const hasLine = driven.length >= 2;
  const span = t ? trackSpan(t) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      {!center ? (
        <EmptyState icon="map-pin" title="Xaritada ko'rsatib bo'lmaydi" hint={`Obyekt nuqtasi ham, GPS izi ham yo'q. Manzil: ${data.address}`} />
      ) : config.mapsEnabled ? (
        canMap ? (
          <View style={{ flex: 1 }}>
            <MapView
              ref={(r) => { mapRef.current = r; }} style={{ flex: 1 }}
              initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
              zoomControls
            >
              {hasLine ? <Polyline coordinates={driven} strokeColor={c.accent} strokeWidth={6} /> : null}
              {start ? <StartMarker coordinate={start} /> : null}
              {origin ? <Marker coordinate={{ latitude: origin.lat, longitude: origin.lng }} tone="info" /> : null}
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
        <Txt v="bodyStrong" numberOfLines={1}>{data.customer}</Txt>
        <Txt v="caption" numberOfLines={1}>{data.address}</Txt>
        {track.isLoading ? <Loader style={{ marginVertical: space.lg }} /> : t ? (
          <Card style={{ flexDirection: 'row', flexWrap: 'wrap', padding: space.md, gap: space.md, marginTop: space.md }}>
            <Metric label="Bosib o'tildi" value={distanceLabel(t.meters)} unit="GPS izi bo'yicha" tone="accent" />
            <Metric label="Yo'lda" value={tripMinutes(t) > 0 ? durationLabel(tripMinutes(t)) : '—'} unit={t.movingSec > 0 ? `harakatda ${durationLabel(t.movingSec / 60)}` : '—'} />
            <Metric label="Vaqt" value={span ? `${fmtTime(span.from)} → ${fmtTime(span.to)}` : '—'} unit={span ? spanDay(span) : ''} />
            <Metric label="O'rtacha tezlik" value={kmh(t.avgSpeedKmh)} unit={t.maxSpeedKmh != null ? `km/soat · eng yuqori ${Math.round(t.maxSpeedKmh)}` : 'km/soat'} />
          </Card>
        ) : (
          <Txt v="caption" align="center" style={{ marginTop: space.md }}>
            {track.isError ? "Yo'l ma'lumoti yuklanmadi — internetni tekshiring" : `Bosib o'tildi: ${distanceLabel(data.traveledMeters)}${data.traveledMinutes > 0 ? ` · ${durationLabel(data.traveledMinutes)}` : ''}`}
          </Txt>
        )}
        {t && !hasLine ? (
          <Txt v="caption" align="center" style={{ marginTop: space.sm }}>Bu reys uchun GPS izi yozilmagan — yo&apos;l chizig&apos;i yo&apos;q</Txt>
        ) : null}
      </View>
    </View>
  );
}
