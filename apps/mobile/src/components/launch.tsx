import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { DUR, EASE_STATE } from '@/design/motion';
import { palette, radius, space } from '@/design/tokens';
import { LaunchScene } from './launch-scene';
import { MixerTruck } from '@/design/loader';
import { useSession } from '@/core/session';

/**
 * Ilova ochilgandagi ekran — oq fon, jonli qurilish sahnasi (`launch-scene.tsx`),
 * logo va yuklanish chizig'i. Native splash ham oq, markazida logo
 * (`app.config.ts`), shuning uchun ochilishda rang sakramaydi.
 * Sahna yig'ilib bo'lishi uchun eng kamida `MIN_MS` turadi (harakat kamaytirilgan bo'lsa —
 * qisqaroq), keyin yuqoriga ko'tarilib erib ketadi (transform + opacity).
 */
const MIN_MS = 2300;
const LOGO = require('../../assets/logo.png') as number;
const LOGO_RATIO = 210 / 970;
const MIN_MS_REDUCED = 900;
const ROAD_W = 180;
const TRUCK_W = 48;
const C = palette.light;

export function LaunchOverlay() {
  const status = useSession((s) => s.status);
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const sceneW = Math.min(width - space.xxl * 2, 380);
  const logoW = Math.min(sceneW * 0.72, 260);
  const [gone, setGone] = useState(false);
  const [minPassed, setMinPassed] = useState(false);

  const mark = useSharedValue(reduce ? 1 : 0);
  const word = useSharedValue(reduce ? 1 : 0);
  const bar = useSharedValue(0);
  const cover = useSharedValue(1);

  useEffect(() => {
    if (!reduce) {
      mark.value = withTiming(1, { duration: DUR.screen, easing: EASE_STATE });
      // Nom sahna yig'ilayotganda, qavatlardan keyin chiqadi
      word.value = withDelay(900, withTiming(1, { duration: DUR.screen * 2, easing: EASE_STATE }));
    }
    // Mikser yo'l bo'ylab butun ochilish davomida yuradi
    bar.value = withDelay(DUR.state, withTiming(1, { duration: MIN_MS - DUR.state, easing: Easing.inOut(Easing.quad) }));
    const t = setTimeout(() => setMinPassed(true), reduce ? MIN_MS_REDUCED : MIN_MS);
    return () => clearTimeout(t);
  }, [mark, word, bar, reduce]);

  useEffect(() => {
    if (status === 'loading' || !minPassed || gone) return;
    cover.value = withTiming(0, { duration: reduce ? 0 : DUR.screen, easing: EASE_STATE }, (done) => { if (done) runOnJS(setGone)(true); });
  }, [status, minPassed, gone, cover, reduce]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value, transform: [{ translateY: (1 - cover.value) * -space.xxl }] }));
  const markStyle = useAnimatedStyle(() => ({ opacity: mark.value }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * space.md }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${8 + bar.value * 92}%` }));
  const truckStyle = useAnimatedStyle(() => ({ transform: [{ translateX: bar.value * (ROAD_W - TRUCK_W) }] }));

  if (gone) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.bgSurface, alignItems: 'center', justifyContent: 'center' }, coverStyle]} pointerEvents="none">
      {/* Oq fonda qorong'i mavzuda ham status bar ikonkalari ko'rinsin; ekran yo'qolganda mavzuniki qaytadi */}
      <StatusBar style="dark" />
      <Animated.View style={markStyle}>
        <LaunchScene width={sceneW} />
      </Animated.View>
      <Animated.View style={[{ marginTop: space.lg, alignItems: 'center' }, wordStyle]}>
        <Image source={LOGO} style={{ width: logoW, height: logoW * LOGO_RATIO }} resizeMode="contain" accessibilityLabel="Insof JBI" accessibilityIgnoresInvertColors />
      </Animated.View>
      {/* Yuklanish: chiziq — yo'l, ustida beton mikser progress bilan oldinga yuradi */}
      <View style={{ position: 'absolute', bottom: space.x12 + space.xxl, width: ROAD_W }}>
        <Animated.View style={truckStyle}>
          <MixerTruck width={TRUCK_W} />
        </Animated.View>
        <View style={{ height: 3, borderRadius: radius.pill, backgroundColor: C.chartTrack, overflow: 'hidden' }}>
          <Animated.View style={[{ height: 3, borderRadius: radius.pill, backgroundColor: C.brand }, barStyle]} />
        </View>
      </View>
    </Animated.View>
  );
}
