import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ListItem, Txt, fmtDate, fmtM3, fmtNum, fmtTime, statusLabel, statusTone } from '@/design/primitives';
import { ListGroup, PageHeader, Reveal, SectionHead, SkeletonList } from '@/design/blocks';
import { fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useCart } from '@/features/shop/cart';
import { LIVE_STATUSES, useClientOrders } from '@/features/shop/orders';
import { MiniArt } from '@/features/shop/ui';

/**
 * "Buyurtma" tabi — faqat haqiqiy ma'lumot:
 *  - kirgan mijoz (ECO: Quruvchi/Tadbirkor): yo'ldagi reyslar (bosilsa jonli kuzatish) va hisobdagi
 *    buyurtmalar — holati serverdan;
 *  - shu telefondan do'kon orqali yuborilgan arizalar (muvaffaqiyatli `POST /order` dan keyin saqlangan).
 *    Do'kon API'si holat qaytarmaydi — shuning uchun holat ko'rsatilmaydi, faqat "yuborildi" sanasi.
 */
export default function ShopOrders() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const sent = useCart((s) => s.sent);
  const eco = useClientOrders();
  const orders = eco.enabled ? eco.data?.items ?? [] : [];
  const live = orders.flatMap((o) => (o.deliveries ?? []).filter((d) => LIVE_STATUSES.includes(d.status)).map((d) => ({ o, d })));
  const loading = eco.enabled && eco.isLoading;
  const empty = !loading && !orders.length && !sent.length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title="Buyurtmalar" style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        contentContainerStyle={[{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxl }, empty && { flexGrow: 1, justifyContent: 'center' }]}
        refreshControl={eco.enabled ? <RefreshControl refreshing={eco.isFetching && !eco.isLoading} onRefresh={() => void eco.refetch()} tintColor={c.textMuted} /> : undefined}
      >
        {empty ? (
          eco.error ? (
            <EmptyState icon="wifi-off" title="Buyurtmalar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void eco.refetch()} />
          ) : (
            <EmptyState icon="package" title="Hali buyurtma yo'q" hint="Savatdan rasmiylashtirgan buyurtmalaringiz shu yerda ko'rinadi" action="Katalogga o'tish" onAction={() => router.navigate('/(shop)/(tabs)/katalog' as never)} />
          )
        ) : (
          <Reveal loading={loading} skeleton={<SkeletonList rows={4} />} gap={space.stack}>
            {live.length ? <SectionHead title="Yo'lda" count={live.length} /> : null}
            {live.length ? (
              <ListGroup>
                {live.map(({ o, d }) => (
                  <ListItem
                    key={d.id} icon="truck" module="logistics"
                    title={`№${o.number} · ${d.sequence}-reys`}
                    subtitle={[d.vehicle?.plateNumber, `${fmtM3(d.plannedM3)} · ${fmtTime(d.plannedAt)}`].filter(Boolean).join(' · ')}
                    badge={{ text: statusLabel(d.status), tone: statusTone(d.status) }}
                    onPress={() => router.push(`/(shop)/kuzatish/${d.id}` as never)}
                  />
                ))}
              </ListGroup>
            ) : null}

            {orders.length ? <SectionHead title="Hisobdagi buyurtmalar" count={orders.length} /> : null}
            {orders.length ? (
              <ListGroup>
                {orders.slice(0, 30).map((o) => (
                  <ListItem
                    key={o.id} icon="package" module="brand"
                    title={`№${o.number} · ${o.items.map((i) => i.gradeSnapshot).join(', ') || 'Beton'}`}
                    subtitle={`${fmtM3(o.totalVolumeM3)} · ${fmtDate(o.scheduledAt)} · ${o.address}`} subtitleLines={1}
                    badge={{ text: statusLabel(o.status), tone: statusTone(o.status) }}
                    onPress={() => router.push(`/order/${o.id}` as never)}
                  />
                ))}
              </ListGroup>
            ) : null}

            {sent.length ? <SectionHead title="Yuborilgan arizalar" count={sent.length} /> : null}
            {sent.length ? (
              <ListGroup>
                {sent.map((s) => (
                  <ListItem
                    key={s.key} leading={<MiniArt item={s.line} />}
                    title={s.line.name}
                    subtitle={[`${fmtNum(s.line.qty, s.line.qty % 1 ? 1 : 0)} ${s.line.unitLabel}`, `${fmtDate(s.at)} ${fmtTime(s.at)}`, s.number ? `№ ${s.number}` : null].filter(Boolean).join(' · ')}
                    subtitleLines={1}
                    value={`≈ ${fmtShort(s.total)}`}
                  />
                ))}
              </ListGroup>
            ) : null}
            {sent.length ? <Txt v="caption" align="center">Arizalar sotuv bo&apos;limiga tushgan — holat va yetkazish vaqtini ular telefonda aytadi</Txt> : null}
          </Reveal>
        )}
      </ScrollView>
    </View>
  );
}
