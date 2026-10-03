import React, { useEffect, useId, useRef, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
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
/** Demo `--ease` cubic-bezier(.2,.8,.2,1) — kirish, chizish, to'lish. */
export const EASE_ENTER = Easing.bezier(0.2, 0.8, 0.2, 1);
/** Tab indikatori — demo cubic-bezier(.34,1.45,.64,1) .5s: sezilarli sakrash. */
export const SPRING_TAB = { damping: 14, stiffness: 190, mass: 0.9 } as const;
/** Ustun o'sishi — demo `grow .8s var(--spring)` (cubic-bezier(.34,1.56,.64,1)): ~10% oshib qaytadi. */
export const SPRING_GROW = { damping: 11, stiffness: 120, mass: 0.9 } as const;

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
  children, delay = 0, from = 14, dx = 0, duration: dur = DUR.enter, scale = 0.98, style, replay,
}: { children: React.ReactNode; delay?: number; from?: number; /** Gorizontal siljish (tab almashganda ±24). */ dx?: number; duration?: number; /** Boshlang'ich masshtab (1 — o'zgarmaydi). */ scale?: number; style?: StyleProp<ViewStyle>; /** O'zgarsa animatsiya qaytadan o'ynaydi (masalan davr tanlanganda). */ replay?: unknown }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { p.value = 1; return; }
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: dur, easing: EASE_ENTER }));
  }, [delay, dur, p, reduce, replay]);
  const s = useAnimatedStyle(() => ({
    opacity: p.value < 0.002 ? 0.001 : p.value,
    transform: [{ translateX: (1 - p.value) * dx }, { translateY: (1 - p.value) * from }, { scale: scale + (1 - scale) * p.value }],
  }));
  return <Animated.View style={[s, style]}>{children}</Animated.View>;
}

/**
 * Demo `.screen.enter .scroll > *`: har bola ketma-ket kiradi (opacity + translateY 14 + scale .98, 60 ms qadam).
 * Bolalar orasidagi bo'shliq — `gap` (standart `space.stack` = 14). `replay` o'zgarsa qayta o'ynaydi.
 */
export function Stagger({ children, gap = 14, step = STAGGER, dx = 0, replay, style }: { children: React.ReactNode; gap?: number; step?: number; dx?: number; replay?: unknown; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ gap }, style]}>
      {items.map((ch, i) => (
        <Appear key={(ch as { key?: React.Key }).key ?? i} delay={stagger(i, step, 12)} dx={dx} replay={replay}>{ch}</Appear>
      ))}
    </View>
  );
}

/** Element paydo bo'lganda "pop" (demo `pop`: .6 → 1.12 → 1, prujina). `trigger` o'zgarsa qayta. */
export function usePop(trigger: unknown, delay = 0) {
  const reduce = useReducedMotion();
  const v = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (reduce) { v.value = 1; return; }
    if (first.current && delay === 0) { first.current = false; return; }
    first.current = false;
    v.value = 0.6;
    v.value = withDelay(delay, withSequence(withTiming(1.12, { duration: 270, easing: EASE_ENTER }), withTiming(1, { duration: 180, easing: EASE_STATE })));
  }, [trigger, reduce, v, delay]);
  return useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
}

/**
 * Sarlavha scroll paytida ko'tariladi (demo `.appbar.raised`): `const raise = useHeaderRaise();`
 * → `<ScrollView onScroll={raise.onScroll} scrollEventThrottle={16}>` + `<PageHeader raised={raise.raised} />`.
 * Har qanday ScrollView / FlatList bilan ishlaydi.
 */
export function useHeaderRaise(threshold = 4) {
  const [raised, setRaised] = useState(false);
  const ref = useRef(false);
  const onScroll = React.useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const r = e.nativeEvent.contentOffset.y > threshold;
    if (r !== ref.current) { ref.current = r; setRaised(r); }
  }, [threshold]);
  return { raised, onScroll, scrollEventThrottle: 16 as const };
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
  /** Davomiylik, ms (standart 1000, ease-out quart — demo `countUp`). */
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
  const { duration: dur = DUR.count, delay = 0, format } = opts;
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
      const v = k >= 1 ? target : a + (target - a) * (1 - (1 - k) ** 4);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    const t0 = setTimeout(() => { raf = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); };
  }, [target, dur, delay, reduce]);
  return format ? format(shown) : String(Math.round(shown));
}

/**
 * Matndagi raqamni sanab chiqaradi (demo `countUp`): "312 mln" → 0…312 mln, "74,2" — kasr vergul bilan,
 * "1 248" — minglar bo'shliq bilan. Raqam bo'lmasa matn o'zgarmaydi.
 */
export function useCountUpText(text: string, opts: Omit<CountUpOpts, 'format'> = {}): string {
  const m = /^(\s*[^\d\s−-]*?[−-]?)(\d[\d\s\u00a0]*\d|\d)([.,]\d+)?(.*)$/s.exec(text ?? '');
  const raw = m ? `${m[2]}${m[3] ?? ''}` : '';
  const dec = m?.[3] ? m[3].length - 1 : 0;
  const sepChar = m?.[3]?.[0] ?? ',';
  const grouped = !!m && /\d[\s\u00a0]\d/.test(m[2]!);
  const target = m ? Number(raw.replace(/[\s\u00a0]/g, '').replace(',', '.')) : 0;
  const shown = useCountUp(Number.isFinite(target) ? target : 0, {
    ...opts,
    format: (v) => {
      const [a, b] = v.toFixed(dec).split('.');
      const ia = grouped ? a!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : a!;
      return `${ia}${b ? sepChar + b : ''}`;
    },
  });
  if (!m || !Number.isFinite(target) || target === 0) return text;
  return `${m[1]}${shown}${m[4]}`;
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
