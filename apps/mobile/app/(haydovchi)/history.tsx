import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, ListItem, Screen, StatusChip, fmtDate } from '@/design/primitives';
import { space } from '@/design/tokens';
import { useShipmentHistory } from '@/features/eco/api';

export default function History() {
  const router = useRouter();
  const q = useShipmentHistory();
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(s) => s.id} contentContainerStyle={{ padding: space.pageX }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Tarix bo'sh" hint="Yetkazilgan yuklar shu yerda ko'rinadi" icon="history" />}
        renderItem={({ item: s }) => (
          <Card style={{ marginBottom: space.sm, paddingVertical: space.xs }}>
            <ListItem icon="package-check" tone="success" title={`№${s.number} ${s.cargo}`} subtitle={`${s.project.name}${s.deliveredAt ? ` · ${fmtDate(s.deliveredAt)}` : ''}`} right={<StatusChip status={s.status} />} onPress={() => router.push(`/shipment/${s.id}`)} last />
          </Card>
        )} />
    </Screen>
  );
}
