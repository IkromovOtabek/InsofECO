import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  LayoutChangeEvent,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import i18n from '@/core/i18n';
import Animated from 'react-native-reanimated';
import { ENTER_ITEM, Shimmer, haptic, usePressScale } from './motion';
import { useTheme } from './theme';
import { Icon, IconName, IconTone } from './icons';
import { CHROME_SCALE, FONT, FontWeight, MIN_FONT_SCALE, ModuleTone, Palette, Tone, TypeVariant, duration, elevation, fitRoom, moduleColors, radius, size, space, textRoom, toneColors, type } from './tokens';

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
  appbarOverline: 'muted', appbarTitle: 'strong', avatarInitials: 'brand', heroValue: 'strong', heroUnit: 'strong', heroDelta: 'onSolid', heroSeg: 'muted',
  tSm: 'muted', kpiValue: 'strong', kpiDelta: 'muted', actionLabel: 'body', sectionTitle: 'strong', sectionLink: 'brand',
  listTitle: 'strong', listValue: 'strong', badge: 'muted', chip: 'muted', tabLabel: 'muted', tabLabelDriver: 'muted', legend: 'body', chartRow: 'body',
  button: 'strong', buttonXl: 'strong', search: 'strong', kv: 'muted',
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
  return <Text {...p} style={[type[v], { color: col }, align ? { textAlign: align } : null, rest, family ? { fontFamily: family } : null, auto]} maxFontSizeMultiplier={p.maxFontSizeMultiplier ?? 1.4} />;
}

/**
 * Bir qatorli xrom yorlig'i (tugma, chip, tab, nishon): bitta qator, sig'masa `MIN_FONT_SCALE`gacha kichrayadi,
 * shrift kattalashtirish `CHROME_SCALE` bilan cheklangan. Qator ichida `flexShrink: 1` bilan birga ishlatiladi.
 */
export const FIT_LINE = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: MIN_FONT_SCALE, maxFontSizeMultiplier: CHROME_SCALE, textBreakStrategy: 'simple' } as const;

/**
 * Konteyner kengligini o'lchaydi va yorliq (taxminiy, shrift masshtabi bilan) + `chrome` (ikonka, padding) sig'masligini aytadi.
 * `tight` bo'lsa chaqiruvchi ikonkani yashiradi / paddingni kamaytiradi. Kenglik hali o'lchanmagan bo'lsa — `false`.
 */
export function useTightFit(text: string, fontSize: number, chrome: number) {
  const { fontScale } = useWindowDimensions();
  const [w, setW] = useState(0);
  const textW = textRoom(text, fontSize) * Math.min(Math.max(fontScale, 1), CHROME_SCALE);
  const onLayout = React.useCallback((e: LayoutChangeEvent) => { const nw = Math.round(e.nativeEvent.layout.width); setW((o) => (o === nw ? o : nw)); }, []);
  return { width: w, textW, tight: w > 0 && textW + chrome > w, onLayout };
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

/** Karta — demo `.card`: chegarasiz, radius 28 (rCard 20 css), padding 16, soya sh1. Ierarxiya soya bilan. */
export function Card({ children, style, ...p }: ViewProps) {
  const { c } = useTheme();
  return (
    <View {...p} style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.card }, elevation(c).sh1, style]}>
      {children}
    </View>
  );
}

/**
 * Bo'lim sarlavhasi — demo `.sh`: nom 17 dp (12.5 css) og'ir, o'ngda brandInk havola 14 dp (10 css), chevronsiz.
 * Tashqi bo'shliq yo'q — ota `gap` (space.stack) beradi. `unit` — havola o'rnida kulrang izoh ("mln so'm").
 */
export function SectionHead({ title, action, onAction, count, icon, unit, style }: {
  /** Bo'lim nomi. */ title: string;
  /** O'ngdagi havola matni ("Barchasi"). */ action?: string;
  onAction?: () => void;
  /** Sarlavha yonidagi son (masalan kutilayotganlar). */ count?: number;
  icon?: IconName;
  /** O'ngdagi izoh (havola bo'lmasa): birlik yoki son ("2 ta"). */ unit?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
        {icon ? <Icon name={icon} tone="muted" /> : null}
        <Txt v="sectionTitle" numberOfLines={1} style={{ flexShrink: 1 }} accessibilityRole="header">{title}</Txt>
        {count != null ? (
          <View style={{ minWidth: space.xl, height: space.xl, paddingHorizontal: space.xs + 2, borderRadius: radius.pill, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="badge" color="body" maxFontSizeMultiplier={CHROME_SCALE}>{count > 99 ? '99+' : count}</Txt>
          </View>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={{ top: space.md, bottom: space.md, left: space.sm, right: space.sm }} accessibilityRole="link" style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Txt v="sectionLink" color="brand" style={{ minWidth: textRoom(action, type.sectionLink.fontSize) }}>{action}</Txt>
        </Pressable>
      ) : unit ? <Txt v="tSm">{unit}</Txt> : null}
    </View>
  );
}

/** Panel — SectionHead + ichida yumshoq karta (ro'yxat uchun ichki chiziqlar `ListItem`da). */
export function Panel({ title, action, onAction, children, style, icon }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <View style={[{ marginTop: space.section, gap: space.stack }, style]}>
      <SectionHead title={title} action={action} onAction={onAction} icon={icon} />
      <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.card, paddingVertical: space.xs }, elevation(c).sh1]}>
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

export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
/** `sticky` — demo `.sticky .btn` (44 css → 60 dp), `stickyXl` — `.btn.xl` (56 css → 76 dp). */
export type BtnSize = 'md' | 'lg' | 'xl' | 'sticky' | 'stickyXl';

/** Asosiy tugma ostidagi brend "nuri" — demo `0 10px 20px -10px var(--brand)` (boxShadow). */
const glow = (color: string): ViewStyle => ({ boxShadow: `0px 14px 28px -14px ${color}` });

/**
 * Tugma — pill shakl, bosilganda prujina 0.96 + yengil haptika. `primary` — brend foni + nur soyasi,
 * `secondary` — yuza + yumshoq soya (chegarasiz), `ghost` — fonsiz.
 */
export function Button({
  title, variant = 'primary', size: sizeKey = 'md', icon, iconRight, loading, disabled, style, onPress, full = true, textColor, ...p
}: PressableProps & { title: string; variant?: BtnVariant; size?: BtnSize; icon?: IconName; iconRight?: IconName; loading?: boolean; full?: boolean; style?: StyleProp<ViewStyle>; /** Matn/ikonka rangi (masalan ikkilamchi "Rad etish" — `c.danger`). */ textColor?: string }) {
  const { c } = useTheme();
  const bg = { primary: c.brand, secondary: c.bgSurface, ghost: 'transparent', danger: c.dangerSolid, success: c.successSolid }[variant];
  const fg = textColor ?? { primary: c.textOnBrand, secondary: c.textStrong, ghost: c.textBody, danger: c.textOnSolid, success: c.textOnSolid }[variant];
  const height = { md: size.button, lg: size.buttonLg, xl: size.driverTouch, sticky: size.stickyButton, stickyXl: size.stickyButtonXl }[sizeKey];
  const txt: TypeVariant = sizeKey === 'xl' ? 'titleMd' : sizeKey === 'stickyXl' ? 'buttonXl' : sizeKey === 'md' ? 'bodyStrong' : 'button';
  const iconSize = sizeKey === 'xl' || sizeKey === 'stickyXl' ? size.iconLg : sizeKey === 'md' ? size.iconSm : size.iconMd;
  const off = !!(disabled || loading);
  const ps = usePressScale();
  // Tor joyda (360 dp, yonma-yon tugmalar, katta tizim shrifti): avval ikonka yashiriladi, keyin padding kamayadi,
  // oxirida matn `MIN_FONT_SCALE`gacha kichrayadi. Faqat to'liq enli tugmada — o'z kengligidagi (`full={false}`) tugma tor bo'lmaydi.
  const padX = sizeKey === 'md' ? space.lg + space.xs : space.xl;
  const iconsW = (icon ? iconSize + space.sm : 0) + (iconRight ? iconSize + space.sm : 0);
  const fit = useTightFit(title, type[txt].fontSize, iconsW + 2 * padX);
  const tight = full && fit.tight;
  const cramped = tight && fit.textW + 2 * padX > fit.width;
  const lift: ViewStyle | null = off ? null
    : variant === 'primary' ? glow(c.brand)
    : variant === 'danger' ? glow(c.dangerSolid)
    : variant === 'success' ? glow(c.successSolid)
    : variant === 'secondary' ? elevation(c).sh1 : null;
  return (
    <Animated.View style={[full ? null : { alignSelf: 'flex-start' }, { borderRadius: radius.pill }, lift, ps.style]}>
      <Pressable
        {...p}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: off, busy: !!loading }}
        disabled={off}
        onPressIn={(e) => { ps.onPressIn(); p.onPressIn?.(e); }}
        onPressOut={(e) => { ps.onPressOut(); p.onPressOut?.(e); }}
        onPress={(e) => { haptic.light(); onPress?.(e); }}
        onLayout={(e) => { fit.onLayout(e); p.onLayout?.(e); }}
        android_ripple={{ color: variant === 'primary' ? c.brandHover : c.bgMuted }}
        style={({ pressed }) => [
          { height, minHeight: size.touch, minWidth: 0, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: cramped ? space.md : padX, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
          off && { opacity: 0.5 },
          Platform.OS === 'ios' && pressed && { opacity: 0.88 },
          style,
        ]}
      >
        {loading ? <ActivityIndicator color={fg} /> : (
          <>
            {icon && !tight ? <Icon name={icon} size={iconSize} color={fg} strokeWidth={2} /> : null}
            {/* Android matn kengligini kam o'lchab oxirgi harflarni qirqadi ("Kiri…") — cheklangan zaxira kenglik;
                uzun yorliq tugmadan chiqmaydi: qisqaradi (flexShrink) va kichrayadi (adjustsFontSizeToFit) */}
            <Text style={[type[txt], { color: fg, flexShrink: 1, minWidth: fitRoom(title, type[txt].fontSize) }]} {...FIT_LINE}>{title}</Text>
            {iconRight && !tight ? <Icon name={iconRight} size={iconSize} color={fg} strokeWidth={2} /> : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Ikonkali tugma — doira, 44×44, `label` majburiy (aria-label). `secondary` — yuza + soya. */
export function IconButton({ icon, label, onPress, tone = 'body', variant = 'ghost', size: s = size.touch, badge, style, disabled, active }: { icon: IconName; label: string; onPress?: () => void; tone?: IconTone; variant?: 'ghost' | 'secondary'; size?: number; badge?: number | boolean; style?: StyleProp<ViewStyle>; disabled?: boolean; /** Yoqilgan holat (masalan kuzatuv): brend foni. */ active?: boolean }) {
  const { c } = useTheme();
  const ps = usePressScale(0.92);
  const num = typeof badge === 'number';
  return (
    <Animated.View style={[ps.style, style]}>
      <Pressable
        onPress={() => { haptic.light(); onPress?.(); }}
        onPressIn={ps.onPressIn}
        onPressOut={ps.onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled, selected: !!active }}
        hitSlop={s < size.touch ? (size.touch - s) / 2 : space.xs}
        android_ripple={{ color: c.bgMuted, borderless: true }}
        style={({ pressed }) => [
          { width: s, height: s, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
          variant === 'secondary' && [{ backgroundColor: c.bgSurface }, elevation(c).sh1],
          active && { backgroundColor: c.brandSoft },
          pressed && !active && { backgroundColor: c.bgMuted },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Icon name={icon} size={size.iconMd} tone={active ? 'brand' : tone} />
        {badge ? (
          <View style={{ position: 'absolute', top: num ? space.xs : space.sm, right: num ? space.xs : space.sm, minWidth: num ? space.lg : size.dot, height: num ? space.lg : size.dot, borderRadius: radius.pill, backgroundColor: c.dangerSolid, borderWidth: size.ring, borderColor: variant === 'secondary' ? c.bgSurface : c.bgChrome, alignItems: 'center', justifyContent: 'center', paddingHorizontal: num ? 3 : 0 }}>
            {num ? <Txt v="overlineXs" color="onSolid" maxFontSizeMultiplier={CHROME_SCALE} numberOfLines={1} style={{ letterSpacing: 0 }}>{(badge as number) > 99 ? '99+' : badge}</Txt> : null}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// ───────────────────────── Maydonlar ─────────────────────────

export function Label({ children, required, style }: { children: string; required?: boolean; style?: StyleProp<TextStyle> }) {
  return <Txt v="label" style={[{ marginBottom: space.xs + 2 }, style]}>{children}{required ? ' *' : ''}</Txt>;
}

/**
 * Input + Label. Balandlik 44, radius.sm, yumshoq fon (chegara faqat fokus/xatoda kuchayadi), fokus halqasi 2 px brand-ring.
 * `mono` — raqam/kod uchun; `left` — ikonka; `right` — ko'z/tozalash tugmasi.
 */
export function Input({ label, error, hint, mono, left, right, required, style, containerStyle, onFocus, onBlur, ...p }: TextInputProps & { label?: string; error?: string; hint?: string; mono?: boolean; left?: IconName; right?: React.ReactNode; required?: boolean; containerStyle?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: space.lg }, containerStyle]}>
      {label ? <Label required={required}>{label}</Label> : null}
      <View style={{ borderRadius: radius.sm + size.ring, borderWidth: size.ring, borderColor: focus ? c.brandRing : 'transparent' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: size.input, borderRadius: radius.sm, borderCurve: 'continuous', borderWidth: size.hairline, borderColor: error ? c.danger : focus ? c.brand : c.borderSubtle, backgroundColor: c.bgSurface, paddingHorizontal: space.md + space.xs, gap: space.sm }}>
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
        onPress={() => { haptic.selection(); onChange(o.value, o); setOpen(false); setQ(''); }}
        android_ripple={{ color: c.bgMuted }}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.row, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.sm, borderCurve: 'continuous', borderWidth: size.hairline, borderColor: on ? c.brand : c.borderSubtle, backgroundColor: on ? c.brandSoft : c.bgSurface }, pressed && !on && { backgroundColor: c.bgSubtle }]}
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
            onPress={() => { haptic.selection(); setOpen((v) => !v); }}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: size.input, paddingHorizontal: space.md + space.xs, borderRadius: radius.sm, borderCurve: 'continuous', borderWidth: size.hairline, borderColor: error ? c.danger : open ? c.brand : c.borderSubtle, backgroundColor: c.bgSurface, gap: space.sm }}
          >
            <Txt v="body" color={selected ? 'strong' : 'faint'} style={{ flex: 1 }} numberOfLines={1}>{selected?.label ?? placeholder}</Txt>
            <Icon name={open ? 'chevron-up' : 'chevron-down'} tone="muted" />
          </Pressable>
          {open ? (
            <Animated.View entering={ENTER_ITEM} style={{ marginTop: space.sm, gap: space.sm }}>
              {searchable ? <Input value={q} onChangeText={setQ} placeholder={i18n.t('ui.search')} left="search" autoCorrect={false} containerStyle={{ marginBottom: 0 }} /> : null}
              <ScrollView style={{ maxHeight: 264 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.sm }}>
                {list.map((o) => <Opt key={o.value} o={o} />)}
                {list.length === 0 ? <Txt v="bodySm" color="muted" style={{ padding: space.md }}>{i18n.t('ui.notFound')}</Txt> : null}
              </ScrollView>
            </Animated.View>
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
  // Brigadir: topshiriq bosqichlari, smena va muammo holati (server o'zbekcha nom yuboradi — `lib/brigade-shift.ts`)
  'Brigadaga berildi': 'info', Jarayonda: 'brand', 'Qisman bajarildi': 'warning', Bajarildi: 'success', 'Bekor qilindi': 'danger',
  'Material yetishmaydi': 'danger', "Uskuna to'xtagan": 'danger', 'Sifat nazoratida': 'warning',
  Ochiq: 'warning', Ochilmagan: 'neutral', Yopilgan: 'success', 'Hal qilindi': 'success', "To'xtagan": 'danger', Ishlayapti: 'success', 'Yangi hisobot': 'brand',
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

/**
 * Nishon — demo `.badge`: pill, 12.5 dp (9 css) qalin, padding 3×10, toneBg / toneInk. Ikonka faqat `icon` berilsa.
 */
export function Badge({ label, tone = 'neutral', icon, style }: { label: string; tone?: Tone | string; /** Ixtiyoriy ikonka (standart — yo'q, demo kabi). */ icon?: IconName | null; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const t = (['neutral', 'brand', 'success', 'warning', 'danger', 'info'] as Tone[]).includes(tone as Tone) ? (tone as Tone) : 'neutral';
  const { ink, bg } = toneColors(c, t);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, paddingHorizontal: space.sm + 2, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: bg, flexShrink: 1, maxWidth: '100%' }, style]}>
      {icon ? <Icon name={icon} size={size.iconSm - 4} color={ink} strokeWidth={2} /> : null}
      <Txt v="badge" style={{ color: ink, flexShrink: 1, minWidth: fitRoom(label, type.badge.fontSize) }} {...FIT_LINE}>{label}</Txt>
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

/**
 * Ikonka plitkasi — 40×40 (yoki `size`). `filled` (standart) — modul/ton foni, radius.lg;
 * `filled={false}` — fonsiz, faqat rangli ikonka (eski ko'rinish).
 */
export function IconTile({ icon, module: m = 'brand', tone, size: s = size.tile, filled = true, style, bg, ink }: { icon: IconName | string; module?: ModuleTone; tone?: Tone; size?: number; /** Fonli plitka (standart true). */ filled?: boolean; style?: StyleProp<ViewStyle>; /** Fon/ikonka rangini almashtirish (masalan asosiy amal plitkasi). */ bg?: string; ink?: string }) {
  const { c } = useTheme();
  const col = tone ? toneColors(c, tone) : moduleColors(c, m);
  // Demo `tileM`: radius rCard × .55, ikonka — plitkaning 55%.
  const r = s >= size.avatarLg ? radius.card : radius.tile;
  return (
    <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, filled && { backgroundColor: bg ?? col.bg, borderRadius: r, borderCurve: 'continuous' }, style]}>
      <Icon name={icon} size={Math.round(s * 0.55)} color={ink ?? col.ink} strokeWidth={filled ? 1.75 : 1.5} />
    </View>
  );
}

/** ListGroup ichidagi qator tartib raqami (birinchisidan keyingilar ichki chiziq chizadi). -1 — guruhdan tashqarida. */
const ListIndexCtx = React.createContext(-1);

/**
 * Ro'yxat guruhi — yumshoq karta, ichidagi `ListItem`lar orasida ichki (inset) chiziqlar:
 * chiziq matn boshidan boshlanadi, ikonka ostidan o'tmaydi.
 */
export function ListGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous' }, elevation(c).sh1, style]}>
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
        {items.map((ch, i) => <ListIndexCtx.Provider key={(ch as { key?: React.Key }).key ?? i} value={i}>{ch}</ListIndexCtx.Provider>)}
      </View>
    </View>
  );
}

/**
 * Ro'yxat qatori — demo `.li`: padding 12×16, 40 dp plitka (28 css), sarlavha 16 dp bir qator, izoh `t-sm`;
 * o'ngda ustun: qiymat (qalin) + nishon. Chevron — faqat bosiladigan va o'ng tomoni bo'sh qatorlarda.
 * Ajratuvchi — ichki (matn boshidan, o'ngda 16): `ListGroup` ichida qator tepasida, tashqarida — pastida (`last` bo'lmasa).
 */
export function ListItem({ title, subtitle, subtitleLines = 2, right, value, badge, onPress, icon, module: m, tone, leading, last, style, chevron, size: sz = 'md' }: {
  title: string; subtitle?: string; subtitleLines?: number;
  /** `lg` — haydovchi rejimi, 64 px qator. */ size?: 'md' | 'lg';
  /** O'ng tomon (to'liq erkin). */ right?: React.ReactNode;
  /** O'ngdagi qiymat (demo `.li .r b`). */ value?: string;
  /** O'ngdagi holat nishoni: `{ text, tone }`. */ badge?: { text: string; tone: Tone | string };
  onPress?: () => void; icon?: IconName | string; module?: ModuleTone; tone?: Tone; leading?: React.ReactNode; last?: boolean; style?: StyleProp<ViewStyle>; chevron?: boolean;
}) {
  const { c } = useTheme();
  const index = React.useContext(ListIndexCtx);
  const inGroup = index >= 0;
  const [tx, setTx] = useState<number | null>(null);
  const line = inGroup ? index > 0 : !last;
  const lg = sz === 'lg';
  const rightCol = value || badge ? (
    <View style={{ alignItems: 'flex-end', gap: space.xs, maxWidth: '45%', flexShrink: 0 }}>
      {value ? <Txt v="listValue" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{value}</Txt> : null}
      {badge ? <Badge label={badge.text} tone={badge.tone} /> : null}
    </View>
  ) : null;
  const showChevron = chevron ?? (!!onPress && !right && !rightCol);
  // Bosilganda qator foni yorishadi va mazmuni prujina bilan ozgina (0.98) kichrayadi; qatorning o'zi
  // (bosish maydoni, ajratuvchi chiziq) o'z joyida qoladi
  const ps = usePressScale(0.98);
  const padX = inGroup ? space.card : 0;
  return (
    <Pressable
      onPress={onPress ? () => { haptic.light(); onPress(); } : undefined} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      onPressIn={onPress ? ps.onPressIn : undefined} onPressOut={onPress ? ps.onPressOut : undefined}
      android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', minHeight: lg ? size.driverTouch : size.row, paddingVertical: lg ? space.lg : space.md }, inGroup && { paddingHorizontal: space.card }, pressed && { backgroundColor: c.bgSubtle }, style]}
    >
      {line ? <View pointerEvents="none" style={{ position: 'absolute', left: padX + (tx ?? 0), right: padX, height: size.hairline, backgroundColor: c.borderSubtle, ...(inGroup ? { top: 0 } : { bottom: 0 }) }} /> : null}
      <Animated.View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md }, ps.style]}>
        {leading ?? (icon ? <IconTile icon={icon} module={m} tone={tone} size={lg ? size.iconTile + space.sm : size.tile} /> : null)}
        <View style={{ flex: 1, minWidth: 0 }} onLayout={(e) => { const x = Math.round(e.nativeEvent.layout.x); if (x !== tx) setTx(x); }}>
          <Txt v={lg ? 'titleSm' : 'listTitle'} numberOfLines={1}>{title}</Txt>
          {subtitle ? <Txt v={lg ? 'bodySm' : 'tSm'} numberOfLines={subtitleLines}>{subtitle}</Txt> : null}
        </View>
        {rightCol}
        {right}
        {showChevron ? <Icon name="chevron-right" size={size.iconMd - 1} tone="faint" strokeWidth={1.75} /> : null}
      </Animated.View>
    </Pressable>
  );
}

// ───────────────────────── KPI ─────────────────────────

/** O'zgarish ko'rsatkichi: "+12%" yoki "−3 ta" — ton rangida, yo'nalish strelkasi bilan. */
export function Delta({ text, tone = 'neutral', dir, onInverse }: { text: string; tone?: Tone; /** Strelka yo'nalishi; berilmasa matndagi ishoradan. */ dir?: 'up' | 'down'; /** To'q (bgInverse) fon ustida. */ onInverse?: boolean }) {
  const { c } = useTheme();
  const d = dir ?? (/^[-−]/.test(text.trim()) ? 'down' : 'up');
  const col = onInverse ? c.textOnInverse : tone === 'neutral' ? c.textMuted : toneColors(c, tone).ink;
  const bg = onInverse ? c.bgInverseChip : tone === 'neutral' ? c.bgMuted : toneColors(c, tone).bg;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, paddingHorizontal: space.xs + 2, minHeight: space.xl, borderRadius: radius.pill, backgroundColor: bg }}>
      <Icon name={d === 'down' ? 'arrow-down-right' : 'arrow-up-right'} size={size.iconSm - 4} color={col} strokeWidth={2.25} />
      <Txt v="caption" {...FIT_LINE} style={{ color: col, fontFamily: FONT[600], flexShrink: 1 }}>{text}</Txt>
    </View>
  );
}

/**
 * KPI kartasi. `layout="stack"` (standart) — plitka tepada, ostida yorliq + ko'rsatkich;
 * `layout="inline"` — plitka chapda, yonida (ixcham, 2 ustunli setka uchun). `hero` — sahifada bittadan ko'p emas.
 */
export function KPICard({ label, value, caption, icon = 'activity', module: m = 'brand', tone, onPress, hero, delta, layout = 'stack', style }: { label: string; value: string; caption?: string; icon?: IconName | string; module?: ModuleTone; tone?: Tone; onPress?: () => void; hero?: boolean; /** O'zgarish: `{ text: '+12%', tone: 'success' }`. */ delta?: { text: string; tone: Tone }; layout?: 'stack' | 'inline'; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const valueColor: TxtColor = tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'strong';
  const ps = usePressScale();
  const inline = layout === 'inline';
  return (
    <Animated.View style={[ps.style, style]}>
      <Pressable
        onPress={onPress ? () => { haptic.light(); onPress(); } : undefined} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${label}: ${value}`}
        onPressIn={onPress ? ps.onPressIn : undefined}
        onPressOut={onPress ? ps.onPressOut : undefined}
        style={[{ flexGrow: 1, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: inline ? space.md : space.card, gap: inline ? space.md : space.md }, inline && { flexDirection: 'row', alignItems: 'center' }, elevation(c).sh1]}
      >
        {inline ? <IconTile icon={icon} module={m} tone={tone} size={size.iconTile} /> : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <IconTile icon={icon} module={m} tone={tone} />
            {delta ? <Delta text={delta.text} tone={delta.tone} /> : onPress ? <Icon name="chevron-right" tone="faint" /> : null}
          </View>
        )}
        <View style={{ flex: inline ? 1 : undefined, minWidth: 0 }}>
          <Txt v={inline ? 'caption' : 'label'} numberOfLines={1}>{label}</Txt>
          <Txt v={hero ? 'metricHero' : inline ? 'titleMd' : 'metric'} color={valueColor} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: inline ? 0 : space.xs }}>{value}</Txt>
          {inline && delta ? <View style={{ marginTop: space.xs }}><Delta text={delta.text} tone={delta.tone} /></View> : null}
          {caption ? <Txt v="caption" numberOfLines={1} style={{ marginTop: space.xs }}>{caption}</Txt> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Izoh/ogohlantirish kartasi — ton foni + ikonka + matn (chegarasiz). Xato nima qilish kerakligini aytadi. */
export function Callout({ tone = 'neutral', icon, children, style }: { tone?: Tone; icon?: IconName; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const col = tone === 'neutral' ? { ink: c.textMuted, bg: c.bgSurface } : toneColors(c, tone);
  const ic: IconName = icon ?? ({ neutral: 'info', brand: 'info', success: 'circle-check', warning: 'triangle-alert', danger: 'circle-alert', info: 'info' } as const)[tone];
  return (
    <View accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'none'} style={[{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: col.bg, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md + space.xs }, tone === 'neutral' && elevation(c).sh1, style]}>
      <Icon name={ic} color={col.ink} size={size.iconMd} />
      {typeof children === 'string' ? <Txt v="bodySm" color={tone === 'neutral' ? 'body' : tone} style={{ flex: 1 }}>{children}</Txt> : <View style={{ flex: 1 }}>{children}</View>}
    </View>
  );
}

// ───────────────────────── Bo'sh holat, skeleton, progress ─────────────────────────

/**
 * Bo'sh holat ayblamaydi: "Bugun reys yo'q". Ixtiyoriy amal tugmasi; `onRetry` — "Qayta urinish"
 * (xato/oflayn holat uchun); `compact` — karta ichida kichikroq.
 */
export function EmptyState({ title, hint, icon = 'inbox', action, onAction, onRetry, retryLabel = 'Qayta urinish', compact, style }: { title: string; hint?: string; icon?: IconName; action?: string; onAction?: () => void; /** Qayta yuklash tugmasi. */ onRetry?: () => void; retryLabel?: string; /** Karta ichida — kichik paddinglar. */ compact?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignItems: 'center', paddingVertical: compact ? space.xl : space.xxxl, paddingHorizontal: compact ? space.lg : space.xxl, gap: compact ? space.sm : space.md }, style]}>
      <IconTile icon={icon} module="brand" size={compact ? size.iconTile : size.avatarLg} />
      <Txt v={compact ? 'bodyStrong' : 'titleSm'} align="center">{title}</Txt>
      {hint ? <Txt v="bodySm" color="muted" align="center">{hint}</Txt> : null}
      {action || onRetry ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.xs }}>
          {onRetry ? <Button title={retryLabel} icon="refresh-cw" variant={action ? 'secondary' : 'primary'} onPress={onRetry} full={false} /> : null}
          {action ? <Button title={action} variant="secondary" onPress={onAction} full={false} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Skeleton — yumshoq shimmer tasmasi (1.1 s); reduced-motion'da harakatsiz. `inverse` — to'q karta ustida. */
export function Skeleton({ width = '100%', height = 16, radius: r = radius.sm, inverse, style }: { width?: number | `${number}%`; height?: number; radius?: number; inverse?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: r, overflow: 'hidden' }, style]}>
      <Shimmer inverse={inverse} />
    </View>
  );
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

// ───────────────────────── Qidiruv, kalit-qiymat, timeline (demo) ─────────────────────────

/**
 * Qidiruv maydoni — demo `.search`: pill, 52 dp (38 css), padding 0×20, chegarasiz, soya sh1, lupa textFaint.
 * Matn kiritilsa o'ngda tozalash tugmasi chiqadi.
 */
export function SearchField({ value, onChangeText, placeholder = i18n.t('ui.search'), right, style, ...p }: Omit<TextInputProps, 'style'> & { value: string; onChangeText: (t: string) => void; /** O'ngdagi qo'shimcha (filtr tugmasi). */ right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.tight, height: size.search, paddingLeft: space.xl, paddingRight: value ? space.sm : space.xl, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.bgSurface }, elevation(c).sh1, style]}>
      <Icon name="search" size={size.iconMd} color={c.textFaint} strokeWidth={1.75} />
      <TextInput
        {...p}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        accessibilityLabel={p.accessibilityLabel ?? placeholder}
        returnKeyType={p.returnKeyType ?? 'search'}
        autoCorrect={p.autoCorrect ?? false}
        style={[type.search, { flex: 1, color: c.textStrong, paddingVertical: 0, height: size.search }]}
      />
      {value ? <IconButton icon="x" label={i18n.t('ui.close')} onPress={() => onChangeText('')} tone="muted" size={size.touch - space.sm} /> : null}
      {right}
    </View>
  );
}

/**
 * Kalit-qiymat ro'yxati — demo `.kv` qatorlari: padding 11×16, kulrang kalit, qalin qiymat, ichki chiziqlar (16 dan 16 gacha).
 * Yuza karta (sh1) ichida; `flat` — kartasiz (boshqa karta ichida).
 */
export function KVList({ rows, flat, style }: { rows: { label: string; value: React.ReactNode; tone?: Tone }[]; flat?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[!flat && [{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous' }, elevation(c).sh1], style]}>
      {rows.map((r, i) => (
        <View key={`${r.label}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingVertical: space.tight, paddingHorizontal: space.card }}>
          {i > 0 ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: space.card, right: space.card, height: size.hairline, backgroundColor: c.borderSubtle }} /> : null}
          <Txt v="kv" numberOfLines={1} style={{ flexShrink: 1 }}>{r.label}</Txt>
          {typeof r.value === 'string' || typeof r.value === 'number'
            ? <Txt v="kv" align="right" numberOfLines={2} style={{ fontFamily: FONT[600], color: r.tone && r.tone !== 'neutral' ? toneColors(c, r.tone).ink : c.textStrong, flexShrink: 1 }}>{r.value}</Txt>
            : r.value}
        </View>
      ))}
    </View>
  );
}

/**
 * Bosqichlar (timeline) — demo `.tl`: 14 dp nuqta (10 css), vertikal chiziq; `done` — yashil to'la, `now` — brend halqa.
 */
export function Timeline({ steps, style }: { steps: { title: string; sub?: string; state?: 'done' | 'now' | 'todo' }[]; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const d = size.timelineDot;
  return (
    <View style={style}>
      {steps.map((st, i) => {
        const state = st.state ?? 'todo';
        const last = i === steps.length - 1;
        return (
          <View key={`${st.title}-${i}`} style={{ flexDirection: 'row', gap: space.md, paddingBottom: last ? 0 : space.md }}>
            {!last ? <View style={{ position: 'absolute', left: d / 2 - 1, top: d + 2, bottom: 0, width: 2, backgroundColor: c.borderDefault }} /> : null}
            <View style={{ width: d, height: d, marginTop: 3, borderRadius: radius.pill, borderWidth: 2.5, borderColor: state === 'done' ? c.successSolid : state === 'now' ? c.brand : c.borderStrong, backgroundColor: state === 'done' ? c.successSolid : state === 'now' ? c.brandSoft : c.bgSurface }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="kv" style={{ fontFamily: FONT[600], color: state === 'todo' ? c.textMuted : c.textStrong }}>{st.title}</Txt>
              {st.sub ? <Txt v="tSm">{st.sub}</Txt> : null}
            </View>
          </View>
        );
      })}
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
