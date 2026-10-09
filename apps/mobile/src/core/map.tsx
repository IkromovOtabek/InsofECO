import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, View, type GestureResponderEvent, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import {
  Circle as YCircle,
  Marker as YMarker,
  Polyline as YPolyline,
  Yamap,
  YamapInstance,
  type MarkerRef,
  type YamapRef,
} from 'react-native-yamap-plus';
import { useTheme } from '@/design/theme';
import { IconButton, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { mapDriver, radius, size, space, textRoom, type } from '@/design/tokens';
import { config } from './config';

/**
 * Ilovadagi barcha xaritalar — Yandex MapKit ustidagi yupqa qatlam.
 *
 * Nega o'z qatlamimiz: ekranlar `react-native-maps` uslubida yozilgan (latitude/longitude,
 * delta bilan region, `fitToCoordinates`). Shu interfeysni saqlab qolsak, ekranlar deyarli
 * o'zgarmaydi, kutubxona almashsa esa faqat shu fayl o'zgaradi.
 *
 * Pin rangi ixtiyoriy emas, uchta tondan biri: MapKit belgini rasm sifatida oladi,
 * rasmlar `assets/map/` da (rangini o'zgartirish — rasmni qayta chizish).
 */

export type LatLng = { latitude: number; longitude: number };
export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
export type PinTone = 'brand' | 'success' | 'info';

const PINS: Record<PinTone, ImageSourcePropType> = {
  brand: require('../../assets/map/pin-brand.png'),
  success: require('../../assets/map/pin-success.png'),
  info: require('../../assets/map/pin-info.png'),
};
/**
 * Haydovchi holati → belgi rangi. Rasm `assets/map/drv-*.png` (generator: dumaloq nishon, ichida
 * oq yuk mashinasi, yumshoq halo). Ranglar `tokens.ts` → `mapDriver` bilan bir xil — afsona shundan oladi.
 */
export type DriverStatus = 'moving' | 'loaded' | 'waiting' | 'issue' | 'offline';
const DRIVER: Record<DriverStatus, { still: ImageSourcePropType; dir: ImageSourcePropType }> = {
  moving: { still: require('../../assets/map/drv-moving.png'), dir: require('../../assets/map/drv-moving-dir.png') },
  loaded: { still: require('../../assets/map/drv-loaded.png'), dir: require('../../assets/map/drv-loaded-dir.png') },
  waiting: { still: require('../../assets/map/drv-waiting.png'), dir: require('../../assets/map/drv-waiting-dir.png') },
  issue: { still: require('../../assets/map/drv-issue.png'), dir: require('../../assets/map/drv-issue-dir.png') },
  offline: { still: require('../../assets/map/drv-offline.png'), dir: require('../../assets/map/drv-offline-dir.png') },
};
/** Nishon rasmi 44 pt (halo bilan) — yorliq shuning ostiga tushadi. */
const DRIVER_PT = 44;

let ready = false;
/**
 * MapKit kalit bilan BIR MARTA, birinchi xaritadan oldin ishga tushiriladi.
 * Kalitsiz build'da `config.mapsEnabled` false — xarita umuman chizilmaydi.
 */
export function initMaps() {
  if (ready || !config.mapsEnabled) return;
  ready = true;
  YamapInstance.init(config.yandexMapKitKey);
}

/** Region kengligi (gradus) → MapKit zoom. 360° — butun dunyo (zoom 0), har zoom ikki baravar yaqin. */
export function zoomOf(r: Pick<Region, 'latitudeDelta' | 'longitudeDelta'>) {
  const span = Math.max(r.latitudeDelta, r.longitudeDelta, 0.0005);
  return Math.min(19, Math.max(2, Math.log2(360 / span)));
}

const toPoint = (p: LatLng) => ({ lat: p.latitude, lon: p.longitude });

export interface MapHandle {
  /** Kamerani nuqtaga suradi, joriy yaqinlikni saqlab. */
  animateCamera: (center: LatLng, durationMs?: number) => void;
  animateToRegion: (region: Region, durationMs?: number) => void;
  /** Hamma nuqta ekranga sig'adi. */
  fitToCoordinates: (coords: LatLng[]) => void;
  /** +1 — ikki baravar yaqin, -1 — uzoq (zoom tugmalari). */
  zoomBy: (delta: number) => void;
}

type MapProps = {
  style?: StyleProp<ViewStyle>;
  initialRegion: Region;
  /** false — faqat ko'rish uchun: surish, yaqinlashtirish va bosish o'chadi. */
  interactive?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  /** Tizimning joylashuv belgisi (ko'k nuqta). */
  showsUserLocation?: boolean;
  /** Tirbandlik qatlami — yo'llar yashil / sariq / qizil (Yandex Navigator'dagidek). */
  traffic?: boolean;
  /** Xarita foydalanuvchi qo'li bilan surildi — "mashina ortidan yurish" shu bilan o'chadi. */
  onPanDrag?: () => void;
  /**
   * Kamera to'xtadi — markaz nuqtasi. `byUser` — qo'l bilan surilgan (dastur emas).
   * Manzil tanlashdagi "markaziy pin" shu bilan ishlaydi.
   */
  onRegionChangeComplete?: (center: LatLng, byUser: boolean) => void;
  /**
   * Kamera to'xtadi — markaz va zoom (MapKit: zoom z da dunyo kengligi 256·2^z pt). Ko'rinadigan
   * kenglik shundan hisoblanadi: `360 / 2^z * (xarita kengligi pt / 256)` gradus. Faqat surish/
   * yaqinlashtirish TUGAGANDA keladi (har kadrda emas) — belgilarni guruhlash shunga tayanadi.
   */
  onCameraIdle?: (cam: { center: LatLng; zoom: number; byUser: boolean }) => void;
  onPress?: () => void;
  /** O'ngda kichik "+ / −" tugmalari — bir qo'lda (rul ortida) ham yaqinlashtirish mumkin. */
  zoomControls?: boolean;
  /**
   * Xarita ScrollView ichida bo'lsa: barmoq xaritaga tekkanda `true`, qo'yib yuborilganda `false`.
   * `useMapScrollLock` bilan ota ScrollView'ni to'xtatadi (iOS). Android'da MapKit o'zi ota
   * scroll'ga "ushlama" deydi (`requestDisallowInterceptTouchEvent`) — u yerda chaqirilmaydi.
   */
  onTouchLock?: (locked: boolean) => void;
  children?: React.ReactNode;
};

/**
 * ScrollView ichidagi xarita: surish va ikki barmoq bilan yaqinlashtirish sahifani aylantirib
 * yubormasin. `<ScrollView scrollEnabled={lock.scrollEnabled}>` + `<MapView onTouchLock={lock.onTouchLock}>`.
 */
export function useMapScrollLock() {
  const [locked, setLocked] = useState(false);
  const onTouchLock = useCallback((v: boolean) => setLocked((p) => (p === v ? p : v)), []);
  return { scrollEnabled: !locked, onTouchLock };
}

export const MapView = forwardRef<MapHandle, MapProps>(function MapView(
  { style, initialRegion, interactive = true, scrollEnabled = true, zoomEnabled = true, rotateEnabled = true, pitchEnabled = true, showsUserLocation, traffic = false, onPanDrag, onRegionChangeComplete, onCameraIdle, onPress, zoomControls, onTouchLock, children },
  ref,
) {
  const map = useRef<YamapRef | null>(null);
  // Tungi xarita ilova mavzusiga ergashadi — qorong'i ekranda oppoq xarita ko'zni qamashtiradi
  const { dark } = useTheme();
  initMaps();

  const zoomBy = (delta: number) => {
    const m = map.current;
    if (!m) return;
    m.getCameraPosition((pos) => m.setZoom(Math.min(19, Math.max(2, pos.zoom + delta)), 0.25));
  };

  useImperativeHandle(ref, () => ({
    animateCamera: (center, durationMs = 600) => {
      const m = map.current;
      if (!m) return;
      m.getCameraPosition((pos) => m.setCenter(toPoint(center), pos.zoom, 0, 0, durationMs / 1000));
    },
    animateToRegion: (region, durationMs = 500) => {
      map.current?.setCenter(toPoint(region), zoomOf(region), 0, 0, durationMs / 1000);
    },
    fitToCoordinates: (coords) => {
      if (coords.length) map.current?.fitMarkers(coords.map(toPoint), 0.6);
    },
    zoomBy,
  }), []);

  // Faqat iOS: Android'da YamapView ota scroll'ni o'zi to'xtatadi. Ikki barmoqdan biri ko'tarilsa
  // ham qulf turadi — oxirgi barmoq ketganda ochiladi
  const lock = onTouchLock && Platform.OS === 'ios' ? {
    onTouchStart: () => onTouchLock(true),
    onTouchEnd: (e: GestureResponderEvent) => { if (!e.nativeEvent.touches?.length) onTouchLock(false); },
    onTouchCancel: () => onTouchLock(false),
  } : null;

  // Qatlam prop emas, buyruq. Xarita yuklangach ham qayta beriladi — yuklanmasdan oldingi buyruq
  // ba'zi qurilmalarda e'tiborsiz qoladi
  useEffect(() => { if (traffic) map.current?.setTrafficVisible(true); }, [traffic]);

  const mapEl = (
    <Yamap
      ref={map}
      style={zoomControls ? { flex: 1 } : style}
      {...lock}
      initialRegion={{ ...toPoint(initialRegion), zoom: zoomOf(initialRegion) }}
      interactiveDisabled={!interactive}
      scrollGesturesDisabled={!scrollEnabled}
      zoomGesturesDisabled={!zoomEnabled}
      rotateGesturesDisabled={!rotateEnabled}
      tiltGesturesDisabled={!pitchEnabled}
      showUserPosition={!!showsUserLocation}
      nightMode={dark}
      // Kamera dastur tomonidan ham suriladi (mashina ortidan yurish) — faqat qo'l harakati hisoblanadi
      onCameraPositionChange={onPanDrag ? (e) => { if (e.nativeEvent.reason === 'GESTURES') onPanDrag(); } : undefined}
      onCameraPositionChangeEnd={onRegionChangeComplete || onCameraIdle ? (e) => {
        const p = e.nativeEvent;
        const center = { latitude: p.point.lat, longitude: p.point.lon };
        onRegionChangeComplete?.(center, p.reason === 'GESTURES');
        onCameraIdle?.({ center, zoom: p.zoom, byUser: p.reason === 'GESTURES' });
      } : undefined}
      onMapPress={onPress ? () => onPress() : undefined}
      onMapLoaded={traffic ? () => map.current?.setTrafficVisible(true) : undefined}
    >
      {children}
    </Yamap>
  );
  if (!zoomControls) return mapEl;
  return (
    <View style={style}>
      {mapEl}
      <View style={{ position: 'absolute', right: space.sm, top: space.sm, gap: space.xs }}>
        <IconButton icon="plus" label="Yaqinlashtirish" variant="secondary" size={size.iconTile} onPress={() => zoomBy(1)} />
        <IconButton icon="minus" label="Uzoqlashtirish" variant="secondary" size={size.iconTile} onPress={() => zoomBy(-1)} />
      </View>
    </View>
  );
});

type MarkerProps = {
  coordinate: LatLng;
  /** Rangli pin. `children` berilsa e'tiborga olinmaydi. */
  tone?: PinTone;
  /** Belgi nuqtaning qayeriga "osiladi": pin — pastki uchi, doira — o'rtasi. */
  anchor?: { x: number; y: number };
  onPress?: () => void;
  zIndex?: number;
  /**
   * O'z ko'rinishidagi belgi (masalan, davlat raqami yozilgan plitka). MapKit uni rasmga
   * aylantirib oladi va o'zgarishni o'zi sezmaydi — ko'rinish o'zgarsa `key` ni almashtiring.
   */
  children?: React.ReactNode;
};

export function Marker({ coordinate, tone = 'brand', anchor, onPress, zIndex, children }: MarkerProps) {
  return (
    <YMarker
      point={toPoint(coordinate)}
      source={children ? undefined : PINS[tone]}
      anchor={anchor ?? (children ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 })}
      onPress={onPress}
      zIndex={zIndex}
    >
      {children as React.ReactElement | undefined}
    </YMarker>
  );
}

/**
 * Haydovchi / mashina belgisi — ixcham dumaloq nishon: ichida oq yuk mashinasi, holat rangi
 * (yo'lda — ko'k, yuklangan — sariq, kutmoqda — moviy, muammo — qizil, GPS eskirgan — kulrang)
 * va yumshoq halo. Ilgari xaritada uzun "plitka" (davlat raqami yozilgan cho'zinchoq pill)
 * edi — mashinalar ko'p bo'lsa bir-birini yopar, nuqtaning aniq joyi ham bilinmasdi.
 *
 * `heading` berilsa (yurayotganda) — tepadan ko'rinishdagi mashina va uchli ko'rsatkich,
 * MapKit'ning o'zida yo'nalishga buriladi. `label` (davlat raqami / ism) faqat `selected`
 * bo'lganda nishon ostida kichik yorliq bo'lib chiqadi.
 */
/** Belgi sirpanishining eng uzoq davomiyligi — keyingi nuqta odatda 3–15 s da keladi. */
const GLIDE_MAX_MS = 1200;
/** Bundan qisqa animatsiya ko'rinmaydi — darhol ko'chiriladi. */
const GLIDE_MIN_MS = 120;
/** Bundan uzoq sakrash (GPS uzilib qolgan, boshqa shahar) sirpanmaydi — darhol ko'chadi. */
const GLIDE_MAX_M = 3000;
/**
 * Native animatsiya davomiyligi millisekundda. iOS'da kutubxona kadrlar sonini `ms / 25` deb oladi,
 * lekin har kadr 1/25 s (40 ms) — haqiqiy vaqt 1.6 baravar uzun bo'lib qoladi; shuni to'g'rilaymiz.
 * 25 ms dan kam qiymat iOS'da 0 kadr (nolga bo'lish) — shuning uchun pastki chegara.
 */
const nativeMs = (ms: number) => Math.max(50, Platform.OS === 'ios' ? ms * 0.625 : ms);

const metersApprox = (a: LatLng, b: LatLng) => {
  const k = Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(b.latitude - a.latitude, (b.longitude - a.longitude) * k) * 111_195;
};

/**
 * Belgini yangi nuqtaga SIRPANTIRIB ko'chirish (MapKit'ning `animatedMoveTo`, native).
 *
 * Nozik joy: `point` prop o'zgarsa kutubxona belgini darhol o'sha joyga qo'yadi (sakraydi), har
 * qanday boshqa prop (tanlash, zIndex) o'zgarsa ham geometriyani prop'dagi nuqtaga qaytaradi.
 * Shuning uchun prop'dagi nuqta animatsiya TUGAGACH yangilanadi: avval native sirpanish, keyin
 * prop o'sha nuqtaga tenglashadi (ko'rinmas). Animatsiya oralig'ida boshqa prop o'zgarsa belgi
 * eski nuqtaga bir lahza qaytishi mumkin — taymer baribir oxirgi nuqtaga to'g'rilaydi.
 *
 * Davomiylik — oldingi yangilanishgacha o'tgan vaqtning ~70 % i (1.2 s dan oshmaydi): tez-tez
 * keladigan nuqtalarda (haydovchining o'z GPS'i) animatsiyalar bir-birini quvlamaydi.
 * `resetKey` o'zgarsa (belgi qayta yaratildi) — darhol ko'chiriladi, buyruq yangi belgiga ulgurmasligi mumkin.
 */
function useGlide(ref: React.RefObject<MarkerRef | null>, coordinate: LatLng, resetKey: string): LatLng {
  const [shown, setShown] = useState(coordinate);
  const shownRef = useRef(coordinate);
  const lastAt = useRef(Date.now());
  const lastKey = useRef(resetKey);
  const { latitude, longitude } = coordinate;
  useEffect(() => {
    const target = { latitude, longitude };
    const now = Date.now();
    const gap = now - lastAt.current;
    lastAt.current = now;
    const set = (p: LatLng) => { shownRef.current = p; setShown(p); };
    const keyChanged = lastKey.current !== resetKey;
    lastKey.current = resetKey;
    const from = shownRef.current;
    if (from.latitude === latitude && from.longitude === longitude) return;
    const ms = Math.min(GLIDE_MAX_MS, gap * 0.7);
    if (keyChanged || ms < GLIDE_MIN_MS || metersApprox(from, target) > GLIDE_MAX_M || !ref.current) { set(target); return; }
    try { ref.current.animatedMoveTo(toPoint(target), nativeMs(ms)); } catch { set(target); return; }
    const t = setTimeout(() => set(target), ms + 80);
    return () => clearTimeout(t);
  }, [latitude, longitude, resetKey, ref]);
  return shown;
}

export function DriverMarker({ coordinate, heading = null, status = 'moving', selected, label, onPress, zIndex }: {
  coordinate: LatLng;
  /** Gradus, shimoldan soat yo'nalishida; null — turibdi (aylanmaydi). */
  heading?: number | null;
  status?: DriverStatus;
  selected?: boolean;
  /** Tanlanganda nishon ostidagi yorliq: "01 A 123 BC". */
  label?: string;
  onPress?: () => void;
  zIndex?: number;
}) {
  const ref = useRef<MarkerRef | null>(null);
  const dir = heading != null;
  const variant = `${status}:${dir ? 'dir' : 'still'}`;
  const shown = useGlide(ref, coordinate, variant);
  /**
   * Burilish eng qisqa yo'l bilan (350° → 10° — 20° o'ngga, 340° chapga emas). Native tomoni
   * `burchak − joriy` farqini aylantiradi, shuning uchun burchak "yoyilgan" holda beriladi.
   * Belgi qayta yaratilganda (variant) joriy burchak 0 dan boshlanadi.
   */
  const angle = useRef<{ variant: string; deg: number }>({ variant, deg: 0 });
  useEffect(() => {
    if (heading == null) return;
    if (angle.current.variant !== variant) angle.current = { variant, deg: 0 };
    const cur = angle.current.deg;
    const next = cur + ((((heading - cur) % 360) + 540) % 360) - 180;
    angle.current.deg = next;
    try { ref.current?.animatedRotateTo(next, nativeMs(300)); } catch { /* belgi hali xaritaga qo'shilmagan */ }
  }, [heading, variant]);
  const z = zIndex ?? (selected ? 12 : 10);
  return (
    <>
      <YMarker
        // Rasm almashganda belgi qayta yaratiladi, burchak effektda darhol qayta qo'yiladi
        key={variant}
        ref={ref}
        point={toPoint(shown)}
        source={dir ? DRIVER[status].dir : DRIVER[status].still}
        anchor={{ x: 0.5, y: 0.5 }}
        // Yo'nalish faqat ROTATE turida qo'llanadi (standart — aylanmaydi)
        rotated={dir}
        scale={selected ? 1.2 : 1}
        onPress={onPress}
        zIndex={z}
      />
      {selected && label ? <DriverLabel key={`l:${label}`} coordinate={coordinate} label={label} zIndex={z - 1} /> : null}
    </>
  );
}

/**
 * Nishon ostidagi yorliq. MapKit uni rasmga aylantiradi: o'lcham ANIQ bo'lmasa xarita kengligigacha
 * cho'zilib ketadi (eski "uzun palasa" xatosi), shuning uchun kenglik/balandlik hisoblab qo'yiladi.
 * Rasm markazi nuqtada turadi — yuqori yarmi bo'sh, yorliq pastki yarmida, nishondan pastroqda.
 */
function DriverLabel({ coordinate, label, zIndex }: { coordinate: LatLng; label: string; zIndex: number }) {
  const { c } = useTheme();
  const h = size.iconMd + space.xs;
  const w = Math.ceil(textRoom(label, type.overline.fontSize, 0.9)) + space.md * 2;
  const half = DRIVER_PT * 0.6 + h;
  // Yorliq nishon bilan birga sirpanadi
  const ref = useRef<MarkerRef | null>(null);
  const shown = useGlide(ref, coordinate, label);
  return (
    <YMarker ref={ref} point={toPoint(shown)} anchor={{ x: 0.5, y: 0.5 }} zIndex={zIndex}>
      <View collapsable={false} style={{ width: w, height: half * 2, justifyContent: 'flex-end' }}>
        <View style={{ height: h, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: c.bgSurface, borderWidth: size.hairline, borderColor: c.borderDefault }}>
          <Txt v="overline" allowFontScaling={false} numberOfLines={1} style={{ color: c.textStrong }}>{label}</Txt>
        </View>
      </View>
    </YMarker>
  );
}

/**
 * Bir nechta mashinaning guruh nishoni (park xaritasi, JS klaster — `features/erp/cluster.ts`):
 * holat rangidagi doira, ichida soni. MapKit uni rasmga aylantiradi va o'zgarishni sezmaydi —
 * shuning uchun son yoki rang o'zgarsa `key` almashadi (belgi qayta yaratiladi), joy o'zgarsa — yo'q.
 */
export function ClusterMarker({ coordinate, count, status, onPress, zIndex = 9 }: {
  coordinate: LatLng;
  count: number;
  status: DriverStatus;
  onPress?: () => void;
  zIndex?: number;
}) {
  const { c } = useTheme();
  const text = count > 99 ? '99+' : String(count);
  // 2 xonali son kengroq doirada; o'lcham aniq — aks holda rasm xarita kengligiga cho'ziladi
  const d = text.length > 1 ? size.iconTile + space.sm : size.iconTile;
  return (
    <YMarker key={`${status}:${text}`} point={toPoint(coordinate)} anchor={{ x: 0.5, y: 0.5 }} onPress={onPress} zIndex={zIndex}>
      <View collapsable={false} style={{ width: d, height: d, borderRadius: radius.pill, backgroundColor: mapDriver[status], borderWidth: size.ring, borderColor: c.bgSurface, alignItems: 'center', justifyContent: 'center' }}>
        <Txt v="bodyStrong" allowFontScaling={false} numberOfLines={1} style={{ color: c.textOnSolid }}>{text}</Txt>
      </View>
    </YMarker>
  );
}

/** Haydovchining o'zi (eski nom) — `DriverMarker` ning "yo'lda" holati. */
export function MeMarker({ coordinate, heading }: { coordinate: LatLng; heading: number | null }) {
  return <DriverMarker coordinate={coordinate} heading={heading} status="moving" />;
}

export function Polyline({ coordinates, strokeColor, strokeWidth = 4, lineDashPattern }: {
  coordinates: LatLng[];
  strokeColor: string;
  strokeWidth?: number;
  /** [chiziq, bo'shliq] — punktir */
  lineDashPattern?: [number, number];
}) {
  // Chiziq atrofida ingichka fon rangli hoshiya — ko'chalar ustida ham aniq ko'rinadi
  const { c } = useTheme();
  if (coordinates.length < 2) return null;
  return (
    <YPolyline
      points={coordinates.map(toPoint)}
      strokeColor={strokeColor}
      strokeWidth={strokeWidth}
      dashLength={lineDashPattern?.[0]}
      gapLength={lineDashPattern?.[1]}
      outlineColor={c.bgSurface}
      outlineWidth={1}
    />
  );
}

export function Circle({ center, radius, strokeColor, fillColor }: { center: LatLng; radius: number; strokeColor: string; fillColor: string }) {
  return <YCircle center={toPoint(center)} radius={radius} strokeColor={strokeColor} fillColor={fillColor} strokeWidth={1.5} />;
}

/**
 * Xarita chizilmaydigan holat — HALOL va amaliy izoh.
 *
 * Yagona sabab: build'ga Yandex MapKit kaliti berilmagan (`EXPO_PUBLIC_YANDEX_MAPKIT_KEY`,
 * `core/config.ts` → `mapsEnabled`). Platforma cheklovi yo'q — kalit bo'lsa Android va iOS'da
 * ishlaydi. Ilgari "Xarita bu qurilmada ko'rsatilmaydi" deyilardi: haydovchi telefonida
 * nuqson bor deb o'ylardi. Endi nima ishlashi va nima qilish kerakligi aytiladi.
 */
export const MAP_OFF_TITLE = "Ilova ichidagi xarita hali yoqilmagan";
export const MAP_OFF_HINT = "Bu versiyaga Yandex xarita kaliti ulanmagan — telefoningizda nuqson yo'q. Masofa va yo'nalish ishlayveradi, yo'lni «Navigatorda ochish» orqali ko'ring. Xaritani yoqish uchun administratorga ayting.";

export function MapUnavailable({ title = MAP_OFF_TITLE, hint = MAP_OFF_HINT, compact, style, children }: {
  title?: string;
  hint?: string;
  /** Kartochka ichidagi kichik variant (manzil tanlash, yuk sahifasi). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Pastda — amal tugmasi (Navigatorda ochish, Joylashuvim). */
  children?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View
      accessible accessibilityRole="summary" accessibilityLabel={`${title}. ${hint}`}
      style={[
        { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: compact ? space.lg : space.xxl, backgroundColor: c.bgMuted, borderRadius: compact ? radius.card : 0 },
        style,
      ]}
    >
      <Icon name="map" size={compact ? size.iconLg : size.iconXl} tone="muted" />
      <Txt v={compact ? 'bodyStrong' : 'titleSm'} align="center">{title}</Txt>
      <Txt v="caption" color="muted" align="center">{hint}</Txt>
      {children}
    </View>
  );
}
