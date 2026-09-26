import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import i18n from '@/core/i18n';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from './theme';
import { Icon, IconName, IconTone } from './icons';
import { FONT, FontWeight, ModuleTone, Palette, Tone, TypeVariant, duration, moduleColors, radius, shadow, size, space, toneColors, type } from './tokens';

// ───────────────────────── Matn ─────────────────────────

export type TxtColor = 'strong' | 'body' | 'muted' | 'faint' | 'onBrand' | 'onSolid' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
const COLOR_KEY: Record<TxtColor, keyof Palette> = {
  strong: 'textStrong', body: 'textBody', muted: 'textMuted', faint: 'textFaint', onBrand: 'textOnBrand', onSolid: 'textOnSolid',
  brand: 'brandInk', success: 'success', warning: 'warning', danger: 'danger', info: 'info',
};
/** Variantning standart rangi: sarlavha/ko'rsatkich — strong, matn — body, yorliq/izoh — muted. */
const DEFAULT_COLOR: Record<TypeVariant, TxtColor> = {
  display: 'strong', titleLg: 'strong', titleMd: 'strong', titleSm: 'strong', metricHero: 'strong', metric: 'strong', bodyStrong: 'strong',
  body: 'body', bodySm: 'body', mono: 'body',
  label: 'muted', caption: 'muted', overline: 'muted', overlineXs: 'muted',
};
const WEIGHT_FAMILY: Record<string, string> = { '400': FONT[400], normal: FONT[400], '500': FONT[500], '600': FONT[600], '700': FONT[700], bold: FONT[700], '800': FONT[700], '900': FONT[700] };

/**
 * Yagona matn komponenti. Variant o'lcham va shriftni beradi; `color` — token nomi.
 * Uslubda `fontWeight` kelsa shrift oilasiga o'giriladi (Android sun'iy qalinlashtirib
 * matnni qirqmasin), `lineHeight`siz `fontSize` kelsa balandlik avtomatik.
 */
export function Txt({ v = 'body', color, mono, align, style, ...p }: TextProps & { v?: TypeVariant; color?: TxtColor; mono?: boolean; align?: TextStyle['textAlign'] }) {
  const { c } = useTheme();
  const col = c[COLOR_KEY[color ?? DEFAULT_COLOR[v]]];
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const { fontWeight, ...rest } = flat;
  const family = mono ? FONT.mono : fontWeight ? WEIGHT_FAMILY[String(fontWeight)] : undefined;
  const auto = rest.fontSize && !rest.lineHeight ? { lineHeight: Math.round(rest.fontSize * 1.4) } : null;
  return <Text {...p} style={[type[v], { color: col }, align ? { textAlign: align } : null, rest, family ? { fontFamily: family } : null, auto]} maxFontSizeMultiplier={1.4} />;
}

// ───────────────────────── Joylashuv ─────────────────────────

/** Sahifa qobig'i — bg-app, sahifa paddingi. */
export function Screen({ children, style, padded = true, ...p }: ViewProps & { padded?: boolean }) {
  const { c } = useTheme();
  return (
    <View {...p} style={[{ flex: 1, backgroundColor: c.bgApp }, padded && { paddingHorizontal: space.pageX, paddingVertical: space.pageY }, style]}>
      {children}
    </View>
  );
}

/** Karta — radius 14, padding 16, 1 px chegara, yengil soya. Ierarxiya chegara bilan. */
export function Card({ children, style, ...p }: ViewProps) {
  const { c } = useTheme();
  return (
    <View {...p} style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, padding: space.card, borderWidth: size.hairline, borderColor: c.borderDefault }, shadow.card, style]}>
      {children}
    </View>
  );
}

/** Panel — sarlavha + "Hammasi →" havolasi + ichida karta. Padding 20. */
export function Panel({ title, action, onAction, children, style, icon }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <View style={[{ marginTop: space.section }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
          {icon ? <Icon name={icon} tone="muted" /> : null}
          <Txt v="titleSm" numberOfLines={1} style={{ flexShrink: 1 }}>{title}</Txt>
        </View>
        {action ? (
          <Pressable onPress={onAction} hitSlop={space.sm} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.touch, justifyContent: 'center' }}>
            <Txt v="label" color="brand">{action}</Txt>
            <Icon name="arrow-right" tone="brand" />
          </Pressable>
        ) : null}
      </View>
      <View style={{ backgroundColor: c.bgSurface, borderRadius: radius.card, padding: space.panel, paddingVertical: space.sm, borderWidth: size.hairline, borderColor: c.borderDefault }}>
        {children}
      </View>
    </View>
  );
}

export const Row = ({ style, ...p }: ViewProps) => <View {...p} style={[{ flexDirection: 'row', alignItems: 'center' }, style]} />;
export const Gap = ({ h = space.md }: { h?: number }) => <View style={{ height: h, width: h }} />;
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: size.hairline, backgroundColor: c.borderSubtle }, style]} />;
}

// ───────────────────────── Tugma ─────────────────────────

export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type BtnSize = 'md' | 'lg' | 'xl';

export function Button({
  title, variant = 'primary', size: sizeKey = 'md', icon, iconRight, loading, disabled, style, onPress, full = true, ...p
}: PressableProps & { title: string; variant?: BtnVariant; size?: BtnSize; icon?: IconName; iconRight?: IconName; loading?: boolean; full?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const bg = { primary: c.brand, secondary: c.bgSurface, ghost: 'transparent', danger: c.dangerSolid }[variant];
  const fg = { primary: c.textOnBrand, secondary: c.textStrong, ghost: c.textBody, danger: c.textOnSolid }[variant];
  const border = variant === 'secondary' ? c.borderDefault : 'transparent';
  const height = { md: size.button, lg: size.buttonLg, xl: size.driverTouch }[sizeKey];
  const txt: TypeVariant = sizeKey === 'xl' ? 'titleMd' : 'bodyStrong';
  const iconSize = sizeKey === 'xl' ? size.iconLg : size.iconSm;
  return (
    <Pressable
      {...p}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={(e) => { if (Platform.OS === 'ios') void Haptics.selectionAsync(); onPress?.(e); }}
      android_ripple={{ color: variant === 'primary' ? c.brandHover : c.bgMuted }}
      style={({ pressed }) => [
        { height, minHeight: size.touch, borderRadius: radius.md, backgroundColor: bg, borderWidth: size.hairline, borderColor: border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.lg, overflow: 'hidden' },
        full ? null : { alignSelf: 'flex-start' },
        (disabled || loading) && { opacity: 0.5 },
        pressed && variant === 'primary' && { backgroundColor: c.brandHover },
        pressed && variant !== 'primary' && { backgroundColor: c.bgMuted },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Icon name={icon} size={iconSize} color={fg} /> : null}
          <Text style={[type[txt], { color: fg }]} maxFontSizeMultiplier={1.4} numberOfLines={1}>{title}</Text>
          {iconRight ? <Icon name={iconRight} size={iconSize} color={fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

/** Ikonkali tugma — 44×44, `label` majburiy (aria-label). */
export function IconButton({ icon, label, onPress, tone = 'body', variant = 'ghost', size: s = size.touch, badge, style, disabled, active }: { icon: IconName; label: string; onPress?: () => void; tone?: IconTone; variant?: 'ghost' | 'secondary'; size?: number; badge?: number | boolean; style?: StyleProp<ViewStyle>; disabled?: boolean; /** Yoqilgan holat (masalan kuzatuv): brend foni + chegara. */ active?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      hitSlop={space.xs}
      android_ripple={{ color: c.bgMuted, borderless: variant === 'ghost' }}
      style={({ pressed }) => [
        { width: s, height: s, borderRadius: variant === 'ghost' ? radius.pill : radius.md, alignItems: 'center', justifyContent: 'center' },
        variant === 'secondary' && { backgroundColor: c.bgSurface, borderWidth: size.hairline, borderColor: c.borderDefault },
        active && { backgroundColor: c.brandSoft, borderWidth: size.hairline, borderColor: c.brand },
        pressed && { backgroundColor: c.bgMuted },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Icon name={icon} size={size.iconMd} tone={active ? 'brand' : tone} />
      {badge ? (
        <View style={{ position: 'absolute', top: space.sm - 2, right: space.sm - 2, minWidth: typeof badge === 'number' ? 16 : size.dot, height: typeof badge === 'number' ? 16 : size.dot, borderRadius: radius.pill, backgroundColor: c.dangerSolid, borderWidth: size.ring, borderColor: c.bgChrome, alignItems: 'center', justifyContent: 'center', paddingHorizontal: typeof badge === 'number' ? 3 : 0 }}>
          {typeof badge === 'number' ? <Txt v="overlineXs" color="onSolid" style={{ letterSpacing: 0 }}>{badge > 99 ? '99+' : badge}</Txt> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

// ───────────────────────── Maydonlar ─────────────────────────

export function Label({ children, required, style }: { children: string; required?: boolean; style?: StyleProp<TextStyle> }) {
  return <Txt v="label" style={[{ marginBottom: space.xs + 2 }, style]}>{children}{required ? ' *' : ''}</Txt>;
}

/**
 * Input + Label. Balandlik 44, radius 6, fokus halqasi 2 px brand-ring (hamma joyda bir xil).
 * `mono` — raqam/kod uchun; `left` — ikonka; `right` — ko'z/tozalash tugmasi.
 */
export function Input({ label, error, hint, mono, left, right, required, style, containerStyle, onFocus, onBlur, ...p }: TextInputProps & { label?: string; error?: string; hint?: string; mono?: boolean; left?: IconName; right?: React.ReactNode; required?: boolean; containerStyle?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: space.lg }, containerStyle]}>
      {label ? <Label required={required}>{label}</Label> : null}
      <View style={{ borderRadius: radius.sm + size.ring, borderWidth: size.ring, borderColor: focus ? c.brandRing : 'transparent' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: size.input, borderRadius: radius.sm, borderWidth: size.hairline, borderColor: error ? c.danger : focus ? c.brand : c.borderDefault, backgroundColor: c.bgSurface, paddingHorizontal: space.md, gap: space.sm }}>
          {left ? <Icon name={left} tone="muted" /> : null}
          <TextInput
            {...p}
            accessibilityLabel={p.accessibilityLabel ?? label ?? p.placeholder}
            placeholderTextColor={c.textFaint}
            onFocus={(e) => { setFocus(true); onFocus?.(e); }}
            onBlur={(e) => { setFocus(false); onBlur?.(e); }}
            style={[{ flex: 1, minHeight: size.input - size.ring, paddingVertical: 0, color: c.textStrong }, mono ? type.mono : type.body, mono ? { fontSize: type.body.fontSize } : null, style]}
          />
          {right}
        </View>
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }}>
          <Icon name="circle-alert" tone="danger" size={size.iconSm - 2} />
          <Txt v="caption" color="danger" style={{ flex: 1 }}>{error}</Txt>
        </View>
      ) : hint ? <Txt v="caption" style={{ marginTop: space.xs }}>{hint}</Txt> : null}
    </View>
  );
}

export interface SelectOption<V extends string = string> { value: V; label: string; hint?: string }
/**
 * Select — ochiladigan ro'yxat (native oynasiz, Fabric'da ishonchli).
 * 3 tadan kam variant — hammasi ko'rinadi; ko'p bo'lsa yig'iladi, 8 tadan ko'p bo'lsa qidiruv.
 */
export function Select<V extends string = string>({ label, value, options, onChange, placeholder = i18n.t('ui.select'), error, hint, required, compact, containerStyle }: { label?: string; value?: V | null; options: SelectOption<V>[]; onChange: (v: V, o: SelectOption<V>) => void; placeholder?: string; error?: string; hint?: string; required?: boolean; compact?: boolean; containerStyle?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const collapsible = options.length > 3 || compact;
  const searchable = options.length > 8;
  const selected = options.find((o) => o.value === value);
  const list = q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;

  const Opt = ({ o }: { o: SelectOption<V> }) => {
    const on = o.value === value;
    return (
      <Pressable
        accessibilityRole="radio" accessibilityState={{ selected: on }}
        onPress={() => { onChange(o.value, o); setOpen(false); setQ(''); }}
        android_ripple={{ color: c.bgMuted }}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.row, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: size.hairline, borderColor: on ? c.brand : c.borderDefault, backgroundColor: on ? c.brandSoft : c.bgSurface }, pressed && { backgroundColor: c.bgMuted }]}
      >
        <Icon name={on ? 'circle-dot' : 'circle'} tone={on ? 'brand' : 'muted'} />
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong" color={on ? 'brand' : 'strong'} numberOfLines={1}>{o.label}</Txt>
          {o.hint ? <Txt v="caption" numberOfLines={1}>{o.hint}</Txt> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[{ marginBottom: space.lg }, containerStyle]}>
      {label ? <Label required={required}>{label}</Label> : null}
      {options.length === 0 ? <Txt v="bodySm" color="muted">{i18n.t('ui.noOptions')}</Txt> : collapsible ? (
        <View>
          <Pressable
            accessibilityRole="button" accessibilityLabel={label ?? placeholder} accessibilityState={{ expanded: open }}
            onPress={() => setOpen((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: size.input, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: size.hairline, borderColor: error ? c.danger : open ? c.brand : c.borderDefault, backgroundColor: c.bgSurface, gap: space.sm }}
          >
            <Txt v="body" color={selected ? 'strong' : 'faint'} style={{ flex: 1 }} numberOfLines={1}>{selected?.label ?? placeholder}</Txt>
            <Icon name={open ? 'chevron-up' : 'chevron-down'} tone="muted" />
          </Pressable>
          {open ? (
            <View style={{ marginTop: space.sm, gap: space.sm }}>
              {searchable ? <Input value={q} onChangeText={setQ} placeholder={i18n.t('ui.search')} left="search" autoCorrect={false} containerStyle={{ marginBottom: 0 }} /> : null}
              <ScrollView style={{ maxHeight: 264 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.sm }}>
                {list.map((o) => <Opt key={o.value} o={o} />)}
                {list.length === 0 ? <Txt v="bodySm" color="muted" style={{ padding: space.md }}>{i18n.t('ui.notFound')}</Txt> : null}
              </ScrollView>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: space.sm }}>{options.map((o) => <Opt key={o.value} o={o} />)}</View>
      )}
      {error ? <Txt v="caption" color="danger" style={{ marginTop: space.xs }}>{error}</Txt> : hint ? <Txt v="caption" style={{ marginTop: space.xs }}>{hint}</Txt> : null}
    </View>
  );
}

// ───────────────────────── Holat ─────────────────────────

/** Holat → ton. Holat hech qachon faqat rang bilan emas: rang + so'z + ikonka. */
export const STATUS_TONE: Record<string, Tone> = {
  DRAFT: 'neutral', SUBMITTED: 'neutral', NEW: 'info', PLANNING: 'neutral', ON_HOLD: 'neutral', TODO: 'neutral',
  CONFIRMED: 'info', SCHEDULED: 'info', ASSIGNED: 'info', ACCEPTED: 'info', WORKER_ASSIGNED: 'info', APPROVED: 'info', PLANNED: 'info',
  IN_PROGRESS: 'brand', LOADING: 'brand', EN_ROUTE: 'brand', ARRIVED: 'brand', UNLOADING: 'brand', ACTIVE: 'brand', IN_PRODUCTION: 'brand', ON_ROAD: 'brand', LOADED: 'brand',
  DELIVERED: 'success', COMPLETED: 'success', DONE: 'success', PAID: 'success', CLOSED: 'success', Faol: 'success',
  DISPUTED: 'warning', REVIEW: 'warning', PENDING: 'warning', DELAYED: 'warning', OPEN: 'warning', PARTIAL: 'warning',
  REJECTED: 'danger', FAILED: 'danger', CANCELLED: 'danger', DECLINED: 'danger', BLOCKED: 'danger', Kam: 'danger', Nofaol: 'danger',
};
export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Qoralama', SUBMITTED: 'Yuborilgan', CONFIRMED: 'Tasdiqlangan', SCHEDULED: 'Rejalashtirilgan', IN_PROGRESS: 'Jarayonda',
  DELIVERED: 'Yetkazildi', COMPLETED: 'Yakunlangan', REJECTED: 'Rad etilgan', CANCELLED: 'Bekor qilingan',
  ASSIGNED: 'Biriktirilgan', ACCEPTED: 'Qabul qilingan', DECLINED: 'Rad etgan', LOADING: 'Yuklanmoqda', EN_ROUTE: "Yo'lda",
  ARRIVED: 'Yetib kelgan', UNLOADING: 'Tushirilmoqda', DISPUTED: "E'tirozda", FAILED: 'Bajarilmagan',
  NEW: 'Yangi', WORKER_ASSIGNED: 'Quruvchi biriktirilgan', REVIEW: 'Tekshiruvda', DONE: 'Bajarilgan', PAID: "To'langan",
  PENDING: 'Kutilmoqda', APPROVED: 'Tasdiqlangan', PLANNING: 'Rejada', ACTIVE: 'Faol', DELAYED: 'Kechikmoqda', ON_HOLD: "To'xtatilgan",
  TODO: 'Bajarilmagan', LOW: 'Past', MEDIUM: "O'rta", HIGH: 'Yuqori',
  BLOCKED: 'Bloklangan', IN_PRODUCTION: 'Ishlab chiqarishda', CLOSED: 'Yopilgan', PLANNED: 'Rejada',
  LOADED: 'Yuklangan', ON_ROAD: "Yo'lda", OPEN: 'Ochiq', PARTIAL: 'Qisman',
};
export const TONE_ICON: Record<Tone, IconName> = { neutral: 'circle', brand: 'circle-dot', success: 'circle-check', warning: 'clock', danger: 'circle-alert', info: 'info' };
export const statusTone = (s: string): Tone => STATUS_TONE[s] ?? 'neutral';
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

/** Nishon — ton fonida ikonka + so'z. Pill radius. */
export function Badge({ label, tone = 'neutral', icon, style }: { label: string; tone?: Tone | string; icon?: IconName | null; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const t = (['neutral', 'brand', 'success', 'warning', 'danger', 'info'] as Tone[]).includes(tone as Tone) ? (tone as Tone) : 'neutral';
  const { ink, bg } = toneColors(c, t);
  const ic = icon === null ? null : icon ?? TONE_ICON[t];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, paddingHorizontal: space.sm, minHeight: 24, borderRadius: radius.pill, backgroundColor: bg, flexShrink: 0 }, style]}>
      {ic ? <Icon name={ic} size={size.iconSm - 4} color={ink} /> : null}
      <Txt v="caption" style={{ color: ink, fontFamily: FONT[600] }} numberOfLines={1}>{label}</Txt>
    </View>
  );
}
/** Holat kodi bo'yicha nishon. */
export const StatusChip = ({ status, tone }: { status: string; tone?: Tone | string }) => <Badge label={statusLabel(status)} tone={tone ?? statusTone(status)} />;

/** Nuqta + so'z — nishonsiz, qatorda ixcham holat. */
export function StatusDot({ tone = 'neutral', label, style }: { tone?: Tone; label?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const { solid } = toneColors(c, tone);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm - 2 }, style]}>
      <View style={{ width: size.dot, height: size.dot, borderRadius: radius.pill, backgroundColor: solid }} />
      {label ? <Txt v="caption" color="body">{label}</Txt> : null}
    </View>
  );
}

// ───────────────────────── Ro'yxat qatori ─────────────────────────

/** Ikonka plitkasi — 40×40 (yoki 32), radius 12, modul/ton foni. */
export function IconTile({ icon, module: m = 'brand', tone, size: s = size.iconTile, style }: { icon: IconName | string; module?: ModuleTone; tone?: Tone; size?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const col = tone ? toneColors(c, tone) : moduleColors(c, m);
  return (
    <View style={[{ width: s, height: s, borderRadius: radius.lg, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name={icon} size={s >= size.avatarLg ? size.iconXl : s >= size.iconTile ? size.iconMd : size.iconSm} color={col.ink} />
    </View>
  );
}

/** Ro'yxat qatori — min 44, ikonka plitkasi/avatar, sarlavha + izoh, o'ng tomon, chevron. */
export function ListItem({ title, subtitle, subtitleLines = 2, right, onPress, icon, module: m, tone, leading, last, style, chevron, size: sz = 'md' }: { title: string; subtitle?: string; subtitleLines?: number; /** `lg` — haydovchi rejimi, 64 px qator. */ size?: 'md' | 'lg'; right?: React.ReactNode; onPress?: () => void; icon?: IconName | string; module?: ModuleTone; tone?: Tone; leading?: React.ReactNode; last?: boolean; style?: StyleProp<ViewStyle>; chevron?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: sz === 'lg' ? size.driverTouch : size.row, paddingVertical: sz === 'lg' ? space.lg : space.md, borderBottomWidth: last ? 0 : size.hairline, borderBottomColor: c.borderSubtle }, pressed && { backgroundColor: c.bgMuted }, style]}
    >
      {leading ?? (icon ? <IconTile icon={icon} module={m} tone={tone} /> : null)}
      <View style={{ flex: 1 }}>
        <Txt v={sz === 'lg' ? 'titleSm' : 'bodyStrong'} numberOfLines={1}>{title}</Txt>
        {subtitle ? <Txt v={sz === 'lg' ? 'bodySm' : 'caption'} numberOfLines={subtitleLines}>{subtitle}</Txt> : null}
      </View>
      {right}
      {(chevron ?? !!onPress) ? <Icon name="chevron-right" tone="faint" /> : null}
    </Pressable>
  );
}

// ───────────────────────── KPI ─────────────────────────

/** KPI kartasi — 40×40 ikonka plitkasi + yorliq + ko'rsatkich + izoh. `hero` — sahifada bittadan ko'p emas. */
export function KPICard({ label, value, caption, icon = 'activity', module: m = 'brand', tone, onPress, hero, style }: { label: string; value: string; caption?: string; icon?: IconName | string; module?: ModuleTone; tone?: Tone; onPress?: () => void; hero?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const valueColor: TxtColor = tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'strong';
  return (
    <Pressable
      onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [{ backgroundColor: c.bgSurface, borderRadius: radius.card, padding: space.card, borderWidth: size.hairline, borderColor: c.borderDefault, gap: space.md }, shadow.card, pressed && { borderColor: c.borderStrong }, style]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
        <IconTile icon={icon} module={m} tone={tone} />
        {onPress ? <Icon name="chevron-right" tone="faint" /> : null}
      </View>
      <View>
        <Txt v="label" numberOfLines={1}>{label}</Txt>
        <Txt v={hero ? 'metricHero' : 'metric'} color={valueColor} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: space.xs }}>{value}</Txt>
        {caption ? <Txt v="caption" numberOfLines={1} style={{ marginTop: space.xs }}>{caption}</Txt> : null}
      </View>
    </Pressable>
  );
}

/** Izoh/ogohlantirish kartasi — ton foni + ikonka + matn. Xato nima qilish kerakligini aytadi. */
export function Callout({ tone = 'neutral', icon, children, style }: { tone?: Tone; icon?: IconName; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const col = tone === 'neutral' ? { ink: c.textMuted, bg: c.bgSurface } : toneColors(c, tone);
  const ic: IconName = icon ?? ({ neutral: 'info', brand: 'info', success: 'circle-check', warning: 'triangle-alert', danger: 'circle-alert', info: 'info' } as const)[tone];
  return (
    <View accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'none'} style={[{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: col.bg, borderWidth: size.hairline, borderColor: tone === 'neutral' ? c.borderDefault : col.ink, borderRadius: radius.card, padding: space.md }, style]}>
      <Icon name={ic} color={col.ink} size={size.iconMd} />
      {typeof children === 'string' ? <Txt v="bodySm" color={tone === 'neutral' ? 'body' : tone} style={{ flex: 1 }}>{children}</Txt> : <View style={{ flex: 1 }}>{children}</View>}
    </View>
  );
}

// ───────────────────────── Bo'sh holat, skeleton, progress ─────────────────────────

/** Bo'sh holat ayblamaydi: "Bugun reys yo'q". Ixtiyoriy amal tugmasi. */
export function EmptyState({ title, hint, icon = 'inbox', action, onAction, style }: { title: string; hint?: string; icon?: IconName; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xxl, gap: space.md }, style]}>
      <IconTile icon={icon} module="brand" size={size.iconTile + space.sm} />
      <Txt v="titleSm" align="center">{title}</Txt>
      {hint ? <Txt v="bodySm" color="muted" align="center">{hint}</Txt> : null}
      {action ? <Button title={action} variant="secondary" onPress={onAction} full={false} style={{ marginTop: space.xs }} /> : null}
    </View>
  );
}

/** Skeleton — 1.2 s ease-in-out sikl; reduced-motion'da harakatsiz. */
export function Skeleton({ width = '100%', height = 16, radius: r = radius.sm, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const v = useSharedValue(1);
  React.useEffect(() => {
    if (reduce) { v.value = 0.7; return; }
    v.value = withRepeat(withTiming(0.45, { duration: duration.loop / 2, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduce, v]);
  const s = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View accessibilityElementsHidden style={[{ width, height, borderRadius: r, backgroundColor: c.bgMuted }, s, style]} />;
}

export function ProgressBar({ value, tone, height = size.progress, style }: { value: number; tone?: Tone; height?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const t: Tone = tone ?? (value >= 100 ? 'success' : 'brand');
  const fill = t === 'brand' ? c.brand : toneColors(c, t).solid;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={[{ height, borderRadius: radius.pill, backgroundColor: c.chartTrack, overflow: 'hidden' }, style]}>
      <View style={{ width: `${pct}%`, height, borderRadius: radius.pill, backgroundColor: fill }} />
    </View>
  );
}

// ───────────────────────── Formatlash ─────────────────────────

/** Minglar bo'shliq bilan: 4 950 000. */
export const fmtNum = (n: number | string, digits = 0) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const [int, frac] = Math.abs(v).toFixed(digits).split('.');
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${v < 0 ? '−' : ''}${grouped}${frac ? `.${frac}` : ''}`;
};
/** Raqamdan keyin birlik, bo'shliq bilan: "4 950 000 so'm". */
export const fmtSum = (n: number | string) => `${fmtNum(Math.round(Number(n)))} so'm`;
export const fmtM3 = (n: number | string) => `${fmtNum(n, Number(n) % 1 ? 1 : 0)} m³`;
export const fmtUnit = (n: number | string, unit: string) => `${fmtNum(n, Number(n) % 1 ? 1 : 0)} ${unit}`;
export const fmtTime = (d: string | Date) => { const x = new Date(d); return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
export const fmtDate = (d: string | Date) => { const x = new Date(d); return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}`; };
export const fmtDateFull = (d: string | Date) => { const x = new Date(d); return `${fmtDate(x)}.${x.getFullYear()}`; };

export { type as typeScale, space, radius, size };
