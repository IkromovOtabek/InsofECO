import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, Skeleton } from '@/design/primitives';
import { Reveal, SectionHead } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';
import { ProductCard, ShopTopBar } from '@/features/shop/ui';
import { CalcPromo, CategoryTiles, PromoCard, TodayCard, categoriesOf } from '@/features/shop/home-blocks';

/** Demo `pcard(p, 140)` — 140 css → 193 dp. */
const CARD_W = 193;
const TILE = space.x12 + space.xxl;

function HomeSkeleton() {
  return (
    <View style={{ gap: space.lg, paddingHorizontal: space.pageX }}>
      <Skeleton height={182} radius={radius.hero} />
      <Skeleton height={TILE} radius={radius.card} />
      <View style={{ flexDirection: 'row', gap: space.tight }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} width={TILE} height={TILE} radius={radius.xl} />)}
      </View>
      <Skeleton height={TILE} radius={radius.card} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        {[0, 1].map((i) => <Skeleton key={i} width={CARD_W} height={CARD_W * 1.3} radius={radius.card} />)}
      </View>
    </View>
  );
}

/**
 * Bosh sahifa — demo CLIENT[0]: logotip + qidiruv + qo'ng'iroq → "Bugungi taklif" (ERP reklamasi matni,
 * demo kartasi uslubida) → zavod holati → toifalar → kalkulyator → "Ommabop" gorizontal kartalar.
 */
export default function ShopHome() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useShopCatalog();
  const phone = q.data?.seller?.phone ?? q.data?.company.phone ?? null;
  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const featured = items.slice(0, 8);
  const cats = useMemo(() => categoriesOf(items), [items]);

  const toCatalog = (params?: Record<string, string>) => router.navigate({ pathname: '/(shop)/(tabs)/katalog', params } as never);
  const toProduct = (id: string) => router.push(`/(shop)/${id}` as never);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ShopTopBar onSearchPress={() => toCatalog({ focus: String(Date.now()) })} />
      <ScrollView
        contentContainerStyle={{ paddingTop: space.xs, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        {q.error && !q.data ? (
          <EmptyState icon="wifi-off" title="Mahsulotlar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
        ) : (
          <Reveal loading={q.isLoading} skeleton={<HomeSkeleton />} gap={space.lg}>
            <PromoCard banners={q.data?.banners ?? []} items={items} onOpen={(id) => (id && items.some((i) => i.id === id) ? toProduct(id) : toCatalog())} />
            {phone || q.data?.seller?.hours || q.data?.seller?.telegram ? <TodayCard seller={q.data?.seller} phone={phone} onPress={() => router.push('/(shop)/zavod' as never)} /> : null}
            {cats.length > 1 ? <CategoryTiles items={cats} onPick={(g) => toCatalog({ group: g, t: String(Date.now()) })} /> : null}
            <CalcPromo onPress={() => router.push('/(shop)/kalkulyator' as never)} />
            {featured.length ? (
              <View style={{ gap: space.sm }}>
                <SectionHead title="Ommabop" action="Barchasi" onAction={() => toCatalog()} style={{ paddingHorizontal: space.pageX }} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: 2, paddingBottom: space.md, gap: space.md + 2 }}>
                  {featured.map((item) => <ProductCard key={item.id} item={item} width={CARD_W} onPress={() => toProduct(item.id)} />)}
                </ScrollView>
              </View>
            ) : (
              <EmptyState icon="store" title="Vitrina hozircha bo'sh" hint="Mahsulotlar tez orada qo'shiladi" />
            )}
          </Reveal>
        )}
      </ScrollView>
    </View>
  );
}
