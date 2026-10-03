import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Input, ListItem, Skeleton, Txt } from '@/design/primitives';
import { ListGroup, PageHeader, SectionHead } from '@/design/blocks';
import { Appear, haptic, stagger } from '@/design/motion';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { useShopCallback, useShopCatalog } from '@/features/shop/api';
import { TodayCard } from '@/features/shop/home-blocks';

/**
 * Aloqa — zavod holati, bir bosishda qo'ng'iroq/Telegram/xarita va "menga qo'ng'iroq qiling" formasi.
 * Mahsulot tanlash shart emas: nima kerakligini bilmagan mijoz ham raqamini qoldiradi,
 * so'rov ERP'ga ariza bo'lib tushadi.
 */
export default function ShopContact() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useShopCatalog();
  const user = useSession((s) => s.user);
  const cb = useShopCallback();
  const company = q.data?.company;
  const seller = q.data?.seller;
  const phone = seller?.phone ?? company?.phone ?? null;
  const address = seller?.address ?? company?.address ?? null;
  const telegram = seller?.telegram ?? null;

  const [name, setName] = useState(user?.fullName ?? '');
  const [tel, setTel] = useState(user?.phone ?? '');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const submit = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Ismingizni yozing';
    const digits = tel.replace(/\D/g, '');
    if (digits.length !== 9 && digits.length !== 12) e.phone = 'Telefon: 90 123 45 67';
    setErrors(e);
    if (Object.keys(e).length) { haptic.warning(); return; }
    cb.mutate(
      { name: name.trim(), phone: tel.trim(), message: message.trim() || undefined },
      {
        onSuccess: (r) => { haptic.success(); toast.success(r.message, 'Qabul qilindi'); setMessage(''); setSent(true); },
        onError: (err) => toast.error(err instanceof ApiException ? err.message : 'Tarmoq xatosi — internetni tekshiring', 'Yuborilmadi'),
      },
    );
  };

  const openMap = () => {
    if (seller?.location) {
      const { lat, lng } = seller.location;
      void Linking.openURL(Platform.OS === 'ios' ? `maps:0,0?q=${lat},${lng}` : `geo:${lat},${lng}?q=${lat},${lng}`);
    } else if (address) void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader overline="Sotuv bo'limi" title="Aloqa" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(shop)' as never))} style={{ paddingTop: insets.top + space.sm }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingTop: space.sm, paddingBottom: space.xxl, gap: space.section }} keyboardShouldPersistTaps="handled">
          <Appear>
            <TodayCard seller={seller} phone={phone} />
          </Appear>

          <Appear delay={stagger(1)} style={{ paddingHorizontal: space.pageX }}>
            {q.isLoading ? (
              <Skeleton height={size.driverTouch * 2} radius={radius.card} />
            ) : phone || address || telegram ? (
              <ListGroup>
                {phone ? <ListItem icon="phone" module="brand" title="Sotuv bo'limi" subtitle={[phone, seller?.phone2].filter(Boolean).join(' · ')} onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
                {telegram ? <ListItem icon="send" module="logistics" title="Telegram" subtitle="Yozing — ish vaqtida javob beramiz" onPress={() => void Linking.openURL(telegram)} /> : null}
                {address ? <ListItem icon="map-pin" module="warehouse" title="Zavod manzili" subtitle={address} onPress={openMap} /> : null}
                {seller?.workingHours ? <ListItem icon="clock" module="production" title="Ish vaqti" subtitle={seller.workingHours} /> : null}
              </ListGroup>
            ) : (
              <Card><Txt v="bodySm" color="muted">Rekvizitlar hozircha yo&apos;q — pastdagi formani to&apos;ldiring, o&apos;zimiz qo&apos;ng&apos;iroq qilamiz.</Txt></Card>
            )}
          </Appear>

          <Appear delay={stagger(2)} style={{ paddingHorizontal: space.pageX }}>
            <SectionHead title="Menga qo'ng'iroq qiling" style={{ marginBottom: 0 }} />
            <Txt v="bodySm" color="muted" style={{ marginBottom: space.md }}>Raqamingizni qoldiring — ish vaqtida sotuv bo&apos;limi o&apos;zi bog&apos;lanadi. Ro&apos;yxatdan o&apos;tish shart emas.</Txt>
            <Card>
              <Input label="Ismingiz" value={name} onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: '' })); }} placeholder="Akmal" left="user" error={errors.name || undefined} autoCapitalize="words" />
              <Input label="Telefon" value={tel} onChangeText={(v) => { setTel(v); setErrors((e) => ({ ...e, phone: '' })); }} placeholder="90 123 45 67" keyboardType="phone-pad" left="phone" error={errors.phone || undefined} mono />
              <Input label="Nima kerak? (ixtiyoriy)" value={message} onChangeText={(v) => { setMessage(v); setSent(false); }} placeholder="Masalan: 20 m³ M300, Yangiyo'lga" multiline containerStyle={{ marginBottom: 0 }} />
              <Button
                title={sent ? "So'rov yuborildi" : cb.isPending ? 'Yuborilmoqda…' : "So'rov yuborish"}
                variant={sent ? 'success' : 'primary'}
                size="lg" iconRight={sent ? 'check' : 'send'} loading={cb.isPending} onPress={submit} style={{ marginTop: space.lg }}
              />
            </Card>
          </Appear>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
