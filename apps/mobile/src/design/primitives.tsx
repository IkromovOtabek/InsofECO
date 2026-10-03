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
import i18n from '@/core/i18n';
import Animated from 'react-native-reanimated';
import { Shimmer, haptic, usePressScale } from './motion';
import { useTheme } from './theme';
import { Icon, IconName, IconTone } from './icons';
import { FONT, FontWeight, ModuleTone, Palette, Tone, TypeVariant, duration, moduleColors, radius, shadow, size, space, textRoom, toneColors, type } from './tokens';

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

/** Karta — yumshoq: chegarasiz, radius 20, padding 16, soya (`shadow.card`). Ierarxiya soya bilan. */
export function Card({ children, style, ...p }: ViewProps) {
  const { c } = useTheme();
  return (
    <View {...p} style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.card }, shadow.card, style]}>
      {children}
    </View>
  );
}

/** Bo'lim sarlavhasi — titleSm + ixtiyoriy son nishoni + o'ngda "Hammasi →" havolasi. */
export function SectionHead({ title, action, onAction, count, icon, style }: {
  /** Bo'lim nomi. */ title: string;
  /** O'ngdagi havola matni ("Hammasi"). */ action?: string;
  onAction?: () => void;
  /** Sarlavha yonidagi son (masalan kutilayotganlar). */ count?: number;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm, gap: space.sm, minHeight: size.touch }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
        {icon ? <Icon name={icon} tone="muted" /> : null}
        <Txt v="titleSm" numberOfLines={1} style={{ flexShrink: 1 }} accessibilityRole="header">{title}</Txt>
        {count != null ? (
          <View style={{ minWidth: space.xl, height: space.xl, paddingHorizontal: space.xs + 2, borderRadius: radius.pill, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="caption" color="body" style={{ fontFamily: FONT[600] }}>{count > 99 ? '99+' : count}</Txt>
          </View>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={space.sm} accessibilityRole="link" style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.touch, justifyContent: 'center', paddingLeft: space.sm }, pressed && { opacity: 0.6 }]}>
          <Txt v="label" color="brand" style={{ minWidth: textRoom(action, type.label.fontSize) }}>{action}</Txt>
          <Icon name="chevron-right" tone="brand" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Panel — SectionHead + ichida yumshoq karta (ro'yxat uchun ichki chiziqlar `ListItem`da). */
export function Panel({ title, action, onAction, children, style, icon }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <View style={[{ marginTop: space.section }, style]}>
      <SectionHead title={title} action={action} onAction={onAction} icon={icon} />
      <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.card, paddingVertical: space.xs }, shadow.card]}>
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
export type BtnSize = 'md' | 'lg' | 'xl';

/** Asosiy tugma ostidagi brend "nuri" — rangli soya (iOS); Android'da yengil elevation. */
const glow = (color: string): ViewStyle => Platform.select<ViewStyle>({
  ios: { shadowColor: color, shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 3, shadowColor: color },
  default: {},
})!;

/**
 * Tugma — pill shakl, bosilganda prujina 0.96 + yengil haptika. `primary` — brend foni + nur soyasi,
 * `secondary` — yuza + yumshoq soya (chegarasiz), `ghost` — fonsiz.
 */
export function Button({
  title, variant = 'primary', size: sizeKey = 'md', icon, iconRight, loading, disabled, style, onPress, full = true, ...p
}: PressableProps & { title: string; variant?: BtnVariant; size?: BtnSize; icon?: IconName; iconRight?: IconName; loading?: boolean; full?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const bg = { primary: c.brand, secondary: c.bgSurface, ghost: 'transparent', danger: c.dangerSolid, success: c.successSolid }[variant];
  const fg = { primary: c.textOnBrand, secondary: c.textStrong, ghost: c.textBody, danger: c.textOnSolid, success: c.textOnSolid }[variant];
  const height = { md: size.button, lg: size.buttonLg, xl: size.driverTouch }[sizeKey];
  const txt: TypeVariant = sizeKey === 'xl' ? 'titleMd' : 'bodyStrong';
  const iconSize = sizeKey === 'xl' ? size.iconLg : sizeKey === 'lg' ? size.iconMd : size.iconSm;
  const off = !!(disabled || loading);
  const ps = usePressScale(0.96);
  const lift: ViewStyle | null = off ? null
    : variant === 'primary' ? glow(c.brand)
    : variant === 'danger' ? glow(c.dangerSolid)
    : variant === 'success' ? glow(c.successSolid)
    : variant === 'secondary' ? shadow.card : null;
  return (
    <Animated.View style={[full ? null : { alignSelf: 'flex-start' }, ps.style]}>
      <Pressable
        {...p}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: off, busy: !!loading }}
        disabled={off}
        onPressIn={(e) => { ps.onPressIn(); p.onPressIn?.(e); }}
        onPressOut={(e) => { ps.onPressOut(); p.onPressOut?.(e); }}
        onPress={(e) => { haptic.light(); onPress?.(e); }}
        android_ripple={{ color: variant === 'primary' ? c.brandHover : c.bgMuted }}
        style={({ pressed }) => [
          { height, minHeight: size.touch, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: sizeKey === 'md' ? space.lg + space.xs : space.xl, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
          lift,
          off && { opacity: 0.5 },
          Platform.OS === 'ios' && pressed && { opacity: 0.88 },
          style,
        ]}
      >
        {loading ? <ActivityIndicator color={fg} /> : (
          <>
            {icon ? <Icon name={icon} size={iconSize} color={fg} strokeWidth={2} /> : null}
            {/* Android matn kengligini kam o'lchab oxirgi harflarni qirqadi ("Kiri…") — zaxira kenglik */}
            <Text style={[type[txt], { color: fg, minWidth: textRoom(title, type[txt].fontSize) }]} maxFontSizeMultiplier={1.4} numberOfLines={1}>{title}</Text>
            {iconRight ? <Icon name={iconRight} size={iconSize} color={fg} strokeWidth={2} /> : null}
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
          variant === 'secondary' && [{ backgroundColor: c.bgSurface }, shadow.card],
          active && { backgroundColor: c.brandSoft },
          pressed && !active && { backgroundColor: c.bgMuted },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Icon name={icon} size={size.iconMd} tone={active ? 'brand' : tone} />
        {badge ? (
          <View style={{ position: 'absolute', top: num ? space.xs : space.sm, right: num ? space.xs : space.sm, minWidth: num ? space.lg : size.dot, height: num ? space.lg : size.dot, borderRadius: radius.pill, backgroundColor: c.dangerSolid, borderWidth: size.ring, borderColor: c.bgApp, alignItems: 'center', justifyContent: 'center', paddingHorizontal: num ? 3 : 0 }}>
            {num ? <Txt v="overlineXs" color="onSolid" style={{ letterSpacing: 0 }}>{(badge as number) > 99 ? '99+' : badge}</Txt> : null}
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
            onPress={() => setOpen((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: size.input, paddingHorizontal: space.md + space.xs, borderRadius: radius.sm, borderCurve: 'continuous', borderWidth: size.hairline, borderColor: error ? c.danger : open ? c.brand : c.borderSubtle, backgroundColor: c.bgSurface, gap: space.sm }}
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

/** Nishon — ton fonida ikonka + so'z. Pill radius. */
export function Badge({ label, tone = 'neutral', icon, style }: { label: string; tone?: Tone | string; icon?: IconName | null; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const t = (['neutral', 'brand', 'success', 'warning', 'danger', 'info'] as Tone[]).includes(tone as Tone) ? (tone as Tone) : 'neutral';
  const { ink, bg } = toneColors(c, t);
  const ic = icon === null ? null : icon ?? TONE_ICON[t];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, paddingHorizontal: space.sm, minHeight: 24, borderRadius: radius.pill, backgroundColor: bg, flexShrink: 0 }, style]}>
      {ic ? <Icon name={ic} size={size.iconSm - 4} color={ink} /> : null}
      <Txt v="caption" style={{ color: ink, fontFamily: FONT[600], minWidth: textRoom(label, type.caption.fontSize) }} numberOfLines={1}>{label}</Txt>
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
export function IconTile({ icon, module: m = 'brand', tone, size: s = size.iconTile, filled = true, style }: { icon: IconName | string; module?: ModuleTone; tone?: Tone; size?: number; /** Fonli plitka (standart true). */ filled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const col = tone ? toneColors(c, tone) : moduleColors(c, m);
  const r = s >= size.avatarLg ? radius.card : s >= size.iconTile ? radius.lg : radius.sm;
  return (
    <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, filled && { backgroundColor: col.bg, borderRadius: r, borderCurve: 'continuous' }, style]}>
      <Icon name={icon} size={s >= size.avatarLg ? size.iconXl : s >= size.iconTile ? size.iconMd : size.iconSm} color={col.ink} strokeWidth={filled ? 1.75 : 1.5} />
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
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous' }, shadow.card, style]}>
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', paddingVertical: space.xs }}>
        {items.map((ch, i) => <ListIndexCtx.Provider key={(ch as { key?: React.Key }).key ?? i} value={i}>{ch}</ListIndexCtx.Provider>)}
      </View>
    </View>
  );
}

/**
 * Ro'yxat qatori — min 44, ikonka plitkasi/avatar, sarlavha + izoh, o'ng tomon, chevron.
 * Ajratuvchi chiziq — ichki (matn boshidan): `ListGroup` ichida qator tepasida, tashqarida — pastida (`last` bo'lmasa).
 */
export function ListItem({ title, subtitle, subtitleLines = 2, right, onPress, icon, module: m, tone, leading, last, style, chevron, size: sz = 'md' }: { title: string; subtitle?: string; subtitleLines?: number; /** `lg` — haydovchi rejimi, 64 px qator. */ size?: 'md' | 'lg'; right?: React.ReactNode; onPress?: () => void; icon?: IconName | string; module?: ModuleTone; tone?: Tone; leading?: React.ReactNode; last?: boolean; style?: StyleProp<ViewStyle>; chevron?: boolean }) {
  const { c } = useTheme();
  const index = React.useContext(ListIndexCtx);
  const inGroup = index >= 0;
  const [tx, setTx] = useState<number | null>(null);
  const line = inGroup ? index > 0 : !last;
  return (
    <Pressable
      onPress={onPress ? () => { haptic.selection(); onPress(); } : undefined} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: sz === 'lg' ? size.driverTouch : size.row, paddingVertical: sz === 'lg' ? space.lg : space.md }, inGroup && { paddingHorizontal: space.card }, pressed && { backgroundColor: c.bgSubtle }, style]}
    >
      {line ? <View pointerEvents="none" style={{ position: 'absolute', left: tx ?? (inGroup ? space.card : 0), right: inGroup ? space.md : 0, height: size.hairline, backgroundColor: c.borderSubtle, ...(inGroup ? { top: 0 } : { bottom: 0 }) }} /> : null}
      {leading ?? (icon ? <IconTile icon={icon} module={m} tone={tone} /> : null)}
      <View style={{ flex: 1 }} onLayout={(e) => { const x = Math.round(e.nativeEvent.layout.x); if (x !== tx) setTx(x); }}>
        <Txt v={sz === 'lg' ? 'titleSm' : 'bodyStrong'} numberOfLines={1}>{title}</Txt>
        {subtitle ? <Txt v={sz === 'lg' ? 'bodySm' : 'caption'} numberOfLines={subtitleLines}>{subtitle}</Txt> : null}
      </View>
      {right}
      {(chevron ?? !!onPress) ? <Icon name="chevron-right" tone="faint" /> : null}
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
      <Txt v="caption" numberOfLines={1} style={{ color: col, fontFamily: FONT[600] }}>{text}</Txt>
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
  const ps = usePressScale(0.96);
  const inline = layout === 'inline';
  return (
    <Animated.View style={[ps.style, style]}>
      <Pressable
        onPress={onPress ? () => { haptic.light(); onPress(); } : undefined} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${label}: ${value}`}
        onPressIn={onPress ? ps.onPressIn : undefined}
        onPressOut={onPress ? ps.onPressOut : undefined}
        style={[{ flexGrow: 1, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: inline ? space.md : space.card, gap: inline ? space.md : space.md }, inline && { flexDirection: 'row', alignItems: 'center' }, shadow.card]}
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
    <View accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'none'} style={[{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: col.bg, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md + space.xs }, tone === 'neutral' && shadow.card, style]}>
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
