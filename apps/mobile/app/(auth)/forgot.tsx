import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PhoneSchema } from '@insof/shared';
import { Badge, Card, IconTile, Input, Label, ListItem, Txt } from '@/design/primitives';
import { radius, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { ApiException } from '@/core/api';
import { AuthScreen, ErrorBox, FooterLink, InfoCard, PrimaryButton, Title } from '@/features/auth/ui';

/**
 * Parolni tiklash — 1-qadam: raqamga kod yuborish.
 *
 * SMS va elektron pochta kanali bor; tizimda foydalanuvchining pochtasi
 * saqlanmaydi, shuning uchun pochta varianti ko'rsatiladi-yu, tanlanmaydi —
 * uning o'rniga administratorga murojaat qilish yo'li yozilgan.
 */

/** "+998" prefiksi — input balandligida, fokus halqasi hisobga olingan. */
function PhonePrefix() {
  const { c } = useTheme();
  return (
    <View style={{ height: size.input + size.ring * 2, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: size.hairline, borderColor: c.borderDefault, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center', marginTop: size.ring }}>
      <Txt v="body" mono color="muted">+998</Txt>
    </View>
  );
}

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

  return (
    <AuthScreen footer={<FooterLink text="Parol esingizga tushdimi?" action="Kirish" onPress={() => router.replace('/(auth)/login')} />}>
      <Title hint="Tasdiqlash kodini qayerga yuboraylik?">Parolni tiklash</Title>

      <Appear delay={130} style={{ marginTop: space.xxl }}>
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem
            leading={<IconTile icon="message-square" module="brand" />}
            title="SMS orqali"
            subtitle={local ? `+998 ${local}` : '+998 …'}
            right={<Badge label="Tanlangan" tone="success" icon="check" />}
          />
          <ListItem
            leading={<IconTile icon="mail" tone="neutral" />}
            title="Elektron pochta orqali"
            subtitle="Hisobga pochta bog'lanmagan"
            right={<Badge label="Mavjud emas" tone="neutral" icon="ban" />}
            last
          />
        </Card>
      </Appear>

      <Appear delay={180} style={{ marginTop: space.xl }}>
        <Label>Telefon raqam</Label>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
          <PhonePrefix />
          <Input
            value={local}
            onChangeText={(v) => { setLocal(v.replace(/\D/g, '').slice(0, 9)); setError(undefined); }}
            keyboardType="number-pad"
            placeholder="90 123 45 67"
            accessibilityLabel="Telefon raqam"
            mono
            error={error}
            hint="Hisobda saqlangan raqam bilan mos bo'lishi kerak."
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="go"
            containerStyle={{ flex: 1 }}
          />
        </View>
      </Appear>

      <ErrorBox text={form} />

      <Appear delay={230} style={{ marginTop: space.sm }}>
        <PrimaryButton title={loading ? 'Yuborilmoqda…' : 'Kodni yuborish'} onPress={submit} loading={loading} />
      </Appear>

      <Appear delay={280} style={{ marginTop: space.xl }}>
        <InfoCard>Raqamingiz ham o&apos;zgargan bo&apos;lsa — korxona administratoriga murojaat qiling.</InfoCard>
      </Appear>
    </AuthScreen>
  );
}
