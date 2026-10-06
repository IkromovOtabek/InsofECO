import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
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
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { radius, size, space } from '@/design/tokens';
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
const ME_DOT: ImageSourcePropType = require('../../assets/map/me-dot.png');
const ME_ARROW: ImageSourcePropType = require('../../assets/map/me-arrow.png');

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
function zoomOf(r: Pick<Region, 'latitudeDelta' | 'longitudeDelta'>) {
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
  onPress?: () => void;
  children?: React.ReactNode;
};

export const MapView = forwardRef<MapHandle, MapProps>(function MapView(
  { style, initialRegion, interactive = true, scrollEnabled = true, zoomEnabled = true, rotateEnabled = true, pitchEnabled = true, showsUserLocation, traffic = false, onPanDrag, onRegionChangeComplete, onPress, children },
  ref,
) {
  const map = useRef<YamapRef | null>(null);
  // Tungi xarita ilova mavzusiga ergashadi — qorong'i ekranda oppoq xarita ko'zni qamashtiradi
  const { dark } = useTheme();
  initMaps();

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
  }), []);

  // Qatlam prop emas, buyruq. Xarita yuklangach ham qayta beriladi — yuklanmasdan oldingi buyruq
  // ba'zi qurilmalarda e'tiborsiz qoladi
  useEffect(() => { if (traffic) map.current?.setTrafficVisible(true); }, [traffic]);

  return (
    <Yamap
      ref={map}
      style={style}
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
      onCameraPositionChangeEnd={onRegionChangeComplete ? (e) => {
        const p = e.nativeEvent;
        onRegionChangeComplete({ latitude: p.point.lat, longitude: p.point.lon }, p.reason === 'GESTURES');
      } : undefined}
      onMapPress={onPress ? () => onPress() : undefined}
      onMapLoaded={traffic ? () => map.current?.setTrafficVisible(true) : undefined}
    >
      {children}
    </Yamap>
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
 * Haydovchining o'zi: yurayotganda — yo'nalishga qaragan o'q, turganda — nuqta.
 * O'q rasmi shimolga qaragan, burchak MapKit'ning o'zida aylantiriladi.
 */
export function MeMarker({ coordinate, heading }: { coordinate: LatLng; heading: number | null }) {
  const ref = useRef<MarkerRef | null>(null);
  useEffect(() => {
    if (heading != null) ref.current?.animatedRotateTo(heading, 0.3);
  }, [heading]);
  return (
    <YMarker
      // Nuqta va o'q — ikki xil rasm; almashganda belgi qayta yaratiladi va burchak shu zahoti qo'yiladi
      key={heading != null ? 'arrow' : 'dot'}
      ref={ref}
      point={toPoint(coordinate)}
      source={heading != null ? ME_ARROW : ME_DOT}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={10}
    />
  );
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
