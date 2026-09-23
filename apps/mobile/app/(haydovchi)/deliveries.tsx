import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, Gap, Screen, StatusChip, Txt, fmtSum } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useShipments } from '@/features/eco/api';

const SEG = [{ key: 'NEW,ACCEPTED,LOADING,EN_ROUTE,DELIVERED', label: 'Joriy' }, { key: 'CONFIRMED,CANCELLED', label: 'Tarix' }] as const;

/** Yuklar: ikkita bo'lim (Joriy / Tarix), katta kartalar. */
export default function Deliveries() {
  const router = useRouter();
  const { c } = useTheme();
  const [seg, setSeg] = useState<(typeof SEG)[number]['key']>(SEG[0].key);
  const q = useShipments(seg);
  return (
    <Screen padded={false}>
      <View style={{ flexDirection: 'row', margin: 16, marginBottom: 4, backgroundColor: c.bgSurfaceMuted, borderRadius: 14, padding: 4 }}>
        {SEG.map((s) => <Pressable key={s.key} onPress={() => setSeg(s.key)} style={{ flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center', backgroundColor: seg === s.key ? c.bgSurface : 'transparent' }}><Txt style={{ fontSize: 17, fontWeight: '700', color: seg === s.key ? c.textPrimary : c.textSecondary }}>{s.label}</Txt></Pressable>)}
      </View>
      <FlatList data={q.data ?? []} keyExtractor={(s) => s.id} contentContainerStyle={{ padding: 16 }} ItemSeparatorComponent={() => <Gap h={12} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Yuklar yo'q" />}
        renderItem={({ item: s }) => (
          <Pressable onPress={() => router.push(`/shipment/${s.id}`)}>
            <Card style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Txt v="caption" color="secondary" style={{ fontWeight: '700' }}>№{s.number}</Txt><StatusChip status={s.status} /></View>
              <Txt style={{ fontSize: 21, fontWeight: '800', color: c.textPrimary, marginTop: 4 }}>{s.cargo}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}><Icon name="arrow-forward" size={16} /><Txt style={{ fontSize: 17, color: c.textSecondary, marginLeft: 6 }} numberOfLines={1}>{s.project.name}</Txt></View>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}><Txt style={{ fontSize: 17, fontWeight: '700', color: c.brandPrimary }}>{fmtSum(s.driverFee)}</Txt>{s.distanceKm ? <Txt style={{ fontSize: 17, color: c.textSecondary }}>{s.distanceKm} km</Txt> : null}</View>
            </Card>
          </Pressable>
        )} />
    </Screen>
  );
}
