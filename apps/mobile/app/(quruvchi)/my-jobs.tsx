import React, { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, KpiGrid, ListGroup, Reveal, SectionHead, SkeletonList } from '@/design/blocks';
import { EmptyState, ListItem, Screen, fmtDateFull, statusLabel, statusTone } from '@/design/primitives';
import { Stars, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { WorkOrder, useWorkOrders, useWorker } from '@/features/eco/api';

type Seg = 'all' | 'done' | 'cancelled';
const FILTER: Record<Seg, (o: WorkOrder) => boolean> = { all: () => true, done: (o) => o.status !== 'CANCELLED', cancelled: (o) => o.status === 'CANCELLED' };

/** Ishlarim: reyting va statistika → filtrlangan tarix (to'lov va holat o'ngda). */
export default function MyJobs() {
  const router = useRouter();
  const { c } = useTheme();
  const userId = useSession((s) => s.user?.id ?? '');
  const q = useWorkOrders('DONE,PAID,CANCELLED'); const me = useWorker(userId);
  const [seg, setSeg] = useState<Seg>('all');
  const st = me.data?.stats;
  const all = q.data ?? [];
  const list = all.filter(FILTER[seg]);
  const refresh = () => { void q.refetch(); void me.refetch(); };
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={(q.isFetching && !q.isLoading) || (me.isFetching && !me.isLoading)} onRefresh={refresh} tintColor={c.textMuted} />}>
        <Reveal loading={q.isLoading && me.isLoading} skeleton={<SkeletonList rows={5} />}>
          <ListGroup>
            <ListItem
              icon="star" module="brand" title="Reyting"
              subtitle={me.data?.profile ? `${me.data.profile.ratingCount} baho · ${me.data.profile.completedJobs} ish` : "Hali baho yo'q"}
              right={me.data?.profile ? <Stars value={me.data.profile.ratingAvg} /> : undefined}
            />
          </ListGroup>
          {st ? (
            <KpiGrid items={[
              { label: 'Jami ish', value: st.total, icon: 'briefcase', module: 'production' },
              { label: 'Muvaffaqiyatli', value: st.done, icon: 'circle-check', tone: 'success' },
              { label: 'Kechikkan', value: st.late, icon: 'clock', tone: st.late ? 'warning' : undefined },
              { label: 'Bekor', value: st.cancelled, icon: 'circle-x', tone: st.cancelled ? 'danger' : undefined },
            ]} />
          ) : null}
          <SectionHead title="Tarix" count={q.data ? all.length : undefined} />
          <ChipGroup
            items={[{ key: 'all', label: 'Barchasi', count: q.data ? all.length || undefined : undefined }, { key: 'done', label: 'Bajarilgan', count: q.data ? all.filter(FILTER.done).length : undefined }, { key: 'cancelled', label: 'Bekor', count: q.data ? all.filter(FILTER.cancelled).length : undefined }]}
            value={seg} onChange={setSeg}
          />
          {q.isLoading ? <SkeletonList rows={4} /> : q.isError && !q.data ? (
            <EmptyState icon="cloud-off" title="Tarix yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState icon="briefcase" title={seg === 'cancelled' ? "Bekor qilingan ish yo'q" : "Tarix bo'sh"} hint="Tugallangan ishlar shu yerda ko'rinadi" />
          ) : (
            <ListGroup>
              {list.map((o) => (
                <ListItem
                  key={o.id} icon="hammer" module="production" tone={o.status === 'CANCELLED' ? 'danger' : undefined}
                  title={o.title} subtitle={`${o.project?.name ?? 'Loyihasiz'} · ${fmtDateFull(o.createdAt)}`} subtitleLines={1}
                  onPress={() => router.push(`/work-order/${o.id}`)}
                  value={`${fmtShort(o.price)} so'm`}
                  badge={{ text: statusLabel(o.status), tone: statusTone(o.status) }}
                />
              ))}
            </ListGroup>
          )}
        </Reveal>
      </ScrollView>
    </Screen>
  );
}
