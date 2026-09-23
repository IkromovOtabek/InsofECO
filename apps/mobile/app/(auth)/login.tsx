import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhoneSchema } from '@insof/shared';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { erpText } from '@/design/tokens';
import { Appear, PressScale } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { erpAuth } from '@/core/erp';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';

/**
 * Kirish oynasi — "ERP Mobil" maketining qorong'i varianti.
 *
 * Bitta maydon ikkala tizimga xizmat qiladi:
 *   telefon raqam (+998…) → Insof ECO: tadbirkor / quruvchi / haydovchi;
 *   login (harfli)        → Insof ERP: zavod xodimlari.
 * Qaysi tizimga borishi kiritilgan qiymatdan aniqlanadi va maydon ostida yozib turiladi.
 */
const D = {
  bg: '#12151B',
  surface: '#1D222B',
  border: '#343C48',
  text: '#F5F4EF',
  muted: '#AEB6C1',
  faint: '#98A2AF',
  accent: '#FFBE3D',
  line: '#252C37',
};

/** Raqamlar 9 (901234567) yoki 12 (998901234567) ta bo'lsa — telefon. Aks holda ERP login. */
function detectKind(raw: string): 'eco' | 'erp' | null {
  const v = raw.trim();
  if (!v) return null;
  if (!/^[+\d\s()-]+$/.test(v)) return 'erp';
  const d = v.replace(/\D/g, '');
  return d.length === 9 || d.length === 12 ? 'eco' : 'erp';
}

const toPhone = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  return `+${d.length === 9 ? `998${d}` : d}`;
};

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signInErp } = useSession();
  const [ident, setIdent] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ ident?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const kind = useMemo(() => detectKind(ident), [ident]);

  const submit = async () => {
    const next: typeof error = {};
    if (!ident.trim()) next.ident = 'Login yoki telefon kiriting';
    if (password.length < 4) next.password = 'Parol kamida 4 belgi';

    const phone = kind === 'eco' ? PhoneSchema.safeParse(toPhone(ident)) : null;
    if (kind === 'eco' && phone && !phone.success) next.ident = phone.error.issues[0]?.message ?? "Telefon noto'g'ri";

    setError(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      if (kind === 'eco') {
        const r = await authApi.login(phone!.data!, password);
        await signIn({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
      } else {
        const r = await erpAuth.login(ident.trim(), password);
        await signInErp({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
      }
    } catch (e) {
      setError({ form: e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring' });
    } finally {
      setLoading(false);
    }
  };

  const field = (err?: string): object => ({
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: err ? '#C9563A' : D.border,
    backgroundColor: D.surface,
    color: D.text,
    fontFamily: erpText.meta.fontFamily,
    fontSize: 14.5,
  });

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 26, flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          <Appear from={16}>
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Orqaga"
              style={{ width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: D.border, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}
            >
              <Icon name="chevron-back" size={20} color={D.muted} />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: D.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="layers" size={21} color={D.bg} />
              </View>
              <View>
                <Txt style={{ fontFamily: erpText.title.fontFamily, fontSize: 16, letterSpacing: 0.3, color: D.text }}>ERP MOBIL</Txt>
                <Txt style={{ fontSize: 11, color: D.muted, letterSpacing: 0.4 }}>Insof beton zavodi</Txt>
              </View>
            </View>
          </Appear>

          <Appear delay={80}>
            <Txt style={{ fontFamily: erpText.title.fontFamily, fontSize: 31, lineHeight: 35, letterSpacing: -0.6, color: D.text, marginTop: 32 }}>Tizimga kirish</Txt>
            <Txt style={{ fontSize: 13.5, lineHeight: 21, color: D.muted, marginTop: 8, marginBottom: 26 }}>
              Har bir bo&apos;lim o&apos;z login va paroli bilan kiradi. Ruxsatlar rolga qarab ochiladi.
            </Txt>
          </Appear>

          <Appear delay={140}>
            <Txt style={{ ...erpText.label, color: D.muted, letterSpacing: 0.5, marginBottom: 7 }}>Login yoki telefon</Txt>
            <TextInput
              value={ident}
              onChangeText={setIdent}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="log1  yoki  +998 90 123 45 67"
              placeholderTextColor={D.faint}
              style={field(error.ident)}
            />
            {error.ident ? <Txt style={{ fontSize: 12, color: '#FF8F5E', marginTop: 6 }}>{error.ident}</Txt> : null}
            {kind ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 9, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: kind === 'erp' ? '#243444' : '#18382F' }}>
                <Icon name={kind === 'erp' ? 'business' : 'call'} size={12} color={kind === 'erp' ? '#66AEFF' : '#2FD9C2'} />
                <Txt style={{ ...erpText.chip, marginLeft: 6, color: kind === 'erp' ? '#66AEFF' : '#2FD9C2' }}>
                  {kind === 'erp' ? 'Zavod xodimi — Insof ERP' : 'Telefon — Insof ECO'}
                </Txt>
              </View>
            ) : null}
          </Appear>

          <Appear delay={190} style={{ marginTop: 16 }}>
            <Txt style={{ ...erpText.label, color: D.muted, letterSpacing: 0.5, marginBottom: 7 }}>Parol</Txt>
            <View style={{ justifyContent: 'center' }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!show}
                textContentType="password"
                autoComplete="password"
                placeholder="••••••"
                placeholderTextColor={D.faint}
                onSubmitEditing={submit}
                returnKeyType="go"
                style={{ ...field(error.password), paddingRight: 54 }}
              />
              <Pressable
                onPress={() => setShow((v) => !v)}
                accessibilityLabel={show ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                style={{ position: 'absolute', right: 3, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={D.muted} />
              </Pressable>
            </View>
            {error.password ? <Txt style={{ fontSize: 12, color: '#FF8F5E', marginTop: 6 }}>{error.password}</Txt> : null}
            <Txt onPress={() => router.push('/(auth)/forgot')} style={{ ...erpText.label, fontSize: 12.5, color: D.accent, alignSelf: 'flex-end', marginTop: 10 }}>
              Parolni unutdingizmi?
            </Txt>
          </Appear>

          {error.form ? (
            <Appear from={8} style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 13, borderRadius: 13, backgroundColor: '#33201A', borderWidth: 1, borderColor: '#5C3526' }}>
                <Icon name="alert-circle" size={18} color="#FF8F5E" />
                <Txt style={{ flex: 1, marginLeft: 9, fontSize: 13.5, lineHeight: 19, color: '#FFC7AE' }}>{error.form}</Txt>
              </View>
            </Appear>
          ) : null}

          <Appear delay={250} style={{ marginTop: 26 }}>
            <PressScale onPress={submit} disabled={loading}>
              <View style={{ height: 54, borderRadius: 14, backgroundColor: D.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: loading ? 0.6 : 1 }}>
                <Txt style={{ ...erpText.button, color: D.bg }}>{loading ? 'Kirilmoqda…' : 'Kirish'}</Txt>
                {!loading ? <Icon name="arrow-forward" size={18} color={D.bg} /> : null}
              </View>
            </PressScale>
          </Appear>

          <Appear delay={300}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: D.border }} />
              <Txt style={{ fontSize: 11.5, color: D.faint, letterSpacing: 1 }}>YOKI</Txt>
              <View style={{ flex: 1, height: 1, backgroundColor: D.border }} />
            </View>
            <PressScale onPress={() => router.push('/(auth)/phone')} haptic={false}>
              <View style={{ height: 52, borderRadius: 14, borderWidth: 1, borderColor: D.border, backgroundColor: D.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Icon name="chatbox-ellipses-outline" size={18} color="#2FD9C2" />
                <Txt style={{ ...erpText.rowTitle, fontSize: 14.5, color: D.text }}>SMS-kod orqali kirish</Txt>
              </View>
            </PressScale>
          </Appear>

          <View style={{ marginTop: 'auto', paddingTop: 22, borderTopWidth: 1, borderTopColor: D.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt style={{ fontSize: 11.5, color: D.faint }}>Xodimlar ERP logini bilan kiradi</Txt>
            <Txt onPress={() => router.replace('/(auth)/register')} style={{ ...erpText.label, fontSize: 11.5, color: D.accent }}>Ro&apos;yxatdan o&apos;tish</Txt>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
