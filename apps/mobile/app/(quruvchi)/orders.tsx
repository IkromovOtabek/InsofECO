import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Gap, Screen, StatusChip, Txt, fmtDateFull, fmtSum } from '@/design/primitives';
import { Tabs, daysLeft, toast } from '@/design/ui';
import { space } from '@/design/tokens';
import { useAction, useWorkOrders } from '@/features/eco/api';

const SEG = [{ key: 'ACCEPTED', label: 'Ochiq' }, { key: 'WORKER_ASSIGNED,IN_PROGRESS,REVIEW', label: 'Mening' }, { key: 'DONE,PAID', label: 'Tugallangan' }] as const;
type SegKey = (typeof SEG)[number]['key'];

/** Quruvchi: ochiq buyurtmalarni qabul qiladi, o'zinikini kuzatadi. */
export default function QuruvchiOrders() {
  const router = useRouter();
  const [seg, setSeg] = useState<SegKey>('WORKER_ASSIGNED,IN_PROGRESS,REVIEW');
  const q = useWorkOrders(seg);
  const start = useAction<string>((id) => ({ path: `/work-orders/${id}/start` }), ['work-orders', 'dash']);
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>
        <Tabs value={seg} onChange={setSeg} items={[...SEG]} />
      </View>
      <FlatList data={q.data ?? []} keyExtractor={(o) => o.id} contentContainerStyle={{ padding: space.pageX }} ItemSeparatorComponent={() => <Gap h={space.md} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Buyurtmalar yo'q" hint="Yangi buyurtma kelganda xabar keladi" icon="clipboard-list" />}
        renderItem={({ item: o }) => {
          const dl = daysLeft(o.deadline);
          return (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/work-order/${o.id}`)}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                  <Txt v="caption" style={{ flex: 1 }} numberOfLines={1}>{o.project?.name ?? 'Loyihasiz'}</Txt>
                  <StatusChip status={o.status} />
                </View>
                <Txt v="titleSm" style={{ marginTop: space.xs }}>{o.title}</Txt>
                <Gap h={space.sm} />
                <Line k="Vazifa" v={o.description ?? '—'} />
                <Line k="Manzil" v={o.address} />
                <Line k="To'lov" v={fmtSum(o.price)} strong />
                <Line k="Muddat" v={`${fmtDateFull(o.deadline)}${dl !== null ? ` (${dl} kun)` : ''}`} />
                {o.status === 'ACCEPTED' && !o.workerUserId ? <><Gap h={space.md} /><Button title="Qabul qilish" icon="check" loading={start.isPending} onPress={() => start.mutate(o.id, { onError: (e) => toast.error(e.message, 'Xato') })} /></> : null}
              </Card>
            </Pressable>
          );
        }} />
    </Screen>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: space.xs, gap: space.sm }}>
      <Txt v="bodySm" color="muted" style={{ width: space.x12 + space.xxxl }}>{k}</Txt>
      <Txt v={strong ? 'bodyStrong' : 'bodySm'} color={strong ? 'brand' : 'strong'} style={{ flex: 1 }}>{v}</Txt>
    </View>
  );
}
