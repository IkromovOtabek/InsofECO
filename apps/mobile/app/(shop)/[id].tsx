import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, EmptyState, IconTile, KVList, Skeleton, Txt, fmtNum } from '@/design/primitives';
import { ChipGroup, Reveal } from '@/design/blocks';
import { PressScale, haptic } from '@/design/motion';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { elevation, radius, size, space } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';
import { ProductImage } from '@/features/shop/art';
import { useCart } from '@/features/shop/cart';
import { FloatingButton, Price, QtyStepper } from '@/features/shop/ui';
import { useTodayStatus } from '@/features/shop/today';

/** Demo `.pdhero` — 200 css; telefonda 250 dp (+ status bar). */
const HERO_H = 250;

function ProductSkeleton() {
  return (
    <View style={{ gap: space.md, paddingHorizontal: space.pageX }}>
      <Skeleton width="45%" height={space.md + 2} />
      <Skeleton width="80%" height={space.xxl} />
      <Skeleton width="55%" height={space.xxl} />
      <Skeleton height={size.chip + size.chipPad * 2} radius={radius.pill} />
      <Skeleton height={size.driverTouch * 2.5} radius={radius.card} />
    </View>
  );
}

/**
 * Mahsulot sahifasi — demo CLIENT[2]: 250 dp rasm maydoni (orqaga + saralash), ustiga chiqib turgan
 * yumaloq varaq: guruh · zavod, nom, narx + holat, Marka chiplari (shu guruhdagi mahsulotlar),
 * texnik ko'rsatkichlar (KVList), yetkazish kartasi. Pastda: hajm stepperi + "Jami … / Savatga qo'shish".
 */
export default function ShopProduct() {
  const { id, qty: qtyParam } = useLocalSearchParams<{ id: string; qty?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useShopCatalog();
  const item = q.data?.items.find((i) => i.id === id);
  const today = useTodayStatus(q.data?.seller?.hours);
  const add = useCart((s) => s.add);
  const fav = useCart((s) => s.favs.includes(id));
  const toggleFav = useCart((s) => s.toggleFav);
  // Kalkulyatordan "12.1" keladi — maydonda vergul bilan ko'rsatiladi
  const [qty, setQty] = useState(() => (qtyParam ?? String(item?.minQty ?? 1)).replace('.', ','));
  const addLock = useRef(0);

  // Katalog kechroq yuklansa yoki marka almashsa — eng kam hajmdan past bo'lmasin (kalkulyator hajmi ustun)
  useEffect(() => {
    if (!qtyParam && item?.minQty) setQty((v) => (Number(v.replace(',', '.')) < item.minQty! ? String(item.minQty) : v));
  }, [item?.minQty, qtyParam]);

  const siblings = useMemo(() => (item?.group ? (q.data?.items ?? []).filter((i) => i.group === item.group) : []), [q.data, item?.group]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(shop)' as never));

  if (!q.isLoading && !item) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp, justifyContent: 'center' }}>
        {q.error
          ? <EmptyState icon="circle-alert" title="Mahsulot yuklanmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} />
          : <EmptyState icon="package" title="Mahsulot topilmadi" hint="Do'kondan olib tashlangan bo'lishi mumkin" action="Do'konga qaytish" onAction={() => router.dismissTo('/(shop)' as never)} />}
        <FloatingButton icon="chevron-left" label="Orqaga" onPress={back} style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg }} />
      </View>
    );
  }

  const hasPhoto = !!item?.photo;
  const n = Number(qty.replace(',', '.'));
  const valid = Number.isFinite(n) && n > 0;
  const total = item && valid ? n * item.price : 0;
  const seller = q.data?.seller?.name ?? q.data?.company.name ?? '';
  const markLabel = (i: NonNullable<typeof item>) => i.strengthClass ?? i.code ?? i.name;

  const specs = item ? [
    item.strengthClass ? { label: 'Mustahkamlik sinfi', value: item.strengthClass } : null,
    item.code ? { label: 'Kod', value: item.code } : null,
    { label: "O'lchov birligi", value: item.unitLabel },
    item.minQty ? { label: 'Eng kam buyurtma', value: `${fmtNum(item.minQty)} ${item.unitLabel}` } : null,
  ].filter((x): x is { label: string; value: string } => !!x) : [];

  const addToCart = () => {
    if (!item) return;
    if (!valid) { haptic.warning(); toast.warning('Hajmni kiriting'); return; }
    if (item.minQty && n < item.minQty) { haptic.warning(); toast.warning(`Eng kam buyurtma: ${fmtNum(item.minQty)} ${item.unitLabel}`); return; }
    // Tez ikki marta bosilsa hajm savatga ikki marta qo'shilmasin
    const now = Date.now();
    if (now - addLock.current < 700) return;
    addLock.current = now;
    add(item, n);
    haptic.success();
    toast.success(`${item.name} — ${fmtNum(n, n % 1 ? 1 : 0)} ${item.unitLabel}`, "Savatga qo'shildi");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        {/* Server surati — butun hero maydonini to'ldiradi (cover); surat yo'q bo'lsa — chizma o'rtada */}
        <View style={{ height: HERO_H + insets.top, backgroundColor: c.bgMuted, overflow: 'hidden' }}>
          {item && hasPhoto ? (
            <ProductImage item={item} />
          ) : (
            <View style={{ flex: 1, paddingTop: insets.top + space.xl, paddingBottom: space.xxxl + space.sm, paddingHorizontal: space.x10 }}>
              {item ? <ProductImage item={item} /> : <Skeleton height={HERO_H - space.x12} radius={radius.card} />}
            </View>
          )}
        </View>

        <View style={[{ marginTop: -space.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderCurve: 'continuous', backgroundColor: c.bgApp, paddingTop: space.xl }, elevation(c).raised]}>
          <Reveal loading={q.isLoading || !item} skeleton={<ProductSkeleton />} gap={space.md + 2} style={{ paddingHorizontal: space.pageX }}>
            {item ? (
              <View style={{ gap: space.xs }}>
                <Pressable accessibilityRole="link" accessibilityLabel={`Sotuvchi: ${seller}`} onPress={() => router.push('/(shop)/zavod' as never)} hitSlop={space.xs} style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}>
                  <Txt v="tSm" numberOfLines={1}>{[item.group, seller].filter(Boolean).join(' · ')}</Txt>
                </Pressable>
                <Txt v="titleLg" accessibilityRole="header">{item.name}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                  <Price value={item.price} unit={item.unitLabel} big />
                  {today?.sameDay ? <Badge label="Bugun yetkazamiz" tone="success" /> : null}
                  {item.badge ? <Badge label={item.badge} tone="brand" /> : null}
                </View>
              </View>
            ) : null}

            {item && siblings.length > 1 ? (
              <View style={{ gap: space.sm }}>
                <Txt v="overline">Marka</Txt>
                <ChipGroup items={siblings.map((s) => ({ key: s.id, label: markLabel(s) }))} value={item.id} onChange={(k) => router.setParams({ id: k })} />
              </View>
            ) : null}

            {item?.description ? <Txt v="body" color="body">{item.description}</Txt> : null}

            {specs.length ? <KVList rows={specs} /> : null}

            {item ? (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 2 }}>
                <IconTile icon="truck" module="logistics" />
                <View style={{ flex: 1 }}>
                  <Txt v="listTitle">{item.unit === 'm3' ? 'Mikser bilan yetkazish' : "O'z transportimiz bilan yetkazish"}</Txt>
                  <Txt v="tSm">{today ? today.deliveryLabel : "Yetkazish vaqti va narxini sotuv bo'limi kelishadi"}</Txt>
                </View>
              </Card>
            ) : null}
          </Reveal>
        </View>
      </ScrollView>

      {item ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.lg) + space.xs }}>
          <QtyStepper value={qty} onChange={setQty} unit={item.unitLabel} min={item.minQty ?? 1} />
          <PressScale
            onPress={addToCart} accessibilityRole="button" accessibilityLabel={`Savatga qo'shish, jami ${fmtNum(total)} so'm`}
            style={{ flex: 1 }}
          >
            {/* Pill — Pressable ichida: bosish maydoni butun tugma (PressScale uslubi tashqi Animated.View'da) */}
            <View style={[{ height: size.stickyButton, borderRadius: radius.pill, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md }, elevation(c).glow(c.brand)]}>
              <Txt v="caption" numberOfLines={1} style={{ color: c.textOnBrand, opacity: 0.85 }}>{total ? `Jami ${fmtNum(total)} so'm` : 'Hajmni kiriting'}</Txt>
              <Txt v="button" numberOfLines={1} style={{ color: c.textOnBrand }}>Savatga qo&apos;shish</Txt>
            </View>
          </PressScale>
        </View>
      ) : null}

      <FloatingButton icon="chevron-left" label="Orqaga" onPress={back} style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg }} />
      {item ? (
        <FloatingButton
          icon="star" label={fav ? 'Saralanganlardan olish' : 'Saralanganlarga qo\'shish'} active={fav}
          onPress={() => { toggleFav(item.id); haptic.selection(); }}
          style={{ position: 'absolute', top: insets.top + space.sm, right: space.lg }}
        />
      ) : null}
    </View>
  );
}
