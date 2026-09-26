import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconButton, Input, Row, Txt } from '@/design/primitives';
import { Icon, StatusLine } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { AuthScreen, ErrorBox, PrimaryButton, Requirements, Strength, Title, strengthOf } from '@/features/auth/ui';

/**
 * Parolni tiklash — 2-qadam: yangi parol.
 * Saqlangach barcha qurilmalardagi eski seanslar yopiladi va shu qurilma tizimga kiradi.
 */
export default function NewPassword() {
  const { phone, code } = useLocalSearchParams<{ phone: string; code: string }>();
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ pw?: string; again?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const matched = !!pw && pw === again;

  const submit = async () => {
    const next: typeof error = {};
    if (pw.length < 6) next.pw = 'Parol kamida 6 belgi';
    else if (strengthOf(pw) < 2) next.pw = 'Parol juda oddiy — harf va raqam aralashtiring';
    if (pw !== again) next.again = 'Parollar mos kelmadi';
    setError(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const r = await authApi.resetPassword(phone, code, pw);
      await signIn({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
      router.replace('/(auth)/done');
    } catch (e) {
      setError({ form: e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring' });
    } finally { setLoading(false); }
  };

  const eye = <IconButton icon={show ? 'eye-off' : 'eye'} label={show ? 'Parolni yashirish' : "Parolni ko'rsatish"} onPress={() => setShow((v) => !v)} size={size.touch - space.sm} tone="muted" />;

  return (
    <AuthScreen
      footer={
        <Row style={{ gap: space.sm }}>
          <Icon name="lock" tone="faint" />
          <Txt v="caption" style={{ flex: 1 }}>Saqlagandan so&apos;ng barcha qurilmalardagi seanslar yopiladi.</Txt>
        </Row>
      }
    >
      <Title hint="Parol kamida 8 belgidan iborat bo'lsin. Eski parolni qayta ishlatib bo'lmaydi.">Yangi parol</Title>

      <Appear delay={130} style={{ marginTop: space.xxl }}>
        <Input
          label="Yangi parol"
          value={pw}
          onChangeText={(v) => { setPw(v); setError((e) => ({ ...e, pw: undefined })); }}
          secureTextEntry={!show}
          autoComplete="new-password"
          placeholder="••••••••"
          mono
          error={error.pw}
          autoFocus
          right={eye}
          containerStyle={{ marginBottom: 0 }}
        />
        <Strength password={pw} />
      </Appear>

      <Appear delay={180} style={{ marginTop: space.lg }}>
        <Input
          label="Parolni takrorlang"
          value={again}
          onChangeText={(v) => { setAgain(v); setError((e) => ({ ...e, again: undefined })); }}
          secureTextEntry={!show}
          autoComplete="new-password"
          placeholder="••••••••"
          mono
          error={error.again}
          onSubmitEditing={submit}
          returnKeyType="go"
          containerStyle={{ marginBottom: 0 }}
        />
        {matched && !error.again ? <StatusLine icon="circle-check" tone="success" text="Parollar mos keldi" /> : null}
      </Appear>

      <Appear delay={230} style={{ marginTop: space.lg }}>
        <Requirements password={pw} />
      </Appear>

      <ErrorBox text={error.form} />

      <Appear delay={280} style={{ marginTop: space.lg }}>
        <PrimaryButton title={loading ? 'Saqlanmoqda…' : 'Parolni saqlash'} icon={null} onPress={submit} loading={loading} />
      </Appear>
    </AuthScreen>
  );
}
