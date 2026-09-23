import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { RegisterSchema } from '@insof/shared';
import { Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/ui';
import { erpText } from '@/design/tokens';
import { Appear, PressScale, stagger } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { AuthScreen, D, DarkField, ErrorBox, FieldError, FooterLink, Hint, Label, PrimaryButton, Steps, Strength, Title } from '@/features/auth/ui';

/**
 * Ro'yxatdan o'tish — maketdagi uch qadamli oqim.
 *   1) Ma'lumotlar: kim sifatida va shaxsiy/tashkilot ma'lumotlari;
 *   2) SMS tasdiq: ro'yxatdan o'tgach raqam tasdiqlanadi (OTP ekrani);
 *   3) Tayyor.
 * Serverda ro'yxatdan o'tish bitta so'rov — shuning uchun 2-qadam parol bilan kirgandan
 * keyin, xohlasa, telefonni tasdiqlash uchun ishlatiladi.
 */
type RoleKey = 'TADBIRKOR' | 'QURUVCHI' | 'HAYDOVCHI';
const ROLES: { key: RoleKey; icon: IconName; title: string; desc: string }[] = [
  { key: 'TADBIRKOR', icon: 'business-outline', title: 'Tadbirkor', desc: 'Beton zavodi yoki qurilish kompaniyasi egasi' },
  { key: 'QURUVCHI', icon: 'home-outline', title: 'Quruvchi', desc: 'Prorab yoki xususiy quruvchi — beton buyurtma qiladi' },
  { key: 'HAYDOVCHI', icon: 'bus-outline', title: 'Haydovchi', desc: 'Mikser haydovchisi — reyslarni qabul qiladi' },
];

export default function Register() {
  const router = useRouter();
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
        <View style={{ marginTop: 24, gap: 10 }}>
          {ROLES.map((r, i) => (
            <Appear key={r.key} delay={stagger(i, 60)}>
              <PressScale
                onPress={() => { if (Platform.OS === 'ios') void Haptics.selectionAsync(); setRole(r.key); }}
                haptic={false}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, borderRadius: 15, padding: 14, minHeight: 74 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: D.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={r.icon} size={20} color={D.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ ...erpText.rowTitle, fontSize: 15, color: D.text }}>{r.title}</Txt>
                    <Txt style={{ fontSize: 12, lineHeight: 17, color: D.muted, marginTop: 3 }}>{r.desc}</Txt>
                  </View>
                  <Icon name="chevron-forward" size={18} color={D.faint} />
                </View>
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

      <Appear delay={60} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 22 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: D.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={meta.icon} size={19} color={D.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt style={{ ...erpText.eyebrow, color: D.accent }}>ROL</Txt>
          <Txt style={{ fontFamily: erpText.title.fontFamily, fontSize: 20, color: D.text }}>{meta.title}</Txt>
        </View>
        <Txt onPress={() => setRole(null)} style={{ ...erpText.label, fontSize: 12.5, color: D.muted }}>O&apos;zgartirish</Txt>
      </Appear>

      <Appear delay={110} style={{ marginTop: 22 }}>
        <Label>Ism va familiya</Label>
        <DarkField value={fullName} onChangeText={setFullName} placeholder="Rustam Yusupov" textContentType="name" autoComplete="name" error={errors.fullName} autoFocus />
        <FieldError text={errors.fullName} />
      </Appear>

      <Appear delay={150} style={{ marginTop: 14 }}>
        <Label>Telefon raqam</Label>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <View style={{ height: 52, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: D.border, backgroundColor: D.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ ...erpText.meta, fontSize: 14.5, color: D.muted }}>+998</Txt>
          </View>
          <DarkField value={local} onChangeText={(v) => setLocal(v.replace(/\D/g, '').slice(0, 9))} keyboardType="number-pad" placeholder="90 123 45 67" mono error={errors.phone} style={{ flex: 1 }} />
        </View>
        <FieldError text={errors.phone} />
      </Appear>

      {role === 'TADBIRKOR' ? (
        <Appear delay={190} style={{ marginTop: 14 }}>
          <Label>Tashkilot turi</Label>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            {(['PLANT', 'CONTRACTOR'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setOrgType(t)}
                style={{ flex: 1, height: 48, borderRadius: 13, borderWidth: orgType === t ? 1.5 : 1, borderColor: orgType === t ? D.accent : D.border, backgroundColor: orgType === t ? D.surfaceAlt : D.surface, alignItems: 'center', justifyContent: 'center' }}
              >
                <Txt style={{ ...erpText.label, fontSize: 13, color: orgType === t ? D.text : D.muted }}>{t === 'PLANT' ? 'Beton zavodi' : 'Qurilish firmasi'}</Txt>
              </Pressable>
            ))}
          </View>
          <View style={{ marginTop: 14 }}>
            <Label>Korxona nomi</Label>
            <DarkField value={orgName} onChangeText={setOrgName} placeholder="Meridian Industrial MChJ" autoComplete="organization" error={errors.organization} />
            <FieldError text={errors.organization} />
          </View>
        </Appear>
      ) : null}

      {role === 'QURUVCHI' ? (
        <Appear delay={190} style={{ marginTop: 14 }}>
          <Label>Qurilish firmasi (ixtiyoriy)</Label>
          <DarkField value={orgName} onChangeText={setOrgName} placeholder="Nomi yoki bo'sh qoldiring" autoComplete="organization" />
        </Appear>
      ) : null}

      {role === 'HAYDOVCHI' ? (
        <Appear delay={190} style={{ marginTop: 14 }}>
          <Label>Qaysi zavodda ishlaysiz</Label>
          {plants.length === 0 ? <Hint>Zavodlar yuklanmoqda…</Hint> : null}
          <View style={{ gap: 8 }}>
            {plants.map((p) => {
              const on = plantOrgId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPlantOrgId(p.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: on ? 1.5 : 1, borderColor: on ? D.accent : D.border, backgroundColor: on ? D.surfaceAlt : D.surface }}
                >
                  <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? D.accent : D.faint} />
                  <View style={{ flex: 1 }}>
                    <Txt style={{ ...erpText.rowTitle, color: D.text }}>{p.name}</Txt>
                    {p.address ? <Txt style={{ fontSize: 11.5, color: D.muted, marginTop: 2 }}>{p.address}</Txt> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <FieldError text={errors.plantOrgId} />
          <Hint>Zavod tadbirkori tasdiqlagach, reyslar ko&apos;rina boshlaydi.</Hint>
        </Appear>
      ) : null}

      <Appear delay={230} style={{ marginTop: 14 }}>
        <Label>Parol</Label>
        <DarkField value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="••••••••" mono error={errors.password} />
        <FieldError text={errors.password} />
        <Strength password={password} />
      </Appear>

      <Appear delay={270} style={{ marginTop: 16 }}>
        <Pressable onPress={() => setAgree((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: agree ? D.accent : D.borderSoft, backgroundColor: agree ? D.accent : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            {agree ? <Icon name="checkmark" size={13} color={D.bg} /> : null}
          </View>
          <Txt style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: '#D5DBE3' }}>
            Ommaviy oferta va maxfiylik siyosati shartlariga roziman
          </Txt>
        </Pressable>
      </Appear>

      <ErrorBox text={errors.form} />

      <Appear delay={310} style={{ marginTop: 20 }}>
        <PrimaryButton title={loading ? 'Yuborilmoqda…' : 'Davom etish'} onPress={submit} loading={loading} disabled={!agree} />
      </Appear>
    </AuthScreen>
  );
}
