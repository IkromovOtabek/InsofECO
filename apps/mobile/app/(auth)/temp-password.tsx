import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { IconButton, Input, Row, Txt } from '@/design/primitives';
import { Icon, StatusLine } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { erpAuth } from '@/core/erp';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { AuthIcon, AuthScreen, ErrorBox, PrimaryButton, Strength, Title } from '@/features/auth/ui';

/**
 * Insof ERP: vaqtinchalik parol bilan kirildi (dispetcher haydovchiga bergan). Server sessiya bermaydi —
 * avval xodim o'z parolini o'rnatadi (ERP `/api/mobile/auth/temp-password`). `token` — login javobidagi
 * `changeToken` (qisqa muddatli, bir martalik); eskirsa — ortga, qaytadan login.
 * Qoida ERP bilan bir xil: kamida 8 belgi, harf va raqam aralash.
 */
export default function TempPassword() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const signInErp = useSession((s) => s.signInErp);
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ pw?: string; again?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const matched = !!pw && pw === again;

  const submit = async () => {
    const next: typeof error = {};
    if (pw.length < 8) next.pw = 'Parol kamida 8 belgi';
    else if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) next.pw = "Parolda harf ham, raqam ham bo'lsin";
    if (pw !== again) next.again = 'Parollar mos kelmadi';
    setError(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const r = await erpAuth.setTempPassword(token, pw);
      await signInErp({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
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
          <Txt v="caption" style={{ flex: 1 }}>Saqlagandan so&apos;ng vaqtinchalik parol ishlamaydi.</Txt>
        </Row>
      }
    >
      <AuthIcon icon="lock" />
      <Title hint="Siz vaqtinchalik parol bilan kirdingiz. Faqat o'zingiz biladigan parol o'ylab toping: kamida 8 belgi, harf va raqam aralash.">O&apos;z parolingiz</Title>

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

      <ErrorBox text={error.form} />

      <Appear delay={230} style={{ marginTop: space.lg }}>
        <PrimaryButton title={loading ? 'Saqlanmoqda…' : 'Saqlash va kirish'} icon={null} onPress={submit} loading={loading} />
      </Appear>
    </AuthScreen>
  );
}
