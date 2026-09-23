import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Txt } from '@/design/primitives';
import { DUR, EASE, SPRING } from '@/design/motion';
import { useSession } from '@/core/session';

/**
 * Ilova ochilgandagi ekran.
 *
 * Sessiya diskdan o'qilguncha baribir kutish bor — shu kutishni bo'sh oq ekran emas,
 * brend belgisi bilan to'ldiramiz. Eng kamida `MIN_MS` turadi (hisob tez tiklansa ham
 * ko'z ilg'amay o'tib ketmasligi uchun), keyin yuqoriga ko'tarilib erib ketadi.
 */
const MIN_MS = 1250;
const BRAND = '#0E7A46';

export function LaunchOverlay() {
  const status = useSession((s) => s.status);
  const [gone, setGone] = useState(false);
  const [minPassed, setMinPassed] = useState(false);

  const mark = useSharedValue(0);      // belgi: kichikdan kattaga
  const word = useSharedValue(0);      // nom: pastdan
  const tag = useSharedValue(0);       // izoh
  const bar = useSharedValue(0);       // yuklanish chizig'i
  const cover = useSharedValue(1);     // butun qatlam

  useEffect(() => {
    mark.value = withSpring(1, { damping: 12, stiffness: 140, mass: 0.9 });
    word.value = withDelay(180, withTiming(1, { duration: DUR.base, easing: EASE }));
    tag.value = withDelay(320, withTiming(1, { duration: DUR.base, easing: EASE }));
    bar.value = withDelay(220, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }));
    const t = setTimeout(() => setMinPassed(true), MIN_MS);
    return () => clearTimeout(t);
  }, [mark, word, tag, bar]);

  // Sessiya tayyor va eng kam vaqt o'tgan — qatlam ko'tarilib yo'qoladi
  useEffect(() => {
    if (status === 'loading' || !minPassed || gone) return;
    mark.value = withSequence(withTiming(1.08, { duration: 140, easing: EASE }), withTiming(0.92, { duration: 260, easing: EASE }));
    cover.value = withTiming(0, { duration: 380, easing: EASE }, (done) => { if (done) runOnJS(setGone)(true); });
  }, [status, minPassed, gone, cover, mark]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value, transform: [{ translateY: (1 - cover.value) * -28 }] }));
  const markStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, mark.value), transform: [{ scale: 0.6 + mark.value * 0.4 }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 16 }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value * 0.85, transform: [{ translateY: (1 - tag.value) * 12 }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${8 + bar.value * 92}%` }));

  if (gone) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }, coverStyle]} pointerEvents="none">
      {/* Fondagi yumshoq doiralar — yassi rangni jonlantiradi */}
      <View style={{ position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: 'rgba(255,255,255,0.05)', top: -90, right: -140 }} />
      <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.04)', bottom: 40, left: -90 }} />

      <Animated.View style={[{ width: 92, height: 92, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }, markStyle]}>
        <Txt style={{ fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1.5 }}>IE</Txt>
      </Animated.View>

      <Animated.View style={[{ marginTop: 26 }, wordStyle]}>
        <Txt style={{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.6 }}>Insof ECO</Txt>
      </Animated.View>

      <Animated.View style={[{ marginTop: 8 }, tagStyle]}>
        <Txt style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)' }}>Zavod · yo&apos;l · obyekt</Txt>
      </Animated.View>

      <View style={{ position: 'absolute', bottom: 74, width: 140, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
        <Animated.View style={[{ height: 3, borderRadius: 2, backgroundColor: '#FFA800' }, barStyle]} />
      </View>
    </Animated.View>
  );
}

export { SPRING };
