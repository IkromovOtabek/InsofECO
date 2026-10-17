import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { IconButton, Input } from '@/design/primitives';
import { size, space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { erpApi, type ErpUser } from '@/core/erp';
import { setEcoTokens, useSession } from '@/core/session';
import { KEYS, secure } from '@/core/storage';
import { ApiException } from '@/core/api';
import { AuthIcon, AuthScreen, ErrorBox, GhostButton, InfoCard, PrimaryButton, Requirements, Strength, Title, strengthOf } from '@/features/auth/ui';
import { dialog } from '@/design/ui';

/**
 * Tizimga kirgan holda parolni almashtirish (Profil → Xavfsizlik).
 *
 * ECO hisobi uchun `/v1/auth/password/change` chaqiriladi va boshqa qurilmalardagi
 * seanslar yopiladi. ERP xodimi — `ErpCredentials` (veb «Mening hisobim» bilan bitta qoida).
 */
export default function ChangePassword() {
  const router = useRouter();
  const kind = useSession((s) => s.kind);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ current?: string; next?: string; again?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  if (kind === 'erp') return <ErpCredentials />;

  const submit = async () => {
    const e: typeof error = {};
    if (current.length < 6) e.current = 'Joriy parolni kiriting';
    if (next.length < 6) e.next = 'Yangi parol kamida 6 belgi';
    else if (strengthOf(next) < 2) e.next = 'Parol juda oddiy — harf va raqam aralashtiring';
    if (next !== again) e.again = 'Parollar mos kelmadi';
    setError(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      const r = await authApi.changePassword(current, next);
      // Server joriy seansni ham yopadi va yangi juftlik beradi — saqlamasak keyingi so'rov 401 bilan chiqarib yuborardi
      if (r.accessToken && r.refreshToken) await setEcoTokens({ accessToken: r.accessToken, refreshToken: r.refreshToken });
      dialog('Saqlandi', 'Parol o\'zgartirildi. Boshqa qurilmalardagi seanslar yopildi.', [
        { text: 'Yopish', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError({ form: err instanceof ApiException ? err.message : 'Tarmoq xatosi. Internetni tekshiring' });
    } finally { setLoading(false); }
  };

  const eye = <IconButton icon={show ? 'eye-off' : 'eye'} label={show ? 'Parolni yashirish' : "Parolni ko'rsatish"} onPress={() => setShow((v) => !v)} size={size.touch - space.sm} tone="muted" />;

  return (
    <AuthScreen>
      <AuthIcon icon="key-round" />
      <Title hint="Joriy parolni tasdiqlang va yangisini kiriting.">Parolni o&apos;zgartirish</Title>

      <Appear delay={130} style={{ marginTop: space.xxl }}>
        <Input label="Joriy parol" value={current} onChangeText={(v) => { setCurrent(v); setError((e) => ({ ...e, current: undefined })); }} secureTextEntry autoComplete="current-password" placeholder="••••••••" mono error={error.current} autoFocus />
      </Appear>

      <Appear delay={170}>
        <Input label="Yangi parol" value={next} onChangeText={(v) => { setNext(v); setError((e) => ({ ...e, next: undefined })); }} secureTextEntry={!show} autoComplete="new-password" placeholder="••••••••" mono error={error.next} right={eye} containerStyle={{ marginBottom: 0 }} />
        <Strength password={next} />
      </Appear>

      <Appear delay={210} style={{ marginTop: space.lg }}>
        <Input label="Yangi parolni takrorlang" value={again} onChangeText={(v) => { setAgain(v); setError((e) => ({ ...e, again: undefined })); }} secureTextEntry={!show} autoComplete="new-password" placeholder="••••••••" mono error={error.again} onSubmitEditing={submit} returnKeyType="go" containerStyle={{ marginBottom: 0 }} />
      </Appear>

      <Appear delay={250} style={{ marginTop: space.lg }}>
        <Requirements password={next} />
      </Appear>

      <ErrorBox text={error.form} />

      <Appear delay={290} style={{ marginTop: space.lg }}>
        <PrimaryButton title={loading ? 'Saqlanmoqda…' : 'Parolni saqlash'} icon={null} onPress={submit} loading={loading} />
      </Appear>
    </AuthScreen>
  );
}

interface ErpAccountInfo { login: string; phone: string | null; needsCode: boolean; eco: boolean; loginHint: string }
interface ErpChangeResult { ok: true; login: string; passwordChanged: boolean; accessToken: string; refreshToken: string; user: ErpUser }

/**
 * ERP xodimi o'z loginini va/yoki parolini o'zgartiradi (ERP `/api/mobile/account/credentials`). Tasdiq — xodim
 * kartasidagi raqamga Telegram orqali kelgan 6 xonali kod; kartada raqam bo'lmasa — joriy parol. Boshqa qurilmalar
 * chiqib ketadi, shu telefon yangi token juftligini oladi.
 */
function ErpCredentials() {
  const router = useRouter();
  const [info, setInfo] = useState<ErpAccountInfo | null>(null);
  const [login, setLogin] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [code, setCode] = useState('');
  const [current, setCurrent] = useState('');
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<{ login?: string; next?: string; again?: string; code?: string; current?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    erpApi<ErpAccountInfo>('/account/credentials')
      .then((r) => { setInfo(r); setLogin(r.login); })
      .catch((err) => setError({ form: err instanceof ApiException ? err.message : 'Tarmoq xatosi. Internetni tekshiring' }));
  }, []);

  const sendCode = async () => {
    setSending(true);
    try {
      const r = await erpApi<{ ok: true; devCode?: string }>('/account/credentials/code', { method: 'POST' });
      setSent(r.devCode ? `Kod yuborildi (sinov: ${r.devCode})` : `Kod ${info?.phone ?? ''} raqamingizga Telegram orqali yuborildi`);
      setError((e) => ({ ...e, form: undefined }));
    } catch (err) {
      setError((e) => ({ ...e, form: err instanceof ApiException ? err.message : 'Tarmoq xatosi. Internetni tekshiring' }));
    } finally { setSending(false); }
  };

  const submit = async () => {
    if (!info) return;
    const e: typeof error = {};
    const newLogin = login.trim().toLowerCase();
    if (newLogin === info.login && !next) e.form = 'Yangi login yoki yangi parolni kiriting';
    if (newLogin.length < 3) e.login = info.loginHint;
    if (next) {
      if (next.length < 8) e.next = 'Parol kamida 8 belgi';
      else if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) e.next = 'Parolda harf ham, raqam ham bo\'lsin';
      if (next !== again) e.again = 'Parollar mos kelmadi';
    }
    if (info.needsCode && !/^\d{6}$/.test(code.trim())) e.code = "Telegram'ga kelgan 6 xonali kodni kiriting";
    if (!info.needsCode && !current) e.current = 'Joriy parolni kiriting';
    setError(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      const r = await erpApi<ErpChangeResult>('/account/credentials', {
        method: 'POST',
        body: { login: newLogin, password: next || undefined, password2: again || undefined, code: info.needsCode ? code.trim() : undefined, currentPassword: info.needsCode ? undefined : current, refreshToken: (await secure.get(KEYS.erpRefresh)) ?? undefined },
      });
      // Server boshqa seanslarni yopdi — shu telefon yangi juftlik bilan kirgan holda qoladi
      await useSession.getState().signInErp({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
      dialog('Saqlandi', r.passwordChanged ? 'Parol o\'zgartirildi. Boshqa qurilmalarda qayta kirish kerak bo\'ladi.' : `Endi login: ${r.login}`, [
        { text: 'Yopish', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError({ form: err instanceof ApiException ? err.message : 'Tarmoq xatosi. Internetni tekshiring' });
    } finally { setLoading(false); }
  };

  const eye = <IconButton icon={show ? 'eye-off' : 'eye'} label={show ? 'Parolni yashirish' : "Parolni ko'rsatish"} onPress={() => setShow((v) => !v)} size={size.touch - space.sm} tone="muted" />;

  return (
    <AuthScreen>
      <AuthIcon icon="key-round" />
      <Title hint={info?.needsCode ? 'Yangi login yoki parolni kiriting va Telegram kod bilan tasdiqlang.' : 'Yangi login yoki parolni kiriting va joriy parol bilan tasdiqlang.'}>Login va parol</Title>

      <Appear delay={130} style={{ marginTop: space.xxl }}>
        <Input label="Login" value={login} onChangeText={(v) => { setLogin(v); setError((x) => ({ ...x, login: undefined })); }} autoCapitalize="none" autoCorrect={false} autoComplete="username" mono error={error.login} hint={info?.loginHint} />
      </Appear>

      <Appear delay={170}>
        <Input label="Yangi parol (o'zgartirmasangiz — bo'sh)" value={next} onChangeText={(v) => { setNext(v); setError((x) => ({ ...x, next: undefined })); }} secureTextEntry={!show} autoComplete="new-password" placeholder="••••••••" mono error={error.next} right={eye} containerStyle={{ marginBottom: 0 }} />
        {next ? <Strength password={next} /> : null}
      </Appear>

      {next ? (
        <Appear delay={210} style={{ marginTop: space.lg }}>
          <Input label="Yangi parolni takrorlang" value={again} onChangeText={(v) => { setAgain(v); setError((x) => ({ ...x, again: undefined })); }} secureTextEntry={!show} autoComplete="new-password" placeholder="••••••••" mono error={error.again} containerStyle={{ marginBottom: 0 }} />
        </Appear>
      ) : null}

      {info?.needsCode ? (
        <Appear delay={250} style={{ marginTop: space.lg }}>
          <Input label="Telegram kod" value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError((x) => ({ ...x, code: undefined })); }} keyboardType="number-pad" placeholder="000000" mono error={error.code} containerStyle={{ marginBottom: 0 }} />
          <GhostButton title={sending ? 'Yuborilmoqda…' : sent ? 'Kodni qayta yuborish' : 'Kod yuborish'} icon="send" onPress={sendCode} />
          {sent ? <InfoCard icon="info" tone="info">{sent}</InfoCard> : null}
        </Appear>
      ) : info ? (
        <Appear delay={250} style={{ marginTop: space.lg }}>
          <Input label="Joriy parol" value={current} onChangeText={(v) => { setCurrent(v); setError((x) => ({ ...x, current: undefined })); }} secureTextEntry autoComplete="current-password" placeholder="••••••••" mono error={error.current} containerStyle={{ marginBottom: 0 }} />
        </Appear>
      ) : null}

      <ErrorBox text={error.form} />

      <Appear delay={290} style={{ marginTop: space.lg }}>
        <PrimaryButton title={loading ? 'Saqlanmoqda…' : 'Saqlash'} icon={null} onPress={submit} loading={loading} disabled={!info} />
      </Appear>
    </AuthScreen>
  );
}
