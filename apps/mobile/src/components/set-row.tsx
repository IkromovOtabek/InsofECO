import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { IconTile, Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/icons';
import { Animated, haptic, usePressScale } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { ModuleTone, Tone, elevation, radius, size, space } from '@/design/tokens';

/**
 * Sozlamalar guruhi va qatori — demo `.group` + `setRow(icon, module, title, right)` (docs/redesign/shots/26).
 * Guruh: yuza karta, sh1, qatorlar orasida ichki chiziq (plitkadan keyin boshlanadi).
 * Qator: 40 dp modul plitkasi, sarlavha (listTitle), o'ngda qiymat / toggle / chevron. `danger` — qizil sarlavha.
 */
export function SetGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }, elevation(c).sh1, style]}>
      {rows.map((r, i) => (
        <React.Fragment key={(r as { key?: React.Key }).key ?? i}>
          {i > 0 ? <View style={{ height: size.hairline, marginLeft: space.card + size.tile + space.md, marginRight: space.card, backgroundColor: c.borderSubtle }} /> : null}
          {r}
        </React.Fragment>
      ))}
    </View>
  );
}

export function SetRow({ icon, module: m, tone, title, subtitle, value, right, onPress, chevron, danger, leading }: {
  icon?: IconName; module?: ModuleTone; tone?: Tone;
  title: string; subtitle?: string;
  /** O'ngdagi kulrang qiymat ("Yoqilgan", "O'zbekcha"). */ value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  /** Standart: bosiladigan va o'ngi bo'sh qatorda. */ chevron?: boolean;
  danger?: boolean;
  leading?: React.ReactNode;
}) {
  const { c } = useTheme();
  const showChevron = chevron ?? (!!onPress && !right);
  // Bosilganda fon yorishadi, mazmuni prujina bilan ozgina kichrayadi (ListItem bilan bir xil)
  const ps = usePressScale(0.98);
  return (
    <Pressable
      onPress={onPress ? () => { haptic.selection(); onPress(); } : undefined}
      onPressIn={onPress ? ps.onPressIn : undefined} onPressOut={onPress ? ps.onPressOut : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [{ minHeight: size.driverTouch, justifyContent: 'center', paddingVertical: space.md, paddingHorizontal: space.card }, pressed && { backgroundColor: c.bgSubtle }]}
    >
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md }, ps.style]}>
      {leading ?? (icon ? <IconTile icon={icon} module={m} tone={tone} size={size.tile} /> : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="listTitle" color={danger ? 'danger' : 'strong'} numberOfLines={1}>{title}</Txt>
        {subtitle ? <Txt v="tSm" numberOfLines={2}>{subtitle}</Txt> : null}
      </View>
      {value ? <Txt v="tSm" numberOfLines={1}>{value}</Txt> : null}
      {right}
      {showChevron ? <Icon name="chevron-right" size={size.iconMd - 1} tone={value ? 'muted' : 'faint'} strokeWidth={1.75} /> : null}
      </Animated.View>
    </Pressable>
  );
}
