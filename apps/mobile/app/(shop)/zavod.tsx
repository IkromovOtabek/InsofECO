import React from 'react';
import { Image, Linking, Platform, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon, Rect } from 'react-native-svg';
import { Badge, Card, EmptyState, ListItem, Skeleton, Txt } from '@/design/primitives';
import { ListGroup, SectionHead, StickyActionBar } from '@/design/blocks';
import { Appear, stagger } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';
import { FloatingButton, LOGO_MARK, ProductGrid } from '@/features/shop/ui';
import { useTodayStatus } from '@/features/shop/today';

const COVER_H = 148;

/** Muqova: to'q fonda zavod siluetlari (izometrik qutilar) — faqat bezak, ranglar mavzudan. */
function Cover({ width }: { width: number }) {
  const { c } = useTheme();
  const P = (ox: number, oy: number, x: number, y: number, z: number) => `${(ox + (x - y) * 0.866).toFixed(1)},${(oy + (x + y) * 0.5 - z).toFixed(1)}`;
  const box = (ox: number, oy: number, w: number, d: number, h: number) => (
    <>
      <Polygon points={`${P(ox, oy, 0, d, 0)} ${P(ox, oy, w, d, 0)} ${P(ox, oy, w, d, h)} ${P(ox, oy, 0, d, h)}`} fill={c.textOnInverse} fillOpacity={0.08} />
      <Polygon points={`${P(ox, oy, w, 0, 0)} ${P(ox, oy, w, d, 0)} ${P(ox, oy, w, d, h)} ${P(ox, oy, w, 0, h)}`} fill={c.textOnInverse} fillOpacity={0.05} />
      <Polygon points={`${P(ox, oy, 0, 0, h)} ${P(ox, oy, w, 0, h)} ${P(ox, oy, w, d, h)} ${P(ox, oy, 0, d, h)}`} fill={c.textOnInverse} fillOpacity={0.13} />
    </>
  );
  return (
    <Svg width={width} height={COVER_H} viewBox={`0 0 280 ${COVER_H}`} preserveAspectRatio="xMidYMid slice" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect width="280" height={COVER_H} fill={c.bgInverse} />
      {box(70, 52, 40, 30, 46)}
      {box(140, 66, 70, 40, 26)}
      <Rect x="224" y="30" width="10" height="72" fill={c.textOnInverse} fillOpacity={0.13} />
      <Rect x="24" y="96" width="232" height="3" fill={c.accent} fillOpacity={0.6} />
    </Svg>
  );
}

/**
 * Zavod (sotuvchi) sahifasi — ishonch: muqova, logotip, "ochiq" belgisi, raqamlar, manzil/ish vaqti/aloqa,
 * barcha mahsulotlar. Pastda doimiy Telegram + Qo'ng'iroq. Sertifikatlar ERP'da hali yo'q — ko'rsatilmaydi.
 */
export default function SellerProfile() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const q = useShopCatalog();
  const s = q.data?.seller;
  const name = s?.name ?? q.data?.company.name;
  const items = (q.data?.items ?? []).filter((i) => !i.sellerId || i.sellerId === (s?.id ?? i.sellerId));
  const st = useTodayStatus(s?.hours);

  const back = (
    <FloatingButton icon="arrow-left" label="Orqaga" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(shop)' as never))} style={{ position: 'absolute', top: insets.top + space.sm, left: space.pageX }} />
  );

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <Skeleton width="100%" height={COVER_H + insets.top} radius={0} />
        <View style={{ padding: space.pageX, gap: space.md }}>
          <Skeleton height={size.driverTouch + space.xxl} radius={radius.card} />
          <Skeleton height={size.driverTouch} radius={radius.card} />
          <Skeleton height={size.driverTouch * 2} radius={radius.card} />
        </View>
        {back}
      </View>
    );
  }
  if (!name) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp, justifyContent: 'center' }}>
        {q.error
          ? <EmptyState icon="circle-alert" title="Ma'lumot yuklanmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} />
          : <EmptyState icon="building" title="Zavod ma'lumoti yo'q" action="Orqaga" onAction={() => router.back()} />}
        {back}
      </View>
    );
  }

  const phone = s?.phone ?? q.data?.company.phone ?? null;
  const address = s?.address ?? q.data?.company.address ?? null;
  const telegram = s?.telegram ?? null;
  const call = () => { if (phone) void Linking.openURL(`tel:${phone}`); };
  const openMap = () => {
    if (s?.location) {
      const { lat, lng } = s.location;
      void Linking.openURL(Platform.OS === 'ios' ? `maps:0,0?q=${lat},${lng}` : `geo:${lat},${lng}?q=${lat},${lng}`);
    } else if (address) void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`);
  };
  const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  const hoursText = s?.workingHours ?? (s?.hours ? `${hh(s.hours.open)}–${hh(s.hours.close)}` : null);

  const stats = [
    { value: String(items.length), label: 'mahsulot' },
    s?.foundedYear ? { value: String(new Date().getFullYear() - s.foundedYear), label: 'yil tajriba' } : null,
    s?.hours ? { value: `${s.hours.open}–${s.hours.close}`, label: 'ish soatlari' } : null,
  ].filter((x): x is { value: string; label: string } => !!x);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} progressViewOffset={insets.top} />}
      >
        <View style={{ paddingTop: insets.top, backgroundColor: c.bgInverse }}>
          <Cover width={width} />
        </View>

        <View style={{ marginTop: -space.x10, paddingHorizontal: space.pageX, gap: space.lg }}>
          <Appear>
            <Card style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Image source={LOGO_MARK} style={{ width: size.avatarLg, height: size.avatarLg, borderRadius: radius.lg }} resizeMode="cover" accessibilityIgnoresInvertColors />
                <View style={{ flex: 1 }}>
                  <Txt v="titleMd" accessibilityRole="header" numberOfLines={2}>{name}</Txt>
                  <Txt v="caption" numberOfLines={1}>{s?.legalName ?? 'Temir-beton mahsulotlari'}</Txt>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                {st ? <Badge label={`${st.open ? 'Ochiq' : 'Yopiq'} · ${st.openLabel}`} tone={st.open ? 'success' : 'neutral'} /> : null}
                {st?.sameDay ? <Badge label="Bugun yetkazadi" tone="info" icon="truck" /> : null}
              </View>
              {s?.about ? <Txt v="body" color="body">{s.about}</Txt> : null}
            </Card>
          </Appear>

          {stats.length > 1 ? (
            <Appear delay={stagger(1)} style={{ flexDirection: 'row', gap: space.sm }}>
              {stats.map((x) => (
                <Card key={x.label} style={{ flex: 1, alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.sm }}>
                  <Txt v="titleMd" numberOfLines={1} adjustsFontSizeToFit>{x.value}</Txt>
                  <Txt v="caption" numberOfLines={1} align="center">{x.label}</Txt>
                </Card>
              ))}
            </Appear>
          ) : null}

          <Appear delay={stagger(2)}>
            <ListGroup>
              {address ? <ListItem icon="map-pin" module="logistics" title={address} subtitle="Xaritada ochish" onPress={openMap} /> : null}
              {hoursText ? <ListItem icon="clock" module="production" title="Ish vaqti" subtitle={`${hoursText}${s?.hours && !s.hours.sunday ? ' · yakshanba dam' : ''}`} /> : null}
              {phone ? <ListItem icon="phone" module="brand" title="Telefon" subtitle={[phone, s?.phone2].filter(Boolean).join(' · ')} onPress={call} /> : null}
              {s?.email ? <ListItem icon="mail" module="brand" title="E-pochta" subtitle={s.email} onPress={() => void Linking.openURL(`mailto:${s.email}`)} /> : null}
              {s?.foundedYear ? <ListItem icon="calendar-days" module="warehouse" title="Faoliyat" subtitle={`${s.foundedYear}-yildan beri`} /> : null}
            </ListGroup>
          </Appear>

          {items.length ? (
            <Appear delay={stagger(3)}>
              <SectionHead title="Zavod mahsulotlari" count={items.length} />
              <ProductGrid items={items} onOpen={(id) => router.push(`/(shop)/${id}` as never)} />
            </Appear>
          ) : null}
        </View>
      </ScrollView>

      {phone ? (
        <StickyActionBar
          primary={{ title: "Qo'ng'iroq", icon: 'phone', onPress: call }}
          secondary={telegram ? { title: 'Telegram', icon: 'send', onPress: () => void Linking.openURL(telegram) } : undefined}
        />
      ) : telegram ? (
        <StickyActionBar primary={{ title: 'Telegram', icon: 'send', onPress: () => void Linking.openURL(telegram) }} />
      ) : null}
      {back}
    </View>
  );
}
