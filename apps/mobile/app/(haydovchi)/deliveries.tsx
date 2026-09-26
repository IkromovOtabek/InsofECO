import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, Gap, Screen, StatusChip, Txt, fmtSum, fmtUnit } from '@/design/primitives';
import { Icon, Tabs } from '@/design/ui';
import { space } from '@/design/tokens';
import { useShipments } from '@/features/eco/api';

const SEG = [{ key: 'NEW,ACCEPTED,LOADING,EN_ROUTE,DELIVERED', label: 'Joriy' }, { key: 'CONFIRMED,CANCELLED', label: 'Tarix' }] as const;
type SegKey = (typeof SEG)[number]['key'];

/** Yuklar: ikkita bo'lim (Joriy / Tarix), katta kartalar. */
export default function Deliveries() {
  const router = useRouter();
  const [seg, setSeg] = useState<SegKey>(SEG[0].key);
  const q = useShipments(seg);
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>
        <Tabs value={seg} onChange={setSeg} items={[...SEG]} />
      </View>
      <FlatList data={q.data ?? []} keyExtractor={(s) => s.id} contentContainerStyle={{ padding: space.pageX }} ItemSeparatorComponent={() => <Gap h={space.md} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Bugun yuk yo'q" hint="Yangi yuk kelganda xabar keladi" icon="package" />}
        renderItem={({ item: s }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`№${s.number} ${s.cargo}`} onPress={() => router.push(`/shipment/${s.id}`)}>
            <Card style={{ padding: space.panel }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                <Txt v="overline">№{s.number}</Txt>
                <StatusChip status={s.status} />
              </View>
              <Txt v="titleMd" style={{ marginTop: space.xs }}>{s.cargo}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
                <Icon name="map-pin" tone="muted" />
                <Txt v="body" color="muted" numberOfLines={1} style={{ flex: 1 }}>{s.project.name}</Txt>
              </View>
              <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.sm }}>
                <Txt v="bodyStrong" color="brand">{fmtSum(s.driverFee)}</Txt>
                {s.distanceKm ? <Txt v="body" color="muted">{fmtUnit(s.distanceKm, 'km')}</Txt> : null}
              </View>
            </Card>
          </Pressable>
        )} />
    </Screen>
  );
}
