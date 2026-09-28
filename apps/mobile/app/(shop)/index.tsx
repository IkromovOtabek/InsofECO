import React, { useMemo, useState } from 'react';
import { FlatList, Image, Linking, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, EmptyState, Gap, IconTile, Input, Skeleton, Txt, fmtNum } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { photoUrl, useShopCatalog, type ShopItem } from '@/features/shop/api';
import { erpRoleConfig } from '@/features/erp/roles';

const ROLE_GROUP = { TADBIRKOR: '(tadbirkor)', QURUVCHI: '(quruvchi)', HAYDOVCHI: '(haydovchi)' } as const;

/** Mahsulot kartasi — surat, yorliq, nom, sinf, narx. Bosilsa kartochka ochiladi. */
function ProductCard({ item, onPress }: { item: ShopItem; onPress: () => void }) {
  const { c } = useTheme();
  const uri = photoUrl(item.photo);
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={item.name} onPress={onPress} android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [
        { flex: 1, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: size.hairline, borderColor: c.borderDefault, overflow: 'hidden' },
        shadow.card, pressed && { backgroundColor: c.bgMuted },
      ]}
    >
      <View style={{ aspectRatio: 1, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <IconTile icon="package" module="brand" size={size.avatarLg} />}
        {item.badge ? <Badge label={item.badge} tone="brand" icon={null} style={{ position: 'absolute', top: space.sm, left: space.sm }} /> : null}
      </View>
      <View style={{ padding: space.md, gap: space.xs }}>
        <Txt v="bodyStrong" numberOfLines={2}>{item.name}</Txt>
        <Txt v="caption" numberOfLines={1}>{[item.code, item.strengthClass].filter(Boolean).join(' · ')}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs, marginTop: space.xs }}>
          <Txt v="titleSm" color="brand">{fmtNum(item.price)}</Txt>
          <Txt v="caption">so'm / {item.unitLabel}</Txt>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Do'kon vitrinasi — ilova ochilganda birinchi ekran. Yuqorida brend va "Kirish",
 * qidiruv, keyin ikki ustunli mahsulot kartalari. Ro'yxat ERP'dagi E-commerce panelidan boshqariladi.
 */
export default function ShopScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { status, kind, active, erp } = useSession();
  const q = useShopCatalog();
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    const s = search.trim().toLowerCase();
    return s ? all.filter((i) => [i.name, i.code, i.strengthClass, i.group].filter(Boolean).join(' ').toLowerCase().includes(s)) : all;
  }, [q.data, search]);

  /** Kirgan foydalanuvchi uchun "Kabinet" — o'z bo'limiga qaytadi; mehmon uchun "Kirish". */
  const goHome = () => {
    if (kind === 'erp' && erp) return router.replace(`/${erpRoleConfig(erp.role).group}` as never);
    if (kind === 'eco' && active) return router.replace(`/${ROLE_GROUP[active.role]}` as never);
    router.replace('/(auth)/select-role');
  };
  const phone = q.data?.company.phone ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <View style={{ backgroundColor: c.bgChrome, borderBottomWidth: size.hairline, borderBottomColor: c.borderDefault, paddingTop: insets.top + space.md, paddingBottom: space.md, paddingHorizontal: space.pageX, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconTile icon="store" module="brand" />
          <View style={{ flex: 1 }}>
            <Txt v="overline" color="brand">Do'kon</Txt>
            <Txt v="titleMd" numberOfLines={1}>{q.data?.company.name ?? 'Insof ECO'}</Txt>
          </View>
          {status === 'authed'
            ? <Button title="Kabinet" variant="secondary" full={false} icon="user" onPress={goHome} />
            : <Button title="Kirish" full={false} icon="user" onPress={() => router.push('/(auth)/login')} />}
        </View>
        <Input value={search} onChangeText={setSearch} placeholder="Marka, sinf yoki nom bo'yicha qidirish" left="search" containerStyle={{ marginBottom: 0 }} returnKeyType="search" clearButtonMode="while-editing" />
      </View>

      {q.isLoading ? (
        <View style={{ padding: space.pageX, flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} width="47%" height={size.driverTouch * 3} radius={radius.card} />)}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={{ padding: space.pageX, paddingBottom: insets.bottom + space.xxxl, gap: space.md }}
          refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
          renderItem={({ item }) => <ProductCard item={item} onPress={() => router.push(`/(shop)/${item.id}` as never)} />}
          ListEmptyComponent={
            q.error
              ? <EmptyState icon="circle-alert" title="Ro'yxat yuklanmadi" hint="Internetni tekshirib, pastga torting" action="Qayta urinish" onAction={() => void q.refetch()} />
              : <EmptyState icon="store" title={search ? 'Topilmadi' : "Do'kon hozircha bo'sh"} hint={search ? 'Boshqa so\'z bilan qidiring' : 'Mahsulotlar tez orada qo\'shiladi'} />
          }
          ListFooterComponent={
            phone ? (
              <Pressable accessibilityRole="link" accessibilityLabel="Zavodga qo'ng'iroq" onPress={() => void Linking.openURL(`tel:${phone}`)} style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center', minHeight: size.touch }}>
                <Icon name="phone" tone="muted" />
                <Txt v="bodySm" color="muted">Savol bo'lsa: {phone}</Txt>
              </Pressable>
            ) : <Gap />
          }
        />
      )}
    </View>
  );
}
