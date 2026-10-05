/**
 * Haydovchi rejimi: katta nishonlar (64 pt), yirik matn, bitta qarashda tushunish, bitta bosish.
 * Ranglar va shakl umumiy tizimdan — faqat o'lcham kattaroq.
 */
import React from 'react';
import { ActivityIndicator, Platform, Pressable, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { haptic, usePressScale } from './motion';
import { useTheme } from './theme';
import { Tone, elevation, radius, size, space, toneColors, type } from './tokens';
import { FIT_LINE, Txt, useTightFit } from './primitives';
import { Icon, IconName } from './icons';

/** Asosiy harakat: 64 pt pill, titleMd matn, ikonka. Bosilganda prujina + o'rtacha haptika. */
export function BigAction({ title, icon, onPress, tone = 'brand', loading, disabled, style }: { title: string; icon?: IconName; onPress: () => void; tone?: 'brand' | 'success' | 'danger' | 'dark'; loading?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const { c } = useTheme();
  const bg = { brand: c.brand, success: c.successSolid, danger: c.dangerSolid, dark: c.textStrong }[tone];
  const fg = tone === 'brand' ? c.textOnBrand : tone === 'dark' ? c.bgSurface : c.textOnSolid;
  const off = !!(disabled || loading);
  const ps = usePressScale();
  // Uzun yorliq ("Keldi — yuz bilan tasdiqlash") sig'masa ikonka yashiriladi, matn kichrayadi — tugmadan chiqmaydi
  const fit = useTightFit(title, type.buttonXl.fontSize, (icon || loading ? size.iconXl + space.md : 0) + 2 * space.xl);
  // Demo `.btn.pri` nuri — `0 10px 20px -10px brand`; balandlik — `.sticky .btn.xl` 56 css → 76 dp.
  const glow: ViewStyle | null = off ? null : elevation(c).glow(bg);
  return (
    <Animated.View style={[{ borderRadius: radius.pill }, glow, ps.style]}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: off, busy: !!loading }} disabled={off}
        onPressIn={ps.onPressIn} onPressOut={ps.onPressOut}
        onPress={() => { haptic.medium(); onPress(); }}
        onLayout={fit.onLayout}
        android_ripple={{ color: c.brandHover }}
        style={({ pressed }) => [{ height: size.stickyButtonXl, minWidth: 0, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: fit.tight ? space.lg : space.xl, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' }, off && { opacity: 0.5 }, pressed && { opacity: 0.92 }, style]}
      >
        {loading ? <ActivityIndicator color={fg} /> : icon && !fit.tight ? <Icon name={icon} size={size.iconXl} color={fg} strokeWidth={2} /> : null}
        <Txt v="buttonXl" style={{ color: fg, flexShrink: 1 }} {...FIT_LINE}>{title}</Txt>
      </Pressable>
    </Animated.View>
  );
}

/** Ikkilamchi katta tugma (qo'ng'iroq, navigatsiya): 64 pt, yuza + yumshoq soya, chegarasiz. */
export function BigSecondary({ title, icon, onPress, style }: { title: string; icon: IconName; onPress: () => void; style?: ViewStyle }) {
  const { c } = useTheme();
  const ps = usePressScale();
  // Odatda yonma-yon (Qo'ng'iroq | Navigatorda ochish): 360 dp da yarim kenglik ~150 dp — tor bo'lsa ikonka yashiriladi
  const fit = useTightFit(title, type.titleSm.fontSize, size.iconLg + space.sm + 2 * space.lg);
  return (
    <Animated.View style={[{ flex: 1, minWidth: 0 }, ps.style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPressIn={ps.onPressIn} onPressOut={ps.onPressOut} onPress={() => { haptic.light(); onPress(); }} android_ripple={{ color: c.bgMuted }}
        onLayout={fit.onLayout}
        style={({ pressed }) => [{ height: size.driverTouch, minWidth: 0, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.bgSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: fit.tight ? space.md : space.lg }, elevation(c).sh1, pressed && { backgroundColor: c.bgSubtle }, style]}>
        {fit.tight ? null : <Icon name={icon} size={size.iconLg} tone="strong" />}
        <Txt v="titleSm" style={{ flexShrink: 1 }} {...FIT_LINE}>{title}</Txt>
      </Pressable>
    </Animated.View>
  );
}

/** Marshrut: A → B, katta matn. */
export function RouteBlock({ from, to }: { from: string; to: string }) {
  const { c } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: size.iconSm, height: size.iconSm, borderRadius: radius.pill, borderWidth: 3, borderColor: c.info }} />
        <View style={{ flex: 1 }}><Txt v="overline">Olish</Txt><Txt v="titleMd">{from}</Txt></View>
      </View>
      <View style={{ width: 2, height: space.xl, backgroundColor: c.borderDefault, marginLeft: size.iconSm / 2 - 1, marginVertical: 2 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Icon name="map-pin" tone="brand" size={size.iconSm} />
        <View style={{ flex: 1 }}><Txt v="overline">Yetkazish</Txt><Txt v="titleMd">{to}</Txt></View>
      </View>
    </View>
  );
}

/** Bosqichli stepper: Ombor → Yuklash → Yo'l → Obyekt. */
export function StepDots({ steps, current }: { steps: string[]; current: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <View style={{ alignItems: 'center', width: size.driverTouch }}>
            <View style={{ width: size.iconXl, height: size.iconXl, borderRadius: radius.pill, backgroundColor: i < current ? c.successSolid : i === current ? c.brand : c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
              {i < current ? <Icon name="check" size={size.iconSm} color={c.textOnSolid} /> : <Txt v="label" style={{ color: i === current ? c.textOnBrand : c.textMuted }}>{i + 1}</Txt>}
            </View>
            <Txt v="caption" color={i === current ? 'strong' : 'muted'} align="center" style={{ marginTop: space.xs }} {...FIT_LINE}>{s}</Txt>
          </View>
          {i < steps.length - 1 ? <View style={{ flex: 1, height: 2, backgroundColor: i < current ? c.successSolid : c.bgMuted, marginTop: -space.xl }} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

/** Katta raqamli statistika: "3 yuk · 2 bajarildi". */
export function BigStat({ value, label, tone }: { value: string; label: string; tone?: 'primary' | Tone }) {
  const { c } = useTheme();
  const col = !tone || tone === 'primary' || tone === 'neutral' ? c.textStrong : tone === 'brand' ? c.brandInk : toneColors(c, tone).ink;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Txt v={value.length <= 3 ? 'metricHero' : 'metric'} style={{ color: col }} numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
      <Txt v="caption" align="center" numberOfLines={2} style={{ marginTop: 2 }}>{label}</Txt>
    </View>
  );
}
