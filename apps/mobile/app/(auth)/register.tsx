import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { RegisterSchema } from '@insof/shared';
import { Card, IconTile, Input, Label, Select, Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/icons';
import { radius, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Appear, PressScale, stagger } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { AuthScreen, ErrorBox, FooterLink, Hint, PrimaryButton, Steps, Strength, TextLink, Title } from '@/features/auth/ui';

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

/** "+998" prefiksi — input balandligida, fokus halqasi hisobga olingan. */
function PhonePrefix() {
  const { c } = useTheme();
  return (
    <View style={{ height: size.input + size.ring * 2, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: size.hairline, borderColor: c.borderDefault, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center', marginTop: size.ring }}>
      <Txt v="body" mono color="muted">+998</Txt>
    </View>
  );
}

export default function Register() {
  const router = useRouter();
  const { c } = useTheme();
  const signIn = useSession((s) => s.signIn);
  const [role, setRole] = useState<RoleKey | null>(null);
  const [fullName, setFullName] = useState('');
  const [local, setLocal] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<'PLANT' | 'CONTRACTOR'>('PLANT');
  const [agree, setAgree] = useState(true);
  const [plants, setPlants] = useState<{ id: string; name: string; address?: string | null }[]>([]);
  const [plantOrgId, setPlantOrgId] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (role === 'HAYDOVCHI' && plants.length === 0) authApi.plants().then(setPlants).catch(() => {}); }, [role, plants.length]);

  const phone = `+998${local.replace(/\D/g, '')}`;

  const submit = async () => {
    if (!role) return;
    if (!agree) return setErrors({ form: 'Davom etish uchun shartlarga rozilik bildiring' });
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
      router.replace('/(auth)/done');
    } catch (e) {
      setErrors({ form: e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring' });
    } finally { setLoading(false); }
  };

  // ── 1-ekran: kim sifatida ──
  if (!role) {
    return (
      <AuthScreen
        onBack={() => router.replace('/(auth)/login')}
        footer={<FooterLink text="Hisobingiz bormi?" action="Kirish" onPress={() => router.replace('/(auth)/login')} />}
      >
        <Steps labels={["Ma'lumotlar", 'SMS tasdiq', 'Tayyor']} current={0} />
        <Title hint="Keyinchalik bitta hisobga boshqa rollar ham qo'shiladi.">Kim sifatida ro&apos;yxatdan o&apos;tasiz?</Title>
        <View style={{ marginTop: space.xxl, gap: space.md }}>
          {ROLES.map((r, i) => (
            <Appear key={r.key} delay={stagger(i, 60)}>
              <PressScale
                onPress={() => { if (Platform.OS === 'ios') void Haptics.selectionAsync(); setRole(r.key); }}
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
      <Steps labels={["Ma'lumotlar", 'SMS tasdiq', 'Tayyor']} current={0} />

      <Appear delay={60} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xxl }}>
        <IconTile icon={meta.icon} module="brand" />
        <View style={{ flex: 1 }}>
          <Txt v="overline" color="brand">Rol</Txt>
          <Txt v="titleMd">{meta.title}</Txt>
        </View>
        <TextLink onPress={() => setRole(null)}>O&apos;zgartirish</TextLink>
      </Appear>

      <Appear delay={110} style={{ marginTop: space.xxl }}>
        <Input label="Ism va familiya" value={fullName} onChangeText={setFullName} placeholder="Rustam Yusupov" textContentType="name" autoComplete="name" error={errors.fullName} autoFocus />
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
        <Input label="Parol" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="••••••••" mono error={errors.password} containerStyle={{ marginBottom: 0 }} />
        <Strength password={password} />
      </Appear>

      <Appear delay={270} style={{ marginTop: space.lg }}>
        <Pressable
          onPress={() => setAgree((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agree }}
          accessibilityLabel="Ommaviy oferta va maxfiylik siyosati shartlariga roziman"
          hitSlop={space.sm}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: size.touch, paddingVertical: space.sm }}
        >
          <View style={{ width: size.iconMd, height: size.iconMd, borderRadius: radius.xs, borderWidth: size.ring, borderColor: agree ? c.brand : c.borderStrong, backgroundColor: agree ? c.brand : c.bgSurface, alignItems: 'center', justifyContent: 'center' }}>
            {agree ? <Icon name="check" size={size.iconSm - 2} tone="onBrand" strokeWidth={2.5} /> : null}
          </View>
          <Txt v="bodySm" style={{ flex: 1 }}>Ommaviy oferta va maxfiylik siyosati shartlariga roziman</Txt>
        </Pressable>
      </Appear>

      <ErrorBox text={errors.form} />

      <Appear delay={310} style={{ marginTop: space.xl }}>
        <PrimaryButton title={loading ? 'Yuborilmoqda…' : 'Davom etish'} onPress={submit} loading={loading} disabled={!agree} />
      </Appear>
    </AuthScreen>
  );
}
