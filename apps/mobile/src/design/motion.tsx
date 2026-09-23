import React, { useEffect } from 'react';
import { Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/**
 * Harakat tili — butun ilova uchun bitta joyda.
 *
 * Qoida: harakat diqqatni tortmaydi, yo'nalish beradi. Ekran ochilganda elementlar
 * pastdan yuqoriga qarab ketma-ket chiqadi (ko'z tabiiy yuqoridan pastga o'qiydi),
 * bosilganda esa ozgina kichrayadi — barmoq ostida "bosildi" degan his qoladi.
 */
export const DUR = { fast: 160, base: 280, slow: 460 } as const;

/** Tez boshlanib, oxirida silliq to'xtaydi (iOS'ning o'z hissi). */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;

/** Ro'yxatda ketma-ketlik: har element oldingisidan shuncha kech chiqadi (ms). */
export const STAGGER = 55;
/** Juda uzun ro'yxatda kutish cho'zilib ketmasin. */
export const stagger = (i: number, step = STAGGER, max = 8) => Math.min(i, max) * step;

/** Pastdan yuqoriga suzib chiqadi. `delay` bilan ketma-ketlik yasaladi. */
export function Appear({
  children, delay = 0, from = 14, duration = DUR.base, style,
}: { children: React.ReactNode; delay?: number; from?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withDelay(delay, withTiming(1, { duration, easing: EASE })); }, [delay, duration, p]);
  const s = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * from }] }));
  return <Animated.View style={[s, style]}>{children}</Animated.View>;
}

/** Bosilganda kichrayadigan yuza — tugmalar, kartochkalar, ro'yxat qatorlari. */
export function PressScale({
  children, style, onPress, disabled, haptic = true, scale = 0.97, ...rest
}: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle>; haptic?: boolean; scale?: number }) {
  const v = useSharedValue(1);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
  return (
    <Animated.View style={[s, style]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={() => { v.value = withTiming(scale, { duration: DUR.fast, easing: EASE }); }}
        onPressOut={() => { v.value = withSpring(1, SPRING); }}
        onPress={(e) => {
          if (haptic && Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Raqam o'zgarganda kartochka bir lahza "nafas oladi" — yangilanish sezilsin. */
export function usePulse(dep: unknown) {
  const v = useSharedValue(1);
  const first = React.useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    v.value = withTiming(1.04, { duration: DUR.fast, easing: EASE }, () => { v.value = withSpring(1, SPRING); });
  }, [dep, v]);
  return useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
}

export { Animated };
