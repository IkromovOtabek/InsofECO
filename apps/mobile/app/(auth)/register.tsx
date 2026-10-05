import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { RegisterSchema } from '@insof/shared';
import { Button, Callout, Card, IconButton, IconTile, Input, Label, Select, Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/icons';
import { radius, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Appear, PressScale, stagger } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { PhotoPicker, PickedPhoto } from '@/features/auth/photo-picker';
import { copyText, dialog, toast } from '@/design/ui';
import { afterLogin } from '@/features/shop/after-login';
import { AuthScreen, ErrorBox, FooterLink, Hint, PrimaryButton, REGISTER_STEPS, Steps, Strength, TextLink, Title, generatePassword } from '@/features/auth/ui';

/**
 * Ro'yxatdan o'tish — uch qadamli oqim:
 *   1) Telefon (`phone?mode=register`) — rozilik va raqam, kod Telegram'ga (SMS yo'q);
 *   2) Kod (`otp?mode=register`) — raqam egaligi tasdiqlanadi, server bir martalik
 *      `phoneVerificationToken` beradi (10 daqiqa, shu raqamga bog'langan);
 *   3) Shu ekran: rol (Mijoz / Haydovchi), ism, parol, haydovchiga — zavod.
 * Tokensiz (to'g'ridan-to'g'ri ochilgan) bo'lsa — 1-qadamga yo'naltiriladi.
 */
type RoleKey = 'TADBIRKOR' | 'QURUVCHI' | 'HAYDOVCHI';
const ROLES: { key: RoleKey; icon: IconName; title: string; desc: string }[] = [
  // Ro'yxatdan o'tishda ikki yo'l: mijoz (QURUVCHI roli — beton va material buyurtma qiladi) va haydovchi.
  // Tadbirkor hisobini zavod/kompaniya ERP orqali ochadi — bu yerda tanlanmaydi (mavjud hisoblar kirishda ishlaydi).
  { key: 'QURUVCHI', icon: 'shopping-cart', title: 'Mijoz', desc: 'Beton va qurilish materiallarini buyurtma qilaman, yetkazishni kuzataman' },
  { key: 'HAYDOVCHI', icon: 'truck', title: 'Haydovchi', desc: 'Mikser haydovchisi — reyslarni qabul qilaman' },
];

export default function Register() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  // Kod tasdig'idan keyin otp.tsx beradi; yo'q bo'lsa — telefon qadamiga
  const { phone = '', token = '' } = useLocalSearchParams<{ phone?: string; token?: string }>();
  const [role, setRole] = useState<RoleKey | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<'PLANT' | 'CONTRACTOR'>('PLANT');
  const [plants, setPlants] = useState<{ id: string; name: string; address?: string | null }[]>([]);
  /** Zavodlar ro'yxati holati: yiqilsa abadiy "yuklanmoqda" emas — xato va "Qayta urinish". */
  const [plantsState, setPlantsState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [plantOrgId, setPlantOrgId] = useState<string>();
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const loadPlants = useCallback(() => {
    setPlantsState('loading');
    authApi.plants()
      .then((list) => { setPlants(list); setPlantsState('ready'); })
      .catch(() => setPlantsState('error'));
  }, []);
  useEffect(() => { if (role === 'HAYDOVCHI' && plantsState === 'idle') loadPlants(); }, [role, plantsState, loadPlants]);

  if (!token || !phone) return <Redirect href={{ pathname: '/(auth)/phone', params: { mode: 'register' } }} />;

  // Tasdiq muddati o'tgan / token ishlatilgan — raqamni qayta tasdiqlash
  const reverify = () => router.replace({ pathname: '/(auth)/phone', params: { mode: 'register' } });

  // Ishonchli parol — ko'rinib turadi va darhol buferga olinadi (keyin menejerga yoki eslatmaga saqlasin)
  const makePassword = async () => {
    const p = generatePassword();
    setPassword(p); setShowPw(true); setErrors((e) => ({ ...e, password: '' }));
    if (await copyText(p)) toast.success('Parolni xavfsiz joyga saqlab qo\'ying', 'Parol nusxalandi');
    else toast.warning('Nusxa olinmadi — parolni yozib oling', 'Parol yaratildi');
  };
  const copyPassword = async () => {
    if (!password) return;
    if (await copyText(password)) toast.success('Parol buferga olindi', 'Nusxalandi');
    else toast.error('Nusxa olinmadi');
  };

  const submit = async () => {
    if (!role || loading) return;
    const raw = {
      fullName: fullName.trim(), phone, password, role,
      organization: role === 'TADBIRKOR' ? { name: orgName.trim(), type: orgType } : role === 'QURUVCHI' && orgName.trim() ? { name: orgName.trim(), type: 'CONTRACTOR' as const } : undefined,
      plantOrgId: role === 'HAYDOVCHI' ? plantOrgId : undefined,
      device: { deviceId: 'x'.repeat(8), platform: 'ios' as const }, // faqat validatsiya uchun; haqiqiysi api.ts da
    };
    const parsed = RegisterSchema.safeParse(raw);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[String(i.path[0] ?? 'form')] = i.message;
      return setErrors(e);
    }
    setErrors({}); setLoading(true);
    try {
      const { device: _d, ...input } = parsed.data; void _d;
      const r = await authApi.register({ ...input, phoneVerificationToken: token });
      await signIn({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
      // Rasm — hisob ochilgach, sessiya bilan. Yiqilsa ro'yxat bekor bo'lmaydi: keyin profildan qo'yiladi
      if (photo) {
        try { useSession.getState().setUser(await authApi.uploadAvatar(photo.uri, photo.mimeType)); }
        catch { toast.error("Rasm yuklanmadi — keyinroq profildan qo'shishingiz mumkin", 'Rasm'); }
      }
      // Mahsulotdan buyurtma uchun kelgan — to'g'ri o'sha mahsulotga, buyurtmani yakunlasin
      const back = afterLogin.take();
      if (back) { toast.success("Ro'yxatdan o'tdingiz — endi buyurtma bera olasiz"); router.dismissTo(back as never); return; }
      router.replace('/(auth)/done');
    } catch (e) {
      const reason = e instanceof ApiException ? (e.body.details as { reason?: string } | undefined)?.reason : undefined;
      if (reason === 'PHONE_NOT_VERIFIED') {
        dialog('Raqamni qayta tasdiqlang', "Tasdiq kodi muddati tugagan (10 daqiqa). Raqamga yangi kod yuboramiz — kiritgan ma'lumotlaringizni qayta to'ldirasiz.", [
          { text: 'Kodni qayta olish', onPress: reverify },
        ], { tone: 'warning', icon: 'clock' });
        return;
      }
      setErrors({ form: e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring' });
    } finally { setLoading(false); }
  };

  // Maxfiylik siyosatiga rozilik telefon qadamida berilgan
  const pickRole = (key: RoleKey) => {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    setErrors({});
    setRole(key);
  };

  /** Tasdiqlangan raqam — o'zgartirib bo'lmaydi (boshqa raqam = yangi kod). */
  const verifiedPhone = (
    <Callout tone="success" icon="shield-check">
      <Txt v="bodySm"><Txt v="bodySm" mono color="strong">{phone}</Txt> raqami tasdiqlandi</Txt>
    </Callout>
  );

  // ── 1-ekran: kim sifatida ──
  if (!role) {
    return (
      <AuthScreen
        onBack={reverify}
        footer={<FooterLink text="Hisobingiz bormi?" action="Kirish" onPress={() => router.replace('/(auth)/login')} />}
      >
        <Steps labels={REGISTER_STEPS} current={2} />
        <Title hint="Keyinchalik bitta hisobga boshqa rollar ham qo'shiladi.">Kim sifatida ro&apos;yxatdan o&apos;tasiz?</Title>
        <Appear delay={30} style={{ marginTop: space.lg }}>{verifiedPhone}</Appear>
        <View style={{ marginTop: space.xl, gap: space.md }}>
          {ROLES.map((r, i) => (
            <Appear key={r.key} delay={stagger(i, 60)}>
              <PressScale
                onPress={() => pickRole(r.key)}
                haptic={false}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}. ${r.desc}`}
              >
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <IconTile icon={r.icon} module="brand" />
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong">{r.title}</Txt>
                    <Txt v="caption">{r.desc}</Txt>
                  </View>
                  <Icon name="chevron-right" tone="faint" />
                </Card>
              </PressScale>
            </Appear>
          ))}
        </View>
        <ErrorBox text={errors.form} />
      </AuthScreen>
    );
  }

  // ── 2-ekran: forma ──
  const meta = ROLES.find((r) => r.key === role)!;
  return (
    <AuthScreen
      onBack={() => setRole(null)}
      footer={<FooterLink text="Hisobingiz bormi?" action="Kirish" onPress={() => router.replace('/(auth)/login')} />}
    >
      <Steps labels={REGISTER_STEPS} current={2} />

      <Appear delay={60} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xxl }}>
        <IconTile icon={meta.icon} module="brand" />
        <View style={{ flex: 1 }}>
          <Txt v="overline" color="brand">Rol</Txt>
          <Txt v="titleMd">{meta.title}</Txt>
        </View>
        <TextLink onPress={() => setRole(null)}>O&apos;zgartirish</TextLink>
      </Appear>

      <Appear delay={90} style={{ marginTop: space.xxl }}>
        <PhotoPicker value={photo} onChange={setPhoto} />
      </Appear>

      <Appear delay={110}>
        <Input label="Ism va familiya" value={fullName} onChangeText={setFullName} placeholder="Rustam Yusupov" textContentType="name" autoComplete="name" error={errors.fullName} />
      </Appear>

      <Appear delay={150} style={{ marginBottom: space.lg }}>
        <Label>Telefon raqam</Label>
        {verifiedPhone}
      </Appear>

      {role === 'TADBIRKOR' ? (
        <Appear delay={190}>
          <Select
            label="Tashkilot turi"
            value={orgType}
            options={[{ value: 'PLANT', label: 'Beton zavodi' }, { value: 'CONTRACTOR', label: 'Qurilish firmasi' }]}
            onChange={setOrgType}
          />
          <Input label="Korxona nomi" value={orgName} onChangeText={setOrgName} placeholder="Meridian Industrial MChJ" autoComplete="organization" error={errors.organization} />
        </Appear>
      ) : null}

      {role === 'QURUVCHI' ? (
        <Appear delay={190}>
          <Input label="Qurilish firmasi (ixtiyoriy)" value={orgName} onChangeText={setOrgName} placeholder="Nomi yoki bo'sh qoldiring" autoComplete="organization" />
        </Appear>
      ) : null}

      {role === 'HAYDOVCHI' ? (
        <Appear delay={190}>
          {plantsState !== 'ready' || plants.length === 0 ? (
            <View style={{ marginBottom: space.lg }}>
              <Label>Qaysi zavodda ishlaysiz</Label>
              {plantsState === 'error' ? (
                <Callout tone="danger">
                  <View style={{ gap: space.sm }}>
                    <Txt v="bodySm">Zavodlar ro&apos;yxati yuklanmadi. Internetni tekshirib, qayta urinib ko&apos;ring.</Txt>
                    <Button title="Qayta urinish" icon="refresh-cw" variant="secondary" size="md" full={false} onPress={loadPlants} />
                  </View>
                </Callout>
              ) : plantsState === 'ready' ? (
                <Callout tone="warning">
                  <View style={{ gap: space.sm }}>
                    <Txt v="bodySm">Hozircha ro&apos;yxatda zavod yo&apos;q. Zavod dispetcheridan so&apos;rang yoki keyinroq qayta urinib ko&apos;ring.</Txt>
                    <Button title="Yangilash" icon="refresh-cw" variant="secondary" size="md" full={false} onPress={loadPlants} />
                  </View>
                </Callout>
              ) : (
                <Hint>Zavodlar yuklanmoqda…</Hint>
              )}
              {errors.plantOrgId ? <Txt v="caption" color="danger" style={{ marginTop: space.xs }}>{errors.plantOrgId}</Txt> : null}
            </View>
          ) : (
            <Select
              label="Qaysi zavodda ishlaysiz"
              value={plantOrgId ?? null}
              options={plants.map((p) => ({ value: p.id, label: p.name, hint: p.address ?? undefined }))}
              onChange={(v) => setPlantOrgId(v)}
              error={errors.plantOrgId}
            />
          )}
          <Hint>Zavod tadbirkori tasdiqlagach, reyslar ko&apos;rina boshlaydi.</Hint>
        </Appear>
      ) : null}

      <Appear delay={230} style={{ marginTop: space.lg }}>
        <Input
          label="Parol"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          autoComplete="new-password"
          placeholder="••••••••"
          mono
          error={errors.password}
          containerStyle={{ marginBottom: 0 }}
          right={(
            <View style={{ flexDirection: 'row' }}>
              {password ? <IconButton icon="copy" label="Parolni nusxalash" onPress={() => void copyPassword()} size={size.touch - space.sm} tone="muted" /> : null}
              <IconButton icon={showPw ? 'eye-off' : 'eye'} label={showPw ? 'Parolni yashirish' : "Parolni ko'rsatish"} onPress={() => setShowPw((v) => !v)} size={size.touch - space.sm} tone="muted" />
            </View>
          )}
        />
        <Strength password={password} />
        <Pressable
          onPress={() => void makePassword()}
          accessibilityRole="button"
          accessibilityLabel="Ishonchli parol yaratish va nusxalash"
          hitSlop={space.xs}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.touch, alignSelf: 'flex-start' }}
        >
          <Icon name="sparkles" tone="brand" size={size.iconSm} />
          <Txt v="label" color="brand">Ishonchli parol yaratish</Txt>
        </Pressable>
      </Appear>

      <ErrorBox text={errors.form} />

      <Appear delay={310} style={{ marginTop: space.xl }}>
        <PrimaryButton title={loading ? 'Yuborilmoqda…' : "Ro'yxatdan o'tish"} onPress={submit} loading={loading} disabled={role === 'HAYDOVCHI' && !plantOrgId} />
      </Appear>
    </AuthScreen>
  );
}
