import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PhoneSchema } from '@insof/shared';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { erpText } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { ApiException } from '@/core/api';
import { AuthScreen, D, DarkField, ErrorBox, FieldError, FooterLink, Hint, InfoCard, Label, PrimaryButton, Title } from '@/features/auth/ui';

/**
 * Parolni tiklash — 1-qadam: raqamga kod yuborish.
 *
 * Maketda SMS va elektron pochta varianti bor; tizimda foydalanuvchining pochtasi
 * saqlanmaydi, shuning uchun pochta varianti ko'rsatiladi-yu, tanlanmaydi —
 * uning o'rniga administratorga murojaat qilish yo'li yozilgan.
 */
export default function Forgot() {
  const router = useRouter();
  const [local, setLocal] = useState('');
  const [error, setError] = useState<string>();
  const [form, setForm] = useState<string>();
  const [loading, setLoading] = useState(false);

  const full = `+998${local.replace(/\D/g, '')}`;

  const submit = async () => {
    const parsed = PhoneSchema.safeParse(full);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Raqam noto'g'ri");
    setLoading(true); setError(undefined); setForm(undefined);
    try {
      await authApi.forgotPassword(parsed.data);
      router.push({ pathname: '/(auth)/otp', params: { phone: parsed.data, mode: 'reset' } });
    } catch (e) {
      setForm(e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');
    } finally { setLoading(false); }
  };

  const Channel = ({ on, icon, name, meta, note }: { on: boolean; icon: 'chatbox-ellipses-outline' | 'mail-outline'; name: string; meta: string; note?: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 15, borderWidth: 1.5, borderColor: on ? D.accent : D.border, backgroundColor: on ? D.surfaceAlt : D.surface, padding: 14, opacity: on ? 1 : 0.6 }}>
      <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? D.accent : D.faint} />
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: D.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={on ? D.accent : D.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={{ ...erpText.rowTitle, fontSize: 14, color: D.text }}>{name}</Txt>
        <Txt style={{ ...erpText.meta, fontSize: 11.5, color: D.muted, marginTop: 3 }}>{meta}</Txt>
        {note ? <Txt style={{ fontSize: 11, color: D.faint, marginTop: 2 }}>{note}</Txt> : null}
      </View>
    </View>
  );

  return (
    <AuthScreen footer={<FooterLink text="Parol esingizga tushdimi?" action="Kirish" onPress={() => router.replace('/(auth)/login')} />}>
      <Title hint="Tasdiqlash kodini qayerga yuboraylik?">Parolni tiklash</Title>

      <Appear delay={130} style={{ marginTop: 22, gap: 10 }}>
        <Channel on icon="chatbox-ellipses-outline" name="SMS orqali" meta={local ? `+998 ${local}` : '+998 …'} />
        <Channel on={false} icon="mail-outline" name="Elektron pochta orqali" meta="pochta saqlanmagan" note="Hisobga pochta bog'lanmagan" />
      </Appear>

      <Appear delay={180} style={{ marginTop: 18 }}>
        <Label>Telefon raqam</Label>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <View style={{ height: 52, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: D.border, backgroundColor: D.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ ...erpText.meta, fontSize: 14.5, color: D.muted }}>+998</Txt>
          </View>
          <DarkField
            value={local}
            onChangeText={(v) => { setLocal(v.replace(/\D/g, '').slice(0, 9)); setError(undefined); }}
            keyboardType="number-pad"
            placeholder="90 123 45 67"
            mono
            focus
            error={error}
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="go"
            style={{ flex: 1 }}
          />
        </View>
        <FieldError text={error} />
        <Hint>Hisobda saqlangan raqam bilan mos bo&apos;lishi kerak.</Hint>
      </Appear>

      <ErrorBox text={form} />

      <Appear delay={230} style={{ marginTop: 20 }}>
        <PrimaryButton title={loading ? 'Yuborilmoqda…' : 'Kodni yuborish'} onPress={submit} loading={loading} />
      </Appear>

      <Appear delay={280} style={{ marginTop: 20 }}>
        <InfoCard>Raqamingiz ham o&apos;zgargan bo&apos;lsa — korxona administratoriga murojaat qiling.</InfoCard>
      </Appear>
    </AuthScreen>
  );
}
