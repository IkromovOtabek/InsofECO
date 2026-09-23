import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, Gap, Screen, Txt, fmtSum } from '@/design/primitives';
import { Kpi, Row, Stars } from '@/design/ui';
import { useSession } from '@/core/session';
import { useWorkOrders, useWorker } from '@/features/eco/api';

/** Ishlarim: tarix + reyting statistikasi. */
export default function MyJobs() {
  const router = useRouter();
  const userId = useSession((s) => s.user?.id ?? '');
  const q = useWorkOrders('DONE,PAID,CANCELLED'); const me = useWorker(userId);
  const st = me.data?.stats;
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(o) => o.id} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListHeaderComponent={
          <Card style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Txt v="heading">Reyting</Txt>{me.data?.profile ? <Stars value={me.data.profile.ratingAvg} size={18} /> : null}</View>
            <Gap h={10} />
            <View style={{ flexDirection: 'row', gap: 8 }}><Kpi label="Jami ish" value={String(st?.total ?? 0)} /><Kpi label="Muvaffaqiyatli" value={String(st?.done ?? 0)} tone="success" /><Kpi label="Kechikkan" value={String(st?.late ?? 0)} tone="warning" /><Kpi label="Bekor" value={String(st?.cancelled ?? 0)} tone="danger" /></View>
          </Card>
        }
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Tarix bo'sh" />}
        renderItem={({ item: o, index }) => <Card style={{ marginBottom: 8 }}><Row icon="hammer" iconTone={o.status === 'CANCELLED' ? 'danger' : 'success'} title={o.title} subtitle={`${o.project?.name ?? ''} · ${new Date(o.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`} right={<Txt v="bodyStrong" color={o.status === 'PAID' ? 'success' : 'primary'}>{fmtSum(o.price)}</Txt>} onPress={() => router.push(`/work-order/${o.id}`)} last /></Card>} />
    </Screen>
  );
}
