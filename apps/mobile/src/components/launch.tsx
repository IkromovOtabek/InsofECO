import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { DUR, EASE_STATE } from '@/design/motion';
import { palette, radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';

/**
 * Ilova ochilgandagi ekran — brend chrome foni (qorong'i), amber belgi, yuklanish chizig'i.
 * Native splash ham shu rangda (`app.config.ts`), shuning uchun ochilishda rang sakramaydi.
 * Eng kamida `MIN_MS` turadi, keyin yuqoriga ko'tarilib erib ketadi (transform + opacity).
 */
const MIN_MS = 1100;
const C = palette.dark;

export function LaunchOverlay() {
  const status = useSession((s) => s.status);
  const reduce = useReducedMotion();
  const [gone, setGone] = useState(false);
  const [minPassed, setMinPassed] = useState(false);

  const mark = useSharedValue(reduce ? 1 : 0);
  const word = useSharedValue(reduce ? 1 : 0);
  const bar = useSharedValue(0);
  const cover = useSharedValue(1);

  useEffect(() => {
    if (!reduce) {
      mark.value = withTiming(1, { duration: DUR.screen, easing: EASE_STATE });
      word.value = withDelay(DUR.micro, withTiming(1, { duration: DUR.screen, easing: EASE_STATE }));
    }
    bar.value = withDelay(DUR.state, withTiming(1, { duration: DUR.loop, easing: Easing.inOut(Easing.quad) }));
    const t = setTimeout(() => setMinPassed(true), MIN_MS);
    return () => clearTimeout(t);
  }, [mark, word, bar, reduce]);

  useEffect(() => {
    if (status === 'loading' || !minPassed || gone) return;
    cover.value = withTiming(0, { duration: reduce ? 0 : DUR.screen, easing: EASE_STATE }, (done) => { if (done) runOnJS(setGone)(true); });
  }, [status, minPassed, gone, cover, reduce]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value, transform: [{ translateY: (1 - cover.value) * -space.xxl }] }));
  const markStyle = useAnimatedStyle(() => ({ opacity: mark.value, transform: [{ scale: 0.9 + mark.value * 0.1 }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * space.md }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${8 + bar.value * 92}%` }));

  if (gone) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.bgChrome, alignItems: 'center', justifyContent: 'center' }, coverStyle]} pointerEvents="none">
      <Animated.View style={[{ width: size.driverTouch + space.sm, height: size.driverTouch + space.sm, borderRadius: radius.xl, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }, markStyle]}>
        <Icon name="layers" size={size.iconXl + space.xs} color={C.textOnBrand} strokeWidth={2} />
      </Animated.View>
      <Animated.View style={[{ marginTop: space.xxl, alignItems: 'center' }, wordStyle]}>
        <Txt v="titleLg" style={{ color: C.textStrong }}>Insof ECO</Txt>
        <Txt v="bodySm" style={{ color: C.textMuted, marginTop: space.xs }}>Zavod · yo&apos;l · obyekt</Txt>
      </Animated.View>
      <View style={{ position: 'absolute', bottom: space.x12 + space.xxl, width: 120, height: 3, borderRadius: radius.pill, backgroundColor: C.chartTrack, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 3, borderRadius: radius.pill, backgroundColor: C.brand }, barStyle]} />
      </View>
    </Animated.View>
  );
}
