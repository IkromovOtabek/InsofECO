import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PhoneSchema } from '@insof/shared';
import { Badge, IconTile, Input, Label, ListGroup, ListItem } from '@/design/primitives';
import { space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { ApiException } from '@/core/api';
import { AuthScreen, ErrorBox, FooterLink, InfoCard, PhonePrefix, PrimaryButton, Title } from '@/features/auth/ui';

/**
 * Parolni tiklash — 1-qadam: raqamga kod yuborish.
 *
 * Kod Telegram'ga (Telegram bo'lmasa SMS) yuboriladi; elektron pochta kanali ham bor, lekin tizimda foydalanuvchining pochtasi
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
      const r = await authApi.forgotPassword(parsed.data);
      router.push({ pathname: '/(auth)/otp', params: { phone: parsed.data, mode: 'reset', via: r.channel } });
    } catch (e) {
      setForm(e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');
    } finally { setLoading(false); }
  };

  return (
    <AuthScreen footer={<FooterLink text="Parol esingizga tushdimi?" action="Kirish" onPress={() => router.replace('/(auth)/login')} />}>
      <Title hint="Tasdiqlash kodini qayerga yuboraylik?">Parolni tiklash</Title>

      <Appear delay={130} style={{ marginTop: space.xxl }}>
        <ListGroup>
          <ListItem
            leading={<IconTile icon="send" module="brand" />}
            title="Telegram yoki SMS orqali"
            subtitle={local ? `+998 ${local}` : '+998 …'}
            right={<Badge label="Tanlangan" tone="success" icon="check" />}
          />
          <ListItem
            leading={<IconTile icon="mail" tone="neutral" />}
            title="Elektron pochta orqali"
            subtitle="Hisobga pochta bog'lanmagan"
            right={<Badge label="Mavjud emas" tone="neutral" icon="ban" />}
          />
        </ListGroup>
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
