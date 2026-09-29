import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Input, Skeleton, Txt } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';
import { ProductCard, ShopHeader } from '@/features/shop/ui';

const ALL = 'Barchasi';

/** Guruh filtri — gorizontal "chip"lar. Guruhlar ERP'dagi mahsulot guruhlaridan keladi. */
function GroupChips({ groups, value, onChange }: { groups: string[]; value: string; onChange: (g: string) => void }) {
  const { c } = useTheme();
  if (groups.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.pageX, paddingVertical: space.md }}>
      {[ALL, ...groups].map((g) => {
        const on = g === value;
        return (
          <Pressable
            key={g} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(g)}
            style={{ paddingHorizontal: space.lg, minHeight: size.touch - space.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? c.brand : c.bgSurface, borderWidth: size.hairline, borderColor: on ? c.brand : c.borderDefault }}
          >
            <Txt v="bodySm" style={{ color: on ? c.textOnBrand : c.textBody, fontWeight: '600' }}>{g}</Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * Katalog — qidiruv, guruh filtri va ikki ustunli mahsulot kartalari.
 * Ro'yxat ERP'dagi E-commerce panelidan boshqariladi.
 */
export default function ShopCatalogScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useShopCatalog();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState(ALL);

  const groups = useMemo(() => Array.from(new Set((q.data?.items ?? []).map((i) => i.group).filter((g): g is string => !!g))), [q.data]);
  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    const s = search.trim().toLowerCase();
    return all.filter((i) => (group === ALL || i.group === group) && (!s || [i.name, i.code, i.strengthClass, i.group].filter(Boolean).join(' ').toLowerCase().includes(s)));
  }, [q.data, search, group]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ShopHeader>
        <Input value={search} onChangeText={setSearch} placeholder="Marka, sinf yoki nom bo'yicha qidirish" left="search" containerStyle={{ marginBottom: 0 }} returnKeyType="search" clearButtonMode="while-editing" />
      </ShopHeader>

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
          contentContainerStyle={{ paddingHorizontal: space.pageX, paddingBottom: insets.bottom + space.xxxl, gap: space.md }}
          ListHeaderComponent={<GroupChips groups={groups} value={group} onChange={setGroup} />}
          ListHeaderComponentStyle={{ marginHorizontal: -space.pageX }}
          refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
          renderItem={({ item }) => <ProductCard item={item} onPress={() => router.push(`/(shop)/${item.id}` as never)} />}
          ListEmptyComponent={
            q.error
              ? <EmptyState icon="circle-alert" title="Ro'yxat yuklanmadi" hint="Internetni tekshirib, pastga torting" action="Qayta urinish" onAction={() => void q.refetch()} />
              : <EmptyState icon="store" title={search || group !== ALL ? 'Topilmadi' : "Katalog hozircha bo'sh"} hint={search || group !== ALL ? "Boshqa so'z yoki guruhni tanlang" : "Mahsulotlar tez orada qo'shiladi"} />
          }
        />
      )}
    </View>
  );
}
