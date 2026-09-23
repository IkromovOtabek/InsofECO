import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { erpText } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { AuthScreen, D, ErrorBox, PrimaryButton, Title } from '@/features/auth/ui';

/**
 * SMS tasdiqlash kodi — oltita alohida katak.
 * `mode=reset` bo'lsa kod tekshirilgach yangi parol ekraniga o'tadi,
 * aks holda kod darhol tizimga kiritadi.
 */
const LEN = 6;

export default function OtpScreen() {
  const { phone, mode } = useLocalSearchParams<{ phone: string; mode?: string }>();
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState(60);
  const refs = useRef<(TextInput | null)[]>([]);

  const code = digits.join('');
  const isReset = mode === 'reset';

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const submit = async (c = code) => {
    if (c.length !== LEN) return;
    if (isReset) { router.push({ pathname: '/(auth)/new-password', params: { phone, code: c } }); return; }
    setLoading(true); setError(undefined);
    try {
      const r = await authApi.verifyOtp(phone, c);
      await signIn({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');
      setDigits(Array(LEN).fill(''));
      refs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  useEffect(() => { if (code.length === LEN) void submit(code); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const setAt = (i: number, v: string) => {
    const only = v.replace(/\D/g, '');
    setError(undefined);
    // Butun kod bir marta yopishtirilgan bo'lsa — kataklarga tarqatamiz
    if (only.length > 1) {
      const next = only.slice(0, LEN).split('');
      setDigits(Array.from({ length: LEN }, (_, x) => next[x] ?? ''));
      refs.current[Math.min(next.length, LEN - 1)]?.focus();
      return;
    }
    setDigits((d) => d.map((x, k) => (k === i ? only : x)));
    if (only && i < LEN - 1) refs.current[i + 1]?.focus();
  };

  const resend = async () => {
    if (left > 0) return;
    setError(undefined);
    try {
      const r = isReset ? await authApi.forgotPassword(phone) : await authApi.requestOtp(phone);
      setLeft(r.retryAfter ?? 60);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Qayta yuborib bo\'lmadi');
    }
  };

  const mmss = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;

  return (
    <AuthScreen>
      <Appear delay={60} style={{ marginTop: 26 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chatbox-ellipses-outline" size={24} color={D.accent} />
        </View>
      </Appear>

      <Title>Tasdiqlash kodi</Title>
      <Appear delay={90}>
        <Txt style={{ fontSize: 13.5, lineHeight: 21, color: D.muted, marginTop: 8 }}>
          <Txt style={{ ...erpText.meta, fontSize: 13.5, color: D.text }}>{phone}</Txt> raqamiga {LEN} xonali kod yubordik.{' '}
          <Txt onPress={() => router.back()} style={{ ...erpText.label, fontSize: 13.5, color: D.accent }}>O&apos;zgartirish</Txt>
        </Txt>
      </Appear>

      <Appear delay={140} style={{ marginTop: 24 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => { refs.current[i] = r; }}
              value={d}
              onChangeText={(v) => setAt(i, v)}
              onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={LEN}
              autoFocus={i === 0}
              selectTextOnFocus
              style={{
                flex: 1, height: 62, borderRadius: 14, textAlign: 'center',
                borderWidth: 1.5, borderColor: d ? D.borderSoft : D.border,
                backgroundColor: d ? D.surfaceAlt : D.surface,
                color: D.text, fontFamily: erpText.meta.fontFamily, fontSize: 24,
              }}
            />
          ))}
        </View>
        <View style={{ minHeight: 20, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {code.length === LEN ? (
            <>
              <Icon name="checkmark-circle" size={14} color={D.okSoft} />
              <Txt style={{ ...erpText.label, fontSize: 12, color: D.okSoft }}>Kod to&apos;liq kiritildi</Txt>
            </>
          ) : (
            <Txt style={{ fontSize: 12, color: D.faint }}>Kodni kiriting — SMS kelganda o&apos;zi to&apos;ladi.</Txt>
          )}
        </View>
      </Appear>

      <ErrorBox text={error} />

      <Appear delay={190} style={{ marginTop: 14 }}>
        <PrimaryButton title={loading ? 'Tekshirilmoqda…' : 'Tasdiqlash'} icon={null} onPress={() => submit()} loading={loading} disabled={code.length !== LEN} />
      </Appear>

      <Appear delay={240} style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, borderRadius: 14, paddingHorizontal: 14, height: 52 }}>
          <Icon name="time-outline" size={18} color={D.muted} />
          <Txt onPress={resend} style={{ flex: 1, fontSize: 12.5, color: left > 0 ? D.muted : D.accent }}>
            {left > 0 ? 'Qayta yuborish' : 'Kodni qayta yuborish'}
          </Txt>
          {left > 0 ? <Txt style={{ ...erpText.meta, fontSize: 13, color: D.text }}>{mmss}</Txt> : null}
        </View>
      </Appear>
    </AuthScreen>
  );
}
