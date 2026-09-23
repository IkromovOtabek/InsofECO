import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { erpText } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { PIN_LEN, pinStore } from '@/core/pin';
import { useSession } from '@/core/session';
import { D, PinDots, PinKeypad } from '@/features/auth/ui';

/**
 * PIN qulfi — ilova ochilganda hisob ustida turadi.
 *
 * PIN o'rnatilgan bo'lsa va sessiya tiklangan bo'lsa, ekranlar chizilishidan oldin
 * shu qatlam ko'rinadi. Kod besh marta xato kiritilsa PIN o'chadi va
 * foydalanuvchi parol bilan qaytadan kiradi.
 */
export function PinLock() {
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
      Alert.alert('PIN o\'chirildi', 'Kod bir necha marta xato kiritildi. Parol bilan qaytadan kiring.', [
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
    <View style={[StyleSheet.absoluteFill, { backgroundColor: D.bg, paddingHorizontal: 26, paddingTop: insets.top + 60, paddingBottom: insets.bottom + 26 }]}>
      <Appear style={{ alignItems: 'center' }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock-closed-outline" size={24} color={D.accent} />
        </View>
        <Txt style={{ fontFamily: erpText.title.fontFamily, fontSize: 27, letterSpacing: -0.5, color: D.text, marginTop: 20 }}>PIN kodni kiriting</Txt>
        <Txt style={{ fontSize: 13.5, color: D.muted, marginTop: 8 }}>Ilovaga kirish uchun</Txt>
      </Appear>

      <Appear delay={90} style={{ marginTop: 28 }}>
        <PinDots filled={pin.length} length={PIN_LEN} />
      </Appear>

      <View style={{ minHeight: 20, marginTop: 14, alignItems: 'center' }}>
        <Txt style={{ ...erpText.label, fontSize: 12.5, color: error ? D.danger : D.faint }}>
          {error ?? (pin.length === PIN_LEN ? 'Tekshirilmoqda…' : `${PIN_LEN - pin.length} ta raqam qoldi`)}
        </Txt>
      </View>

      <Appear delay={140} style={{ marginTop: 20 }}>
        <PinKeypad onDigit={tap} onDelete={() => { setPin((p) => p.slice(0, -1)); setError(undefined); }} />
      </Appear>

      <Appear delay={200} style={{ marginTop: 'auto', alignItems: 'center', paddingTop: 20 }}>
        <Txt onPress={() => { setLocked(false); void signOut(); }} style={{ ...erpText.label, fontSize: 13, color: D.muted }}>
          Boshqa hisob bilan kirish
        </Txt>
      </Appear>
    </View>
  );
}
