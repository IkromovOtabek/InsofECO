import React, { useEffect } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';
import Animated, { Easing, SharedValue, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { brand, illus as K, radius, space } from './tokens';
import { EASE_LOOP } from './motion';
import { Txt } from './primitives';
import { useTheme } from './theme';

/**
 * Yuklanish belgisi — beton mikser (avtobeton): baraban aylanadi, g'ildiraklar aylanadi,
 * yo'l orqaga oqadi. Zavod → yo'l → obyekt — ilovaning o'zi shu haqida.
 *
 * `MixerTruck` — faqat mashina (ochilish ekranida progress chizig'i ustida yuradi);
 * `Loader` — sahifa/bo'lim yuklanayotganda: mashina + yo'l + ixtiyoriy yozuv.
 * Tugma ichidagi kichik spinner (ActivityIndicator) o'zgarmaydi — u yerga sig'maydi.
 * "Harakatni kamaytirish" yoqilgan bo'lsa mashina harakatsiz turadi.
 */

const VB_W = 120;
const VB_H = 64;
export const TRUCK_RATIO = VB_H / VB_W;

const ALine = Animated.createAnimatedComponent(Line);
const AG = Animated.createAnimatedComponent(G);

/** 0→1 cheksiz, chiziqli. */
function useLoop(duration: number, reduce: boolean) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(v);
  }, [v, duration, reduce]);
  return v;
}

/** Baraban ichidagi spiral chizig'i — faza bo'yicha chapga suriladi (aylanish illyuziyasi). */
function Stripe({ i, phase }: { i: number; phase: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    const x = 6 + i * 16 - phase.value * 16;
    return { x1: x, x2: x + 18 };
  });
  return <ALine animatedProps={props} y1={48} y2={4} stroke={K.crane.right} strokeWidth={5} strokeLinecap="round" />;
}

/** G'ildirak: shina + gupchak + aylanadigan uch parmoq. */
function Wheel({ cx, spin }: { cx: number; spin: SharedValue<number> }) {
  const cy = 50;
  const props = useAnimatedProps(() => ({ rotation: spin.value * 360, originX: cx, originY: cy }));
  return (
    <G>
      <Circle cx={cx} cy={cy} r={7} fill={K.metal.track} />
      <Circle cx={cx} cy={cy} r={3.6} fill={K.metal.top} />
      <AG animatedProps={props}>
        <Line x1={cx} y1={cy - 3.4} x2={cx} y2={cy + 3.4} stroke={K.metal.right} strokeWidth={1.1} />
        <Line x1={cx - 3} y1={cy - 1.7} x2={cx + 3} y2={cy + 1.7} stroke={K.metal.right} strokeWidth={1.1} />
      </AG>
      <Circle cx={cx} cy={cy} r={1} fill={K.metal.right} />
    </G>
  );
}

const DRUM = 'M12 30 L20 15 Q46 5 70 12 Q82 17 81 31 Q80 42 66 44 L24 44 Q14 42 12 30 Z';

export function MixerTruck({ width, style }: { width: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const drum = useLoop(900, reduce);
  const spin = useLoop(650, reduce);
  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    bob.value = withRepeat(withSequence(withTiming(1, { duration: 260, easing: EASE_LOOP }), withTiming(0, { duration: 260, easing: EASE_LOOP })), -1);
    return () => cancelAnimation(bob);
  }, [bob, reduce]);
  const k = width / VB_W;
  // Kuzov g'ildirak ustida ozgina silkinadi — yo'lda ketayotgandek
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 0.8 * k }] }));

  return (
    <View style={[{ width, height: width * TRUCK_RATIO }, style]}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }, body]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <Defs>
            <ClipPath id="mixer-drum"><Path d={DRUM} /></ClipPath>
          </Defs>
          {/* Rama */}
          <Rect x={8} y={43} width={98} height={5} rx={1.5} fill={K.metal.right} />
          {/* Tarnov (orqada) */}
          <Path d="M13 34 L4 44 L7 45 L16 37 Z" fill={K.metal.left} />
          {/* Baraban tayanchlari */}
          <Rect x={20} y={40} width={4} height={4} fill={K.metal.left} />
          <Rect x={66} y={38} width={4} height={6} fill={K.metal.left} />
          {/* Baraban + aylanadigan spiral */}
          <Path d={DRUM} fill={K.concrete.left} />
          <G clipPath="url(#mixer-drum)">
            {[0, 1, 2, 3, 4, 5].map((i) => <Stripe key={i} i={i} phase={drum} />)}
          </G>
          <Path d="M20 15 Q46 5 70 12 Q76 14 79 19 Q50 10 18 19 Z" fill={K.concrete.slab} fillOpacity={0.7} />
          {/* Kabina */}
          <Path d="M84 44 L84 22 Q84 20 86 20 L98 20 Q100 20 101 22 L107 34 L107 44 Z" fill={brand[500]} />
          <Path d="M88 24 L97 24 L102 33 L88 33 Z" fill={K.glass} />
          <Rect x={104} y={38} width={3} height={3} rx={1} fill={K.person.helmet} />
        </Svg>
      </Animated.View>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ position: 'absolute' }}>
        <Wheel cx={24} spin={spin} />
        <Wheel cx={40} spin={spin} />
        <Wheel cx={94} spin={spin} />
      </Svg>
    </View>
  );
}

/** Yo'l — palitradagi yumshoq kulrang; uzuq chiziqlar orqaga oqadi (mashina oldinga ketayotgandek). */
function Road({ width }: { width: number }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const flow = useLoop(650, reduce);
  const props = useAnimatedProps(() => ({ strokeDashoffset: flow.value * 16 }));
  return (
    <Svg width={width} height={6} viewBox={`0 0 ${width} 6`}>
      <Line x1={2} y1={1} x2={width - 2} y2={1} stroke={c.borderStrong} strokeWidth={2} strokeLinecap="round" />
      <ALine animatedProps={props} x1={0} y1={4.5} x2={width} y2={4.5} stroke={c.borderDefault} strokeWidth={1.5} strokeDasharray="8 8" strokeLinecap="round" />
    </Svg>
  );
}


/** Sahifa yoki bo'lim yuklanayotganda. `fill` — butun ekran markazida. */
export function Loader({ label = 'Yuklanmoqda…', width = 104, fill, style }: { label?: string | null; width?: number; fill?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Yuklanmoqda'}
      style={[{ alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxl }, fill && { flex: 1, backgroundColor: c.bgApp }, style]}
    >
      <MixerTruck width={width} />
      <Road width={width * 1.5} />
      {label ? (
        <View style={{ marginTop: space.md, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: c.bgSurface }}>
          <Txt v="caption" color="muted">{label}</Txt>
        </View>
      ) : null}
    </View>
  );
}
