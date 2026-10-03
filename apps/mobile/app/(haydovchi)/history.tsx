import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListGroup } from '@/design/blocks';
import { EmptyState, ListItem, Screen, StatusChip, Txt, fmtDate } from '@/design/primitives';
import { fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { ListSkeleton } from '@/features/erp/ui';
import { useShipmentHistory } from '@/features/eco/api';

/** Kabina: yetkazilgan yuklar tarixi — 64 pt qatorlar, o'ngda haq va holat. */
export default function History() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useShipmentHistory();
  const list = q.data ?? [];
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        {q.isLoading ? <ListSkeleton rows={5} /> : q.isError && !q.data ? (
          <EmptyState icon="cloud-off" title="Tarix ko'rinmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState icon="history" title="Tarix bo'sh" hint="Yetkazilgan yuklar shu yerda" />
        ) : (
          <ListGroup>
            {list.map((s) => (
              <ListItem
                key={s.id} size="lg" icon="package-check" tone={s.status === 'CANCELLED' ? 'danger' : 'success'}
                title={s.cargo} subtitle={`№${s.number} · ${s.project.name}${s.deliveredAt ? ` · ${fmtDate(s.deliveredAt)}` : ''}`} subtitleLines={1}
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
