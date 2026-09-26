/**
 * Yuqori darajali komponentlar (primitives ustida): Avatar, Tabs, Table, Modal, Sheet, Toast,
 * grafiklar, HeaderBack. Native <Modal> Fabric'da ko'rinmaydi — Modal/Sheet daraxt ichida chiziladi.
 */
import React, { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import i18n from '@/core/i18n';
import { useTheme } from './theme';
import { Icon, IconName } from './icons';
import { DUR, EASE_STATE } from './motion';
import { Palette, Tone, duration, radius, shadow, size, space, toneColors } from './tokens';
import { Badge, Button, IconButton, StatusDot, Txt, fmtSum } from './primitives';

export { Icon, resolveIcon } from './icons';
export type { IconName } from './icons';

/** Tab navigatorlarda push qilingan ekranlar uchun orqaga tugmasi. */
export function HeaderBack() {
  const router = useRouter();
  return <IconButton icon="arrow-left" label={i18n.t('ui.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('..'))} tone="strong" />;
}

/** Tab ikonkasi — Lucide; faol holatda chiziq qalinroq. */
export const tabIcon = (name: IconName) => ({ color, focused }: { color: string; focused: boolean }) => <Icon name={name} size={size.iconLg} color={color} strokeWidth={focused ? 2 : 1.5} />;

export function Avatar({ name, size: s = size.avatar, tone = 'neutral' }: { name?: string | null; size?: number; tone?: Tone }) {
  const { c } = useTheme();
  const initials = (name ?? '?').split(' ').map((x) => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const col = tone === 'neutral' ? { bg: c.bgMuted, ink: c.textBody } : toneColors(c, tone);
  return (
    <View accessibilityLabel={name ?? undefined} style={{ width: s, height: s, borderRadius: radius.pill, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Txt v={s >= size.avatarLg ? 'titleMd' : 'bodyStrong'} style={{ color: col.ink }}>{initials}</Txt>
    </View>
  );
}

/** Tabs — segment: bg-subtle yo'lak, faol segment surface + chegara. */
export function Tabs<T extends string>({ value, onChange, items, style }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; count?: number }[]; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const scroll = items.length > 4;
  const body = items.map((s) => {
    const on = value === s.key;
    return (
      <Pressable
        key={s.key} onPress={() => onChange(s.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
        style={({ pressed }) => [{ flex: scroll ? undefined : 1, minHeight: size.touch - space.sm, paddingHorizontal: space.md, borderRadius: radius.md - 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, backgroundColor: on ? c.bgSurface : 'transparent', borderWidth: size.hairline, borderColor: on ? c.borderDefault : 'transparent' }, on && shadow.card, pressed && !on && { backgroundColor: c.bgMuted }]}
      >
        <Txt v="label" color={on ? 'strong' : 'muted'} numberOfLines={1}>{s.label}</Txt>
        {s.count != null ? <Txt v="caption" color={on ? 'body' : 'faint'}>{s.count}</Txt> : null}
      </Pressable>
    );
  });
  const track = { flexDirection: 'row' as const, gap: space.xs, padding: space.xs, borderRadius: radius.md, backgroundColor: c.bgSubtle, borderWidth: size.hairline, borderColor: c.borderSubtle };
  return scroll
    ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={track}>{body}</ScrollView>
    : <View style={[track, style]}>{body}</View>;
}

// ───────────────────────── Jadval ─────────────────────────

export interface TableColumn<T> { key: string; title: string; width?: number; flex?: number; align?: 'left' | 'right'; mono?: boolean; render: (row: T) => React.ReactNode }
/** Jadval — sticky sarlavha (bg-subtle, overline), 44 px qator, mono faqat tekislanadigan ustunda. */
export function Table<T>({ columns, rows, keyOf, onRowPress, empty, minWidth, style }: { columns: TableColumn<T>[]; rows: T[]; keyOf: (r: T) => string; onRowPress?: (r: T) => void; empty?: React.ReactNode; minWidth?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const cell = (col: TableColumn<T>): ViewStyle => ({ width: col.width, flex: col.width ? undefined : col.flex ?? 1, alignItems: col.align === 'right' ? 'flex-end' : 'flex-start', paddingHorizontal: space.md, justifyContent: 'center' });
  const inner = (
    <View style={{ minWidth, borderRadius: radius.card, borderWidth: size.hairline, borderColor: c.borderDefault, backgroundColor: c.bgSurface, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', minHeight: size.row - space.sm, alignItems: 'center', backgroundColor: c.bgSubtle, borderBottomWidth: size.hairline, borderBottomColor: c.borderDefault }}>
        {columns.map((col) => <View key={col.key} style={cell(col)}><Txt v="overline" numberOfLines={1}>{col.title}</Txt></View>)}
      </View>
      {rows.length === 0 ? (empty ?? <Txt v="bodySm" color="muted" style={{ padding: space.lg }} align="center">{i18n.t('ui.noData')}</Txt>) : rows.map((r, i) => (
        <Pressable
          key={keyOf(r)} onPress={onRowPress ? () => onRowPress(r) : undefined} disabled={!onRowPress}
          android_ripple={{ color: c.bgMuted }}
          style={({ pressed }) => [{ flexDirection: 'row', minHeight: size.row, alignItems: 'center', borderBottomWidth: i === rows.length - 1 ? 0 : size.hairline, borderBottomColor: c.borderSubtle }, pressed && { backgroundColor: c.bgMuted }]}
        >
          {columns.map((col) => {
            const v = col.render(r);
            return <View key={col.key} style={cell(col)}>{typeof v === 'string' || typeof v === 'number' ? <Txt v={col.mono ? 'mono' : 'bodySm'} numberOfLines={1}>{v}</Txt> : v}</View>;
          })}
        </Pressable>
      ))}
    </View>
  );
  return minWidth ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>{inner}</ScrollView> : <View style={style}>{inner}</View>;
}

// ───────────────────────── Modal / Sheet ─────────────────────────

/** Parda + ichki qatlam: holat o'zgarishi 200 ms, faqat opacity + transform. */
function useOverlay(open: boolean, onClose: () => void) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => { p.value = reduce ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: DUR.state, easing: EASE_STATE }); }, [open, p, reduce]);
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [open, onClose]);
  return p;
}

/** Pastdan chiqadigan varaq (mobil). Sarlavha doim ko'rinadi, ichi aylanadi, pastda footer. */
export function Sheet({ open, onClose, title, children, footer, maxHeight = '88%' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; maxHeight?: `${number}%` }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const p = useOverlay(open, onClose);
  const scrim = useAnimatedStyle(() => ({ opacity: p.value }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.value) * 40 }], opacity: p.value }));
  if (!open) return null;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrim]}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={i18n.t('ui.close')} /></Animated.View>
      <Animated.View style={[{ backgroundColor: c.bgSurface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + space.lg, maxHeight, borderTopWidth: size.hairline, borderColor: c.borderDefault }, shadow.pop, panel]}>
        <View style={{ alignSelf: 'center', width: space.x10, height: space.xs, borderRadius: radius.pill, backgroundColor: c.borderStrong, marginTop: space.sm }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: space.xl, paddingRight: space.sm, paddingTop: space.sm, paddingBottom: space.xs }}>
          <Txt v="titleMd" style={{ flex: 1 }} numberOfLines={1}>{title}</Txt>
          <IconButton icon="x" label={i18n.t('ui.close')} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingVertical: space.sm }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        {footer ? <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, borderTopWidth: size.hairline, borderTopColor: c.borderSubtle }}>{footer}</View> : null}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

/** Markazdagi oyna — tasdiq va qisqa forma. */
export function Modal({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  const { c } = useTheme();
  const p = useOverlay(open, onClose);
  const scrim = useAnimatedStyle(() => ({ opacity: p.value }));
  const panel = useAnimatedStyle(() => ({ transform: [{ scale: 0.96 + p.value * 0.04 }], opacity: p.value }));
  if (!open) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', padding: space.xxl }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrim]}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={i18n.t('ui.close')} /></Animated.View>
      <Animated.View accessibilityViewIsModal style={[{ backgroundColor: c.bgSurface, borderRadius: radius.xl, padding: space.xl, borderWidth: size.hairline, borderColor: c.borderDefault, gap: space.lg }, shadow.pop, panel]}>
        <Txt v="titleMd">{title}</Txt>
        {children}
        {actions ? <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' }}>{actions}</View> : null}
      </Animated.View>
    </View>
  );
}

/** Tasdiq oynasi — matn + Bekor / Tasdiq. */
export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel = i18n.t('ui.confirm'), danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: string; confirmLabel?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} actions={<><Button title={i18n.t('ui.cancel')} variant="ghost" full={false} onPress={onClose} /><Button title={confirmLabel} variant={danger ? 'danger' : 'primary'} full={false} loading={loading} onPress={onConfirm} /></>}>
      {message ? <Txt v="body">{message}</Txt> : null}
    </Modal>
  );
}

// ───────────────────────── Toast ─────────────────────────

interface ToastItem { id: number; text: string; tone: Tone; title?: string }
const useToastStore = create<{ items: ToastItem[]; push: (t: Omit<ToastItem, 'id'>) => void; remove: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items.slice(-2), { ...t, id: Date.now() + Math.random() }] })),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));
/** `toast.success('Saqlandi')`, `toast.error('Kredit limit oshgan — to\'lov kiriting yoki limitni kengaytiring')`. */
export const toast = {
  show: (text: string, tone: Tone = 'neutral', title?: string) => useToastStore.getState().push({ text, tone, title }),
  success: (text: string, title?: string) => useToastStore.getState().push({ text, tone: 'success', title }),
  error: (text: string, title?: string) => useToastStore.getState().push({ text, tone: 'danger', title }),
  warning: (text: string, title?: string) => useToastStore.getState().push({ text, tone: 'warning', title }),
  info: (text: string, title?: string) => useToastStore.getState().push({ text, tone: 'info', title }),
};

function ToastCard({ item }: { item: ToastItem }) {
  const { c } = useTheme();
  const remove = useToastStore((s) => s.remove);
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    p.value = reduce ? 1 : withTiming(1, { duration: DUR.state, easing: EASE_STATE });
    const t = setTimeout(() => { p.value = withTiming(0, { duration: DUR.state, easing: EASE_STATE }); setTimeout(() => remove(item.id), DUR.state); }, 3200);
    return () => clearTimeout(t);
  }, [item.id, p, reduce, remove]);
  const s = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * -12 }] }));
  const { ink, solid } = toneColors(c, item.tone);
  const ICON: Record<Tone, IconName> = { neutral: 'info', brand: 'info', success: 'circle-check', warning: 'triangle-alert', danger: 'circle-alert', info: 'info' };
  const icon = ICON[item.tone];
  return (
    <Animated.View accessibilityLiveRegion="polite" style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.bgSurface, borderRadius: radius.card, borderWidth: size.hairline, borderColor: c.borderDefault, padding: space.md, paddingRight: space.xs }, shadow.pop, s]}>
      <View style={{ width: size.iconTileSm, height: size.iconTileSm, borderRadius: radius.md, backgroundColor: item.tone === 'neutral' ? c.bgMuted : toneColors(c, item.tone).bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={item.tone === 'neutral' ? c.textBody : ink} />
      </View>
      <View style={{ flex: 1 }}>
        {item.title ? <Txt v="bodyStrong" numberOfLines={1}>{item.title}</Txt> : null}
        <Txt v="bodySm" numberOfLines={3}>{item.text}</Txt>
      </View>
      <IconButton icon="x" label={i18n.t('ui.close')} onPress={() => remove(item.id)} tone="muted" size={size.touch - space.sm} />
      <View style={{ position: 'absolute', left: 0, top: space.md, bottom: space.md, width: 3, borderRadius: radius.pill, backgroundColor: item.tone === 'neutral' ? 'transparent' : solid, opacity: 0 }} />
    </Animated.View>
  );
}

/** Ildiz maketiga bir marta qo'yiladi. */
export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const insets = useSafeAreaInsets();
  if (!items.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, gap: space.sm }}>
      {items.map((i) => <ToastCard key={i.id} item={i} />)}
    </View>
  );
}

// ───────────────────────── Grafiklar ─────────────────────────

export type ChartTone = 'chart1' | 'chart2' | 'chart3' | 'chart4' | 'muted';
const chartColor = (c: Palette, t: ChartTone) => ({ chart1: c.chart1, chart2: c.chart2, chart3: c.chart3, chart4: c.chart4, muted: c.textMuted }[t]);

/** Ustunli grafik — ikki qator (chart-1, chart-2), setka chiziqlari, nuqtalarda raqam yo'q. */
export function BarChart({ data, height = 140 }: { data: { label: string; a: number; b?: number }[]; height?: number }) {
  const { c } = useTheme();
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b ?? 0]));
  const plot = height - space.xl;
  return (
    <View accessibilityRole="image" accessibilityLabel="Ustunli grafik">
      <View style={{ height: plot, justifyContent: 'space-between', position: 'absolute', left: 0, right: 0, top: 0 }}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={{ height: size.hairline, backgroundColor: c.chartGrid }} />)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: space.sm }}>
        {data.map((d) => (
          <View key={d.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: plot }}>
              <View style={{ width: d.b === undefined ? space.xl : space.md, height: Math.max(2, (plot * d.a) / max), borderTopLeftRadius: radius.xs, borderTopRightRadius: radius.xs, backgroundColor: c.chart1 }} />
              {d.b !== undefined ? <View style={{ width: space.md, height: Math.max(2, (plot * d.b) / max), borderTopLeftRadius: radius.xs, borderTopRightRadius: radius.xs, backgroundColor: c.chart2 }} /> : null}
            </View>
            <Txt v="caption" style={{ marginTop: space.xs }} numberOfLines={1}>{d.label}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Legend({ items }: { items: { label: string; tone: ChartTone }[] }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap', marginTop: space.md }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
          <View style={{ width: size.dot + 2, height: size.dot + 2, borderRadius: radius.xs / 2, backgroundColor: chartColor(c, i.tone) }} />
          <Txt v="caption">{i.label}</Txt>
        </View>
      ))}
    </View>
  );
}

/** Gorizontal taqsimot — 4 qator + "Boshqa" (beshinchi rang yo'q). */
export function Breakdown({ rows, total }: { rows: { label: string; value: number }[]; total?: number }) {
  const { c } = useTheme();
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((s, r) => s + r.value, 0);
  const shown = rest > 0 ? [...top, { label: i18n.t('ui.other'), value: rest }] : top;
  const sum = (total ?? shown.reduce((s, r) => s + r.value, 0)) || 1;
  const tones: ChartTone[] = ['chart1', 'chart2', 'chart3', 'chart4', 'muted'];
  return (
    <View>
      <View style={{ flexDirection: 'row', height: space.sm, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: c.chartTrack, gap: 2 }}>
        {shown.map((r, i) => <View key={r.label} style={{ width: `${(r.value / sum) * 100}%`, backgroundColor: chartColor(c, tones[i]!) }} />)}
      </View>
      {shown.map((r, i) => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', minHeight: size.row - space.md, marginTop: space.sm, gap: space.sm }}>
          <View style={{ width: size.dot + 2, height: size.dot + 2, borderRadius: radius.xs / 2, backgroundColor: chartColor(c, tones[i]!) }} />
          <Txt v="bodySm" style={{ flex: 1 }} numberOfLines={1}>{r.label}</Txt>
          <Txt v="caption">{Math.round((r.value / sum) * 100)}%</Txt>
          <Txt v="bodyStrong">{fmtSum(r.value)}</Txt>
        </View>
      ))}
    </View>
  );
}

export function Stars({ value, size: s = size.iconSm - 2 }: { value: number; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} accessibilityLabel={`Baho ${value.toFixed(1)}`}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name={value >= i - 0.25 ? 'star' : value >= i - 0.75 ? 'star-half' : 'star'} size={s} color={value >= i - 0.75 ? c.brand : c.borderStrong} />)}
      <Txt v="caption" style={{ marginLeft: space.xs }}>{value.toFixed(1)}</Txt>
    </View>
  );
}

/** Holat qatori — ikonka + matn (emoji o'rniga). */
export function StatusLine({ icon, text, tone = 'neutral' }: { icon?: IconName | string; text: string; tone?: Tone }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row - space.sm, paddingVertical: space.xs }}>
      {icon && /^[a-z0-9-]+$/.test(icon) ? <Icon name={icon} tone={tone === 'neutral' ? 'muted' : tone} /> : <StatusDot tone={tone} />}
      <Txt v="bodySm" style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

// ───────────────────────── Formatlash ─────────────────────────

export const fmtShort = (n: number | string) => { const v = Number(n); return v >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)} mlrd` : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(v >= 100_000_000 ? 0 : 1)} mln` : v >= 1_000 ? `${Math.round(v / 1_000)} ming` : String(Math.round(v)); };
export const fmtRel = (d: string | Date) => { const ms = Date.now() - new Date(d).getTime(); const m = Math.round(ms / 60_000); if (m < 1) return 'hozir'; if (m < 60) return `${m} daq`; const h = Math.round(m / 60); if (h < 24) return `${h} soat`; const dd = Math.round(h / 24); return dd === 1 ? 'kecha' : `${dd} kun`; };
/** Ixcham pul: "4.9 mln so'm". */
export const fmtShortSum = (n: number | string) => `${fmtShort(n)} so'm`;
export const daysLeft = (d?: string | null) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) : null);

export { ProgressBar } from './primitives';
export { duration };
