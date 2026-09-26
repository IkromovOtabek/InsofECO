import React from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Card, EmptyState, Gap, Screen, StatusChip, Txt, fmtUnit } from '@/design/primitives';
import { Avatar, Icon, Stars } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useDrivers } from '@/features/eco/api';

export default function Drivers() {
  const router = useRouter();
  const q = useDrivers();
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(d) => d.userId} contentContainerStyle={{ padding: space.pageX }} ItemSeparatorComponent={() => <Gap h={space.md} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Haydovchilar yo'q" hint="Xodimlar bo'limida haydovchini tasdiqlang" icon="car" />}
        renderItem={({ item: d }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={d.fullName ?? undefined} disabled={!d.currentShipment} onPress={() => d.currentShipment && router.push(`/shipment/${d.currentShipment.id}`)}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Avatar name={d.fullName} size={size.avatar} tone="info" />
                <View style={{ flex: 1 }}>
                  <Txt v="titleSm">{d.fullName}</Txt>
                  <Txt v="caption">{d.vehicle ? `${d.vehicle.brand ?? ''} · ${d.vehicle.plateNumber} · ${d.vehicle.capacityTons ? fmtUnit(d.vehicle.capacityTons, 't') : '—'}` : 'Transport biriktirilmagan'}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs }}>
                    {d.rating ? <Stars value={d.rating} /> : null}
                    <Txt v="caption">{fmtUnit(d.deliveredCount, 'ta yetkazish')}</Txt>
                  </View>
                </View>
                {d.currentShipment ? <StatusChip status={d.currentShipment.status} /> : <Badge label="Bo'sh" tone="success" />}
              </View>
              {d.currentShipment ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm }}>
                  <Icon name="package" tone="muted" />
                  <Txt v="caption" style={{ flex: 1 }} numberOfLines={1}>№{d.currentShipment.number} {d.currentShipment.cargo} → {d.currentShipment.project.name}</Txt>
                </View>
              ) : null}
            </Card>
          </Pressable>
        )} />
    </Screen>
  );
}
