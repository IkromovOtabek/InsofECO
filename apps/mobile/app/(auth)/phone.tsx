import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PhoneSchema } from '@insof/shared';
import { Txt } from '@/design/primitives';
import { erpText } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { ApiException } from '@/core/api';
import { AuthScreen, D, DarkField, Divider, ErrorBox, FieldError, FooterLink, GhostButton, Hint, Label, PrimaryButton, Title } from '@/features/auth/ui';

/** Telefon orqali kirish — raqamga 6 xonali kod yuboriladi. */
export default function PhoneScreen() {
  const router = useRouter();
  const [local, setLocal] = useState('');
  const [error, setError] = useState<string>();
  const [form, setForm] = useState<string>();
  const [loading, setLoading] = useState(false);

  const full = `+998${local.replace(/\D/g, '')}`;

  const submit = async () => {
    const parsed = PhoneSchema.safeParse(full);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Raqam noto'g'ri");
    setLoading(true); setError(undefined); setForm(undefined);
    try {
      await authApi.requestOtp(parsed.data);
      router.push({ pathname: '/(auth)/otp', params: { phone: parsed.data } });
    } catch (e) {
      setForm(e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');
    } finally { setLoading(false); }
  };

  return (
    <AuthScreen footer={<FooterLink text="Hisobingiz yo'qmi?" action="Ro'yxatdan o'tish" onPress={() => router.replace('/(auth)/register')} />}>
      <Title hint="Raqamingizni kiriting — tasdiqlash uchun 6 xonali kod yuboramiz.">Telefon raqamingiz</Title>

      <Appear delay={130} style={{ marginTop: 26 }}>
        <Label>Telefon raqam</Label>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <View style={{ height: 52, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: D.border, backgroundColor: D.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ ...erpText.meta, fontSize: 14.5, color: D.muted }}>+998</Txt>
          </View>
          <DarkField
            value={local}
            onChangeText={(v) => { setLocal(v.replace(/\D/g, '').slice(0, 9)); setError(undefined); }}
            keyboardType="number-pad"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            placeholder="90 123 45 67"
            mono
            focus
            error={error}
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="go"
            style={{ flex: 1 }}
          />
        </View>
        <FieldError text={error} />
        <Hint>Raqam korxona hisobingizga bog&apos;langan bo&apos;lishi kerak.</Hint>
      </Appear>

      <ErrorBox text={form} />

      <Appear delay={190} style={{ marginTop: 22 }}>
        <PrimaryButton title={loading ? 'Yuborilmoqda…' : 'Kodni yuborish'} onPress={submit} loading={loading} />
      </Appear>

      <Appear delay={240}>
        <Divider />
        <View style={{ gap: 10 }}>
          <GhostButton title="Login va parol bilan kirish" icon="lock-closed-outline" onPress={() => router.replace('/(auth)/login')} />
          <GhostButton title="PIN kod bilan kirish" icon="keypad-outline" iconColor={D.ok} onPress={() => router.push('/(auth)/pin')} />
        </View>
      </Appear>
    </AuthScreen>
  );
}
