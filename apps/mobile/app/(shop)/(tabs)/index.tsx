import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Skeleton, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { useShopCatalog } from '@/features/shop/api';
import { ProductCard, ShopHeader } from '@/features/shop/ui';
import { HeroSwiper } from '@/features/shop/hero-swiper';
import { CalcPromo, TodayCard } from '@/features/shop/home-blocks';

const CARD_W = 168;

/**
 * Bosh sahifa — mehmon ilovani ochganda ko'radigan birinchi ekran. Tepada swiper: asosiy
 * taklif, reklama (ERP → E-commerce → Reklama), "Buyurtma 3 qadamda" va "Nega Insof JBI"
 * rasmlari. Keyin "Bugungi holat" (ochiqmi, bugun yetkazamizmi, qo'ng'iroq/Telegram),
 * beton kalkulyatori, mahsulotlar va qo'ng'iroq so'rovi. Hisob — Profil tabida.
 */
export default function ShopHome() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useShopCatalog();
  const phone = q.data?.company.phone ?? null;
  const seller = q.data?.seller?.name ?? q.data?.company.name ?? null;
  const featured = (q.data?.items ?? []).slice(0, 8);

  const toCatalog = () => router.navigate('/(shop)/(tabs)/katalog' as never);
  const toProduct = (id: string) => router.push(`/(shop)/${id}` as never);
  const toSeller = () => router.push('/(shop)/zavod' as never);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ShopHeader height={44} />
      <ScrollView
        contentContainerStyle={{ paddingTop: space.pageY, paddingBottom: insets.bottom + space.xxxl, gap: space.section }}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        <Appear delay={40}>
          <HeroSwiper banners={q.data?.banners ?? []} phone={phone} onCatalog={toCatalog} onProduct={toProduct} />
        </Appear>

        <Appear delay={80}>
          <TodayCard seller={q.data?.seller} phone={phone} />
        </Appear>

        <Appear delay={120}>
          <CalcPromo onPress={() => router.push('/(shop)/kalkulyator' as never)} />
        </Appear>

        {/* Mahsulotlar — gorizontal, "Barchasi" katalogga */}
        {q.isLoading || featured.length ? (
          <View style={{ gap: space.md }}>
            <View style={{ paddingHorizontal: space.pageX, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt v="titleMd">Mahsulotlar</Txt>
              <Pressable accessibilityRole="button" onPress={toCatalog} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.touch }}>
                <Txt v="bodyStrong" color="brand">Barchasi</Txt>
                <Icon name="arrow-right" tone="brand" size={size.iconSm} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.pageX, gap: space.md }}>
              {q.isLoading
                ? [0, 1, 2].map((i) => <Skeleton key={i} width={CARD_W} height={CARD_W * 1.5} radius={radius.card} />)
                : featured.map((item) => <ProductCard key={item.id} item={item} width={CARD_W} seller={seller} onSeller={toSeller} onPress={() => toProduct(item.id)} />)}
            </ScrollView>
          </View>
        ) : null}

        {phone ? (
          <View style={{ paddingHorizontal: space.pageX }}>
            <Button title="Menga qo'ng'iroq qiling" size="lg" icon="phone" onPress={() => router.navigate('/(shop)/(tabs)/aloqa' as never)} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
