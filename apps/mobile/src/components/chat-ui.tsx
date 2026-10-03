import React, { useEffect } from 'react';
import { Pressable, StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { Appear, EASE_LOOP, haptic, usePressScale } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { DEMO_SCALE, elevation, radius, size, space, type } from '@/design/tokens';

/**
 * Chat bo'laklari — demo `.daychip .bub .typing .composer .cin .send` (docs/redesign/shots/29).
 * Suhbat (chat/[id]) va ERP AI yordamchisi shu bo'laklardan quriladi.
 */

/** Demo `.cin` / `.send` — 34 css. */
const FIELD = Math.round(34 * DEMO_SCALE);

/** Kun ajratgichi — demo `.daychip`: markazda yuza pill, sh1, 9 css 700 matn. */
export function DayChip({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="header" style={[{ alignSelf: 'center', marginVertical: space.xs, paddingHorizontal: space.md + 2, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: c.bgSurface }, elevation(c).sh1]}>
      <Txt v="badge" color="muted">{label}</Txt>
    </View>
  );
}

/**
 * Pufakcha qobig'i — demo `.bub`: 78% gacha, padding 8/10/6 css, radius 16 css, yon burchagi 5 css.
 * `in` — yuza + sh1 (chapda), `out` — brend (o'ngda), `ref` — brandSoft (biriktirilgan obyekt kartasi).
 * Ostida `meta` — vaqt va belgi (o'ngga tekislangan, 70% xira).
 */
export function BubbleShell({ side, tone, children, meta, maxWidth = '78%', label, style }: {
  side: 'in' | 'out';
  tone?: 'ref' | 'danger';
  children: React.ReactNode;
  meta?: React.ReactNode;
  maxWidth?: `${number}%`;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg = tone === 'ref' ? c.brandSoft : tone === 'danger' ? c.dangerBg : side === 'out' ? c.brand : c.bgSurface;
  return (
    <View
      accessible={!!label} accessibilityLabel={label}
      style={[
        { alignSelf: side === 'out' ? 'flex-end' : 'flex-start', maxWidth, gap: 2, paddingTop: space.md, paddingHorizontal: space.md + 2, paddingBottom: space.sm, borderRadius: radius.xl, borderCurve: 'continuous', backgroundColor: bg },
        side === 'out' ? { borderBottomRightRadius: radius.xs } : { borderBottomLeftRadius: radius.xs },
        elevation(c).sh1,
        style,
      ]}
    >
      {children}
      {meta ? <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: space.xs, opacity: 0.7 }}>{meta}</View> : null}
    </View>
  );
}

/** "Yozmoqda" — demo `.typing`: yuza pill ichida uch nuqta navbat bilan yonadi. Faqat haqiqiy kutish paytida chiziladi. */
export function TypingDots({ label = 'Yozmoqda' }: { label?: string }) {
  const { c } = useTheme();
  return (
    <Appear from={6} style={{ alignSelf: 'flex-start' }}>
      <View
        accessibilityLabel={label} accessibilityLiveRegion="polite"
        style={[{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.xl, backgroundColor: c.bgSurface }, elevation(c).sh1]}
      >
        {[0, 1, 2].map((i) => <Dot key={i} i={i} />)}
      </View>
    </Appear>
  );
}

function Dot({ i }: { i: number }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 0.6 : 0);
  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(i * 200, withRepeat(withSequence(withTiming(1, { duration: 400, easing: EASE_LOOP }), withTiming(0, { duration: 400, easing: EASE_LOOP })), -1, false));
    return () => cancelAnimation(p);
  }, [i, p, reduce]);
  const s = useAnimatedStyle(() => ({ opacity: 0.3 + p.value * 0.7 }));
  const d = Math.round(5 * DEMO_SCALE);
  return <Animated.View style={[{ width: d, height: d, borderRadius: radius.pill, backgroundColor: c.textMuted }, s]} />;
}

/**
 * Yozish paneli — demo `.composer`: bgChrome fon, bgMuted pill maydon (34 css), dumaloq brend "yuborish" tugmasi nur bilan.
 * `bottom` — pastki xavfsiz hudud (klaviatura ochiq bo'lsa kichik). Ilova (foto/joylashuv) API'si yo'q — "+" tugmasi chizilmaydi.
 */
export function Composer({ value, onChangeText, onSend, canSend, placeholder = 'Xabar yozing…', bottom, inputProps, top }: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  canSend: boolean;
  placeholder?: string;
  bottom: number;
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'style'>;
  /** Maydon ustidagi qo'shimcha qator (masalan tayyor savollar). */ top?: React.ReactNode;
}) {
  const { c } = useTheme();
  const ps = usePressScale(0.9);
  return (
    <View style={{ backgroundColor: c.bgChrome }}>
      {top}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.tight, paddingHorizontal: space.md + 2, paddingTop: space.md, paddingBottom: bottom }}>
        <View style={{ flex: 1, minHeight: FIELD, justifyContent: 'center', paddingHorizontal: space.lg, borderRadius: FIELD / 2, borderCurve: 'continuous', backgroundColor: c.bgMuted }}>
          <TextInput
            {...inputProps}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={c.textFaint}
            multiline
            style={[type.search, { color: c.textStrong, maxHeight: size.touch * 3, paddingTop: space.sm + 2, paddingBottom: space.sm + 2 }]}
          />
        </View>
        <Animated.View style={ps.style}>
          <Pressable
            onPress={() => { if (!canSend) return; haptic.light(); onSend(); }}
            onPressIn={ps.onPressIn} onPressOut={ps.onPressOut}
            disabled={!canSend}
            accessibilityRole="button" accessibilityLabel="Yuborish" accessibilityState={{ disabled: !canSend }}
            style={[
              { width: FIELD, height: FIELD, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? c.brand : c.bgMuted },
              canSend ? elevation(c).glow(c.brand) : null,
            ]}
          >
            <Icon name="send" size={size.iconMd} color={canSend ? c.textOnBrand : c.textFaint} strokeWidth={2} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
