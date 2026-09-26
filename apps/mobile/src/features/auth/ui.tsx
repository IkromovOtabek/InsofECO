import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInputProps, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Callout, IconButton, Input, Txt } from '@/design/primitives';
export { Callout };
import { Icon, IconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { Tone, radius, size, space, toneColors } from '@/design/tokens';
import { Appear } from '@/design/motion';
import i18n from '@/core/i18n';

/**
 * Autentifikatsiya ekranlarining umumiy bo'laklari — umumiy dizayn tizimida (yorug'/qorong'i
 * tizim sozlamasiga ergashadi). Kirish, ro'yxat, SMS kod, parol tiklash va PIN shu yerdan quriladi.
 */

/** Sahifa qobig'i: bg-app, orqaga tugmasi, klaviatura ustida surilish, pastda footer. */
export function AuthScreen({ children, back = true, onBack, footer }: { children: React.ReactNode; back?: boolean; onBack?: () => void; footer?: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.xxl, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {back ? <Appear from={8}><IconButton icon="arrow-left" label={i18n.t('ui.back')} variant="secondary" tone="strong" onPress={() => (onBack ? onBack() : router.back())} /></Appear> : null}
          {children}
          {footer ? <View style={{ marginTop: 'auto', paddingTop: space.xl, borderTopWidth: size.hairline, borderTopColor: c.borderSubtle }}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
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

/** Asosiy amal — amber, 52 px, o'ngda strelka. */
export const PrimaryButton = ({ title, onPress, loading, icon = 'arrow-right', disabled }: { title: string; onPress: () => void; loading?: boolean; icon?: IconName | null; disabled?: boolean }) =>
  <Button title={title} size="lg" onPress={onPress} loading={loading} disabled={disabled} iconRight={icon ?? undefined} />;

/** Ikkilamchi — chegarali. */
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

/** Uch qadamli ro'yxatdan o'tish ko'rsatkichi. */
export function Steps({ labels, current }: { labels: string[]; current: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xxl }} accessibilityLabel={`${current + 1}-qadam, ${labels.length} tadan`}>
      {labels.map((l, i) => (
        <View key={l} style={{ flex: 1, gap: space.sm }}>
          <View style={{ height: space.xs, borderRadius: radius.pill, backgroundColor: i < current ? c.successSolid : i === current ? c.brand : c.borderDefault }} />
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
  const rules = [
    { label: 'Kamida 8 ta belgi', ok: password.length >= 8 },
    { label: 'Katta va kichik harf', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'Kamida bitta raqam', ok: /\d/.test(password) },
    { label: 'Maxsus belgi (# $ % !)', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  return (
    <View style={{ backgroundColor: c.bgSurface, borderWidth: size.hairline, borderColor: c.borderDefault, borderRadius: radius.card, padding: space.card, gap: space.sm }}>
      <Txt v="overline" style={{ marginBottom: space.xs }}>Talablar</Txt>
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

// ───────────────────────── PIN bo'laklari ─────────────────────────

export function PinDots({ filled, length }: { filled: number; length: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }} accessibilityLabel={`${filled} ta raqam kiritildi, ${length} tadan`}>
      {Array.from({ length }, (_, i) => (
        <View key={i} style={{ width: space.lg, height: space.lg, borderRadius: radius.pill, borderWidth: size.ring, borderColor: i < filled ? c.brand : c.borderStrong, backgroundColor: i < filled ? c.brand : 'transparent' }} />
      ))}
    </View>
  );
}

/** Raqamli klaviatura — 3×4, oxirgi qatorda o'chirish. */
export function PinKeypad({ onDigit, onDelete }: { onDigit: (d: string) => void; onDelete: () => void }) {
  const { c } = useTheme();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {keys.map((k, i) => {
        if (!k) return <View key={i} style={{ flexGrow: 0, flexBasis: '30.5%', height: size.driverTouch }} />;
        const isDel = k === 'del';
        return (
          <Pressable
            key={i} onPress={() => (isDel ? onDelete() : onDigit(k))} accessibilityRole="button" accessibilityLabel={isDel ? "Oxirgi raqamni o'chirish" : k}
            android_ripple={{ color: c.bgMuted }}
            style={({ pressed }) => [{ flexGrow: 0, flexBasis: '30.5%', height: size.driverTouch, borderRadius: radius.card, borderWidth: isDel ? 0 : size.hairline, borderColor: c.borderDefault, backgroundColor: isDel ? 'transparent' : c.bgSurface, alignItems: 'center', justifyContent: 'center' }, pressed && { backgroundColor: c.bgMuted }]}
          >
            {isDel ? <Icon name="delete" size={size.iconLg} tone="muted" /> : <Txt v="metric">{k}</Txt>}
          </Pressable>
        );
      })}
    </View>
  );
}
