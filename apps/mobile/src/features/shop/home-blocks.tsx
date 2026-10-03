import React, { useState } from 'react';
import { Linking, ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Button, Card, IconButton, IconTile, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { PressScale } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { elevation, radius, size, space } from '@/design/tokens';
import type { ShopBanner, ShopItem, ShopSeller } from './api';
import { InverseGrid, ProdArt, ProductImage, artKind } from './art';
import { useTodayStatus } from './today';

/** Demo `.promo`: o'ngda chizma uchun joy (110 css → 152 dp), eng kam balandlik 132 css → 182 dp. */
const PROMO_ART_W = 152;
const PROMO_MIN_H = 182;

interface PromoSlide { key: string; title: string; subtitle: string | null; button: string; productId: string | null }

/**
 * "Bugungi taklif" — demo `.hero.promo`: to'q karta, overline, 2–3 qatorli sarlavha, kichik asosiy tugma,
 * o'ngda mahsulot chizmasi va sahifa nuqtalari. Matn ERP reklamasidan (sarlavha / izoh / tugma matni) —
 * server rasmi ishlatilmaydi, ko'rinish doim demo uslubida. Reklama yo'q bo'lsa — zavodning umumiy taklifi.
 * Bir nechta reklama bo'lsa — surib almashtiriladi (nuqtalar shu holatda chiqadi).
 */
export function PromoCard({ banners, items, onOpen }: { banners: ShopBanner[]; items: ShopItem[]; onOpen: (productId: string | null) => void }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const W = width - space.pageX * 2;
  const [index, setIndex] = useState(0);
  const slides: PromoSlide[] = banners.filter((b) => b.title?.trim()).map((b) => ({
    key: b.id, title: b.title.trim(), subtitle: b.subtitle?.trim() || null, button: b.buttonText?.trim() || 'Buyurtma', productId: b.productId,
  }));
  if (!slides.length) slides.push({ key: 'default', title: 'Beton va temir-beton', subtitle: 'zavod narxida, obyektgacha', button: 'Katalog', productId: null });
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    if (i !== index) setIndex(i);
  };
  return (
    <View style={[{ marginHorizontal: space.pageX, borderRadius: radius.hero, borderCurve: 'continuous', backgroundColor: c.bgInverse }, elevation(c).hero]}>
      <View style={{ borderRadius: radius.hero, borderCurve: 'continuous', overflow: 'hidden' }}>
        <InverseGrid />
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEnabled={slides.length > 1} onScroll={onScroll} scrollEventThrottle={32}>
          {slides.map((s) => {
            const product = s.productId ? items.find((i) => i.id === s.productId) : undefined;
            return (
              <View key={s.key} style={{ width: W, minHeight: PROMO_MIN_H, padding: space.lg + 2, paddingRight: PROMO_ART_W, paddingBottom: slides.length > 1 ? space.xxxl + space.xs : space.lg + 2, gap: space.tight }}>
                <Txt v="appbarOverline" style={{ color: c.textOnInverseMuted }}>Bugungi taklif</Txt>
                <Txt v="titleLg" numberOfLines={3} style={{ color: c.textOnInverse }}>{s.subtitle ? `${s.title}\n${s.subtitle}` : s.title}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.xs }}>
                  <Button title={s.button} full={false} onPress={() => onOpen(s.productId)} />
                </View>
                <View pointerEvents="none" style={{ position: 'absolute', right: -space.sm, bottom: space.sm, width: PROMO_ART_W + space.x7, height: (PROMO_ART_W + space.x7) * 0.66 }}>
                  <ProdArt kind={product ? artKind(product) : artKind({ name: `${s.title} ${s.subtitle ?? ''}` })} />
                </View>
              </View>
            );
          })}
        </ScrollView>
        {slides.length > 1 ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: space.lg + 2, bottom: space.lg, flexDirection: 'row', gap: space.xs + 2 }}>
            {slides.map((s, i) => (
              <View key={s.key} style={{ width: i === index ? space.xl + 2 : space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: i === index ? c.brand : c.textOnInverseMuted, opacity: i === index ? 1 : 0.45 }} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * "Bugungi holat" — demo `.card.today`: yashil jonli nuqta, "Zavod ochiq · 07:00–20:00", ostida
 * "Bugun yetkazamiz · …" va o'ngda qo'ng'iroq. Soatlar ERP Sozlamalardan; bo'lmasa karta faqat aloqa uchun.
 */
export function TodayCard({ seller, phone }: { seller?: ShopSeller; phone: string | null }) {
  const { c } = useTheme();
  const st = useTodayStatus(seller?.hours);
  const telegram = seller?.telegram ?? null;
  if (!st && !phone && !telegram) return null;
  const dot = size.dot + space.xs + 2;
  return (
    <Card style={{ marginHorizontal: space.pageX, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md + 2, paddingHorizontal: space.md + 2 }}>
      {st ? (
        <View style={{ width: dot + space.sm + 2, height: dot + space.sm + 2, borderRadius: radius.pill, backgroundColor: st.open ? c.successBg : c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: dot, height: dot, borderRadius: radius.pill, backgroundColor: st.open ? c.successSolid : c.textFaint }} />
        </View>
      ) : <IconTile icon="factory" module="brand" size={size.iconTileSm} />}
      <View style={{ flex: 1, minWidth: 0 }} accessible accessibilityLabel={st ? `${st.open ? 'Zavod ochiq' : 'Zavod yopiq'}, ${st.hoursLabel}. ${st.deliveryShort}` : "Zavod bilan bog'lanish"}>
        <Txt v="listTitle" numberOfLines={1}>{st ? `${st.open ? 'Zavod ochiq' : 'Zavod yopiq'} · ${st.hoursLabel}` : 'Savolingiz bormi?'}</Txt>
        <Txt v="tSm" numberOfLines={1}>{st ? st.deliveryShort : "Sotuv bo'limi bilan bog'laning"}</Txt>
      </View>
      {phone
        ? <IconButton icon="phone" label="Qo'ng'iroq qilish" variant="secondary" tone="strong" onPress={() => void Linking.openURL(`tel:${phone}`)} />
        : telegram ? <IconButton icon="send" label="Telegram" variant="secondary" tone="strong" onPress={() => void Linking.openURL(telegram)} /> : null}
    </Card>
  );
}

/** "Necha m³ kerak?" — demo `.card.calcp`: yumshoq brend foni, plitka, matn, chevron. */
export function CalcPromo({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Beton kalkulyatori: qancha beton kerakligini hisoblash"
      style={[{ marginHorizontal: space.pageX, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: c.brandSoft }, elevation(c).sh1]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 2 }}>
        <IconTile icon="calculator" module="production" size={space.x12} />
        <View style={{ flex: 1 }}>
          <Txt v="listTitle">Necha m³ kerak?</Txt>
          <Txt v="tSm">Poydevor o&apos;lchamini kiriting, hajm va narxni hisoblaymiz</Txt>
        </View>
        <Icon name="chevron-right" size={size.iconMd} tone="body" />
      </View>
    </PressScale>
  );
}

/** Toifa: nom + vitrinadagi birinchi mahsulot (surat yoki chizma uchun). */
export interface Category { name: string; sample: ShopItem; count: number }

/** Mahsulot guruhlari → toifalar (ERP'dagi guruh nomi bo'yicha, tartib saqlanadi). */
export function categoriesOf(items: ShopItem[]): Category[] {
  const map = new Map<string, Category>();
  for (const it of items) {
    if (!it.group) continue;
    const cur = map.get(it.group);
    if (cur) { cur.count += 1; if (!cur.sample.photo && it.photo) cur.sample = it; }
    else map.set(it.group, { name: it.group, sample: it, count: 1 });
  }
  return Array.from(map.values());
}

/** Demo `.cats`: 52 css → 72 dp yuza plitkalar (radius 24, sh1) + yorliq; bosilsa katalog shu toifada. */
export function CategoryTiles({ items, onPick }: { items: Category[]; onPick: (name: string) => void }) {
  const { c } = useTheme();
  if (items.length < 2) return null;
  const tile = space.x12 + space.xxl;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.pageX, gap: space.tight, paddingVertical: space.xs }}>
      {items.map((g) => (
        <PressScale
          key={g.name} accessibilityRole="button" accessibilityLabel={`${g.name}, ${g.count} ta mahsulot`} onPress={() => onPick(g.name)}
          style={{ alignItems: 'center', gap: space.sm - 2, width: tile }}
        >
          <View style={[{ width: tile, height: tile, borderRadius: radius.xl, borderCurve: 'continuous', backgroundColor: c.bgSurface, padding: space.sm }, elevation(c).sh1]}>
            <ProductImage item={g.sample} />
          </View>
          <Txt v="label" color="body" numberOfLines={1} align="center">{g.name}</Txt>
        </PressScale>
      ))}
    </ScrollView>
  );
}
