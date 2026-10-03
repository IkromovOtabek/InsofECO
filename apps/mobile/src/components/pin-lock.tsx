import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Txt } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space } from '@/design/tokens';
import { Appear, haptic } from '@/design/motion';
import { Avatar, Icon, dialog } from '@/design/ui';
import { PIN_LEN, pinStore } from '@/core/pin';
import { useDisplayName, useSession } from '@/core/session';
import { avatarUri } from '@/features/auth/api';
import { TextLink } from '@/features/auth/ui';

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
    <Animated.View style={[{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }, st]} accessibilityLabel={`${filled} ta raqam kiritildi, ${length} tadan`}>
      {Array.from({ length }, (_, i) => (
        <View key={i} style={{ width: space.lg, height: space.lg, borderRadius: radius.pill, borderWidth: size.ring, borderColor: i < filled ? on : c.borderStrong, backgroundColor: i < filled ? on : 'transparent' }} />
      ))}
    </Animated.View>
  );
});

const KEY = size.driverTouch + space.sm;

/** Dumaloq raqamli klaviatura — 3×4; chap pastki katak ixtiyoriy (`extra`), o'ng pastda o'chirish. */
export function RoundKeypad({ onDigit, onDelete, extra }: { onDigit: (d: string) => void; onDelete: () => void; extra?: React.ReactNode }) {
  const { c } = useTheme();
  const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['extra', '0', 'del']];
  return (
    <View style={{ gap: space.md, alignItems: 'center' }}>
      {rows.map((r) => (
        <View key={r.join('')} style={{ flexDirection: 'row', gap: space.xl }}>
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
                  !del && [{ backgroundColor: c.bgSurface }, shadow.card],
                  pressed && { backgroundColor: c.bgMuted, transform: [{ scale: 0.94 }] },
                ]}
              >
                {del ? <Icon name="delete" size={size.iconLg} tone="muted" /> : <Txt v="metric">{k}</Txt>}
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
      dialog("PIN o'chirildi", 'Kod bir necha marta xato kiritildi. Parol bilan qaytadan kiring.', [
        { text: 'Kirish', onPress: () => { setLocked(false); void signOut(); } },
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
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bgApp, paddingHorizontal: space.xxl, paddingTop: insets.top + space.x10, paddingBottom: insets.bottom + space.lg }]}>
      <Appear style={{ alignItems: 'center' }}>
        <Avatar name={name ?? undefined} uri={avatar} size={size.avatarLg + space.xs} tone="brand" />
        <Txt v="titleLg" align="center" style={{ marginTop: space.lg }}>{first ? `Salom, ${first}` : 'Xush kelibsiz'}</Txt>
        <Txt v="bodySm" color="muted" align="center" style={{ marginTop: space.xs }}>PIN kodni kiriting</Txt>
      </Appear>
      <Appear delay={60} style={{ marginTop: space.x7 }}>
        <ShakeDots ref={dots} filled={pin.length} length={PIN_LEN} error={!!error} />
      </Appear>
      <View style={{ minHeight: space.xl, marginTop: space.md, alignItems: 'center' }} accessibilityLiveRegion="polite">
        <Txt v="caption" color={error ? 'danger' : 'faint'}>{error ?? (pin.length === PIN_LEN ? 'Tekshirilmoqda…' : ' ')}</Txt>
      </View>
      <Appear delay={120} style={{ marginTop: space.lg }}>
        <RoundKeypad onDigit={tap} onDelete={() => { setPin((p) => p.slice(0, -1)); setError(undefined); }} />
      </Appear>
      <Appear delay={180} style={{ marginTop: 'auto', flexDirection: 'row', justifyContent: 'center', gap: space.xl, paddingTop: space.lg }}>
        <TextLink onPress={forgot}>PIN esdan chiqdimi?</TextLink>
        <TextLink onPress={() => { setLocked(false); void signOut(); }}>Boshqa hisob</TextLink>
      </Appear>
    </View>
  );
}
