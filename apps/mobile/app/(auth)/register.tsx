import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { RegisterSchema } from '@insof/shared';
import { Card, IconButton, IconTile, Input, Label, Select, Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/icons';
import { radius, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Appear, PressScale, stagger } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { useTelegramLogin } from '@/features/auth/telegram';
import { PhotoPicker, PickedPhoto } from '@/features/auth/photo-picker';
import { copyText, toast } from '@/design/ui';
import { afterLogin } from '@/features/shop/after-login';
import { AuthScreen, ConsentCheck, Divider, GhostButton, ErrorBox, FooterLink, Hint, PhonePrefix, PrimaryButton, Steps, Strength, TextLink, Title, generatePassword } from '@/features/auth/ui';

/**
 * Ro'yxatdan o'tish — uch qadamli oqim.
 *   1) Ma'lumotlar: kim sifatida va shaxsiy/tashkilot ma'lumotlari;
 *   2) SMS tasdiq: ro'yxatdan o'tgach raqam tasdiqlanadi (OTP ekrani);
 *   3) Tayyor.
 * Serverda ro'yxatdan o'tish bitta so'rov — shuning uchun 2-qadam parol bilan kirgandan
 * keyin, xohlasa, telefonni tasdiqlash uchun ishlatiladi.
 */
type RoleKey = 'TADBIRKOR' | 'QURUVCHI' | 'HAYDOVCHI';
const ROLES: { key: RoleKey; icon: IconName; title: string; desc: string }[] = [
  { key: 'TADBIRKOR', icon: 'briefcase', title: 'Tadbirkor', desc: 'Beton zavodi yoki qurilish kompaniyasi egasi' },
  { key: 'QURUVCHI', icon: 'hard-hat', title: 'Quruvchi', desc: 'Prorab yoki xususiy quruvchi — beton buyurtma qiladi' },
  { key: 'HAYDOVCHI', icon: 'truck', title: 'Haydovchi', desc: 'Mikser haydovchisi — reyslarni qabul qiladi' },
];

export default function Register() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  // Parolsiz tez yo'l: raqam Telegram'da tasdiqlanadi, keyin rol tanlash ekranida «Mijoz sifatida davom etish»
  const tg = useTelegramLogin();
  const [role, setRole] = useState<RoleKey | null>(null);
  const [fullName, setFullName] = useState('');
  const [local, setLocal] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<'PLANT' | 'CONTRACTOR'>('PLANT');
  const [agree, setAgree] = useState(false);
  const [plants, setPlants] = useState<{ id: string; name: string; address?: string | null }[]>([]);
  const [plantOrgId, setPlantOrgId] = useState<string>();
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (role === 'HAYDOVCHI' && plants.length === 0) authApi.plants().then(setPlants).catch(() => {}); }, [role, plants.length]);

  const phone = `+998${local.replace(/\D/g, '')}`;

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
    if (!role) return;
    if (!agree) return setErrors({ form: "Davom etish uchun maxfiylik siyosatiga rozilik bildiring" });
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
      const r = await authApi.register(input);
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
      setErrors({ form: e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring' });
    } finally { setLoading(false); }
  };

  // Rozilik bermaguncha ma'lumotlar formasiga o'tilmaydi — rol bosilsa sababi aytiladi
  const CONSENT_MSG = "Davom etish uchun maxfiylik siyosatiga rozilik bildiring";
  const pickRole = (key: RoleKey) => {
    if (!agree) {
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      toast.warning("Avval pastdagi maxfiylik siyosatiga rozilik belgisini qo'ying", 'Rozilik kerak');
      return setErrors({ form: CONSENT_MSG });
    }
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    setRole(key);
  };

  // ── 1-ekran: kim sifatida ──
  if (!role) {
    return (
      <AuthScreen
        onBack={() => router.replace('/(auth)/login')}
        footer={<FooterLink text="Hisobingiz bormi?" action="Kirish" onPress={() => router.replace('/(auth)/login')} />}
      >
        <Steps labels={["Ma'lumotlar", "Kod tasdig'i", 'Tayyor']} current={0} />
        <Title hint="Keyinchalik bitta hisobga boshqa rollar ham qo'shiladi.">Kim sifatida ro&apos;yxatdan o&apos;tasiz?</Title>
        <View style={{ marginTop: space.xxl, gap: space.md }}>
          {ROLES.map((r, i) => (
            <Appear key={r.key} delay={stagger(i, 60)}>
              <PressScale
                onPress={() => pickRole(r.key)}
                haptic={false}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}. ${r.desc}`}
                accessibilityHint={agree ? undefined : "Avval maxfiylik siyosatiga rozilik bildiring"}
              >
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, opacity: agree ? 1 : 0.55 }}>
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
        <Appear delay={300}>
          <Divider />
          <ConsentCheck value={agree} onChange={(v) => { setAgree(v); setErrors((e) => ({ ...e, form: '' })); }} />
          <GhostButton
            title={tg.waiting ? "Telegram'da raqamni ulashing…" : tg.starting ? 'Telegram ochilmoqda…' : "Telegram orqali ro'yxatdan o'tish"}
            icon="send"
            onPress={() => (agree ? void tg.start() : setErrors({ form: "Davom etish uchun maxfiylik siyosatiga rozilik bildiring" }))}
          />
          {tg.waiting ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
              <Txt v="caption">Botda raqamingizni ulashing — hisob o&apos;zi ochiladi</Txt>
              <TextLink onPress={tg.cancel}>Bekor qilish</TextLink>
            </View>
          ) : null}
          <ErrorBox text={errors.form || tg.error} />
        </Appear>
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
      <Steps labels={["Ma'lumotlar", "Kod tasdig'i", 'Tayyor']} current={0} />

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

      <Appear delay={150}>
        <Label>Telefon raqam</Label>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
          <PhonePrefix />
          <Input
            value={local}
            onChangeText={(v) => setLocal(v.replace(/\D/g, '').slice(0, 9))}
            keyboardType="number-pad"
            placeholder="90 123 45 67"
            accessibilityLabel="Telefon raqam"
            mono
            error={errors.phone}
            containerStyle={{ flex: 1 }}
          />
        </View>
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
          {plants.length === 0 ? (
            <View style={{ marginBottom: space.lg }}>
              <Label>Qaysi zavodda ishlaysiz</Label>
              <Hint>Zavodlar yuklanmoqda…</Hint>
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

      <Appear delay={270} style={{ marginTop: space.lg }}>
        <ConsentCheck value={agree} onChange={(v) => { setAgree(v); setErrors((e) => ({ ...e, form: '' })); }} />
      </Appear>

      <ErrorBox text={errors.form} />

      <Appear delay={310} style={{ marginTop: space.xl }}>
        <PrimaryButton title={loading ? 'Yuborilmoqda…' : 'Davom etish'} onPress={submit} loading={loading} disabled={!agree} />
      </Appear>
    </AuthScreen>
  );
}
