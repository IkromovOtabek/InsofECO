import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, ListGroup, StickyActionBar } from '@/design/blocks';
import { EmptyState, IconButton, Input, ListItem, Screen, StatusChip, Txt, fmtDate, fmtM3 } from '@/design/primitives';
import { Appear } from '@/design/motion';
import { Avatar, daysLeft, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { ListSkeleton } from '@/features/erp/ui';
import { useWorkOrders } from '@/features/eco/api';
import { useOrders } from '@/features/orders/api';

const SEG = [{ key: 'NEW', label: 'Yangi' }, { key: 'ACCEPTED,WORKER_ASSIGNED,IN_PROGRESS', label: 'Jarayonda' }, { key: 'REVIEW', label: 'Tekshiruv' }, { key: 'DONE', label: 'Tugallandi' }, { key: 'PAID', label: "To'langan" }, { key: 'all', label: 'Barchasi' }, { key: 'beton', label: 'Beton' }] as const;
type SegKey = (typeof SEG)[number]['key'];

/** Buyurtmalar: ish buyurtmalari (asosiy) + beton buyurtmalari (chip). Qidiruv → chiplar → ListGroup; "Yangi buyurtma" pastki panelda. */
export default function Orders() {
  const router = useRouter();
  const { c } = useTheme();
  const [seg, setSeg] = useState<SegKey>('NEW');
  const [search, setSearch] = useState('');
  const isBeton = seg === 'beton';
  const wo = useWorkOrders(seg === 'all' || seg === 'beton' ? undefined : seg);
  const beton = useOrders();
  const cur = isBeton ? beton : wo;
  const needle = search.trim().toLowerCase();
  const match = (s: string) => !needle || s.toLowerCase().includes(needle);
  const woList = (wo.data ?? []).filter((o) => match(`${o.number} ${o.title} ${o.project?.name ?? ''} ${o.worker?.fullName ?? ''} ${o.address}`));
  const betonList = (beton.data?.items ?? []).filter((o) => match(`${o.number} ${o.client.name} ${o.address}`));
  const count = isBeton ? betonList.length : woList.length;
  const label = SEG.find((s) => s.key === seg)?.label ?? '';

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={cur.isRefetching} onRefresh={() => void cur.refetch()} tintColor={c.textMuted} />}
      >
        <Input
          value={search} onChangeText={setSearch} placeholder={isBeton ? 'Raqam, mijoz yoki manzil…' : 'Raqam, ish, loyiha yoki quruvchi…'} left="search" autoCorrect={false} returnKeyType="search"
          right={search ? <IconButton icon="x" label="Tozalash" tone="muted" size={size.touch - space.sm} onPress={() => setSearch('')} /> : null}
          containerStyle={{ marginBottom: 0 }}
        />
        <ChipGroup items={SEG.map((s) => ({ key: s.key, label: s.label }))} value={seg} onChange={setSeg} />
        {cur.isLoading ? <ListSkeleton rows={5} />
          : cur.isError && !cur.data ? <EmptyState icon="cloud-off" title="Buyurtmalar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void cur.refetch()} />
          : count === 0 ? (
            needle ? <EmptyState icon="search" title="Hech narsa topilmadi" hint="Boshqa so'z bilan qidiring" />
              : isBeton ? <EmptyState icon="package" title="Beton buyurtmalari yo'q" hint="Zavodga berilgan buyurtmalar shu yerda ko'rinadi" />
              : <EmptyState icon="clipboard-list" title={seg === 'all' ? "Buyurtmalar yo'q" : `"${label}" buyurtmalar yo'q`} hint="Pastdagi Yangi buyurtma tugmasi bilan yarating" />
          ) : (
            <Appear key={seg}>
              <Txt v="caption" color="muted" style={{ marginBottom: space.sm }}>{`${count} ta buyurtma`}</Txt>
              <ListGroup>
                {isBeton
                  ? betonList.map((o) => (
                    <ListItem
                      key={o.id} icon="truck" module="logistics"
                      title={`№${o.number} · ${o.client.name}`}
                      subtitle={`${o.items.map((i) => `${i.gradeSnapshot} ${fmtM3(i.volumeM3)}`).join(' · ')}\n${o.address}`}
                      onPress={() => router.push(`/order/${o.id}`)}
                      right={<RightCol value={`${fmtShort(o.totalAmount)} so'm`} status={o.status} />}
                    />
                  ))
                  : woList.map((o) => {
                    const dl = daysLeft(o.deadline);
                    const late = dl !== null && dl < 0 && !['DONE', 'PAID', 'CANCELLED'].includes(o.status);
                    const due = `${fmtDate(o.deadline)}${dl === null ? '' : dl < 0 ? ` · ${-dl} kun kechikdi` : ` · ${dl} kun`}`;
                    return (
                      <ListItem
                        key={o.id}
                        leading={o.worker ? <Avatar name={o.worker.fullName} size={size.iconTile} /> : undefined}
                        icon="hammer" module="production" tone={late ? 'danger' : undefined}
                        title={o.title}
                        subtitle={`№${o.number} · ${o.project?.name ?? 'Loyihasiz'}\n${o.worker?.fullName ?? 'Quruvchi biriktirilmagan'} · ${due}`}
                        onPress={() => router.push(`/work-order/${o.id}`)}
                        right={<RightCol value={`${fmtShort(o.price)} so'm`} status={o.status} danger={late} />}
                      />
                    );
                  })}
              </ListGroup>
            </Appear>
          )}
      </ScrollView>
      {isBeton ? null : <StickyActionBar primary={{ title: 'Yangi buyurtma', icon: 'plus', onPress: () => router.push('/(tadbirkor)/new-order') }} style={{ paddingBottom: space.md }} />}
    </Screen>
  );
}

function RightCol({ value, status, danger }: { value: string; status: string; danger?: boolean }) {
  return (
    <View style={{ alignItems: 'flex-end', gap: space.xs, flexShrink: 0 }}>
      <Txt v="bodyStrong" color={danger ? 'danger' : 'strong'}>{value}</Txt>
      <StatusChip status={status} />
    </View>
  );
}
