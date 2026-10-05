import React from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInputProps, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Callout, IconButton, IconTile, Input, Txt } from '@/design/primitives';
export { Callout };
import { Icon, IconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { Tone, elevation, radius, size, space, toneColors } from '@/design/tokens';
import { Appear } from '@/design/motion';
import i18n from '@/core/i18n';
import { config } from '@/core/config';

const LOGO = require('../../../assets/logo.png') as number;
const LOGO_RATIO = 970 / 210;

/**
 * Autentifikatsiya ekranlarining umumiy bo'laklari — umumiy dizayn tizimida (yorug'/qorong'i
 * tizim sozlamasiga ergashadi). Kirish, ro'yxat, SMS kod, parol tiklash va PIN shu yerdan quriladi.
 */

/** "+998" prefiksi — telefon maydoni yonida, input balandligida; yumshoq muted plitka, chegarasiz. */
export function PhonePrefix() {
  const { c } = useTheme();
  return (
    <View style={{ height: size.input, marginTop: size.ring, paddingHorizontal: space.md + space.xs, borderRadius: radius.sm, borderCurve: 'continuous', backgroundColor: c.bgMuted, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs }}>
      <Txt v="body" mono color="strong">+998</Txt>
    </View>
  );
}

/** Sahifa qobig'i: bg-app, orqaga tugmasi, klaviatura ustida surilish, pastda footer. */
export function AuthScreen({ children, back = true, onBack, footer }: { children: React.ReactNode; back?: boolean; onBack?: () => void; footer?: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.xxl, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {back ? <Appear from={8}><IconButton icon="arrow-left" label={i18n.t('ui.back')} tone="strong" style={{ marginLeft: -space.md }} onPress={() => (onBack ? onBack() : router.back())} /></Appear> : null}
          {children}
          {footer ? <View style={{ marginTop: 'auto', paddingTop: space.xl }}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Brend logotipi (Insof JBI) — kirish ekrani tepasida (Welcome bilan bir xil o'lcham va kirish harakati). */
export function AuthLogo({ height = space.x12 + space.lg }: { height?: number }) {
  const { c, dark } = useTheme();
  return (
    <Appear delay={40} from={18} style={{ marginTop: space.xl, alignItems: 'center' }}>
      {/* Logotip matni to'q — qorong'i fonda bir rangli och ko'rinishda */}
      <Image source={LOGO} style={{ height, width: height * LOGO_RATIO, tintColor: dark ? c.textStrong : undefined }} resizeMode="contain" accessibilityLabel="Insof JBI — temir beton mahsulotlari" />
    </Appear>
  );
}

/** Ekran belgisi — sarlavha ustidagi katta brend plitka (OTP ekrani bilan bir xil). */
export function AuthIcon({ icon, tone }: { icon: IconName; tone?: Tone }) {
  return (
    <Appear delay={40} style={{ marginTop: space.xxl }}>
      <IconTile icon={icon} module="brand" tone={tone} size={size.iconTile + space.md} />
    </Appear>
  );
}

/** Maxfiylik siyosatiga rozilik — belgilanmaguncha ro'yxatdan o'tib bo'lmaydi. Havola saytdagi /maxfiylik sahifasini ochadi. */
export function ConsentCheck({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm }}>
      <Pressable
        onPress={() => onChange(!value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        accessibilityLabel="Maxfiylik siyosati va foydalanish shartlariga roziman"
        hitSlop={space.md}
        style={{ width: size.iconMd, height: size.iconMd, borderRadius: radius.xs, borderWidth: size.ring, borderColor: value ? c.brand : c.borderStrong, backgroundColor: value ? c.brand : c.bgSurface, alignItems: 'center', justifyContent: 'center' }}
      >
        {value ? <Icon name="check" size={size.iconSm - 2} tone="onBrand" strokeWidth={2.5} /> : null}
      </Pressable>
      <Txt v="bodySm" style={{ flex: 1 }} onPress={() => onChange(!value)}>
        <Txt v="bodySm" color="brand" onPress={() => void Linking.openURL(`${config.erpUrl}/maxfiylik`)} accessibilityRole="link">Maxfiylik siyosati</Txt>
        {' '}va foydalanish shartlari bilan tanishdim va roziman
      </Txt>
    </View>
  );
}

/** Ekran sarlavhasi (title-lg) + izoh. `display` — faqat kirish ekrani. */
export function Title({ children, hint, display }: { children: string; hint?: string; display?: boolean }) {
  return (
    <Appear delay={60}>
      <Txt v={display ? 'display' : 'titleLg'} style={{ marginTop: space.xxl }}>{children}</Txt>
      {hint ? <Txt v="bodySm" color="muted" style={{ marginTop: space.sm }}>{hint}</Txt> : null}
    </Appear>
  );
}

/** Auth maydoni — umumiy Input; `mono` raqam/parol uchun. */
export const AuthField = (p: TextInputProps & { label?: string; error?: string; hint?: string; mono?: boolean; left?: IconName; right?: React.ReactNode }) => <Input {...p} />;

export const Hint = ({ children }: { children: string }) => <Txt v="caption" style={{ marginTop: space.xs }}>{children}</Txt>;

/** Asosiy amal — brend pill, 52 px, o'ngda strelka. */
export const PrimaryButton = ({ title, onPress, loading, icon = 'arrow-right', disabled }: { title: string; onPress: () => void; loading?: boolean; icon?: IconName | null; disabled?: boolean }) =>
  <Button title={title} size="lg" onPress={onPress} loading={loading} disabled={disabled} iconRight={icon ?? undefined} />;

/** Ikkilamchi — oq pill, yumshoq soya (chegarasiz). */
export const GhostButton = ({ title, onPress, icon }: { title: string; onPress: () => void; icon?: IconName; iconColor?: string }) =>
  <Button title={title} variant="secondary" size="lg" onPress={onPress} icon={icon} />;

export function Divider({ label = i18n.t('ui.or') }: { label?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xl }}>
      <View style={{ flex: 1, height: size.hairline, backgroundColor: c.borderDefault }} />
      <Txt v="overline">{label}</Txt>
      <View style={{ flex: 1, height: size.hairline, backgroundColor: c.borderDefault }} />
    </View>
  );
}

export const ErrorBox = ({ text }: { text?: string }) => (text ? <Appear from={6} style={{ marginTop: space.lg }}><Callout tone="danger">{text}</Callout></Appear> : null);
export const InfoCard = ({ icon = 'circle-question-mark', children, tone = 'neutral' }: { icon?: IconName; children: string; tone?: Tone; color?: string }) => <Callout icon={icon} tone={tone}>{children}</Callout>;

/** Qadamlar ko'rsatkichi — demo `.steps`: 4 css (6 dp) pill chiziqlar, o'tilgan va joriy — brend, qolgani bgMuted. */
export function Steps({ labels, current }: { labels: string[]; current: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm - 2, marginTop: space.xxl }} accessibilityLabel={`${current + 1}-qadam, ${labels.length} tadan`}>
      {labels.map((l, i) => (
        <View key={l} style={{ flex: 1, gap: space.sm }}>
          <View style={{ height: size.progress, borderRadius: radius.pill, backgroundColor: i <= current ? c.brand : c.bgMuted }} />
          <Txt v="caption" color={i === current ? 'strong' : 'faint'}>{l}</Txt>
        </View>
      ))}
    </View>
  );
}

/** 0–4: uzunlik, harf registri, raqam, maxsus belgi. */
export function strengthOf(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

/**
 * Ishonchli parol: 14 belgi, katta/kichik harf, raqam va belgi — har biridan kamida bittadan.
 * Chalkash belgilar (0/O, 1/l/I) yo'q — qo'lda qayta yozish oson bo'lsin.
 * `crypto.getRandomValues` bo'lsa o'shandan, bo'lmasa Math.random'dan.
 */
export function generatePassword(length = 14) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?-_'];
  const all = sets.join('');
  const rnd = (n: number) => {
    const g = globalThis.crypto as Crypto | undefined;
    if (g?.getRandomValues) { const a = new Uint32Array(1); g.getRandomValues(a); return (a[0] ?? 0) % n; }
    return Math.floor(Math.random() * n);
  };
  const chars = sets.map((set) => set.charAt(rnd(set.length)));
  while (chars.length < length) chars.push(all.charAt(rnd(all.length)));
  for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = chars[i]!; chars[i] = chars[j]!; chars[j] = t; }
  return chars.join('');
}

/** Parol kuchi — to'rtta chiziq va baho (rang + so'z). */
export function Strength({ password }: { password: string }) {
  const { c } = useTheme();
  const score = strengthOf(password);
  const label = ['Juda zaif', 'Zaif', "O'rtacha", 'Kuchli', 'Juda kuchli'][score];
  const tone: Tone = score <= 1 ? 'danger' : score === 2 ? 'warning' : 'success';
  const col = toneColors(c, tone);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: space.xs }}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={{ flex: 1, height: space.xs, borderRadius: radius.pill, backgroundColor: i < score ? col.solid : c.borderDefault }} />)}
      </View>
      <Txt v="caption" color={tone}>{password ? label : ' '}</Txt>
    </View>
  );
}

/** Parol talablari — bajarilgani belgi bilan. */
export function Requirements({ password }: { password: string }) {
  const { c } = useTheme();
  const done = [password.length >= 8, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const rules = [
    { label: 'Kamida 8 ta belgi', ok: password.length >= 8 },
    { label: 'Katta va kichik harf', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'Kamida bitta raqam', ok: /\d/.test(password) },
    { label: 'Maxsus belgi (# $ % !)', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.card, gap: space.sm }, elevation(c).sh1]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.xs }}>
        <Txt v="overline" style={{ flex: 1 }}>Talablar</Txt>
        <Txt v="caption" color={done === rules.length ? 'success' : 'faint'}>{done}/{rules.length}</Txt>
      </View>
      {rules.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ width: space.xl, height: space.xl, borderRadius: radius.pill, backgroundColor: r.ok ? c.successBg : c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={r.ok ? 'check' : 'circle'} size={size.iconSm - 4} tone={r.ok ? 'success' : 'faint'} />
          </View>
          <Txt v="bodySm" color={r.ok ? 'body' : 'muted'}>{r.label}</Txt>
        </View>
      ))}
    </View>
  );
}

/** Pastdagi "hisobingiz bormi / yo'qmi" qatori. */
export function FooterLink({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
      <Txt v="bodySm" color="muted">{text}</Txt>
      <Pressable onPress={onPress} accessibilityRole="link" hitSlop={space.sm} style={{ minHeight: size.touch, justifyContent: 'center' }}><Txt v="label" color="brand">{action}</Txt></Pressable>
    </View>
  );
}

/** Matnli havola — 44 px bosish maydoni bilan. */
export function TextLink({ children, onPress, style }: { children: string; onPress: () => void; style?: object }) {
  return <Pressable onPress={onPress} accessibilityRole="link" hitSlop={space.sm} style={[{ minHeight: size.touch, justifyContent: 'center' }, style]}><Txt v="label" color="brand">{children}</Txt></Pressable>;
}

/** Ro'yxatdan o'tish qadamlari: telefon → kod → ma'lumotlar (phone, otp va register ekranlari bir xil yozadi). */
export const REGISTER_STEPS = ['Telefon', "Kod tasdig'i", "Ma'lumotlar"];
