import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, Gap, KPICard, ListItem, Screen, Txt, fmtDateFull, fmtSum } from '@/design/primitives';
import { Stars } from '@/design/ui';
import { space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { useWorkOrders, useWorker } from '@/features/eco/api';

/** Ishlarim: tarix + reyting statistikasi. */
export default function MyJobs() {
  const router = useRouter();
  const userId = useSession((s) => s.user?.id ?? '');
  const q = useWorkOrders('DONE,PAID,CANCELLED'); const me = useWorker(userId);
  const st = me.data?.stats;
  const grid = { flexBasis: '48%' as const, flexGrow: 1 };
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(o) => o.id} contentContainerStyle={{ padding: space.pageX }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListHeaderComponent={
          <View style={{ marginBottom: space.md }}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Txt v="titleSm">Reyting</Txt>
              {me.data?.profile ? <Stars value={me.data.profile.ratingAvg} /> : <Txt v="caption">Hali baho yo&apos;q</Txt>}
            </Card>
            <Gap h={space.grid} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.grid }}>
              <KPICard label="Jami ish" value={String(st?.total ?? 0)} icon="briefcase" style={grid} />
              <KPICard label="Muvaffaqiyatli" value={String(st?.done ?? 0)} icon="circle-check" tone="success" style={grid} />
              <KPICard label="Kechikkan" value={String(st?.late ?? 0)} icon="clock" tone="warning" style={grid} />
              <KPICard label="Bekor" value={String(st?.cancelled ?? 0)} icon="circle-x" tone="danger" style={grid} />
            </View>
          </View>
        }
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Tarix bo'sh" hint="Tugallangan ishlar shu yerda ko'rinadi" icon="briefcase" />}
        renderItem={({ item: o }) => (
          <Card style={{ marginBottom: space.sm, paddingVertical: space.xs }}>
            <ListItem icon="hammer" tone={o.status === 'CANCELLED' ? 'danger' : 'success'} title={o.title} subtitle={`${o.project?.name ?? ''} · ${fmtDateFull(o.createdAt)}`} right={<Txt v="bodyStrong" color={o.status === 'PAID' ? 'success' : 'strong'}>{fmtSum(o.price)}</Txt>} onPress={() => router.push(`/work-order/${o.id}`)} last />
          </Card>
        )} />
    </Screen>
  );
}
