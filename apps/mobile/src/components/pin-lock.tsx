import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Txt } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { DEMO_SCALE, elevation, radius, size, space } from '@/design/tokens';
import { Appear, haptic } from '@/design/motion';
import { Avatar, Icon, dialog } from '@/design/ui';
import { PIN_LEN, pinStore } from '@/core/pin';
import { useDisplayName, useSession } from '@/core/session';
import { avatarUri } from '@/features/auth/api';

/** Ilova orqa fonda shuncha turgach qaytsa — PIN qayta so'raladi. */
const RELOCK_AFTER_MS = 60_000;

// ───────────────────────── PIN bo'laklari (qulf va /(auth)/pin uchun umumiy) ─────────────────────────

export interface PinDotsHandle { shake: () => void }

/** PIN nuqtalari — to'lganlari brend rangida; `shake()` xato kodda chapga-o'ngga silkitadi. */
export const ShakeDots = React.forwardRef<PinDotsHandle, { filled: number; length: number; error?: boolean }>(function ShakeDots({ filled, length, error }, ref) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const x = useSharedValue(0);
  useImperativeHandle(ref, () => ({
    shake: () => {
      if (reduce) return;
      x.value = withSequence(withTiming(-space.md, { duration: 50 }), withRepeat(withTiming(space.md, { duration: 90 }), 3, true), withTiming(0, { duration: 60 }));
    },
  }), [reduce, x]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const on = error ? c.dangerSolid : c.brand;
  return (
    <Animated.View style={[{ flexDirection: 'row', justifyContent: 'center', gap: DOT_GAP }, st]} accessibilityLabel={`${filled} ta raqam kiritildi, ${length} tadan`}>
      {Array.from({ length }, (_, i) => (
        <View key={i} style={{ width: DOT, height: DOT, borderRadius: radius.pill, borderWidth: size.ring, borderColor: i < filled ? on : c.borderStrong, backgroundColor: i < filled ? on : 'transparent' }} />
      ))}
    </Animated.View>
  );
});

/** Demo `.key` — 58 css doira; `.keypad` gap 10×18 css. */
const KEY = Math.round(58 * DEMO_SCALE);
const KEY_GAP_X = Math.round(18 * DEMO_SCALE);
/** Demo `.pdots i` — 13 css, gap 14 css. */
const DOT = Math.round(13 * DEMO_SCALE);
const DOT_GAP = Math.round(14 * DEMO_SCALE);

/**
 * Dumaloq raqamli klaviatura — demo `.keypad`: 3×4, yuza doiralar (sh1), bosilganda brandSoft + 0.9.
 * Chap pastki katak ixtiyoriy (`extra` — masalan Face ID; bo'lmasa bo'sh), o'ng pastda shaffof "orqaga" tugmasi.
 */
export function RoundKeypad({ onDigit, onDelete, extra }: { onDigit: (d: string) => void; onDelete: () => void; extra?: React.ReactNode }) {
  const { c } = useTheme();
  const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['extra', '0', 'del']];
  return (
    <View style={{ gap: space.stack, alignItems: 'center' }}>
      {rows.map((r) => (
        <View key={r.join('')} style={{ flexDirection: 'row', gap: KEY_GAP_X }}>
          {r.map((k) => {
            if (k === 'extra') return <View key={k} style={{ width: KEY, height: KEY, alignItems: 'center', justifyContent: 'center' }}>{extra}</View>;
            const del = k === 'del';
            return (
              <Pressable
                key={k}
                onPress={() => { haptic.selection(); if (del) onDelete(); else onDigit(k); }}
                accessibilityRole="button"
                accessibilityLabel={del ? "Oxirgi raqamni o'chirish" : k}
                android_ripple={{ color: c.bgMuted, borderless: true }}
                style={({ pressed }) => [
                  { width: KEY, height: KEY, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
                  !del && [{ backgroundColor: c.bgSurface }, elevation(c).sh1],
                  pressed && { backgroundColor: del ? c.bgMuted : c.brandSoft, transform: [{ scale: 0.9 }] },
                ]}
              >
                {del ? <Icon name="chevron-left" size={size.iconXl} tone="muted" strokeWidth={1.75} /> : <Txt v="titleLg">{k}</Txt>}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── Qulf ─────────────────────────

/**
 * PIN qulfi — ilova ochilganda hisob ustida turadi, ilova orqa fonda bir daqiqadan ko'p
 * turib qaytganda ham qayta qulflanadi. Kod besh marta xato kiritilsa PIN o'chadi va
 * foydalanuvchi parol bilan qaytadan kiradi.
 */
export function PinLock() {
  const { c } = useTheme();
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);
  const name = useDisplayName();
  const avatar = useSession((s) => (s.kind === 'eco' ? avatarUri(s.user?.avatarUrl) : null));
  const [locked, setLocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string>();
  const insets = useSafeAreaInsets();
  const dots = useRef<PinDotsHandle>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'anon') { setLocked(false); return; }
    void pinStore.has().then((has) => setLocked(has));
  }, [status]);

  // Orqa fondan qaytish: uzoq turgan bo'lsa (va PIN o'rnatilgan bo'lsa) qayta qulflanadi
  const leftAt = useRef<number | null>(null);
  useEffect(() => {
    if (status !== 'authed') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') { leftAt.current = Date.now(); return; }
      if (s === 'active' && leftAt.current != null) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (away >= RELOCK_AFTER_MS) void pinStore.has().then((has) => { if (has) { setPin(''); setError(undefined); setLocked(true); } });
      }
    });
    return () => sub.remove();
  }, [status]);

  const submit = async (code: string) => {
    const r = await pinStore.verify(code);
    if (r.ok) { haptic.success(); setPin(''); setLocked(false); return; }
    haptic.error();
    dots.current?.shake();
    if (r.wiped) {
      setPin('');
      // Chiqish darhol — dialog tugmasini kutmaymiz: ilova shu yerda yopilsa PIN allaqachon o'chgan,
      // sessiya esa qolgan bo'lardi va keyingi ochilishda ilova PINsiz to'g'ridan-to'g'ri ochilardi.
      void signOut();
      dialog("PIN o'chirildi", 'Kod bir necha marta xato kiritildi. Parol bilan qaytadan kiring.', [
        { text: 'Kirish', onPress: () => setLocked(false) },
      ], { tone: 'danger', icon: 'lock' });
      return;
    }
    setError(`Kod xato — yana ${r.left} urinish qoldi`);
    // Silkinish ko'rinsin, keyin nuqtalar bo'shaydi
    setTimeout(() => setPin(''), 380);
  };

  const tap = (d: string) => {
    if (pin.length >= PIN_LEN) return;
    const next = pin + d;
    setPin(next);
    setError(undefined);
    if (next.length === PIN_LEN) void submit(next);
  };

  const forgot = () => dialog('PIN esdan chiqdimi?', "Hisobdan chiqib, parol (yoki Telegram yoki SMS kodi) bilan qaytadan kiring. Keyin yangi PIN o'rnatishingiz mumkin.", [
    { text: 'Bekor', style: 'cancel' },
    { text: 'Chiqish', style: 'destructive', onPress: () => { setLocked(false); void signOut(); } },
  ]);

  if (!locked) return null;

  const first = name?.split(' ')[0];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bgApp, alignItems: 'center', paddingHorizontal: space.xxl, paddingTop: insets.top + space.x10, paddingBottom: insets.bottom + space.lg, gap: space.xl }]}>
      <Appear style={{ alignItems: 'center', gap: space.xl }}>
        {avatar ? <Avatar name={name ?? undefined} uri={avatar} size={AV} /> : (
          <View accessibilityElementsHidden style={{ width: AV, height: AV, borderRadius: radius.pill, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="titleLg" style={{ color: c.brandInk }}>{initials(name)}</Txt>
          </View>
        )}
        <View style={{ alignItems: 'center' }}>
          <Txt v="titleMd" align="center" accessibilityRole="header">{first ? `Salom, ${first}` : 'Xush kelibsiz'}</Txt>
          <Txt v="tSm" align="center">PIN kodni kiriting</Txt>
        </View>
      </Appear>
      <Appear delay={60} style={{ alignItems: 'center' }}>
        <ShakeDots ref={dots} filled={pin.length} length={PIN_LEN} error={!!error} />
        {error ? <Txt v="caption" color="danger" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: DOT + space.sm, width: KEY * 4 }} align="center">{error}</Txt> : null}
      </Appear>
      <Appear delay={120} style={{ marginTop: error ? space.md : 0 }}>
        <RoundKeypad onDigit={tap} onDelete={() => { setPin((p) => p.slice(0, -1)); setError(undefined); }} />
      </Appear>
      <Appear delay={180} style={{ flexDirection: 'row', justifyContent: 'center', gap: KEY_GAP_X }}>
        <LockLink onPress={forgot} tone="brand">PIN esdan chiqdimi?</LockLink>
        <LockLink onPress={() => { setLocked(false); void signOut(); }} tone="muted">Boshqa hisob</LockLink>
      </Appear>
    </View>
  );
}

/** Demo `.av` 58 css — qulf ekrani avatari. */
const AV = Math.round(58 * DEMO_SCALE);
const initials = (n?: string | null) => (n ?? '?').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

/** Qulf pastidagi havola — 10.5 css 700: brandInk yoki textMuted. */
function LockLink({ children, onPress, tone }: { children: string; onPress: () => void; tone: 'brand' | 'muted' }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={space.sm} style={({ pressed }) => [{ minHeight: size.touch, justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
      <Txt v="bodyStrong" color={tone}>{children}</Txt>
    </Pressable>
  );
}
