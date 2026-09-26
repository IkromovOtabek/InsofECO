import React, { useEffect } from 'react';
import { Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { duration } from './tokens';

/**
 * Harakat tili — bitta joyda.
 * Mikro (hover/fokus/bosish) 120 ms ease-out; holat o'zgarishi 200 ms cubic-bezier(0.22,1,0.36,1);
 * ekran o'tishi 280 ms; yuklanish sikli 1.2 s ease-in-out. Faqat transform + opacity.
 * `prefers-reduced-motion` yoqilgan bo'lsa siklli animatsiyalar o'chadi, o'tishlar bir zumda.
 */
export const DUR = duration;
export const EASE_MICRO = Easing.out(Easing.quad);
export const EASE_STATE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_LOOP = Easing.inOut(Easing.quad);

/** Ro'yxatda ketma-ketlik: har element oldingisidan shuncha kech chiqadi (ms). */
export const STAGGER = 40;
export const stagger = (i: number, step = STAGGER, max = 8) => Math.min(i, max) * step;

/** Ekran o'tishi: pastdan yuqoriga suzib chiqadi. */
export function Appear({
  children, delay = 0, from = 12, style,
}: { children: React.ReactNode; delay?: number; from?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { p.value = 1; return; }
    p.value = withDelay(delay, withTiming(1, { duration: DUR.screen, easing: EASE_STATE }));
  }, [delay, p, reduce]);
  const s = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * from }] }));
  return <Animated.View style={[s, style]}>{children}</Animated.View>;
}

/** Bosilganda ozgina kichrayadigan yuza — tugmalar, kartalar, qatorlar. */
export function PressScale({
  children, style, onPress, disabled, haptic = true, scale = 0.98, ...rest
}: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle>; haptic?: boolean; scale?: number }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(1);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
  return (
    <Animated.View style={[s, style]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={() => { if (!reduce) v.value = withTiming(scale, { duration: DUR.micro, easing: EASE_MICRO }); }}
        onPressOut={() => { v.value = withTiming(1, { duration: DUR.state, easing: EASE_STATE }); }}
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

export { Animated, useReducedMotion };
