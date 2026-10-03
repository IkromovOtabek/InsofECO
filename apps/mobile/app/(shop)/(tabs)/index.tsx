import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, Skeleton } from '@/design/primitives';
import { SectionHead } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { Appear, stagger } from '@/design/motion';
import { useShopCatalog } from '@/features/shop/api';
import { ProductCard, ShopTopBar } from '@/features/shop/ui';
import { HeroSwiper } from '@/features/shop/hero-swiper';
import { CalcPromo, CategoryTiles, TodayCard, categoriesOf } from '@/features/shop/home-blocks';

const CARD_W = 164;

/**
 * Bosh sahifa — mehmon ilovani ochganda ko'radigan birinchi ekran (chizma "Bosh sahifa"):
 * qidiruv → taklif banneri (ERP → E-commerce → Reklama) → zavod holati ("ochiq · bugun yetkazamiz")
 * → toifalar → kalkulyator → ommabop mahsulotlar. Hisob — Profil tabida.
 */
export default function ShopHome() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useShopCatalog();
  const phone = q.data?.seller?.phone ?? q.data?.company.phone ?? null;
  const items = q.data?.items ?? [];
  const featured = items.slice(0, 8);
  const cats = useMemo(() => categoriesOf(q.data?.items ?? []), [q.data]);

  const toCatalog = (params?: Record<string, string>) => router.navigate({ pathname: '/(shop)/(tabs)/katalog', params } as never);
  const toProduct = (id: string) => router.push(`/(shop)/${id}` as never);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ShopTopBar onSearchPress={() => toCatalog({ focus: String(Date.now()) })} />
      <ScrollView
        contentContainerStyle={{ paddingTop: space.xs, paddingBottom: space.xxl, gap: space.section }}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        <Appear delay={stagger(0)}>
          <HeroSwiper banners={q.data?.banners ?? []} phone={phone} onCatalog={() => toCatalog()} onProduct={toProduct} />
        </Appear>

        <Appear delay={stagger(1)}>
          <TodayCard seller={q.data?.seller} phone={phone} />
        </Appear>

        {q.isLoading ? (
          <View style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.pageX }}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width={size.avatarLg + space.sm} height={size.avatarLg + space.sm} radius={radius.card} />)}
          </View>
        ) : (
          <Appear delay={stagger(2)}>
            <CategoryTiles items={cats} onPick={(g) => toCatalog({ group: g, t: String(Date.now()) })} />
          </Appear>
        )}

        <Appear delay={stagger(3)}>
          <CalcPromo onPress={() => router.push('/(shop)/kalkulyator' as never)} />
        </Appear>

        {q.error && !q.data ? (
          <EmptyState icon="wifi-off" title="Mahsulotlar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
        ) : q.isLoading || featured.length ? (
          <Appear delay={stagger(4)}>
            <SectionHead title="Ommabop" action="Barchasi" onAction={() => toCatalog()} style={{ paddingHorizontal: space.pageX, marginBottom: space.xs }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.pageX, paddingVertical: space.sm, gap: space.md }}>
              {q.isLoading
                ? [0, 1, 2].map((i) => <Skeleton key={i} width={CARD_W} height={CARD_W * 1.4} radius={radius.card} />)
                : featured.map((item) => <ProductCard key={item.id} item={item} width={CARD_W} onPress={() => toProduct(item.id)} />)}
            </ScrollView>
          </Appear>
        ) : (
          <EmptyState icon="store" title="Vitrina hozircha bo'sh" hint="Mahsulotlar tez orada qo'shiladi" />
        )}
      </ScrollView>
    </View>
  );
}
