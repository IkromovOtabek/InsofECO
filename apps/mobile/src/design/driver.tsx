/**
 * Shafyor rejimi komponentlari: katta nishonlar (≥64 pt), 19–24 pt matn, yuqori kontrast, minimal matn.
 * Qo'lqopda, quyoshda, rulda — bitta qarashda tushunish, bitta bosish.
 */
import React from 'react';
import { Platform, Pressable, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './theme';
import { onColor } from './tokens';
import { Txt } from './primitives';
import { IconName } from './ui';

/** Asosiy harakat: 72 pt, 22 pt shrift, ikon. */
export function BigAction({ title, icon, onPress, tone = 'brand', loading, disabled, style }: { title: string; icon?: IconName; onPress: () => void; tone?: 'brand' | 'success' | 'danger' | 'dark'; loading?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const { c, shape } = useTheme();
  const bg = { brand: c.brandPrimary, success: c.success, danger: c.danger, dark: c.textPrimary }[tone];
  const fg = onColor(bg);
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title} disabled={disabled || loading}
      onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
      style={({ pressed }) => [{ height: 72, borderRadius: shape.button, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20, overflow: 'hidden' }, (disabled || loading) && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }] }, style]}
    >
      {icon ? <Ionicons name={icon} size={28} color={fg} /> : null}
      <Txt style={{ color: fg, fontSize: 22, fontWeight: '800', letterSpacing: 0.2 }}>{loading ? '…' : title}</Txt>
    </Pressable>
  );
}

/** Ikkilamchi katta tugma (qo'ng'iroq, navigatsiya): 64 pt, oq fon. */
export function BigSecondary({ title, icon, onPress, style }: { title: string; icon: IconName; onPress: () => void; style?: ViewStyle }) {
  const { c, shape } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => { void Haptics.selectionAsync(); onPress(); }} android_ripple={{ color: c.border }}
      style={({ pressed }) => [{ height: 64, borderRadius: shape.button, backgroundColor: c.bgSurface, borderWidth: Platform.OS === 'android' ? 1 : 0, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flex: 1 }, pressed && { opacity: 0.7 }, style]}>
      <Ionicons name={icon} size={26} color={c.brandPrimary} />
      <Txt style={{ fontSize: 18, fontWeight: '700', color: c.textPrimary }}>{title}</Txt>
    </Pressable>
  );
}

/** Marshrut: A → B, katta matn. */
export function RouteBlock({ from, to }: { from: string; to: string }) {
  const { c } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: c.info, marginRight: 12 }} />
        <View style={{ flex: 1 }}><Txt v="caption" color="secondary">OLISH</Txt><Txt style={{ fontSize: 19, fontWeight: '600', color: c.textPrimary }}>{from}</Txt></View>
      </View>
      <View style={{ width: 3, height: 22, backgroundColor: c.border, marginLeft: 5.5, marginVertical: 2 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="location" size={18} color={c.brandPrimary} style={{ marginRight: 10, marginLeft: -2 }} />
        <View style={{ flex: 1 }}><Txt v="caption" color="secondary">YETKAZISH</Txt><Txt style={{ fontSize: 19, fontWeight: '600', color: c.textPrimary }}>{to}</Txt></View>
      </View>
    </View>
  );
}

/** 4 bosqichli katta stepper: Ombor → Yuklash → Yo'l → Obyekt. */
export function StepDots({ steps, current }: { steps: string[]; current: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <View style={{ alignItems: 'center', width: 64 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: i < current ? c.success : i === current ? c.brandPrimary : c.bgSurfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
              {i < current ? <Ionicons name="checkmark" size={18} color={onColor(c.success)} /> : <Txt style={{ color: i === current ? onColor(c.brandPrimary) : c.textSecondary, fontWeight: '700' }}>{i + 1}</Txt>}
            </View>
            <Txt v="caption" style={{ marginTop: 4, fontWeight: i === current ? '700' : '400', color: i === current ? c.textPrimary : c.textSecondary }}>{s}</Txt>
          </View>
          {i < steps.length - 1 ? <View style={{ flex: 1, height: 3, backgroundColor: i < current ? c.success : c.bgSurfaceMuted, marginTop: -18 }} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

/** Katta raqamli statistika: "3 yuk · 2 bajarildi". */
export function BigStat({ value, label, tone = 'primary' }: { value: string; label: string; tone?: 'primary' | 'brand' | 'success' | 'warning' }) {
  const { c } = useTheme();
  const col = { primary: c.textPrimary, brand: c.brandPrimary, success: c.success, warning: c.warning }[tone];
  const big = value.length <= 3;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Txt style={{ fontSize: big ? 32 : 24, lineHeight: 40, fontWeight: '800', color: col, letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
      <Txt v="caption" color="secondary" style={{ marginTop: 2 }}>{label}</Txt>
    </View>
  );
}
