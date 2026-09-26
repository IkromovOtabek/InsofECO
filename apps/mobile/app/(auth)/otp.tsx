import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, IconTile, ListItem, Txt } from '@/design/primitives';
import { StatusLine } from '@/design/ui';
import { radius, size, space, type } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { AuthScreen, ErrorBox, PrimaryButton, TextLink, Title } from '@/features/auth/ui';

/**
 * SMS tasdiqlash kodi — oltita alohida katak.
 * `mode=reset` bo'lsa kod tekshirilgach yangi parol ekraniga o'tadi,
 * aks holda kod darhol tizimga kiritadi.
 */
const LEN = 6;

export default function OtpScreen() {
  const { phone, mode } = useLocalSearchParams<{ phone: string; mode?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const signIn = useSession((s) => s.signIn);
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const [focused, setFocused] = useState<number | null>(null);
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

  const submit = async (value = code) => {
    if (value.length !== LEN) return;
    if (isReset) { router.push({ pathname: '/(auth)/new-password', params: { phone, code: value } }); return; }
    setLoading(true); setError(undefined);
    try {
      const r = await authApi.verifyOtp(phone, value);
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
      <Appear delay={60} style={{ marginTop: space.xxl }}>
        <IconTile icon="message-square" module="brand" size={size.iconTile + space.md} />
      </Appear>

      <Title>Tasdiqlash kodi</Title>
      <Appear delay={90} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
        <Txt v="bodySm" color="muted">
          <Txt v="bodySm" mono color="strong">{phone}</Txt> raqamiga {LEN} xonali kod yubordik.
        </Txt>
        <TextLink onPress={() => router.back()}>O&apos;zgartirish</TextLink>
      </Appear>

      <Appear delay={140} style={{ marginTop: space.lg }}>
        <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityLabel={`Tasdiqlash kodi, ${LEN} ta raqam`}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => { refs.current[i] = r; }}
              value={d}
              onChangeText={(v) => setAt(i, v)}
              onFocus={() => setFocused(i)}
              onBlur={() => setFocused((f) => (f === i ? null : f))}
              onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={LEN}
              autoFocus={i === 0}
              selectTextOnFocus
              accessibilityLabel={`${i + 1}-raqam`}
              style={[type.metric, {
                flex: 1, height: size.driverTouch - space.sm, borderRadius: radius.sm, textAlign: 'center', paddingVertical: 0,
                borderWidth: focused === i ? size.ring : size.hairline,
                borderColor: error ? c.danger : focused === i ? c.brand : d ? c.borderStrong : c.borderDefault,
                backgroundColor: c.bgSurface, color: c.textStrong,
              }]}
            />
          ))}
        </View>
        <View style={{ marginTop: space.sm }}>
          {code.length === LEN
            ? <StatusLine icon="circle-check" tone="success" text="Kod to'liq kiritildi" />
            : <StatusLine icon="message-square" text="Kodni kiriting — SMS kelganda o'zi to'ladi." />}
        </View>
      </Appear>

      <ErrorBox text={error} />

      <Appear delay={190} style={{ marginTop: space.md }}>
        <PrimaryButton title={loading ? 'Tekshirilmoqda…' : 'Tasdiqlash'} icon={null} onPress={() => submit()} loading={loading} disabled={code.length !== LEN} />
      </Appear>

      <Appear delay={240} style={{ marginTop: space.lg }}>
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem
            icon="clock"
            title={left > 0 ? 'Qayta yuborish' : 'Kodni qayta yuborish'}
            subtitle={left > 0 ? 'Vaqt tugagach yana yuborish mumkin' : 'SMS kelmagan bo\'lsa bosing'}
            onPress={left > 0 ? undefined : () => void resend()}
            right={left > 0 ? <Txt v="mono" color="strong">{mmss}</Txt> : null}
            last
          />
        </Card>
      </Appear>
    </AuthScreen>
  );
}
