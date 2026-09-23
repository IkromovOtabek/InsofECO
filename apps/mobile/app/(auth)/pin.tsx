import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { erpText } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { PIN_LEN, pinStore } from '@/core/pin';
import { useSession } from '@/core/session';
import { AuthScreen, D, PinDots, PinKeypad, PrimaryButton } from '@/features/auth/ui';

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
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    const next = pin + d;
    setPin(next);
    setError(undefined);
    if (next.length === PIN_LEN) await finish(next);
  };

  const finish = async (code: string) => {
    if (mode === 'set') {
      if (!first) { setFirst(code); setPin(''); return; }
      if (first !== code) { setFirst(null); setPin(''); setError('Kodlar mos kelmadi — qaytadan kiriting'); return; }
      await pinStore.set(code);
      setSaved(true);
      setPin('');
      return;
    }
    const r = await pinStore.verify(code);
    setPin('');
    if (r.ok) {
      if (mode === 'off') { await pinStore.clear(); router.back(); return; }
      router.back();
      return;
    }
    if (r.wiped) {
      Alert.alert('PIN o\'chirildi', 'Kod bir necha marta xato kiritildi. Parol bilan qaytadan kiring.', [
        { text: 'Kirish', onPress: () => void signOut() },
      ]);
      return;
    }
    setError(`Kod xato — yana ${r.left} urinish qoldi`);
  };

  const del = () => { setPin((p) => p.slice(0, -1)); setError(undefined); };

  if (saved) {
    return (
      <AuthScreen back={false}>
        <Appear delay={60} style={{ alignItems: 'center', marginTop: 70 }}>
          <View style={{ width: 84, height: 84, borderRadius: 99, backgroundColor: D.okBg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="checkmark" size={40} color={D.okSoft} />
          </View>
          <Txt style={{ fontFamily: erpText.title.fontFamily, fontSize: 28, color: D.text, marginTop: 22 }}>PIN saqlandi</Txt>
          <Txt style={{ fontSize: 13.5, lineHeight: 21, color: D.muted, marginTop: 8, textAlign: 'center' }}>
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
      <Appear delay={60} style={{ alignItems: 'center', marginTop: 26 }}>
        <Txt style={{ fontFamily: erpText.title.fontFamily, fontSize: 27, lineHeight: 32, letterSpacing: -0.5, color: D.text, textAlign: 'center' }}>{title}</Txt>
        <Txt style={{ fontSize: 13.5, lineHeight: 21, color: D.muted, marginTop: 8, textAlign: 'center' }}>{hint}</Txt>
      </Appear>

      <Appear delay={110} style={{ marginTop: 26 }}>
        <PinDots filled={pin.length} length={PIN_LEN} />
      </Appear>

      <View style={{ minHeight: 20, marginTop: 14, alignItems: 'center' }}>
        <Txt style={{ ...erpText.label, fontSize: 12.5, color: error ? D.danger : D.faint }}>
          {error ?? (pin.length === PIN_LEN ? 'Tekshirilmoqda…' : `${PIN_LEN - pin.length} ta raqam qoldi`)}
        </Txt>
      </View>

      <Appear delay={160} style={{ marginTop: 20 }}>
        <PinKeypad onDigit={(d) => void tap(d)} onDelete={del} />
      </Appear>

      <Appear delay={220} style={{ marginTop: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, borderRadius: 15, padding: 14 }}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: D.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="finger-print" size={19} color={D.faint} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt style={{ ...erpText.rowTitle, color: D.text }}>Face ID / barmoq izi</Txt>
            <Txt style={{ fontSize: 11.5, lineHeight: 16, color: D.faint, marginTop: 3 }}>
              Ilovaning keyingi yig&apos;ilishida yoqiladi
            </Txt>
          </View>
        </View>
      </Appear>

      {mode === 'set' ? (
        <Appear delay={270} style={{ marginTop: 'auto', paddingTop: 18, alignItems: 'center' }}>
          <Txt onPress={() => router.back()} style={{ ...erpText.label, fontSize: 13, color: D.muted }}>Keyinroq sozlayman</Txt>
        </Appear>
      ) : null}
    </AuthScreen>
  );
}
