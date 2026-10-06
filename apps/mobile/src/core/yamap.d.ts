/**
 * `react-native-yamap-plus` ning biz ishlatadigan qismi uchun tiplar.
 *
 * Nega o'zimiz: paket TypeScript MANBASINI beradi (`main: src/index.ts`) va u bizning
 * `noUncheckedIndexedAccess` sozlamamizdan o'tmaydi (Suggest.ts). tsconfig `paths` shu faylga
 * yo'naltiradi — faqat tip tekshiruvi uchun; Metro baribir haqiqiy paketni oladi.
 * Paket versiyasi almashsa, shu yerdagi props'ni `src/spec/*NativeComponent.ts` bilan solishtiring.
 */
declare module 'react-native-yamap-plus' {
  import type { ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';
  import type { ImageSourcePropType, NativeSyntheticEvent, ViewProps } from 'react-native';

  export type Point = { lat: number; lon: number };
  export type CameraPosition = { point: Point; azimuth: number; finished: boolean; reason: 'APPLICATION' | 'GESTURES'; tilt: number; zoom: number };

  export interface YamapRef {
    setCenter(center: Point, zoom?: number, azimuth?: number, tilt?: number, duration?: number): void;
    fitMarkers(points: Point[], duration?: number): void;
    fitAllMarkers(duration?: number): void;
    setZoom(zoom: number, duration?: number): void;
    getCameraPosition(callback: (position: CameraPosition) => void): void;
    /** Tirbandlik qatlami (yo'llar yashil / sariq / qizil). */
    setTrafficVisible(isVisible: boolean): void;
  }

  export interface YamapProps extends ViewProps {
    initialRegion?: Point & { zoom?: number; azimuth?: number; tilt?: number };
    interactiveDisabled?: boolean;
    scrollGesturesDisabled?: boolean;
    zoomGesturesDisabled?: boolean;
    rotateGesturesDisabled?: boolean;
    tiltGesturesDisabled?: boolean;
    showUserPosition?: boolean;
    followUser?: boolean;
    nightMode?: boolean;
    onCameraPositionChange?: (e: NativeSyntheticEvent<CameraPosition>) => void;
    onCameraPositionChangeEnd?: (e: NativeSyntheticEvent<CameraPosition>) => void;
    onMapPress?: (e: NativeSyntheticEvent<Point>) => void;
    onMapLoaded?: () => void;
    children?: ReactNode;
  }
  export const Yamap: ForwardRefExoticComponent<YamapProps & RefAttributes<YamapRef>>;

  export interface MarkerRef {
    animatedMoveTo(coords: Point, duration: number): void;
    animatedRotateTo(angle: number, duration: number): void;
  }
  export interface MarkerProps {
    point: Point;
    source?: ImageSourcePropType;
    scale?: number;
    anchor?: { x: number; y: number };
    rotated?: boolean;
    visible?: boolean;
    zIndex?: number;
    onPress?: () => void;
    children?: ReactNode;
  }
  export const Marker: ForwardRefExoticComponent<MarkerProps & RefAttributes<MarkerRef>>;

  export function Polyline(props: {
    points: Point[];
    strokeColor?: string;
    strokeWidth?: number;
    outlineColor?: string;
    outlineWidth?: number;
    dashLength?: number;
    gapLength?: number;
    zIndex?: number;
  }): JSX.Element;

  export function Circle(props: {
    center: Point;
    radius: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    zIndex?: number;
  }): JSX.Element;

  /** Yo'l bo'yicha marshrut (Full MapKit). `time*` — tayyor matn ("1 ч 6 мин"), soniya emas. */
  export interface DrivingRoutes {
    routes: {
      sections: {
        points: Point[];
        routeInfo: { time: string; timeWithTraffic?: string; distance?: number };
      }[];
    }[];
  }
  export const Transport: {
    findDrivingRoutes(points: Point[]): Promise<DrivingRoutes>;
  };

  export const YamapInstance: {
    init(apiKey: string): void;
    setLocale(locale: string): Promise<void>;
  };
}
