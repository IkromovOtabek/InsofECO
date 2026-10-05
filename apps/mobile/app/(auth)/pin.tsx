import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Txt } from '@/design/primitives';
import { size, space } from '@/design/tokens';
import { Appear, haptic } from '@/design/motion';
import { SuccessCheck } from '@/design/success';
import { PIN_LEN, pinStore } from '@/core/pin';
import { useSession } from '@/core/session';
import { AuthScreen, PrimaryButton } from '@/features/auth/ui';
import { PinDotsHandle, RoundKeypad, ShakeDots } from '@/components/pin-lock';
import { dialog } from '@/design/ui';

/**
 * PIN kod — tez kirish va xavfsizlik.
 *
 * Uch holatda ishlaydi:
 *   set     — yangi PIN o'rnatish (ikki marta kiritiladi);
 *   unlock  — ilova ochilganda PIN so'rash;
 *   off     — PIN o'chirish (avval joriy PIN so'raladi).
 */
type Mode = 'set' | 'unlock' | 'off';

export default function PinScreen() {
  const { mode: raw } = useLocalSearchParams<{ mode?: Mode }>();
  const mode: Mode = raw === 'unlock' || raw === 'off' ? raw : 'set';
  const router = useRouter();
  const signOut = useSession((s) => s.signOut);

  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const dots = useRef<PinDotsHandle>(null);
  /** Xato: tebranish + silkinish, nuqtalar silkinish tugagach bo'shaydi. */
  const fail = (msg: string, after?: () => void) => {
    haptic.error();
    dots.current?.shake();
    setError(msg);
    setTimeout(() => { setPin(''); after?.(); }, 380);
  };

  const stage = mode === 'set' ? (first ? 'confirm' : 'create') : mode;

  const title = { create: 'Tez kirish uchun PIN', confirm: 'PIN kodni takrorlang', unlock: 'PIN kodni kiriting', off: 'PIN kodni o\'chirish' }[stage];
  const hint = {
    create: `${PIN_LEN} xonali kod o'rnating — keyingi safar parolsiz kirasiz.`,
    confirm: 'Xato bo\'lmasligi uchun yana bir marta kiriting.',
    unlock: 'Ilovaga kirish uchun PIN kodingizni kiriting.',
    off: 'Tasdiqlash uchun joriy PIN kodni kiriting.',
  }[stage];

  const tap = async (d: string) => {
    if (pin.length >= PIN_LEN) return;
    const next = pin + d;
    setPin(next);
    setError(undefined);
    if (next.length === PIN_LEN) await finish(next);
  };

  const finish = async (code: string) => {
    if (mode === 'set') {
      if (!first) { setFirst(code); setPin(''); return; }
      if (first !== code) { fail('Kodlar mos kelmadi — qaytadan kiriting', () => setFirst(null)); return; }
      await pinStore.set(code);
      haptic.success();
      setSaved(true);
      setPin('');
      return;
    }
    const r = await pinStore.verify(code);
    if (r.ok) {
      setPin('');
      if (mode === 'off') { await pinStore.clear(); router.back(); return; }
      router.back();
      return;
    }
    if (r.wiped) {
      haptic.error();
      setPin('');
      // Chiqish darhol (dialogni kutmasdan) — aks holda ilova yopilsa PINsiz sessiya qolardi
      void signOut();
      dialog('PIN o\'chirildi', 'Kod bir necha marta xato kiritildi. Parol bilan qaytadan kiring.', [
        { text: 'Kirish' },
      ]);
      return;
    }
    fail(`Kod xato — yana ${r.left} urinish qoldi`);
  };

  const del = () => { setPin((p) => p.slice(0, -1)); setError(undefined); };

  if (saved) {
    return (
      <AuthScreen back={false}>
        <Appear delay={60} style={{ alignItems: 'center', marginTop: space.x12 + space.xxl }}>
          <SuccessCheck size={size.driverTouch * 2} />
          <Txt v="titleLg" align="center" style={{ marginTop: space.xl }}>PIN saqlandi</Txt>
          <Txt v="bodySm" color="muted" align="center" style={{ marginTop: space.sm }}>
            Keyingi safar ilovani ochganda shu {PIN_LEN} xonali kod so&apos;raladi.
          </Txt>
        </Appear>
        <Appear delay={140} style={{ marginTop: 'auto' }}>
          <PrimaryButton title="Davom etish" onPress={() => router.back()} />
        </Appear>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen back={mode !== 'unlock'}>
      <Appear delay={60} style={{ alignItems: 'center', marginTop: space.xxl }}>
        <Txt v="titleLg" align="center">{title}</Txt>
        <Txt v="bodySm" color="muted" align="center" style={{ marginTop: space.sm }}>{hint}</Txt>
      </Appear>

      <Appear delay={110} style={{ marginTop: space.xxl }}>
        <ShakeDots ref={dots} filled={pin.length} length={PIN_LEN} error={!!error} />
      </Appear>

      <View style={{ minHeight: space.xl, marginTop: space.md, alignItems: 'center' }} accessibilityLiveRegion="polite">
        <Txt v="label" color={error ? 'danger' : 'faint'} align="center">
          {error ?? (pin.length === PIN_LEN ? 'Tekshirilmoqda…' : `${PIN_LEN - pin.length} ta raqam qoldi`)}
        </Txt>
      </View>

      <Appear delay={160} style={{ marginTop: space.xl }}>
        <RoundKeypad onDigit={(d) => void tap(d)} onDelete={del} />
      </Appear>

      {mode === 'set' ? (
        <Appear delay={270} style={{ marginTop: 'auto', paddingTop: space.lg }}>
          <Button title="Keyinroq sozlayman" variant="ghost" onPress={() => router.back()} />
        </Appear>
      ) : null}
    </AuthScreen>
  );
}
