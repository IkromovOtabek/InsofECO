import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Button, Txt } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useReducedMotion } from 'react-native-reanimated';
import { photoUrl, type ShopBanner } from '@/features/shop/api';

/** "Nega Insof JBI" — rasm ko'rinishidagi slaydlar (ilova ichida, internetsiz ham ko'rinadi). */
const WHY = [
  { key: 'why-kafolat', src: require('../../../assets/shop/why-kafolat.png') as number, label: 'Zavod kafolati — har partiya laboratoriyada sinovdan o\'tadi' },
  { key: 'why-yetkazish', src: require('../../../assets/shop/why-yetkazish.png') as number, label: 'O\'z transportimiz — obyektga kelishilgan vaqtda' },
  { key: 'why-narx', src: require('../../../assets/shop/why-narx.png') as number, label: 'Zavod narxi — vositachisiz' },
];

/** Slayd nisbati 16:9 — reklama suratlari shu o'lchamda tayyorlanadi (1200×675), kesilmaydi. */
const RATIO = 16 / 9;
const AUTOPLAY_MS = 5000;

type Slide =
  | { kind: 'hero' }
  | { kind: 'steps' }
  | { kind: 'ad'; ad: ShopBanner }
  | { kind: 'why'; src: number; label: string; key: string };

/**
 * Bosh sahifa tepasidagi swiper: asosiy taklif → reklama (ERP → E-commerce → Reklama) →
 * "Buyurtma 3 qadamda" → "Nega Insof JBI" rasmlari. O'zi aylanadi (5 s), qo'lda suriladi;
 * "harakatni kamaytirish" yoqilgan bo'lsa avtomatik aylanmaydi.
 */
export function HeroSwiper({ banners, phone, onCatalog, onProduct }: { banners: ShopBanner[]; phone: string | null; onCatalog: () => void; onProduct: (id: string) => void }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const W = width - space.pageX * 2;
  const H = Math.round(W / RATIO);
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const touching = useRef(false);

  const slides: Slide[] = [
    { kind: 'hero' },
    ...banners.map((ad) => ({ kind: 'ad' as const, ad })),
    { kind: 'steps' },
    ...WHY.map((w) => ({ kind: 'why' as const, ...w })),
  ];

  useEffect(() => {
    if (reduce || slides.length < 2) return;
    const t = setInterval(() => {
      if (touching.current) return;
      setIndex((i) => {
        const n = (i + 1) % slides.length;
        ref.current?.scrollTo({ x: n * (W + space.md), animated: true });
        return n;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [reduce, slides.length, W]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    touching.current = false;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / (W + space.md)));
  };

  const box = { width: W, height: H, borderRadius: radius.card, borderCurve: 'continuous' as const, overflow: 'hidden' as const };

  const render = (s: Slide, i: number) => {
    if (s.kind === 'hero') {
      return (
        <View key="hero" style={[box, { backgroundColor: c.bgInverse, padding: space.xl, justifyContent: 'space-between' }]}>
          <View style={{ gap: space.xs }}>
            <View style={{ width: space.x7, height: 3, borderRadius: radius.pill, backgroundColor: c.accent, marginBottom: space.xs }} />
            <Txt v="overline" style={{ color: c.textOnInverseMuted }}>Temir beton mahsulotlari</Txt>
            <Txt v="titleMd" style={{ color: c.textOnInverse }} numberOfLines={2}>Beton va JBI — zavoddan to'g'ridan-to'g'ri</Txt>
            <Txt v="caption" style={{ color: c.textOnInverseMuted }} numberOfLines={2}>Narxni ko'ring, hajmni yozing — sotuv bo'limi o'zi qo'ng'iroq qiladi</Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Button title="Katalog" iconRight="arrow-right" full={false} onPress={onCatalog} />
            {phone ? <Button title="Qo'ng'iroq" variant="secondary" icon="phone" full={false} onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
          </View>
        </View>
      );
    }
    if (s.kind === 'steps') {
      return (
        <View key="steps" style={[box, { backgroundColor: c.bgSurface, padding: space.lg, justifyContent: 'space-between' }]}>
          <Txt v="titleSm">Buyurtma 3 qadamda</Txt>
          {[
            ['1', 'Mahsulotni tanlang', 'katalogdan'],
            ['2', 'Kiring va hajmni yozing', 'kalkulyator yordam beradi'],
            ['3', 'Biz qo\'ng\'iroq qilamiz', 'narx va yetkazishni kelishamiz'],
          ].map(([n, t, sub]) => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ width: size.iconXl, height: size.iconXl, borderRadius: radius.pill, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Txt v="bodyStrong" style={{ color: c.textOnBrand }}>{n}</Txt>
              </View>
              <Txt v="bodySm" numberOfLines={1} style={{ flex: 1 }}><Txt v="bodyStrong">{t}</Txt> — {sub}</Txt>
            </View>
          ))}
        </View>
      );
    }
    if (s.kind === 'ad') {
      const uri = photoUrl(s.ad.image);
      const open = () => (s.ad.productId ? onProduct(s.ad.productId) : onCatalog());
      return (
        <Pressable key={s.ad.id} accessibilityRole="button" accessibilityLabel={`Reklama: ${s.ad.title}`} onPress={open} style={[box, { backgroundColor: c.bgInverse }]}>
          {uri ? (
            <Image source={{ uri }} style={{ width: W, height: H }} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <View style={{ flex: 1, padding: space.xl, justifyContent: 'space-between' }}>
              <View style={{ gap: space.xs }}>
                <Txt v="overline" style={{ color: c.textOnInverseMuted }}>Bugungi taklif</Txt>
                <Txt v="titleMd" style={{ color: c.textOnInverse }} numberOfLines={2}>{s.ad.title}</Txt>
                {s.ad.subtitle ? <Txt v="bodySm" style={{ color: c.textOnInverseMuted }} numberOfLines={2}>{s.ad.subtitle}</Txt> : null}
              </View>
              <Button title={s.ad.buttonText ?? 'Batafsil'} iconRight="arrow-right" full={false} onPress={open} />
            </View>
          )}
        </Pressable>
      );
    }
    return (
      <View key={s.key} style={box} accessible accessibilityLabel={s.label}>
        <Image source={s.src} style={{ width: W, height: H }} resizeMode="cover" />
      </View>
    );
  };

  return (
    <View style={{ gap: space.sm }}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={W + space.md}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: space.pageX, gap: space.md }}
        onScrollBeginDrag={() => { touching.current = true; }}
        onMomentumScrollEnd={onEnd}
      >
        {slides.map(render)}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xs }}>
        {slides.map((_, i) => (
          <View key={i} style={{ width: i === index ? space.lg : space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: i === index ? c.brand : c.borderDefault }} />
        ))}
      </View>
    </View>
  );
}
