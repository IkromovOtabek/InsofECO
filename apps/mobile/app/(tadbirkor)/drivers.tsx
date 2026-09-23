import React from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, Gap, Screen, StatusChip, Txt } from '@/design/primitives';
import { Avatar, Pill, Stars } from '@/design/ui';
import { useDrivers } from '@/features/eco/api';

export default function Drivers() {
  const router = useRouter();
  const q = useDrivers();
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(d) => d.userId} contentContainerStyle={{ padding: 16 }} ItemSeparatorComponent={() => <Gap h={10} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Haydovchilar yo'q" />}
        renderItem={({ item: d }) => (
          <Pressable onPress={() => d.currentShipment && router.push(`/shipment/${d.currentShipment.id}`)}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar name={d.fullName} size={48} tone="info" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Txt v="heading">{d.fullName}</Txt>
                  <Txt v="caption" color="secondary">{d.vehicle ? `${d.vehicle.brand ?? ''} · ${d.vehicle.plateNumber} · ${d.vehicle.capacityTons ?? '—'} t` : 'Transport biriktirilmagan'}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>{d.rating ? <Stars value={d.rating} /> : null}<Txt v="caption" color="secondary">{d.deliveredCount} ta yetkazish</Txt></View>
                </View>
                {d.currentShipment ? <StatusChip status={d.currentShipment.status} /> : <Pill label="Bo'sh" tone="success" />}
              </View>
              {d.currentShipment ? <Txt v="caption" color="secondary" style={{ marginTop: 8 }}>📦 №{d.currentShipment.number} {d.currentShipment.cargo} → {d.currentShipment.project.name}</Txt> : null}
            </Card>
          </Pressable>
        )} />
    </Screen>
  );
}
