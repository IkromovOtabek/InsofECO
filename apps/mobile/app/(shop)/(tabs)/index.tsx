import React from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Skeleton, Txt } from '@/design/primitives';
import { Icon, type IconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { Appear, stagger } from '@/design/motion';
import { useShopCatalog } from '@/features/shop/api';
import { ProductCard, ShopHeader } from '@/features/shop/ui';

/** Nega aynan biz — mijozni ushlab qoladigan uchta sabab. */
const REASONS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'shield-check', title: 'Zavod kafolati', text: 'Har partiya laboratoriyada sinovdan o\'tadi, sertifikat bilan' },
  { icon: 'truck', title: 'Yetkazib beramiz', text: 'O\'z transportimiz — obyektga kelishilgan vaqtda' },
  { icon: 'receipt', title: 'Zavod narxi', text: "Vositachisiz, to'g'ridan-to'g'ri ishlab chiqaruvchidan" },
];

const CARD_W = 168;

/**
 * Bosh sahifa — mehmon ilovani ochganda ko'radigan birinchi ekran. Vazifasi: ishonch
 * uyg'otish va bir bosishda harakatga undash (katalog yoki qo'ng'iroq). Logotipdan boshqa
 * hech qanday "kirish" talabi yo'q — hisob Profil tabida.
 */
export default function ShopHome() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useShopCatalog();
  const phone = q.data?.company.phone ?? null;
  const featured = (q.data?.items ?? []).slice(0, 8);

  const toCatalog = () => router.navigate('/(shop)/(tabs)/katalog' as never);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ShopHeader height={44} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl, gap: space.section }}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        {/* Bosh taklif — brend rangida, bitta asosiy amal */}
        <Appear delay={40} style={{ paddingHorizontal: space.pageX, paddingTop: space.pageY }}>
          <View style={{ backgroundColor: c.brand, borderRadius: radius.card, borderCurve: 'continuous', padding: space.panel, gap: space.md }}>
            <Txt v="overline" style={{ color: c.textOnBrand, opacity: 0.8 }}>Temir beton mahsulotlari</Txt>
            <Txt v="titleLg" style={{ color: c.textOnBrand }}>Beton va JBI — zavoddan to'g'ridan-to'g'ri</Txt>
            <Txt v="bodySm" style={{ color: c.textOnBrand, opacity: 0.85 }}>
              Tovar beton, plitalar, bloklar va boshqa mahsulotlar. Narxni ko'ring, hajmni yozing — sotuv bo'limi o'zi qo'ng'iroq qiladi.
            </Txt>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
              <Button title="Katalogni ochish" variant="secondary" size="lg" iconRight="arrow-right" onPress={toCatalog} style={{ flex: 1 }} />
              {phone ? <Button title="Qo'ng'iroq" variant="ghost" size="lg" icon="phone" full={false} onPress={() => void Linking.openURL(`tel:${phone}`)} style={{ backgroundColor: 'rgba(15,23,43,0.12)' }} /> : null}
            </View>
          </View>
        </Appear>

        {/* Nega biz */}
        <View style={{ paddingHorizontal: space.pageX, gap: space.md }}>
          <Txt v="titleMd">Nega Insof JBI?</Txt>
          {REASONS.map((r, i) => (
            <Appear key={r.title} delay={stagger(i, 60) + 100}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: size.iconTile, height: size.iconTile, borderRadius: radius.lg, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={r.icon} tone="brand" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">{r.title}</Txt>
                  <Txt v="caption">{r.text}</Txt>
                </View>
              </Card>
            </Appear>
          ))}
        </View>

        {/* Mahsulotlar — gorizontal, "Barchasi" katalogga */}
        {q.isLoading || featured.length ? (
          <View style={{ gap: space.md }}>
            <View style={{ paddingHorizontal: space.pageX, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt v="titleMd">Mahsulotlar</Txt>
              <Pressable accessibilityRole="button" onPress={toCatalog} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.touch }}>
                <Txt v="bodySm" color="brand" style={{ fontWeight: '600' }}>Barchasi</Txt>
                <Icon name="arrow-right" tone="brand" size={size.iconSm} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.pageX, gap: space.md }}>
              {q.isLoading
                ? [0, 1, 2].map((i) => <Skeleton key={i} width={CARD_W} height={CARD_W * 1.6} radius={radius.card} />)
                : featured.map((item) => <ProductCard key={item.id} item={item} width={CARD_W} onPress={() => router.push(`/(shop)/${item.id}` as never)} />)}
            </ScrollView>
          </View>
        ) : null}

        {/* Qanday ishlaydi */}
        <View style={{ paddingHorizontal: space.pageX, gap: space.md }}>
          <Txt v="titleMd">Buyurtma 3 qadamda</Txt>
          <Card style={{ gap: space.md }}>
            {[
              ['1', 'Mahsulotni tanlang', 'Katalogdan kerakli marka yoki mahsulot'],
              ['2', 'Hajm va telefon', 'Ro\'yxatdan o\'tish shart emas'],
              ['3', 'Biz qo\'ng\'iroq qilamiz', 'Narx, yetkazish va muddatni kelishamiz'],
            ].map(([n, t, s]) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: size.avatar, height: size.avatar, borderRadius: radius.pill, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt v="bodyStrong" style={{ color: c.textOnBrand }}>{n}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">{t}</Txt>
                  <Txt v="caption">{s}</Txt>
                </View>
              </View>
            ))}
          </Card>
        </View>

        {phone ? (
          <View style={{ paddingHorizontal: space.pageX }}>
            <Button title="Menga qo'ng'iroq qiling" size="lg" icon="phone" onPress={() => router.navigate('/(shop)/(tabs)/aloqa' as never)} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
