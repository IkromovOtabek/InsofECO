// Holat belgilari — butun ilova bo'ylab yagona: muvaffaqiyat "ptichka"si (Lottie) va xato/ogohlantirish
// doirachasi. Manba: LottieFiles "success" (Biswajit Rout), Lottie Simple License — bepul, tijoriy
// foydalanish mumkin. Ptichka kerak bo'lgan har joyda (oynalar, toast, "tayyor" ekranlari) shu fayl.
import React, { useEffect } from 'react';
import { StyleProp, UIManager, View, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useTheme } from './theme';
import { Icon, IconName } from './icons';
import { radius, toneColors, type Tone } from './tokens';

const SOURCE = require('../../assets/lottie/success.json');

/**
 * Lottie native komponenti shu build ichida bormi. `lottie-react-native` native modul — u qo'shilishidan
 * OLDIN yig'ilgan ilova (eski dev client, do'kondagi versiya + OTA) uni topolmaydi va ekranda
 * "Unimplemented component" qizil qutisi chiqadi. Bunday build'da ptichka qo'lda chiziladi.
 */
const hasLottie = (() => {
  const name = 'LottieAnimationView';
  const g = globalThis as { __nativeComponentRegistry__hasComponent?: (n: string) => boolean };
  try {
    if (typeof g.__nativeComponentRegistry__hasComponent === 'function') return g.__nativeComponentRegistry__hasComponent(name);
    return UIManager.hasViewManagerConfig(name);
  } catch {
    return false;
  }
})();

const ICON: Record<Tone, IconName> = { success: 'check', danger: 'x', warning: 'triangle-alert', info: 'info', brand: 'info', neutral: 'info' };

/**
 * Chizilgan belgi: yumshoq halqalar (faqat to'ldirilgan shakllar, chiziqsiz) + to'q doira + oq ikonka.
 * Faqat bezak — ichida tugma yo'q, shuning uchun Reanimated bu yerda xavfsiz.
 */
export function StatusMark({ tone, size = 96, icon }: { tone: Tone; size?: number; icon?: IconName }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const pop = useSharedValue(reduce ? 1 : 0);
  const halo = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    pop.value = withSpring(1, { damping: 11, stiffness: 180 });
    halo.value = withDelay(90, withSpring(1, { damping: 14, stiffness: 110 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const core = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const outer = useAnimatedStyle(() => ({ opacity: halo.value * 0.45, transform: [{ scale: 0.6 + halo.value * 0.4 }] }));
  const inner = useAnimatedStyle(() => ({ opacity: halo.value, transform: [{ scale: 0.7 + halo.value * 0.3 }] }));
  const { bg, solid } = toneColors(c, tone);
  const mid = Math.round(size * 0.8);
  const dot = Math.round(size * 0.6);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: radius.pill, backgroundColor: bg }, outer]} />
      <Animated.View style={[{ position: 'absolute', width: mid, height: mid, borderRadius: radius.pill, backgroundColor: bg }, inner]} />
      <Animated.View style={[{ width: dot, height: dot, borderRadius: radius.pill, backgroundColor: solid, alignItems: 'center', justifyContent: 'center' }, core]}>
        <Icon name={icon ?? ICON[tone]} size={Math.round(dot * 0.52)} color={c.textOnSolid} strokeWidth={3} />
      </Animated.View>
    </View>
  );
}

/**
 * Muvaffaqiyat ptichkasi. `size` — kvadrat tomoni (pt). Harakat kamaytirilgan bo'lsa oxirgi kadr statik.
 * Har paydo bo'lganda animatsiya BOSHIDAN o'ynaydi: chaqiruvchi har ko'rsatishda yangi `key` beradi,
 * ya'ni native ko'rinish qaytadan yaratiladi va `autoPlay` birinchi kadrdan boshlaydi.
 * (Mount'da `ref.play()` ishonchsiz — native ko'rinish hali tayyor bo'lmay, ptichka bo'sh qolardi.)
 */
export function SuccessCheck({ size = 96, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  if (!hasLottie) return <View style={style}><StatusMark tone="success" size={size} /></View>;
  return (
    <View style={[{ width: size, height: size }, style]} accessibilityRole="image" accessibilityLabel="Bajarildi">
      <LottieView
        source={SOURCE}
        autoPlay={!reduce}
        progress={reduce ? 1 : undefined}
        loop={false}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    </View>
  );
}
