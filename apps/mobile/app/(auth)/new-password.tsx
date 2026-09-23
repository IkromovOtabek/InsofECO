import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { erpText } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { AuthScreen, D, DarkField, ErrorBox, FieldError, Label, PrimaryButton, Requirements, Strength, Title, strengthOf } from '@/features/auth/ui';

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

  return (
    <AuthScreen
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="lock-closed-outline" size={16} color={D.faint} />
          <Txt style={{ flex: 1, fontSize: 11.5, lineHeight: 17, color: D.faint }}>
            Saqlagandan so&apos;ng barcha qurilmalardagi seanslar yopiladi.
          </Txt>
        </View>
      }
    >
      <Title hint="Parol kamida 8 belgidan iborat bo'lsin. Eski parolni qayta ishlatib bo'lmaydi.">Yangi parol</Title>

      <Appear delay={130} style={{ marginTop: 24 }}>
        <Label>Yangi parol</Label>
        <View style={{ justifyContent: 'center' }}>
          <DarkField
            value={pw}
            onChangeText={(v) => { setPw(v); setError((e) => ({ ...e, pw: undefined })); }}
            secureTextEntry={!show}
            autoComplete="new-password"
            placeholder="••••••••"
            mono
            focus
            error={error.pw}
            autoFocus
            style={{ paddingRight: 54 }}
          />
          <Pressable onPress={() => setShow((v) => !v)} accessibilityLabel={show ? 'Yashirish' : "Ko'rsatish"} style={{ position: 'absolute', right: 3, width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={D.muted} />
          </Pressable>
        </View>
        <FieldError text={error.pw} />
        <Strength password={pw} />
      </Appear>

      <Appear delay={180} style={{ marginTop: 16 }}>
        <Label>Parolni takrorlang</Label>
        <DarkField
          value={again}
          onChangeText={(v) => { setAgain(v); setError((e) => ({ ...e, again: undefined })); }}
          secureTextEntry={!show}
          autoComplete="new-password"
          placeholder="••••••••"
          mono
          error={error.again}
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        <FieldError text={error.again} />
        {matched && !error.again ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Icon name="checkmark-circle" size={13} color={D.okSoft} />
            <Txt style={{ ...erpText.label, fontSize: 11.5, color: D.okSoft }}>Parollar mos keldi</Txt>
          </View>
        ) : null}
      </Appear>

      <Appear delay={230} style={{ marginTop: 18 }}>
        <Requirements password={pw} />
      </Appear>

      <ErrorBox text={error.form} />

      <Appear delay={280} style={{ marginTop: 18 }}>
        <PrimaryButton title={loading ? 'Saqlanmoqda…' : 'Parolni saqlash'} icon={null} onPress={submit} loading={loading} />
      </Appear>
    </AuthScreen>
  );
}
