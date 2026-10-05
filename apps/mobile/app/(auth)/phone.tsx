import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PhoneSchema } from '@insof/shared';
import { Input, Label, Txt } from '@/design/primitives';
import { space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { ApiException } from '@/core/api';
import { useTelegramLogin } from '@/features/auth/telegram';
import { AuthIcon, AuthScreen, ConsentCheck, Divider, ErrorBox, FooterLink, GhostButton, PhonePrefix, PrimaryButton, REGISTER_STEPS, Steps, TextLink, Title } from '@/features/auth/ui';

const CONSENT_MSG = 'Davom etish uchun maxfiylik siyosatiga rozilik bildiring';

/**
 * Telefon raqami — uning Telegram'iga 6 xonali kod yuboriladi (Telegram Gateway; SMS yo'q).
 *   - oddiy rejim: kod bilan kirish;
 *   - `mode=register`: ro'yxatdan o'tishning 1-qadami. Kod tasdiqlangach raqam egasi ekani
 *     isbotlanadi va ma'lumotlar formasi ochiladi (begona odam raqamni oldindan egallay olmaydi).
 */
export default function PhoneScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isRegister = mode === 'register';
  // Parolsiz tez yo'l: raqam Telegram botida ulashiladi, keyin rol tanlash ekranida «Mijoz sifatida davom etish»
  const tg = useTelegramLogin();
  const [local, setLocal] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string>();
  const [form, setForm] = useState<string>();
  const [loading, setLoading] = useState(false);

  const full = `+998${local.replace(/\D/g, '')}`;

  const submit = async () => {
    if (loading) return;
    const parsed = PhoneSchema.safeParse(full);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Raqam noto'g'ri");
    if (isRegister && !agree) return setForm(CONSENT_MSG);
    setLoading(true); setError(undefined); setForm(undefined);
    try {
      const r = await authApi.requestOtp(parsed.data);
      router.push({ pathname: '/(auth)/otp', params: { phone: parsed.data, via: r.channel, ...(isRegister ? { mode: 'register' } : {}) } });
    } catch (e) {
      setForm(e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');
    } finally { setLoading(false); }
  };

  const footer = isRegister
    ? <FooterLink text="Hisobingiz bormi?" action="Kirish" onPress={() => router.replace('/(auth)/login')} />
    : <FooterLink text="Hisobingiz yo'qmi?" action="Ro'yxatdan o'tish" onPress={() => router.replace('/(auth)/register')} />;

  return (
    <AuthScreen footer={footer} onBack={isRegister ? () => (router.canGoBack() ? router.back() : router.replace('/(auth)/login')) : undefined}>
      {isRegister ? <Steps labels={REGISTER_STEPS} current={0} /> : <AuthIcon icon="smartphone" />}
      <Title hint={isRegister
        ? "Avval raqamingizni tasdiqlaymiz: 6 xonali kod Telegram'ingizga keladi. Keyin rol, ism va parolni kiritasiz."
        : "Raqamingizni kiriting — tasdiqlash uchun 6 xonali kodni Telegram orqali yuboramiz."}
      >
        {isRegister ? "Ro'yxatdan o'tish" : 'Telefon raqamingiz'}
      </Title>

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
            hint={isRegister ? "Shu raqam hisobingiz logini bo'ladi." : "Raqam korxona hisobingizga bog'langan bo'lishi kerak."}
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="go"
            containerStyle={{ flex: 1 }}
          />
        </View>
      </Appear>

      {isRegister ? (
        <Appear delay={160}>
          <ConsentCheck value={agree} onChange={(v) => { setAgree(v); setForm(undefined); }} />
        </Appear>
      ) : null}

      <ErrorBox text={form || (isRegister ? tg.error : undefined)} />

      <Appear delay={190} style={{ marginTop: space.sm }}>
        <PrimaryButton title={loading ? 'Yuborilmoqda…' : 'Kodni yuborish'} onPress={submit} loading={loading} disabled={isRegister && !agree} />
      </Appear>

      <Appear delay={240}>
        <Divider />
        {isRegister ? (
          <>
            <GhostButton
              title={tg.waiting ? "Telegram'da raqamni ulashing…" : tg.starting ? 'Telegram ochilmoqda…' : "Telegram orqali ro'yxatdan o'tish"}
              icon="send"
              onPress={() => (agree ? void tg.start() : setForm(CONSENT_MSG))}
            />
            {tg.waiting ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
                <Txt v="caption">Botda raqamingizni ulashing — hisob o&apos;zi ochiladi</Txt>
                <TextLink onPress={tg.cancel}>Bekor qilish</TextLink>
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ gap: space.md }}>
            <GhostButton title="Login va parol bilan kirish" icon="lock" onPress={() => router.replace('/(auth)/login')} />
            <GhostButton title="PIN kod bilan kirish" icon="grid-3x3" onPress={() => router.push('/(auth)/pin')} />
          </View>
        )}
      </Appear>
    </AuthScreen>
  );
}
