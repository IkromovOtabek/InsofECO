import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconTile, Txt } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { PIN_LEN, pinStore } from '@/core/pin';
import { useSession } from '@/core/session';
import { PinDots, PinKeypad, TextLink } from '@/features/auth/ui';

/**
 * PIN qulfi — ilova ochilganda hisob ustida turadi.
 * Kod besh marta xato kiritilsa PIN o'chadi va foydalanuvchi parol bilan qaytadan kiradi.
 */
export function PinLock() {
  const { c } = useTheme();
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);
  const [locked, setLocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string>();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'anon') { setLocked(false); return; }
    void pinStore.has().then((has) => setLocked(has));
  }, [status]);

  const submit = async (code: string) => {
    const r = await pinStore.verify(code);
    setPin('');
    if (r.ok) { setLocked(false); return; }
    if (r.wiped) {
      Alert.alert("PIN o'chirildi", 'Kod bir necha marta xato kiritildi. Parol bilan qaytadan kiring.', [
        { text: 'Kirish', onPress: () => { setLocked(false); void signOut(); } },
      ]);
      return;
    }
    setError(`Kod xato — yana ${r.left} urinish qoldi`);
  };

  const tap = (d: string) => {
    if (pin.length >= PIN_LEN) return;
    const next = pin + d;
    setPin(next);
    setError(undefined);
    if (next.length === PIN_LEN) void submit(next);
  };

  if (!locked) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bgApp, paddingHorizontal: space.xxl, paddingTop: insets.top + space.x12, paddingBottom: insets.bottom + space.xxl }]}>
      <Appear style={{ alignItems: 'center' }}>
        <IconTile icon="lock" />
        <Txt v="titleLg" style={{ marginTop: space.xl }}>PIN kodni kiriting</Txt>
        <Txt v="bodySm" color="muted" style={{ marginTop: space.sm }}>Ilovaga kirish uchun</Txt>
      </Appear>
      <Appear delay={60} style={{ marginTop: space.x7 }}>
        <PinDots filled={pin.length} length={PIN_LEN} />
      </Appear>
      <View style={{ minHeight: space.xl, marginTop: space.md, alignItems: 'center' }}>
        <Txt v="caption" color={error ? 'danger' : 'faint'}>{error ?? (pin.length === PIN_LEN ? 'Tekshirilmoqda…' : `${PIN_LEN - pin.length} ta raqam qoldi`)}</Txt>
      </View>
      <Appear delay={120} style={{ marginTop: space.xl }}>
        <PinKeypad onDigit={tap} onDelete={() => { setPin((p) => p.slice(0, -1)); setError(undefined); }} />
      </Appear>
      <Appear delay={180} style={{ marginTop: 'auto', alignItems: 'center', paddingTop: space.xl }}>
        <TextLink onPress={() => { setLocked(false); void signOut(); }}>Boshqa hisob bilan kirish</TextLink>
      </Appear>
    </View>
  );
}
