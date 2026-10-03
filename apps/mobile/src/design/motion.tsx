import React, { useEffect, useId, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from './theme';
import { duration } from './tokens';

/**
 * Harakat tili — bitta joyda.
 * Mikro (bosish) — prujina 0.96; holat o'zgarishi 220 ms cubic-bezier(0.22,1,0.36,1);
 * kirish — ketma-ket (stagger) fade + ko'tarilish; yuklanish — shimmer; raqamlar sanab chiqadi.
 * Faqat transform + opacity. "Harakatni kamaytirish" yoqilgan bo'lsa sikllar o'chadi, o'tishlar bir zumda.
 */
export const DUR = duration;
export const EASE_MICRO = Easing.out(Easing.quad);
export const EASE_STATE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_LOOP = Easing.inOut(Easing.quad);
/** Bosish prujinasi — tez, ozgina sakraydi. */
export const SPRING_PRESS = { damping: 15, stiffness: 320, mass: 0.6 } as const;
/** Suzuvchi indikator (tab, segment, chip) prujinasi — demo'dagi cubic-bezier(.34,1.3,.64,1) ga yaqin. */
export const SPRING_SLIDE = { damping: 18, stiffness: 210, mass: 0.8 } as const;

/** Ro'yxatda ketma-ketlik: har element oldingisidan shuncha kech chiqadi (ms). */
export const STAGGER = duration.stagger;
export const stagger = (i: number, step: number = STAGGER, max = 8) => Math.min(i, max) * step;

// ───────────────────────── Haptika ─────────────────────────

const canHaptic = Platform.OS === 'ios' || Platform.OS === 'android';
const safe = (fn: () => Promise<unknown>) => {
  if (!canHaptic) return;
  try { void fn().catch(() => {}); } catch { /* native modul yo'q — jim */ }
};

/**
 * Teginish sezgisi — `haptic.light()` (bosish), `haptic.success()` (amal bajarildi), `haptic.error()` (xato).
 * Native modul bo'lmasa yoki veb'da — jim o'tadi.
 */
export const haptic = {
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  selection: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

// ───────────────────────── Kirish ─────────────────────────

/** Ekran/blok kirishi: pastdan suzib, ozgina kattalashib chiqadi. `delay` — `stagger(i)`. */
export function Appear({
  children, delay = 0, from = 14, duration: dur = DUR.enter, scale = 0.98, style,
}: { children: React.ReactNode; delay?: number; from?: number; duration?: number; /** Boshlang'ich masshtab (1 — o'zgarmaydi). */ scale?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { p.value = 1; return; }
    p.value = withDelay(delay, withTiming(1, { duration: dur, easing: EASE_STATE }));
  }, [delay, dur, p, reduce]);
  const s = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * from }, { scale: scale + (1 - scale) * p.value }],
  }));
  return <Animated.View style={[s, style]}>{children}</Animated.View>;
}

// ───────────────────────── Bosish ─────────────────────────

/** Bosish masshtabi hook'i — o'z Pressable'ini chizadigan komponentlar uchun (prujina, 0.96). */
export function usePressScale(to = 0.96) {
  const reduce = useReducedMotion();
  const v = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
  return {
    style,
    onPressIn: () => { if (!reduce) v.value = withSpring(to, SPRING_PRESS); },
    onPressOut: () => { v.value = reduce ? 1 : withSpring(1, SPRING_PRESS); },
  };
}

/** Bosilganda prujina bilan kichrayadigan yuza (0.96) + yengil haptika — tugmalar, kartalar, plitkalar. */
export function PressScale({
  children, style, onPress, onPressIn, onPressOut, disabled, haptic: withHaptic = true, scale = 0.96, ...rest
}: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle>; haptic?: boolean; scale?: number }) {
  const ps = usePressScale(scale);
  return (
    <Animated.View style={[ps.style, style]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={(e) => { ps.onPressIn(); onPressIn?.(e); }}
        onPressOut={(e) => { ps.onPressOut(); onPressOut?.(e); }}
        onPress={(e) => {
          if (withHaptic) haptic.light();
          onPress?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Raqam o'zgarganda karta bir lahza "nafas oladi" — yangilanish sezilsin. */
export function usePulse(dep: unknown) {
  const reduce = useReducedMotion();
  const v = useSharedValue(1);
  const first = React.useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    v.value = withTiming(1.03, { duration: DUR.micro, easing: EASE_MICRO }, () => { v.value = withTiming(1, { duration: DUR.state, easing: EASE_STATE }); });
  }, [dep, v, reduce]);
  return useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
}

// ───────────────────────── Raqam sanash ─────────────────────────

export interface CountUpOpts {
  /** Davomiylik, ms (standart 900). */
  duration?: number;
  /** Kechikish, ms — `stagger(i)` bilan birga. */
  delay?: number;
  /** Formatlash: `fmtNum`, `fmtShort` va h.k. Standart — butun son. */
  format?: (n: number) => string;
}

/**
 * Raqamni 0 dan (keyingi o'zgarishda — oldingi qiymatdan) yangisigacha sanab chiqaradi; formatlangan satr qaytaradi.
 * Harakat kamaytirilgan bo'lsa darhol oxirgi qiymat. JS kadrlarida ishlaydi — matn uchun yetarli.
 */
export function useCountUp(value: number, opts: CountUpOpts = {}): string {
  const { duration: dur = 900, delay = 0, format } = opts;
  const reduce = useReducedMotion();
  const target = Number.isFinite(value) ? value : 0;
  const [shown, setShown] = useState(reduce ? target : 0);
  const from = useRef(reduce ? target : 0);
  useEffect(() => {
    if (reduce) { from.current = target; setShown(target); return; }
    let raf = 0;
    let start = 0;
    const a = from.current;
    const tick = (t: number) => {
      if (!start) start = t;
      const k = Math.min(1, (t - start) / dur);
      const v = k >= 1 ? target : a + (target - a) * (1 - (1 - k) ** 3);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    const t0 = setTimeout(() => { raf = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); };
  }, [target, dur, delay, reduce]);
  return format ? format(shown) : String(Math.round(shown));
}

// ───────────────────────── Shimmer ─────────────────────────

/**
 * Yuklanish yaltirashi — yuza ustidan qiya yorug' tasma o'tadi (1.1 s sikl).
 * Ota elementni to'ldiradi (`absoluteFill`) — skeleton yoki karta ichiga qo'yiladi (ota `overflow: 'hidden'` + radius).
 * `inverse` — to'q (bgInverse) karta ustida. Harakat kamaytirilgan bo'lsa — harakatsiz fon.
 */
export function Shimmer({ inverse, style }: { inverse?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const gid = `sh${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [w, setW] = useState(0);
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce || !w) return;
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(p);
  }, [p, reduce, w]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: -w + p.value * w * 2 }] }));
  const base = inverse ? c.bgInverseChip : c.bgMuted;
  const glow = inverse ? c.bgInverse : c.bgSubtle;
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  return (
    <View pointerEvents="none" onLayout={onLayout} style={[StyleSheet.absoluteFill, { backgroundColor: base, overflow: 'hidden' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {w && !reduce ? (
        <Animated.View style={[StyleSheet.absoluteFill, { width: w }, band]}>
          <Svg width={w} height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0.25" stopColor={glow} stopOpacity={0} />
                <Stop offset="0.5" stopColor={glow} stopOpacity={1} />
                <Stop offset="0.75" stopColor={glow} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={w} height="100%" fill={`url(#${gid})`} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

export { Animated, useReducedMotion };
