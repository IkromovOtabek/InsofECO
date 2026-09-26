import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PhoneSchema } from '@insof/shared';
import { Badge, IconButton, IconTile, Input, Txt } from '@/design/primitives';
import { size, space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { erpAuth } from '@/core/erp';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { AuthScreen, Divider, ErrorBox, FooterLink, GhostButton, PrimaryButton, TextLink, Title } from '@/features/auth/ui';

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
    <AuthScreen footer={<FooterLink text="Xodimlar ERP logini bilan kiradi" action="Ro'yxatdan o'tish" onPress={() => router.replace('/(auth)/register')} />}>
      <Appear delay={40} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xxl }}>
        <IconTile icon="layers" module="brand" />
        <View>
          <Txt v="titleSm">Insof ECO</Txt>
          <Txt v="caption">Insof beton zavodi</Txt>
        </View>
      </Appear>

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
          containerStyle={kind ? { marginBottom: space.sm } : undefined}
        />
        {kind ? (
          <Badge
            tone={kind === 'erp' ? 'info' : 'success'}
            icon={kind === 'erp' ? 'building' : 'phone'}
            label={kind === 'erp' ? 'Zavod xodimi — Insof ERP' : 'Telefon — Insof ECO'}
            style={{ marginBottom: space.lg }}
          />
        ) : null}
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

      <ErrorBox text={error.form} />

      <Appear delay={250} style={{ marginTop: space.lg }}>
        <PrimaryButton title={loading ? 'Kirilmoqda…' : 'Kirish'} onPress={submit} loading={loading} />
      </Appear>

      <Appear delay={300}>
        <Divider />
        <GhostButton title="SMS-kod orqali kirish" icon="message-square" onPress={() => router.push('/(auth)/phone')} />
      </Appear>
    </AuthScreen>
  );
}
