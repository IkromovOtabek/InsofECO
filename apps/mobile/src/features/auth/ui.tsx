import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/ui';
import { erpText } from '@/design/tokens';
import { Appear, PressScale } from '@/design/motion';

/**
 * Autentifikatsiya ekranlarining umumiy bo'laklari — maketdagi qorong'i uslub.
 * Kirish, ro'yxat, SMS kod, parol tiklash va PIN — hammasi shu yerdan quriladi,
 * shunda uslub bir joyda turadi va ekranlar qisqa bo'ladi.
 */
export const D = {
  bg: '#12151B',
  surface: '#1D222B',
  surfaceAlt: '#252C37',
  border: '#343C48',
  borderSoft: '#46505E',
  text: '#F5F4EF',
  muted: '#AEB6C1',
  faint: '#98A2AF',
  accent: '#FFBE3D',
  ok: '#2FD9C2',
  okSoft: '#7FEEDC',
  okBg: '#123F38',
  danger: '#FF8F5E',
  dangerBg: '#33201A',
  line: '#252C37',
} as const;

/** Sahifa qobig'i: qorong'i fon, orqaga tugmasi, klaviatura ustida surilish. */
export function AuthScreen({
  children, back = true, onBack, footer,
}: { children: React.ReactNode; back?: boolean; onBack?: () => void; footer?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 26, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 22, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {back ? (
            <Appear from={12}>
              <Pressable
                onPress={() => (onBack ? onBack() : router.back())}
                accessibilityLabel="Orqaga"
                style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: D.border, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="chevron-back" size={19} color={D.muted} />
              </Pressable>
            </Appear>
          ) : null}
          {children}
          {footer ? <View style={{ marginTop: 'auto', paddingTop: 20, borderTopWidth: 1, borderTopColor: D.line }}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function Title({ children, hint }: { children: string; hint?: string }) {
  return (
    <Appear delay={70}>
      <Txt style={{ fontFamily: erpText.title.fontFamily, fontSize: 29, lineHeight: 34, letterSpacing: -0.6, color: D.text, marginTop: 28 }}>{children}</Txt>
      {hint ? <Txt style={{ fontSize: 13.5, lineHeight: 21, color: D.muted, marginTop: 8 }}>{hint}</Txt> : null}
    </Appear>
  );
}

export function Label({ children }: { children: string }) {
  return <Txt style={{ ...erpText.label, fontSize: 12, color: D.muted, letterSpacing: 0.5, marginBottom: 7 }}>{children}</Txt>;
}

/** Qorong'i maydon. `mono` — raqam va parol uchun. */
export function DarkField({ error, mono, focus, style, ...p }: TextInputProps & { error?: string; mono?: boolean; focus?: boolean; style?: ViewStyle }) {
  return (
    <TextInput
      placeholderTextColor={D.faint}
      {...p}
      style={[{
        height: 52,
        paddingHorizontal: 14,
        borderRadius: 13,
        borderWidth: focus || error ? 1.5 : 1,
        borderColor: error ? D.danger : focus ? D.accent : D.border,
        backgroundColor: D.surface,
        color: D.text,
        fontFamily: mono ? erpText.meta.fontFamily : undefined,
        fontSize: 14.5,
      }, style]}
    />
  );
}

export function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return <Txt style={{ fontSize: 12, color: D.danger, marginTop: 6 }}>{text}</Txt>;
}

export function Hint({ children }: { children: string }) {
  return <Txt style={{ fontSize: 11.5, lineHeight: 16, color: D.faint, marginTop: 6 }}>{children}</Txt>;
}

/** Asosiy amal tugmasi — amber. */
export function PrimaryButton({ title, onPress, loading, icon = 'arrow-forward', disabled }: { title: string; onPress: () => void; loading?: boolean; icon?: IconName | null; disabled?: boolean }) {
  return (
    <PressScale onPress={onPress} disabled={loading || disabled}>
      <View style={{ height: 54, borderRadius: 14, backgroundColor: D.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: loading || disabled ? 0.55 : 1 }}>
        <Txt style={{ ...erpText.button, color: D.bg }}>{title}</Txt>
        {icon && !loading ? <Icon name={icon} size={18} color={D.bg} /> : null}
      </View>
    </PressScale>
  );
}

/** Ikkilamchi tugma — chegarali, qorong'i. */
export function GhostButton({ title, onPress, icon, iconColor }: { title: string; onPress: () => void; icon?: IconName; iconColor?: string }) {
  return (
    <PressScale onPress={onPress} haptic={false}>
      <View style={{ height: 52, borderRadius: 14, borderWidth: 1, borderColor: D.border, backgroundColor: D.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        {icon ? <Icon name={icon} size={18} color={iconColor ?? D.muted} /> : null}
        <Txt style={{ fontFamily: erpText.rowTitle.fontFamily, fontSize: 14.5, color: D.text }}>{title}</Txt>
      </View>
    </PressScale>
  );
}

export function Divider({ label = 'YOKI' }: { label?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: D.border }} />
      <Txt style={{ fontSize: 11.5, color: D.faint, letterSpacing: 1 }}>{label}</Txt>
      <View style={{ flex: 1, height: 1, backgroundColor: D.border }} />
    </View>
  );
}

/** Xato paneli. */
export function ErrorBox({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Appear from={8} style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 13, borderRadius: 13, backgroundColor: D.dangerBg, borderWidth: 1, borderColor: '#5C3526' }}>
        <Icon name="alert-circle" size={18} color={D.danger} />
        <Txt style={{ flex: 1, marginLeft: 9, fontSize: 13.5, lineHeight: 19, color: '#FFC7AE' }}>{text}</Txt>
      </View>
    </Appear>
  );
}

/** Izoh kartasi. */
export function InfoCard({ icon = 'help-circle-outline', children, color }: { icon?: IconName; children: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 11, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, borderRadius: 14, padding: 13 }}>
      <Icon name={icon} size={18} color={color ?? D.muted} />
      <Txt style={{ flex: 1, fontSize: 12, lineHeight: 18, color: D.muted }}>{children}</Txt>
    </View>
  );
}

/** Uch qadamli ro'yxatdan o'tish ko'rsatkichi. */
export function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 24 }}>
      {labels.map((l, i) => (
        <View key={l} style={{ flex: 1, gap: 7 }}>
          <View style={{ height: 4, borderRadius: 99, backgroundColor: i < current ? D.ok : i === current ? D.accent : D.border }} />
          <Txt style={{ ...erpText.label, fontSize: 11, color: i === current ? D.text : D.faint }}>{l}</Txt>
        </View>
      ))}
    </View>
  );
}

/** Parol kuchi — to'rtta chiziq va baho. */
export function Strength({ password }: { password: string }) {
  const score = strengthOf(password);
  const label = ['Juda zaif', 'Zaif', "O'rtacha", 'Kuchli', 'Juda kuchli'][score];
  const color = score <= 1 ? D.danger : score === 2 ? D.accent : D.okSoft;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8 }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: i < score ? color : D.border }} />
        ))}
      </View>
      <Txt style={{ ...erpText.label, fontSize: 11.5, color }}>{password ? label : ' '}</Txt>
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

/** Parol talablari ro'yxati — bajarilgani yashil belgi bilan. */
export function Requirements({ password }: { password: string }) {
  const rules = [
    { label: 'Kamida 8 ta belgi', ok: password.length >= 8 },
    { label: 'Katta va kichik harf', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'Kamida bitta raqam', ok: /\d/.test(password) },
    { label: 'Maxsus belgi (# $ % !)', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  return (
    <View style={{ backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, borderRadius: 15, padding: 14 }}>
      <Txt style={{ ...erpText.label, fontSize: 11.5, color: D.faint, letterSpacing: 0.7, marginBottom: 11 }}>TALABLAR</Txt>
      <View style={{ gap: 9 }}>
        {rules.map((r) => (
          <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 18, height: 18, borderRadius: 99, backgroundColor: r.ok ? D.okBg : D.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={r.ok ? 'checkmark' : 'ellipse-outline'} size={11} color={r.ok ? D.okSoft : D.faint} />
            </View>
            <Txt style={{ fontSize: 12.5, color: r.ok ? '#D5DBE3' : D.faint }}>{r.label}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Pastdagi "hisobingiz bormi / yo'qmi" qatori. */
export function FooterLink({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <Txt style={{ fontSize: 13, color: D.muted }}>{text}</Txt>
      <Txt onPress={onPress} style={{ ...erpText.label, fontSize: 13, color: D.accent }}>{action}</Txt>
    </View>
  );
}

// ───────────────────────── PIN bo'laklari ─────────────────────────

/** To'rtta nuqta — kiritilgan raqamlar soni. */
export function PinDots({ filled, length }: { filled: number; length: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
      {Array.from({ length }, (_, i) => (
        <View
          key={i}
          style={{ width: 16, height: 16, borderRadius: 99, borderWidth: 1.5, borderColor: i < filled ? D.accent : D.borderSoft, backgroundColor: i < filled ? D.accent : 'transparent' }}
        />
      ))}
    </View>
  );
}

/** Raqamli klaviatura — 3×4, oxirgi qatorda o'chirish. */
export function PinKeypad({ onDigit, onDelete }: { onDigit: (d: string) => void; onDelete: () => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {keys.map((k, i) => {
        if (!k) return <View key={i} style={{ flexGrow: 0, flexBasis: '30.5%', height: 66 }} />;
        const isDel = k === '⌫';
        return (
          <Pressable
            key={i}
            onPress={() => (isDel ? onDelete() : onDigit(k))}
            accessibilityLabel={isDel ? "Oxirgi raqamni o'chirish" : k}
            style={({ pressed }) => [{
              flexGrow: 0, flexBasis: '30.5%', height: 66, borderRadius: 18,
              borderWidth: isDel ? 0 : 1, borderColor: D.border,
              backgroundColor: isDel ? 'transparent' : D.surface,
              alignItems: 'center', justifyContent: 'center',
            }, pressed && { opacity: 0.6 }]}
          >
            {isDel
              ? <Icon name="backspace-outline" size={24} color={D.muted} />
              : <Txt style={{ ...erpText.meta, fontSize: 24, color: D.text }}>{k}</Txt>}
          </Pressable>
        );
      })}
    </View>
  );
}
