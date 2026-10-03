import React from 'react';
import { Image, Linking, Platform, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { Badge, Card, EmptyState, ListItem, Skeleton, Txt } from '@/design/primitives';
import { ListGroup, Reveal, StickyActionBar } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { alpha, radius, size, space } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';
import { IsoBox } from '@/features/shop/art';
import { FloatingButton, LOGO_MARK } from '@/features/shop/ui';
import { useTodayStatus } from '@/features/shop/today';

/** Demo `.zcover` — 130 css → 180 dp. */
const COVER_H = 180;

/** Muqova: to'q fonda zavod siluetlari (demo `isoBox` × 2 + minora) — faqat bezak. */
function Cover({ width }: { width: number }) {
  const { c } = useTheme();
  const f: [string, string, string] = [alpha(c.textOnInverse, 0.13), alpha(c.textOnInverse, 0.08), alpha(c.textOnInverse, 0.05)];
  return (
    <Svg width={width} height={COVER_H} viewBox="0 0 280 120" preserveAspectRatio="xMidYMid slice" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect width="280" height="120" fill={c.bgInverse} />
      <IsoBox ox={60} oy={38} w={40} d={30} h={46} fill={f} />
      <IsoBox ox={130} oy={52} w={70} d={40} h={26} fill={f} />
      <Rect x="214" y="20" width="10" height="70" fill={f[0]} />
    </Svg>
  );
}

function ZavodSkeleton() {
  return (
    <View style={{ gap: space.md }}>
      <Skeleton height={size.driverTouch + space.xxxl + space.sm} radius={radius.card} />
      <View style={{ flexDirection: 'row', gap: space.tight }}>
        {[0, 1, 2].map((i) => <Skeleton key={i} height={size.driverTouch + space.md} radius={radius.card} style={{ flex: 1 }} />)}
      </View>
      <Skeleton height={size.driverTouch * 2} radius={radius.card} />
    </View>
  );
}

/**
 * Zavod sahifasi — demo CLIENT[6]: to'q muqova, ustiga chiqqan karta (logotip, nom, holat nishonlari),
 * 3 ta raqam, manzil / ish vaqti / aloqa ro'yxati va pastda Telegram + Qo'ng'iroq.
 * Faqat ERP bergan ma'lumot: sertifikat, quvvat, mikserlar soni yo'q — ko'rsatilmaydi.
 */
export default function SellerProfile() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const q = useShopCatalog();
  const s = q.data?.seller;
  const name = s?.name ?? q.data?.company.name;
  const items = (q.data?.items ?? []).filter((i) => !i.sellerId || !s?.id || i.sellerId === s.id);
  const st = useTodayStatus(s?.hours);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(shop)' as never));

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
  const hoursText = s?.workingHours ?? st?.hoursLabel ?? null;

  const stats = [
    items.length ? { value: String(items.length), label: 'mahsulot' } : null,
    s?.foundedYear ? { value: `${new Date().getFullYear() - s.foundedYear} yil`, label: 'tajriba' } : null,
    st ? { value: st.hoursLabel, label: 'ish vaqti' } : null,
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

        <View style={{ marginTop: -space.xxxl - space.xs, paddingHorizontal: space.pageX }}>
          {!q.isLoading && !name ? (
            <Card>
              {q.error
                ? <EmptyState compact icon="circle-alert" title="Ma'lumot yuklanmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} />
                : <EmptyState compact icon="building" title="Zavod ma'lumoti yo'q" />}
            </Card>
          ) : (
            <Reveal loading={q.isLoading} skeleton={<ZavodSkeleton />} gap={space.md + 2}>
              <Card style={{ gap: space.sm + 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md + 2 }}>
                  <Image source={LOGO_MARK} style={{ width: size.avatarLg + space.sm, height: size.avatarLg + space.sm, borderRadius: radius.lg }} resizeMode="cover" accessibilityIgnoresInvertColors />
                  <View style={{ flex: 1 }}>
                    <Txt v="titleMd" accessibilityRole="header" numberOfLines={2}>{name}</Txt>
                    <Txt v="tSm" numberOfLines={2}>{[s?.legalName ?? 'Temir-beton mahsulotlari', address?.split(',')[0]].filter(Boolean).join(' · ')}</Txt>
                  </View>
                </View>
                {st ? (
                  <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                    <Badge label={`${st.open ? 'Ochiq' : 'Yopiq'} · ${st.hoursLabel}`} tone={st.open ? 'success' : 'neutral'} />
                    {st.sameDay ? <Badge label="Bugun yetkazadi" tone="info" /> : null}
                  </View>
                ) : null}
                {s?.about ? <Txt v="body" color="body">{s.about}</Txt> : null}
              </Card>

              {stats.length > 1 ? (
                <View style={{ flexDirection: 'row', gap: space.tight }}>
                  {stats.map((x) => (
                    <Card key={x.label} style={{ flex: 1, alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.sm }}>
                      <Txt v="kpiValue" numberOfLines={1} adjustsFontSizeToFit>{x.value}</Txt>
                      <Txt v="tSm" numberOfLines={1} align="center">{x.label}</Txt>
                    </Card>
                  ))}
                </View>
              ) : null}

              <ListGroup>
                {address ? <ListItem icon="map" module="logistics" title={address} subtitle="Xaritada ochish" onPress={openMap} /> : null}
                {hoursText ? <ListItem icon="clock" module="production" title="Ish vaqti" subtitle={`${hoursText}${s?.hours && !s.hours.sunday ? ' · yakshanba dam' : ''}`} /> : null}
                {s?.email ? <ListItem icon="mail" module="brand" title={s.email} subtitle="E-pochta" onPress={() => void Linking.openURL(`mailto:${s.email}`)} /> : null}
                <ListItem icon="message-circle" module="brand" title="Menga qo'ng'iroq qiling" subtitle="Raqamingizni qoldiring — o'zimiz bog'lanamiz" onPress={() => router.push('/(shop)/aloqa' as never)} />
              </ListGroup>
            </Reveal>
          )}
        </View>
      </ScrollView>

      {phone ? (
        <StickyActionBar
          primary={{ title: "Qo'ng'iroq", icon: 'phone', onPress: call }}
          secondary={telegram ? { title: 'Telegram', icon: 'message-circle', onPress: () => void Linking.openURL(telegram) } : undefined}
        />
      ) : telegram ? (
        <StickyActionBar primary={{ title: 'Telegram', icon: 'send', onPress: () => void Linking.openURL(telegram) }} />
      ) : null}
      <FloatingButton icon="chevron-left" label="Orqaga" onPress={back} style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg }} />
    </View>
  );
}
