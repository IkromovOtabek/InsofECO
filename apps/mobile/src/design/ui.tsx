/**
 * Yuqori darajali komponentlar (primitives ustida): Avatar, Tabs, Table, Modal, Sheet, Toast,
 * grafiklar, HeaderBack. Native <Modal> Fabric'da ko'rinmaydi — Modal/Sheet daraxt ichida chiziladi.
 */
import React, { useEffect, useState } from 'react';
import { BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import i18n from '@/core/i18n';
import { useTheme } from './theme';
import { Icon, IconName } from './icons';
import { StatusMark, SuccessCheck } from './success';
import { DUR, EASE_STATE } from './motion';
import { Palette, Tone, duration, radius, shadow, size, space, textRoom, toneColors, type } from './tokens';
import { Badge, Button, IconButton, StatusDot, Txt, fmtDate, fmtSum } from './primitives';

export { Icon, resolveIcon } from './icons';
export type { IconName } from './icons';

/** Tab navigatorlarda push qilingan ekranlar uchun orqaga tugmasi. */
export function HeaderBack() {
  const router = useRouter();
  return <IconButton icon="arrow-left" label={i18n.t('ui.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('..'))} tone="strong" />;
}

/** Tab ikonkasi — Lucide; faol holatda chiziq qalinroq. */
export const tabIcon = (name: IconName) => ({ color, focused }: { color: string; focused: boolean }) => <Icon name={name} size={size.iconLg} color={color} strokeWidth={focused ? 2 : 1.5} />;

export function Avatar({ name, uri, size: s = size.avatar, tone = 'neutral' }: { name?: string | null; /** Profil rasmi — bo'lsa bosh harflar o'rniga */ uri?: string | null; size?: number; tone?: Tone }) {
  const { c } = useTheme();
  if (uri) return <Image source={{ uri }} accessibilityLabel={name ?? undefined} accessibilityIgnoresInvertColors style={{ width: s, height: s, borderRadius: radius.pill, backgroundColor: c.bgMuted }} />;
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
        <Txt v="label" color={on ? 'strong' : 'muted'} numberOfLines={1} style={{ minWidth: textRoom(s.label, type.label.fontSize) }}>{s.label}</Txt>
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

// ───────────────────────── Modal / Sheet / Dialog ─────────────────────────
//
// Barcha oynalar bitta uslubda (Dribbble "Success modal" asosida): chegara chiziqlarisiz katta
// yumaloq karta, tepada holat belgisi, markazda sarlavha, pastda to'liq enli katta tugmalar.
//
// MUHIM: faqat fon (parda) animatsiyalanadi. Tugmasi bor karta/varaq — oddiy `View`: Fabric'da
// Reanimated uslubli konteyner ichidagi `Pressable` bosilmay qolardi yoki bosish fonga o'tib ketardi.

/** Apparat "orqaga" tugmasi (Android) oynani yopadi. */
function useBackClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [open, onClose]);
}

/** Qoraytirilgan fon — ochilganda 200 ms da paydo bo'ladi, bosilsa `onPress`. */
function Scrim({ onPress }: { onPress?: () => void }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => { if (!reduce) p.value = withTiming(1, { duration: DUR.state, easing: EASE_STATE }); }, [p, reduce]);
  const s = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, s]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} disabled={!onPress} accessibilityLabel={i18n.t('ui.close')} />
    </Animated.View>
  );
}

/** Markazdagi karta ramkasi: fon + xavfsiz hudud ichida, uzun bo'lsa ichi aylanadi. */
function DialogFrame({ onDismiss, children }: { onDismiss?: () => void; children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Scrim onPress={onDismiss} />
      <KeyboardAvoidingView
        pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', paddingHorizontal: space.lg, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}
      >
        <View accessibilityViewIsModal accessibilityLiveRegion="polite" style={[{ backgroundColor: c.bgSurface, borderRadius: radius.xl * 2, width: '100%', maxWidth: 420, maxHeight: '100%', alignSelf: 'center', overflow: 'hidden' }, shadow.pop]}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xxl, paddingTop: space.xxl + space.xs }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Sarlavha bloki: holat belgisi (ixtiyoriy) + markazda sarlavha + izoh. */
function DialogHead({ tone, icon, title, message }: { tone?: Tone; icon?: IconName; title: string; message?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {tone ? (tone === 'success' && !icon ? <SuccessCheck size={104} /> : <StatusMark tone={tone} icon={icon} size={88} />) : null}
      <Txt v="titleLg" align="center" style={{ marginTop: tone ? space.lg : 0 }}>{title}</Txt>
      {message ? <Txt v="body" color="muted" align="center" style={{ marginTop: space.sm }}>{message}</Txt> : null}
    </View>
  );
}

/** Pastdan chiqadigan varaq (mobil). Sarlavha doim ko'rinadi, ichi aylanadi, pastda footer. */
export function Sheet({ open, onClose, title, children, footer, maxHeight = '88%' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; maxHeight?: `${number}%` }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  useBackClose(open, onClose);
  if (!open) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Scrim onPress={onClose} />
      <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
        <View accessibilityViewIsModal style={[{ backgroundColor: c.bgSurface, borderTopLeftRadius: radius.xl * 2, borderTopRightRadius: radius.xl * 2, paddingBottom: insets.bottom + space.lg, maxHeight }, shadow.pop]}>
          <View style={{ alignSelf: 'center', width: space.x10, height: space.xs + 1, borderRadius: radius.pill, backgroundColor: c.bgMuted, marginTop: space.md }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: space.xxl, paddingRight: space.lg, paddingTop: space.md, paddingBottom: space.sm }}>
            <Txt v="titleLg" style={{ flex: 1 }} numberOfLines={2}>{title}</Txt>
            <IconButton icon="x" label={i18n.t('ui.close')} onPress={onClose} variant="secondary" size={size.touch - space.xs} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.xxl, paddingVertical: space.sm }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {footer ? <View style={{ paddingHorizontal: space.xxl, paddingTop: space.md }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Markazdagi oyna — tasdiq va qisqa forma. `tone`/`icon` berilsa tepada holat belgisi chiqadi.
 * `actions` — tugmalar ustunda, to'liq enli (asosiy — tepada, "Bekor" — pastda).
 */
export function Modal({ open, onClose, title, message, tone, icon, children, actions }: { open: boolean; onClose: () => void; title?: string; message?: string; tone?: Tone; icon?: IconName; children?: React.ReactNode; actions?: React.ReactNode }) {
  useBackClose(open, onClose);
  if (!open) return null;
  return (
    <DialogFrame onDismiss={onClose}>
      {title ? <DialogHead tone={tone} icon={icon} title={title} message={message} /> : null}
      {children ? <View style={{ marginTop: title ? space.lg : 0, gap: space.lg }}>{children}</View> : null}
      {actions ? <View style={{ marginTop: space.xxl, gap: space.sm }}>{actions}</View> : null}
    </DialogFrame>
  );
}

/** Tasdiq oynasi — belgi + matn + katta Tasdiq / Bekor. */
export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel = i18n.t('ui.confirm'), danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: string; confirmLabel?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal
      open={open} onClose={onClose} title={title} message={message}
      tone={danger ? 'danger' : 'brand'} icon={danger ? 'triangle-alert' : 'circle-question-mark'}
      actions={<>
        <Button title={confirmLabel} size="lg" variant={danger ? 'danger' : 'primary'} loading={loading} onPress={onConfirm} />
        <Button title={i18n.t('ui.cancel')} size="lg" variant="ghost" onPress={onClose} />
      </>}
    />
  );
}

// ── dialog() — `Alert.alert` o'rnini bosadi ──
// Tizim oynasi o'rniga ilovaning o'z oynasi: dizayn bir xil, Fabric'da ko'rinmay qolish muammosi yo'q.
// Imzo `Alert.alert` bilan bir xil — almashtirish uchun faqat nomi o'zgaradi.

export interface DialogButton { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }
export interface DialogOptions { cancelable?: boolean; onDismiss?: () => void; tone?: Tone; icon?: IconName }
interface DialogItem { id: number; title: string; message?: string; buttons: DialogButton[]; opts: DialogOptions }
let dialogSeq = 0;
const useDialogStore = create<{ queue: DialogItem[]; push: (d: Omit<DialogItem, 'id'>) => void; pop: (id: number) => void }>((set) => ({
  queue: [],
  push: (d) => set((s) => ({ queue: [...s.queue, { ...d, id: ++dialogSeq }] })),
  pop: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
}));

/** `dialog('Saqlandi', 'Parol o\'zgartirildi', [{ text: 'OK', onPress }])` — `Alert.alert` bilan bir xil. */
export function dialog(title: string, message?: string, buttons?: DialogButton[], opts: DialogOptions = {}) {
  useDialogStore.getState().push({ title, message, buttons: buttons?.length ? buttons : [{ text: i18n.t('ui.close') }], opts });
}

/** Sarlavha/tugmalarga qarab belgi: xavfli amal → qizil, "Bajarildi" → ptichka, ogohlantirish → sariq. */
function autoTone(d: DialogItem): { tone: Tone; icon?: IconName } {
  if (d.opts.tone) return { tone: d.opts.tone, icon: d.opts.icon };
  if (d.buttons.some((b) => b.style === 'destructive')) return { tone: 'danger', icon: 'triangle-alert' };
  const t = d.title.toLowerCase();
  if (/bajarildi|saqlandi|tayyor|yuborildi|qabul qilindi|muvaffaq/.test(t)) return { tone: 'success' };
  if (/diqqat|xato|topilmadi|o'chirildi|muammo|e'tiroz|bajarilmadi/.test(t)) return { tone: 'warning', icon: 'triangle-alert' };
  return { tone: 'brand', icon: d.opts.icon ?? (d.buttons.length > 1 ? 'circle-question-mark' : 'info') };
}

/** Ildiz maketiga bir marta qo'yiladi (PIN qulfidan keyin — undagi oynalar ham ustida chiqsin). */
export function DialogHost() {
  const d = useDialogStore((s) => s.queue[0]);
  const pop = useDialogStore((s) => s.pop);
  const run = (b?: DialogButton) => { if (!d) return; pop(d.id); b?.onPress?.(); };
  const dismiss = () => {
    if (!d || d.opts.cancelable === false) return;
    const cancel = d.buttons.find((b) => b.style === 'cancel') ?? (d.buttons.length === 1 ? d.buttons[0] : undefined);
    if (cancel) run(cancel); else { pop(d.id); d.opts.onDismiss?.(); }
  };
  useBackClose(!!d, dismiss);
  if (!d) return null;
  const { tone, icon } = autoTone(d);
  const main = d.buttons.filter((b) => b.style !== 'cancel');
  const cancel = d.buttons.filter((b) => b.style === 'cancel');
  const many = main.length > 2;
  return (
    <DialogFrame key={d.id} onDismiss={dismiss}>
      <DialogHead tone={tone} icon={icon} title={d.title} message={d.message} />
      <View style={{ marginTop: space.xxl, gap: space.sm }}>
        {main.map((b, i) => (
          <Button
            key={`${i}-${b.text}`} title={b.text ?? 'OK'} size="lg"
            variant={b.style === 'destructive' ? 'danger' : many || i > 0 ? 'secondary' : 'primary'}
            onPress={() => run(b)}
          />
        ))}
        {cancel.map((b, i) => <Button key={`c${i}`} title={b.text ?? i18n.t('ui.cancel')} size="lg" variant="ghost" onPress={() => run(b)} />)}
      </View>
    </DialogFrame>
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
      <View style={{ width: size.iconTileSm, height: size.iconTileSm, alignItems: 'center', justifyContent: 'center' }}>
        {item.tone === 'success' ? <SuccessCheck size={size.iconTileSm} /> : <Icon name={icon} color={item.tone === 'neutral' ? c.textBody : ink} />}
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

// ───────────────────────── Natija oynasi ─────────────────────────

interface ResultState { open: boolean; seq: number; tone: 'success' | 'danger'; title: string; subtitle?: string; onDone?: () => void }
const useResultStore = create<ResultState & { show: (s: Omit<ResultState, 'open' | 'seq'>) => void; close: () => void }>((set, get) => ({
  open: false, seq: 0, tone: 'success', title: '', subtitle: undefined, onDone: undefined,
  // `seq` — har ko'rsatishda yangi: oyna ochiq turganda yana chaqirilsa ham ptichka boshidan o'ynaydi
  show: (s) => set((st) => ({ ...s, open: true, seq: st.seq + 1 })),
  close: () => { const { onDone } = get(); set((s) => ({ ...s, open: false })); onDone?.(); },
}));
/**
 * Amal yakunlangach o'rtada chiqadigan katta natija oynasi — muvaffaqiyat yoki xato. O'zi yopiladi.
 * Ekran davomida navigatsiya qilishi kerak bo'lsa (masalan yangi kartochkani ochish), buni
 * `onDone` orqali qiladi — oyna yopilgach chaqiriladi, foydalanuvchi natijani o'qib ulguradi.
 * `result.success('Ochildi', 'Z-2026-00027')`, `result.error('Bajarilmadi', xabar)`.
 */
export const result = {
  success: (title: string, subtitle?: string, onDone?: () => void) => useResultStore.getState().show({ tone: 'success', title, subtitle, onDone }),
  error: (title: string, subtitle?: string, onDone?: () => void) => useResultStore.getState().show({ tone: 'danger', title, subtitle, onDone }),
};

/** Ildiz maketiga `ToastHost` bilan yonma-yon qo'yiladi. */
export function ResultHost() {
  const { open, seq, tone, title, subtitle } = useResultStore();
  const close = useResultStore((s) => s.close);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(close, tone === 'danger' ? 2600 : 1800);
    return () => clearTimeout(t);
  }, [open, seq, tone, close]);
  useBackClose(open, close);
  if (!open) return null;
  return (
    <DialogFrame key={seq} onDismiss={close}>
      <DialogHead tone={tone} title={title} message={subtitle} />
    </DialogFrame>
  );
}

// ───────────────────────── Chek oynasi ─────────────────────────

/** Server `receipt` maydoni bilan bir xil shakl (`@/core/erp` → `Receipt`). */
export interface ReceiptData {
  headline: string;
  caption?: string;
  status: { label: string; tone: 'success' | 'warning'; at: string };
  rows: { label: string; value: string; copy?: boolean }[];
}
const useReceiptStore = create<{ data: ReceiptData | null; seq: number; onDone?: () => void; show: (d: ReceiptData, onDone?: () => void) => void; close: () => void }>((set, get) => ({
  data: null, seq: 0,
  show: (data, onDone) => set((st) => ({ data, onDone, seq: st.seq + 1 })),
  close: () => { const { onDone } = get(); set({ data: null, onDone: undefined }); onDone?.(); },
}));
/**
 * Muhim amal natijasi — "chek" ko'rinishida: katta summa, holat plashkasi, asosiy qatorlar,
 * raqamni nusxalash va "Yopish". O'zi yopilmaydi — foydalanuvchi ma'lumotni o'qib chiqsin.
 * `receipt.show(r.receipt)`.
 */
export const receipt = { show: (d: ReceiptData, onDone?: () => void) => useReceiptStore.getState().show(d, onDone) };

/**
 * `expo-clipboard` native modul — u qo'shilishidan oldingi build'da yo'q. Fayl boshida import qilinsa
 * eski ilova ochilishdayoq yiqiladi, shuning uchun faqat bosilganda yuklanadi.
 */
export async function copyText(text: string) {
  try {
    const Clipboard: typeof import('expo-clipboard') = require('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function ReceiptRow({ label, value, copy }: ReceiptData['rows'][number]) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t); }, [copied]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.touch }}>
      <Txt v="body" color="muted" style={{ flexShrink: 0 }}>{label}</Txt>
      <Txt v="bodyStrong" align="right" numberOfLines={2} style={{ flex: 1 }}>{value}</Txt>
      {copy ? (
        <IconButton
          icon={copied ? 'check' : 'copy'} tone={copied ? 'success' : 'body'} variant="secondary" size={size.touch - space.xs}
          label={copied ? 'Nusxa olindi' : `${label}ni nusxalash`}
          onPress={() => { void copyText(value).then(setCopied); }}
        />
      ) : null}
    </View>
  );
}

/** Ildiz maketiga `ResultHost` bilan yonma-yon qo'yiladi. O'zi yopilmaydi. */
export function ReceiptHost() {
  const { data, seq, close } = useReceiptStore();
  const { c } = useTheme();
  useBackClose(!!data, close);
  if (!data) return null;
  const ok = data.status.tone === 'success';
  const { ink, solid } = toneColors(c, data.status.tone);
  const at = new Date(data.status.at);
  return (
    <DialogFrame key={seq} onDismiss={close}>
      <View style={{ alignItems: 'center' }}>
        {ok ? <SuccessCheck size={112} /> : <StatusMark tone="warning" size={96} />}
        <Txt v="metricHero" align="center" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: space.sm }}>{data.headline}</Txt>
        {data.caption ? <Txt v="body" color="muted" align="center" style={{ marginTop: space.xs }}>{data.caption}</Txt> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, paddingVertical: space.sm, paddingLeft: space.sm, paddingRight: space.md, borderRadius: radius.pill, backgroundColor: c.bgMuted }}>
          <View style={{ width: size.iconTileSm - space.sm, height: size.iconTileSm - space.sm, borderRadius: radius.pill, backgroundColor: solid, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={ok ? 'check' : 'triangle-alert'} size={size.iconSm - 2} color={c.textOnSolid} strokeWidth={3} />
          </View>
          <Txt v="bodyStrong" style={{ color: ink }}>{data.status.label}</Txt>
          <Txt v="body" color="faint">·</Txt>
          <Txt v="body" color="muted">{`${fmtDate(at)}, ${hhmm(at)}`}</Txt>
        </View>
      </View>
      <View style={{ marginTop: space.xl, marginBottom: space.xxl, gap: space.xs }}>
        {data.rows.map((r) => <ReceiptRow key={r.label} {...r} />)}
      </View>
      <Button title="Yopish" size="lg" onPress={close} />
    </DialogFrame>
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
