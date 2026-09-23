import React, { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Gap, Screen, StatusChip, Txt, fmtSum } from '@/design/primitives';
import { Segmented, daysLeft } from '@/design/ui';
import { useAction, useWorkOrders } from '@/features/eco/api';

const SEG = [{ key: 'ACCEPTED', label: 'Ochiq' }, { key: 'WORKER_ASSIGNED,IN_PROGRESS,REVIEW', label: 'Mening' }, { key: 'DONE,PAID', label: 'Tugallangan' }] as const;

/** Quruvchi: ochiq buyurtmalarni qabul qiladi, o'zinikini kuzatadi. */
export default function QuruvchiOrders() {
  const router = useRouter();
  const [seg, setSeg] = useState<(typeof SEG)[number]['key']>('WORKER_ASSIGNED,IN_PROGRESS,REVIEW');
  const q = useWorkOrders(seg);
  const start = useAction<string>((id) => ({ path: `/work-orders/${id}/start` }), ['work-orders', 'dash']);
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Segmented value={seg} onChange={setSeg} items={SEG as never} /></View>
      <FlatList data={q.data ?? []} keyExtractor={(o) => o.id} contentContainerStyle={{ padding: 16 }} ItemSeparatorComponent={() => <Gap h={10} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Buyurtmalar yo'q" />}
        renderItem={({ item: o }) => {
          const dl = daysLeft(o.deadline);
          return (
            <Pressable onPress={() => router.push(`/work-order/${o.id}`)}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="caption" color="secondary">{o.project?.name ?? 'Loyihasiz'}</Txt><StatusChip status={o.status} /></View>
                <Txt v="heading" style={{ marginTop: 2 }}>{o.title}</Txt>
                <Gap h={8} />
                <Line k="Vazifa" v={o.description ?? '—'} /><Line k="Manzil" v={o.address} /><Line k="To'lov" v={fmtSum(o.price)} strong /><Line k="Deadline" v={`${new Date(o.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}${dl !== null ? ` (${dl} kun)` : ''}`} />
                {o.status === 'ACCEPTED' && !o.workerUserId ? <><Gap h={12} /><Button title="Qabul qilish" size="md" loading={start.isPending} onPress={() => start.mutate(o.id, { onError: (e) => Alert.alert('Xato', e.message) })} /></> : null}
              </Card>
            </Pressable>
          );
        }} />
    </Screen>
  );
}
function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <View style={{ flexDirection: 'row', paddingVertical: 3 }}><Txt v="callout" color="secondary" style={{ width: 80 }}>{k}</Txt><Txt v={strong ? 'bodyStrong' : 'callout'} color={strong ? 'brand' : 'primary'} style={{ flex: 1 }}>{v}</Txt></View>;
}
