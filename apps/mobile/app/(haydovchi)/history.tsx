import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, Screen, StatusChip, Txt } from '@/design/primitives';
import { Row } from '@/design/ui';
import { useShipmentHistory } from '@/features/eco/api';

export default function History() {
  const router = useRouter();
  const q = useShipmentHistory();
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(s) => s.id} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Tarix bo'sh" />}
        renderItem={({ item: s }) => <Card style={{ marginBottom: 8, paddingVertical: 4 }}><Row icon="cube" iconTone="success" title={`#${s.number} ${s.cargo}`} subtitle={`${s.project.name} · ${s.deliveredAt ? new Date(s.deliveredAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}`} right={<StatusChip status={s.status} />} onPress={() => router.push(`/shipment/${s.id}`)} last /></Card>} />
      <Txt style={{ display: 'none' }} />
    </Screen>
  );
}
