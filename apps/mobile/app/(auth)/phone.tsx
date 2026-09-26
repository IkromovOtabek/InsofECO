import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PhoneSchema } from '@insof/shared';
import { Input, Label, Txt } from '@/design/primitives';
import { radius, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { ApiException } from '@/core/api';
import { AuthScreen, Divider, ErrorBox, FooterLink, GhostButton, PrimaryButton, Title } from '@/features/auth/ui';

/** "+998" prefiksi — input balandligida, fokus halqasi hisobga olingan. */
function PhonePrefix() {
  const { c } = useTheme();
  return (
    <View style={{ height: size.input + size.ring * 2, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: size.hairline, borderColor: c.borderDefault, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center', marginTop: size.ring }}>
      <Txt v="body" mono color="muted">+998</Txt>
    </View>
  );
}

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

      <Appear delay={130} style={{ marginTop: space.xxl }}>
        <Label>Telefon raqam</Label>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
          <PhonePrefix />
          <Input
            value={local}
            onChangeText={(v) => { setLocal(v.replace(/\D/g, '').slice(0, 9)); setError(undefined); }}
            keyboardType="number-pad"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            placeholder="90 123 45 67"
            accessibilityLabel="Telefon raqam"
            mono
            error={error}
            hint="Raqam korxona hisobingizga bog'langan bo'lishi kerak."
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="go"
            containerStyle={{ flex: 1 }}
          />
        </View>
      </Appear>

      <ErrorBox text={form} />

      <Appear delay={190} style={{ marginTop: space.sm }}>
        <PrimaryButton title={loading ? 'Yuborilmoqda…' : 'Kodni yuborish'} onPress={submit} loading={loading} />
      </Appear>

      <Appear delay={240}>
        <Divider />
        <View style={{ gap: space.md }}>
          <GhostButton title="Login va parol bilan kirish" icon="lock" onPress={() => router.replace('/(auth)/login')} />
          <GhostButton title="PIN kod bilan kirish" icon="grid-3x3" onPress={() => router.push('/(auth)/pin')} />
        </View>
      </Appear>
    </AuthScreen>
  );
}
