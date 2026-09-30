import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { PhoneSchema } from '@insof/shared';
import { IconButton, Input, Txt } from '@/design/primitives';
import { size, space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { erpAuth } from '@/core/erp';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { useTelegramLogin } from '@/features/auth/telegram';
import { AuthLogo, AuthScreen, Divider, ErrorBox, FooterLink, PrimaryButton, TextLink, Title } from '@/features/auth/ui';
import { SocialLogin } from '@/features/auth/social';
import { afterLogin } from '@/features/shop/after-login';

/**
 * Kirish oynasi.
 *
 * Bitta maydon ikkala tizimga xizmat qiladi:
 *   telefon raqam (+998…) → Insof ECO: tadbirkor / quruvchi / haydovchi;
 *   login (harfli)        → Insof ERP: zavod xodimlari.
 * Qaysi tizimga borishi kiritilgan qiymatdan aniqlanadi va maydon ostida nishon bilan ko'rsatiladi.
 */

/** Raqamlar 9 (901234567) yoki 12 (998901234567) ta bo'lsa — telefon. Aks holda ERP login. */
function detectKind(raw: string): 'eco' | 'erp' | null {
  const v = raw.trim();
  if (!v) return null;
  if (!/^[+\d\s()-]+$/.test(v)) return 'erp';
  const d = v.replace(/\D/g, '');
  return d.length === 9 || d.length === 12 ? 'eco' : 'erp';
}

const toPhone = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  return `+${d.length === 9 ? `998${d}` : d}`;
};

export default function Login() {
  const router = useRouter();
  const { signIn, signInErp } = useSession();
  const [ident, setIdent] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ ident?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const kind = useMemo(() => detectKind(ident), [ident]);
  const tg = useTelegramLogin();

  /**
   * Ortga — har doim do'konga (E-commerce). `router.back()` yetmaydi: login ko'pincha
   * `replace` bilan ochiladi (ro'yxat, SMS, parolni tiklash ekranlaridan) va tarix bo'sh
   * bo'ladi. `dismissTo` do'kon tarixda bo'lsa unga qaytadi, bo'lmasa uni o'rniga qo'yadi.
   */
  // Mahsulotdan "Buyurtma berish" orqali kelgan bo'lsa — o'sha mahsulotga qaytadi
  const toShop = useCallback(() => router.dismissTo((afterLogin.take() ?? '/(shop)') as never), [router]);
  // Android'dagi tizim "orqaga" tugmasi ham ilovani yopmasin — do'konga qaytarsin
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { toShop(); return true; });
    return () => sub.remove();
  }, [toShop]));

  const submit = async () => {
    const next: typeof error = {};
    if (!ident.trim()) next.ident = 'Login yoki telefon kiriting';
    if (password.length < 4) next.password = 'Parol kamida 4 belgi';

    const phone = kind === 'eco' ? PhoneSchema.safeParse(toPhone(ident)) : null;
    if (kind === 'eco' && phone && !phone.success) next.ident = phone.error.issues[0]?.message ?? "Telefon noto'g'ri";

    setError(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      if (kind === 'eco') {
        const r = await authApi.login(phone!.data!, password);
        await signIn({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
      } else {
        const r = await erpAuth.login(ident.trim(), password);
        await signInErp({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
      }
    } catch (e) {
      setError({ form: e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen onBack={toShop} footer={<FooterLink text="Xodimlar ERP logini bilan kiradi" action="Ro'yxatdan o'tish" onPress={() => router.replace('/(auth)/register')} />}>
      <AuthLogo />

      <Title display hint="Har bir bo'lim o'z login va paroli bilan kiradi. Ruxsatlar rolga qarab ochiladi.">Tizimga kirish</Title>

      <Appear delay={140} style={{ marginTop: space.xxl }}>
        <Input
          label="Login yoki telefon"
          value={ident}
          onChangeText={(v) => { setIdent(v); setError((e) => ({ ...e, ident: undefined })); }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="log1  yoki  +998 90 123 45 67"
          error={error.ident}
        />
      </Appear>

      <Appear delay={190}>
        <Input
          label="Parol"
          value={password}
          onChangeText={(v) => { setPassword(v); setError((e) => ({ ...e, password: undefined })); }}
          secureTextEntry={!show}
          textContentType="password"
          autoComplete="password"
          placeholder="••••••"
          mono
          onSubmitEditing={submit}
          returnKeyType="go"
          error={error.password}
          containerStyle={{ marginBottom: 0 }}
          right={<IconButton icon={show ? 'eye-off' : 'eye'} label={show ? 'Parolni yashirish' : "Parolni ko'rsatish"} onPress={() => setShow((v) => !v)} size={size.touch - space.sm} tone="muted" />}
        />
        <TextLink onPress={() => router.push('/(auth)/forgot')} style={{ alignSelf: 'flex-end' }}>Parolni unutdingizmi?</TextLink>
      </Appear>

      <ErrorBox text={error.form ?? tg.error} />

      <Appear delay={250} style={{ marginTop: space.lg }}>
        <PrimaryButton title={loading ? 'Kirilmoqda…' : 'Kirish'} onPress={submit} loading={loading} />
      </Appear>

      <Appear delay={300}>
        <Divider />
        {/* Telegram va SMS — dumaloq belgilar, yozuvsiz (o'z brend ranglarida) */}
        <SocialLogin onTelegram={() => void tg.start()} onSms={() => router.push('/(auth)/phone')} telegramBusy={tg.starting || tg.waiting} />
        {tg.waiting ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
            <Txt v="caption">Botda «Raqamni ulashish» ni bosing — kirish o'zi bo'ladi</Txt>
            <TextLink onPress={tg.cancel}>Bekor qilish</TextLink>
          </View>
        ) : null}
      </Appear>
    </AuthScreen>
  );
}
