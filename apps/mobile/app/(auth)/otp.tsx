import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconTile, ListGroup, ListItem, Txt } from '@/design/primitives';
import { StatusLine, toast } from '@/design/ui';
import { elevation, radius, size, space, type } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Appear, haptic } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { AuthScreen, ErrorBox, PrimaryButton, REGISTER_STEPS, Steps, TextLink, Title } from '@/features/auth/ui';

/**
 * Tasdiqlash kodi (Telegram Gateway yoki SMS — `via`) — oltita alohida katak.
 * `mode=reset` bo'lsa kod tekshirilgach yangi parol ekraniga o'tadi;
 * `mode=register` — ro'yxatdan o'tish: kod raqam egaligini tasdiqlaydi va ma'lumotlar formasi
 * bir martalik token bilan ochiladi (raqam tizimda bor bo'lsa — egasi shu kod bilan kiradi);
 * aks holda kod darhol tizimga kiritadi.
 */
const LEN = 6;

export default function OtpScreen() {
  const params = useLocalSearchParams<{ phone: string; mode?: string; via?: string }>();
  const { phone, mode } = params;
  // Qayta yuborishda kanal o'zgarishi mumkin (Telegram ishlamay SMS'ga tushsa)
  const [via, setVia] = useState(params.via === 'telegram' ? 'telegram' : 'sms');
  const tg = via === 'telegram';
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
  const isRegister = mode === 'register';

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
      if (isRegister) {
        const r = await authApi.verifyRegisterPhone(phone, value);
        if (r.status === 'verified') {
          router.replace({ pathname: '/(auth)/register', params: { phone, token: r.phoneVerificationToken } });
          return;
        }
        // Raqam tizimda bor — yangi hisob ochilmaydi, egasi kod bilan kirdi
        await signIn({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
        toast.info("Parolni keyin «Parolni unutdim» orqali o'rnatishingiz mumkin", 'Bu raqam tizimda bor — hisobingizga kirdingiz');
        return;
      }
      const r = await authApi.verifyOtp(phone, value);
      await signIn({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
    } catch (e) {
      haptic.error();
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
      if (r.channel) setVia(r.channel);
    } catch (e) {
      haptic.error();
      setError(e instanceof ApiException ? e.message : 'Qayta yuborib bo\'lmadi');
    }
  };

  const mmss = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;

  return (
    <AuthScreen>
      {isRegister ? <Steps labels={REGISTER_STEPS} current={1} /> : null}
      <Appear delay={60} style={{ marginTop: space.xxl }}>
        <IconTile icon={tg ? 'send' : 'message-square'} module="brand" size={size.iconTile + space.md} />
      </Appear>

      <Title>Tasdiqlash kodi</Title>
      <Appear delay={90} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
        <Txt v="bodySm" color="muted">
          {tg
            ? <>{LEN} xonali kodni <Txt v="bodySm" mono color="strong">{phone}</Txt> raqamidagi Telegram'ga («Verification Codes» chati) yubordik.</>
            : <><Txt v="bodySm" mono color="strong">{phone}</Txt> raqamiga {LEN} xonali kod yubordik.</>}
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
                flex: 1, height: size.driverTouch - space.sm, borderRadius: radius.md, borderCurve: 'continuous', textAlign: 'center', paddingVertical: 0,
                borderWidth: size.ring,
                borderColor: error ? c.danger : focused === i ? c.brand : 'transparent',
                backgroundColor: d ? c.bgSurface : c.bgSubtle, color: c.textStrong,
              }, elevation(c).sh1]}
            />
          ))}
        </View>
        <View style={{ marginTop: space.sm }}>
          {code.length === LEN
            ? <StatusLine icon="circle-check" tone="success" text="Kod to'liq kiritildi" />
            : <StatusLine icon={tg ? 'send' : 'message-square'} text={tg ? "Telegram'dagi kodni kiriting yoki nusxalab qo'ying." : "Kodni kiriting — SMS kelganda o'zi to'ladi."} />}
        </View>
      </Appear>

      <ErrorBox text={error} />

      <Appear delay={190} style={{ marginTop: space.md }}>
        <PrimaryButton title={loading ? 'Tekshirilmoqda…' : 'Tasdiqlash'} icon={null} onPress={() => submit()} loading={loading} disabled={code.length !== LEN} />
      </Appear>

      <Appear delay={240} style={{ marginTop: space.lg }}>
        <ListGroup>
          <ListItem
            icon="clock"
            title={left > 0 ? 'Qayta yuborish' : 'Kodni qayta yuborish'}
            subtitle={left > 0 ? 'Vaqt tugagach yana yuborish mumkin' : tg ? 'Telegram\'ga kelmagan bo\'lsa bosing' : 'SMS kelmagan bo\'lsa bosing'}
            onPress={left > 0 ? undefined : () => void resend()}
            right={left > 0 ? <Txt v="mono" color="strong">{mmss}</Txt> : null}
          />
        </ListGroup>
      </Appear>
    </AuthScreen>
  );
}
