import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Gap, Screen, StatusChip, Txt, fmtDateFull, fmtM3, fmtSum } from '@/design/primitives';
import { Avatar, Tabs, daysLeft } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useWorkOrders } from '@/features/eco/api';
import { useOrders } from '@/features/orders/api';

const SEG = [{ key: 'NEW', label: 'Yangi' }, { key: 'ACCEPTED,WORKER_ASSIGNED,IN_PROGRESS', label: 'Jarayonda' }, { key: 'REVIEW', label: 'Tekshiruv' }, { key: 'DONE', label: 'Tugallandi' }, { key: 'PAID', label: "To'langan" }, { key: 'all', label: 'Barchasi' }, { key: 'beton', label: 'Beton' }] as const;
type SegKey = (typeof SEG)[number]['key'];

/** Buyurtmalar: ish buyurtmalari (asosiy) + beton buyurtmalari (segment). */
export default function Orders() {
  const router = useRouter();
  const [seg, setSeg] = useState<SegKey>('NEW');
  const wo = useWorkOrders(seg === 'all' || seg === 'beton' ? undefined : seg);
  const beton = useOrders();
  const header = (
    <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>
      <Tabs value={seg} onChange={setSeg} items={[...SEG]} />
    </View>
  );
  if (seg === 'beton') {
    return (
      <Screen padded={false}>
        {header}
        <FlatList data={beton.data?.items ?? []} keyExtractor={(o) => o.id} contentContainerStyle={{ padding: space.pageX }} ItemSeparatorComponent={() => <Gap h={space.md} />}
          ListEmptyComponent={<EmptyState title="Beton buyurtmalari yo'q" icon="package" />}
          renderItem={({ item: o }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/order/${o.id}`)}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
                  <Txt v="titleSm" style={{ flex: 1 }} numberOfLines={2}>№{o.number} · {o.client.name}</Txt>
                  <StatusChip status={o.status} />
                </View>
                <Txt v="caption">{o.items.map((i) => `${i.gradeSnapshot} ${fmtM3(i.volumeM3)}`).join(' · ')} · {o.address}</Txt>
                <Txt v="bodyStrong" color="brand" style={{ marginTop: space.sm }}>{fmtSum(o.totalAmount)}</Txt>
              </Card>
            </Pressable>
          )} />
      </Screen>
    );
  }
  return (
    <Screen padded={false}>
      {header}
      <FlatList
        data={wo.data ?? []} keyExtractor={(o) => o.id} contentContainerStyle={{ padding: space.pageX, paddingBottom: size.buttonLg + space.x12 }} ItemSeparatorComponent={() => <Gap h={space.md} />}
        refreshControl={<RefreshControl refreshing={wo.isFetching} onRefresh={() => void wo.refetch()} />}
        ListEmptyComponent={wo.isLoading ? null : <EmptyState title="Buyurtmalar yo'q" hint="Yangi buyurtma tugmasi bilan yarating" icon="clipboard-list" />}
        renderItem={({ item: o }) => {
          const dl = daysLeft(o.deadline);
          const late = dl !== null && dl < 0 && !['DONE', 'PAID', 'CANCELLED'].includes(o.status);
          return (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/work-order/${o.id}`)}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="caption">№{o.number} · {o.project?.name ?? 'Loyihasiz'}</Txt>
                    <Txt v="titleSm">{o.title}</Txt>
                  </View>
                  <StatusChip status={o.status} />
                </View>
                <Gap h={space.md} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
                    {o.worker ? <><Avatar name={o.worker.fullName} size={size.iconXl} /><Txt v="caption" numberOfLines={1}>{o.worker.fullName}</Txt></> : <Txt v="caption" color="warning">Quruvchi biriktirilmagan</Txt>}
                  </View>
                  <Txt v="bodyStrong" color="brand">{fmtSum(o.price)}</Txt>
                </View>
                <Txt v="caption" color={late ? 'danger' : 'muted'} style={{ marginTop: space.sm }}>
                  Muddat: {fmtDateFull(o.deadline)} {dl !== null && dl < 0 ? `(${-dl} kun kechikdi)` : dl !== null ? `(${dl} kun)` : ''}
                </Txt>
              </Card>
            </Pressable>
          );
        }}
      />
      <View style={{ position: 'absolute', left: space.pageX, right: space.pageX, bottom: space.lg }}>
        <Button title="Yangi buyurtma" icon="plus" size="lg" onPress={() => router.push('/(tadbirkor)/new-order')} />
      </View>
    </Screen>
  );
}
