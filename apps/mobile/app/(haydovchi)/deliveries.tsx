import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, ListGroup, OfflineBanner } from '@/design/blocks';
import { EmptyState, ListItem, Screen, StatusChip, Txt, fmtUnit } from '@/design/primitives';
import { fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { ListSkeleton } from '@/features/erp/ui';
import { useShipments } from '@/features/eco/api';
import { outbox } from '@/core/outbox';
import { useOutboxSize } from '@/shared/hooks';

const SEG = [{ key: 'NEW,ACCEPTED,LOADING,EN_ROUTE,DELIVERED', label: 'Joriy' }, { key: 'CONFIRMED,CANCELLED', label: 'Tarix' }] as const;
type SegKey = (typeof SEG)[number]['key'];

/** Kabina: yuklar — ikki bo'lim (Joriy / Tarix), 64 pt qatorlar: yuk, obyekt, haq va holat. */
export default function Deliveries() {
  const router = useRouter();
  const { c } = useTheme();
  const [seg, setSeg] = useState<SegKey>(SEG[0].key);
  const q = useShipments(seg);
  const pending = useOutboxSize();
  const list = q.data ?? [];
  const current = seg === SEG[0].key;
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm }}>
        <OfflineBanner visible={pending > 0} pendingCount={pending} onRetry={() => void outbox.flush()} />
        <ChipGroup items={[...SEG]} value={seg} onChange={setSeg} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        {q.isLoading ? <ListSkeleton rows={4} /> : q.isError && !q.data ? (
          <EmptyState icon="cloud-off" title="Yuklar ko'rinmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState icon={current ? 'coffee' : 'history'} title={current ? "Hozir yuk yo'q" : "Tarix bo'sh"} hint={current ? 'Yangi yuk kelganda xabar keladi' : "Yakunlangan yuklar shu yerda"} />
        ) : (
          <ListGroup>
            {list.map((s) => (
              <ListItem
                key={s.id} size="lg" icon={s.status === 'EN_ROUTE' ? 'navigation' : 'package'} module="logistics"
                title={s.cargo}
                subtitle={`№${s.number} · ${s.project.name}${s.distanceKm ? ` · ${fmtUnit(s.distanceKm, 'km')}` : ''}`} subtitleLines={1}
                onPress={() => router.push(`/shipment/${s.id}`)}
                right={
                  <View style={{ alignItems: 'flex-end', gap: space.xs, maxWidth: '40%' }}>
                    <Txt v="titleSm" numberOfLines={1}>{`${fmtShort(s.driverFee)} so'm`}</Txt>
                    <StatusChip status={s.status} />
                  </View>
                }
              />
            ))}
          </ListGroup>
        )}
      </ScrollView>
    </Screen>
  );
}
