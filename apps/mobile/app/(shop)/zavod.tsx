import React from 'react';
import { Image, Linking, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, EmptyState, ListItem, Txt } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';
import { ProductCard } from '@/features/shop/ui';

const LOGO = require('../../assets/logo.png') as number;
const LOGO_RATIO = 970 / 210;

/**
 * Sotuvchi (zavod) profili — mahsulot kartasidagi sotuvchi nomi bosilganda ochiladi.
 * Kim sotayotgani, qayerda, qachon ishlaydi, qanday bog'lanish va uning barcha mahsulotlari.
 */
export default function SellerProfile() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useShopCatalog();
  const s = q.data?.seller;
  const name = s?.name ?? q.data?.company.name;
  const items = (q.data?.items ?? []).filter((i) => !i.sellerId || i.sellerId === (s?.id ?? i.sellerId));

  if (q.isLoading) return null;
  if (!name) return <EmptyState icon="building" title="Zavod ma'lumoti yo'q" action="Orqaga" onAction={() => router.back()} />;

  const phone = s?.phone ?? q.data?.company.phone ?? null;
  const address = s?.address ?? q.data?.company.address ?? null;
  const openMap = () => {
    if (s?.location) {
      const { lat, lng } = s.location;
      void Linking.openURL(Platform.OS === 'ios' ? `maps:0,0?q=${lat},${lng}` : `geo:${lat},${lng}?q=${lat},${lng}`);
    } else if (address) void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bgApp }} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl, gap: space.section }}>
      <View style={{ backgroundColor: c.bgChrome, paddingHorizontal: space.pageX, paddingVertical: space.xl, gap: space.md, borderBottomWidth: size.hairline, borderBottomColor: c.borderDefault }}>
        <Image source={LOGO} style={{ height: 44, width: 44 * LOGO_RATIO }} resizeMode="contain" accessibilityLabel={name} />
        <View>
          <Txt v="titleLg">{name}</Txt>
          {s?.legalName ? <Txt v="caption">{s.legalName}</Txt> : null}
        </View>
        {s?.about ? <Txt v="body" color="body">{s.about}</Txt> : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {phone ? <Button title="Qo'ng'iroq" icon="phone" size="lg" onPress={() => void Linking.openURL(`tel:${phone}`)} style={{ flex: 1 }} /> : null}
          {address || s?.location ? <Button title="Xaritada" icon="map-pin" variant="secondary" size="lg" onPress={openMap} style={{ flex: 1 }} /> : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: space.pageX }}>
        <Card style={{ paddingVertical: 0, borderRadius: radius.card }}>
          {address ? <ListItem icon="map-pin" title="Manzil" subtitle={address} onPress={openMap} /> : null}
          {s?.workingHours ? <ListItem icon="clock" title="Ish vaqti" subtitle={s.workingHours} /> : null}
          {phone ? <ListItem icon="phone" title="Telefon" subtitle={[phone, s?.phone2].filter(Boolean).join(' · ')} onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
          {s?.email ? <ListItem icon="mail" title="E-pochta" subtitle={s.email} onPress={() => void Linking.openURL(`mailto:${s.email}`)} /> : null}
          {s?.foundedYear ? <ListItem icon="calendar" title="Faoliyat" subtitle={`${s.foundedYear}-yildan beri`} /> : null}
          <ListItem icon="package" title="Mahsulotlar" subtitle={`${items.length} ta — vitrinada`} last />
        </Card>
      </View>

      <View style={{ paddingHorizontal: space.pageX, gap: space.md }}>
        <Txt v="titleMd">Zavod mahsulotlari</Txt>
        {Array.from({ length: Math.ceil(items.length / 2) }, (_, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: space.md }}>
            {items.slice(r * 2, r * 2 + 2).map((it) => <ProductCard key={it.id} item={it} onPress={() => router.push(`/(shop)/${it.id}` as never)} />)}
            {items.slice(r * 2, r * 2 + 2).length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
