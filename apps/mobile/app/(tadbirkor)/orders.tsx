import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Gap, Screen, StatusChip, Txt, fmtSum } from '@/design/primitives';
import { Avatar, Segmented, daysLeft } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useWorkOrders } from '@/features/eco/api';
import { useOrders } from '@/features/orders/api';

const SEG = [{ key: 'NEW', label: 'Yangi' }, { key: 'ACCEPTED,WORKER_ASSIGNED,IN_PROGRESS', label: 'Jarayonda' }, { key: 'REVIEW', label: 'Tekshiruv' }, { key: 'DONE', label: 'Tugallandi' }, { key: 'PAID', label: "To'langan" }, { key: 'all', label: 'Barchasi' }, { key: 'beton', label: 'Beton' }] as const;

/** Buyurtmalar: ish buyurtmalari (asosiy) + beton buyurtmalari (segment). */
export default function Orders() {
  const router = useRouter();
  const { c } = useTheme();
  const [seg, setSeg] = useState<(typeof SEG)[number]['key']>('NEW');
  const wo = useWorkOrders(seg === 'all' || seg === 'beton' ? undefined : seg);
  const beton = useOrders();
  if (seg === 'beton') {
    return (
      <Screen padded={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Segmented value={seg} onChange={setSeg} items={SEG as never} /></View>
        <FlatList data={beton.data?.items ?? []} keyExtractor={(o) => o.id} contentContainerStyle={{ padding: 16 }} ItemSeparatorComponent={() => <Gap h={10} />}
          ListEmptyComponent={<EmptyState title="Beton buyurtmalari yo'q" />}
          renderItem={({ item: o }) => (
            <Pressable onPress={() => router.push(`/order/${o.id}`)}><Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="heading">№{o.number} · {o.client.name}</Txt><StatusChip status={o.status} /></View>
              <Txt v="caption" color="secondary">{o.items.map((i) => `${i.gradeSnapshot} ${i.volumeM3} m³`).join(' · ')} · {o.address}</Txt>
              <Txt v="bodyStrong" color="brand" style={{ marginTop: 6 }}>{fmtSum(o.totalAmount)}</Txt>
            </Card></Pressable>
          )} />
      </Screen>
    );
  }
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Segmented value={seg} onChange={setSeg} items={SEG as never} /></View>
      <FlatList
        data={wo.data ?? []} keyExtractor={(o) => o.id} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} ItemSeparatorComponent={() => <Gap h={10} />}
        refreshControl={<RefreshControl refreshing={wo.isFetching} onRefresh={() => void wo.refetch()} />}
        ListEmptyComponent={wo.isLoading ? null : <EmptyState title="Buyurtmalar yo'q" />}
        renderItem={({ item: o }) => {
          const dl = daysLeft(o.deadline);
          return (
            <Pressable onPress={() => router.push(`/work-order/${o.id}`)}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}><Txt v="caption" color="secondary">№{o.number} · {o.project?.name ?? 'Loyihasiz'}</Txt><Txt v="heading">{o.title}</Txt></View>
                  <StatusChip status={o.status} />
                </View>
                <Gap h={10} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {o.worker ? <><Avatar name={o.worker.fullName} size={28} /><Txt v="caption" color="secondary">{o.worker.fullName}</Txt></> : <Txt v="caption" color="warning">Quruvchi biriktirilmagan</Txt>}
                  </View>
                  <Txt v="bodyStrong" color="brand">{fmtSum(o.price)}</Txt>
                </View>
                <Txt v="caption" color={dl !== null && dl < 0 && !['DONE', 'PAID', 'CANCELLED'].includes(o.status) ? 'danger' : 'secondary'} style={{ marginTop: 6 }}>
                  Muddat: {new Date(o.deadline).toLocaleDateString('ru-RU')} {dl !== null && dl < 0 ? `(${-dl} kun kechikdi)` : dl !== null ? `(${dl} kun)` : ''}
                </Txt>
              </Card>
            </Pressable>
          );
        }}
      />
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
        <Button title="+ Yangi buyurtma" onPress={() => router.push('/(tadbirkor)/new-order')} style={{ shadowColor: c.brandPrimary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }} />
      </View>
    </Screen>
  );
}
