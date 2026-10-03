import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, ListGroup } from '@/design/blocks';
import { Button, EmptyState, ListItem, Screen, StatusChip, Txt, fmtDate } from '@/design/primitives';
import { daysLeft, fmtShort, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { ListSkeleton } from '@/features/erp/ui';
import { useAction, useWorkOrders } from '@/features/eco/api';

const SEG = [{ key: 'ACCEPTED', label: 'Ochiq' }, { key: 'WORKER_ASSIGNED,IN_PROGRESS,REVIEW', label: 'Mening' }, { key: 'DONE,PAID', label: 'Tugallangan' }] as const;
type SegKey = (typeof SEG)[number]['key'];
const EMPTY: Record<SegKey, { title: string; hint: string }> = {
  ACCEPTED: { title: "Ochiq buyurtma yo'q", hint: 'Yangi buyurtma kelganda xabar keladi' },
  'WORKER_ASSIGNED,IN_PROGRESS,REVIEW': { title: "Faol ishingiz yo'q", hint: "\"Ochiq\" bo'limidan ish oling" },
  'DONE,PAID': { title: "Tugallangan ish yo'q", hint: "Topshirilgan ishlar shu yerda ko'rinadi" },
};
const FINISHED = ['DONE', 'PAID', 'CANCELLED'];

/** Quruvchi: ish buyurtmalari — chip filtr, qatorda to'lov va holat; ochiq ishni shu yerdan oladi. */
export default function QuruvchiOrders() {
  const router = useRouter();
  const { c } = useTheme();
  const [seg, setSeg] = useState<SegKey>('WORKER_ASSIGNED,IN_PROGRESS,REVIEW');
  const q = useWorkOrders(seg);
  const start = useAction<string>((id) => ({ path: `/work-orders/${id}/start` }), ['work-orders', 'dash']);
  const list = q.data ?? [];
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.md }}>
        <ChipGroup items={[...SEG]} value={seg} onChange={setSeg} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        {q.isLoading ? <ListSkeleton rows={5} /> : q.isError && !q.data ? (
          <EmptyState icon="cloud-off" title="Ro'yxat yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState icon="clipboard-list" title={EMPTY[seg].title} hint={EMPTY[seg].hint} />
        ) : (
          <ListGroup>
            {list.map((o) => {
              const dl = FINISHED.includes(o.status) ? null : daysLeft(o.deadline);
              const open = o.status === 'ACCEPTED' && !o.workerUserId;
              return (
                <ListItem
                  key={o.id} icon="hammer" module="production" tone={dl !== null && dl < 0 ? 'danger' : undefined}
                  title={o.title}
                  subtitle={`${o.project?.name ?? 'Loyihasiz'} · muddat ${fmtDate(o.deadline)}${dl === null ? '' : dl < 0 ? ` · ${-dl} kun kechikdi` : ` · ${dl} kun`}`}
                  subtitleLines={1}
                  onPress={() => router.push(`/work-order/${o.id}`)}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: space.xs, maxWidth: '45%' }}>
                      <Txt v="bodyStrong" numberOfLines={1}>{`${fmtShort(o.price)} so'm`}</Txt>
                      {open
                        ? <Button title="Olish" icon="check" full={false} loading={start.isPending && start.variables === o.id} onPress={() => start.mutate(o.id, { onError: (e) => toast.error(e.message, 'Xato') })} />
                        : <StatusChip status={o.status} />}
                    </View>
                  }
                />
              );
            })}
          </ListGroup>
        )}
      </ScrollView>
    </Screen>
  );
}
