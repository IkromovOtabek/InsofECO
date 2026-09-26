/**
 * Haydovchi rejimi: katta nishonlar (64 pt), yirik matn, bitta qarashda tushunish, bitta bosish.
 * Ranglar va shakl umumiy tizimdan — faqat o'lcham kattaroq.
 */
import React from 'react';
import { Platform, Pressable, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from './theme';
import { Tone, radius, size, space, toneColors } from './tokens';
import { Txt } from './primitives';
import { Icon, IconName } from './icons';

/** Asosiy harakat: 64 pt, titleMd matn, ikonka. */
export function BigAction({ title, icon, onPress, tone = 'brand', loading, disabled, style }: { title: string; icon?: IconName; onPress: () => void; tone?: 'brand' | 'success' | 'danger' | 'dark'; loading?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const { c } = useTheme();
  const bg = { brand: c.brand, success: c.successSolid, danger: c.dangerSolid, dark: c.textStrong }[tone];
  const fg = tone === 'brand' ? c.textOnBrand : tone === 'dark' ? c.bgSurface : c.textOnSolid;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!(disabled || loading) }} disabled={disabled || loading}
      onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
      android_ripple={{ color: c.brandHover }}
      style={({ pressed }) => [{ height: size.driverTouch, borderRadius: radius.md, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xl, overflow: 'hidden' }, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.9 }, style]}
    >
      {icon ? <Icon name={icon} size={size.iconXl} color={fg} /> : null}
      <Txt v="titleMd" style={{ color: fg }} numberOfLines={1}>{loading ? '…' : title}</Txt>
    </Pressable>
  );
}

/** Ikkilamchi katta tugma (qo'ng'iroq, navigatsiya): 64 pt, chegarali. */
export function BigSecondary({ title, icon, onPress, style }: { title: string; icon: IconName; onPress: () => void; style?: ViewStyle }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => { void Haptics.selectionAsync(); onPress(); }} android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [{ height: size.driverTouch, borderRadius: radius.md, backgroundColor: c.bgSurface, borderWidth: size.hairline, borderColor: c.borderDefault, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, flex: 1 }, pressed && { backgroundColor: c.bgMuted }, style]}>
      <Icon name={icon} size={size.iconLg} tone="strong" />
      <Txt v="titleSm" numberOfLines={1}>{title}</Txt>
    </Pressable>
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
            <Txt v="caption" color={i === current ? 'strong' : 'muted'} style={{ marginTop: space.xs }}>{s}</Txt>
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
      <Txt v="caption" style={{ marginTop: 2 }}>{label}</Txt>
    </View>
  );
}
