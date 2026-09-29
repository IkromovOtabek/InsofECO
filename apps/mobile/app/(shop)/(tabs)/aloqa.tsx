import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Input, ListItem, Txt } from '@/design/primitives';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { useShopCallback, useShopCatalog } from '@/features/shop/api';
import { ShopHeader } from '@/features/shop/ui';

/**
 * Aloqa — bir bosishda qo'ng'iroq va "menga qo'ng'iroq qiling" formasi. Mahsulot tanlash
 * shart emas: nima kerakligini bilmagan mijoz ham raqamini qoldiradi, so'rov ERP'ga ariza bo'lib tushadi.
 */
export default function ShopContact() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useShopCatalog();
  const user = useSession((s) => s.user);
  const cb = useShopCallback();
  const company = q.data?.company;

  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Ismingizni yozing';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 9 && digits.length !== 12) e.phone = 'Telefon: 90 123 45 67';
    setErrors(e);
    if (Object.keys(e).length) return;
    cb.mutate(
      { name: name.trim(), phone: phone.trim(), message: message.trim() || undefined },
      {
        onSuccess: (r) => { toast.success(r.message, 'Qabul qilindi'); setMessage(''); },
        onError: (err) => toast.error(err instanceof ApiException ? err.message : 'Tarmoq xatosi — internetni tekshiring', 'Yuborilmadi'),
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ShopHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: insets.bottom + space.xxxl, gap: space.section }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: space.md }}>
            <Txt v="titleMd">Bog'lanish</Txt>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {company?.phone ? (
                <ListItem style={{ paddingHorizontal: space.card }} icon="phone" module="brand" title="Sotuv bo'limi" subtitle={company.phone} chevron onPress={() => void Linking.openURL(`tel:${company.phone}`)} last={!company.address} />
              ) : null}
              {company?.address ? (
                <ListItem style={{ paddingHorizontal: space.card }} icon="map-pin" module="brand" title="Zavod manzili" subtitle={company.address} chevron onPress={() => void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(company.address ?? '')}`)} last />
              ) : null}
              {!company?.phone && !company?.address ? <View style={{ padding: space.card }}><Txt v="bodySm" color="muted">Rekvizitlar yuklanmoqda…</Txt></View> : null}
            </Card>
          </View>

          <View style={{ gap: space.md }}>
            <Txt v="titleMd">Menga qo'ng'iroq qiling</Txt>
            <Txt v="bodySm" color="muted">Raqamingizni qoldiring — ish vaqtida sotuv bo'limi o'zi bog'lanadi. Ro'yxatdan o'tish shart emas.</Txt>
            <Card>
              <Input label="Ismingiz" value={name} onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: '' })); }} placeholder="Akmal" error={errors.name || undefined} autoCapitalize="words" />
              <Input label="Telefon" value={phone} onChangeText={(v) => { setPhone(v); setErrors((e) => ({ ...e, phone: '' })); }} placeholder="90 123 45 67" keyboardType="phone-pad" error={errors.phone || undefined} mono />
              <Input label="Nima kerak? (ixtiyoriy)" value={message} onChangeText={setMessage} placeholder="Masalan: 20 m³ M300, Yangiyo'lga" multiline containerStyle={{ marginBottom: 0 }} />
              <Button title={cb.isPending ? 'Yuborilmoqda…' : "So'rov yuborish"} size="lg" iconRight="send" loading={cb.isPending} onPress={submit} style={{ marginTop: space.lg }} />
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
