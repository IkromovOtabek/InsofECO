import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, ListGroup } from '@/design/blocks';
import { Badge, EmptyState, IconButton, Input, ListItem, Screen, StatusChip, Txt, fmtUnit } from '@/design/primitives';
import { Appear } from '@/design/motion';
import { Avatar, Stars } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { ListSkeleton } from '@/features/erp/ui';
import { useDrivers } from '@/features/eco/api';

type SegKey = 'all' | 'busy' | 'free';

/** Haydovchilar: qidiruv → Reysda/Bo'sh chiplari → ListGroup (transport, joriy yuk; o'ngda holat). Reysdagisi bosilsa — yuk sahifasi. */
export default function Drivers() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useDrivers();
  const [seg, setSeg] = useState<SegKey>('all');
  const [search, setSearch] = useState('');
  const all = q.data ?? [];
  const busyCount = all.filter((d) => d.currentShipment).length;
  const needle = search.trim().toLowerCase();
  const list = all.filter((d) => (seg === 'all' || (seg === 'busy') === !!d.currentShipment) && (!needle || `${d.fullName ?? ''} ${d.phone} ${d.vehicle?.plateNumber ?? ''}`.toLowerCase().includes(needle)));

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        <Input
          value={search} onChangeText={setSearch} placeholder="Ism, telefon yoki raqam…" left="search" autoCorrect={false} returnKeyType="search"
          right={search ? <IconButton icon="x" label="Tozalash" tone="muted" size={size.touch - space.sm} onPress={() => setSearch('')} /> : null}
          containerStyle={{ marginBottom: 0 }}
        />
        <ChipGroup<SegKey>
          items={[{ key: 'all', label: 'Barchasi', count: all.length || undefined }, { key: 'busy', label: 'Reysda', count: busyCount || undefined }, { key: 'free', label: "Bo'sh", count: all.length - busyCount || undefined }]}
          value={seg} onChange={setSeg}
        />
        {q.isLoading ? <ListSkeleton rows={5} />
          : q.isError && !q.data ? <EmptyState icon="cloud-off" title="Haydovchilar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
          : list.length === 0 ? (
            all.length === 0
              ? <EmptyState icon="car" title="Haydovchilar yo'q" hint="Xodimlar bo'limida haydovchini tasdiqlang" action="Xodimlar" onAction={() => router.push('/(tadbirkor)/members')} />
              : <EmptyState icon="search" title="Hech kim topilmadi" hint={needle ? "Boshqa so'z bilan qidiring" : seg === 'busy' ? "Hozir reysda haydovchi yo'q" : "Bo'sh haydovchi yo'q"} />
          ) : (
            <Appear key={seg}>
              <Txt v="caption" color="muted" style={{ marginBottom: space.sm }}>{`${list.length} ta haydovchi`}</Txt>
              <ListGroup>
                {list.map((d) => {
                  const veh = d.vehicle ? `${d.vehicle.brand ? `${d.vehicle.brand} · ` : ''}${d.vehicle.plateNumber}${d.vehicle.capacityTons ? ` · ${fmtUnit(d.vehicle.capacityTons, 't')}` : ''}` : 'Transport biriktirilmagan';
                  const line2 = d.currentShipment
                    ? `№${d.currentShipment.number} ${d.currentShipment.cargo} → ${d.currentShipment.project.name}`
                    : fmtUnit(d.deliveredCount, 'ta yetkazish');
                  const sh = d.currentShipment;
                  return (
                    <ListItem
                      key={d.userId}
                      leading={<Avatar name={d.fullName} size={size.iconTile} tone="info" />}
                      title={d.fullName ?? d.phone}
                      subtitle={`${veh}\n${line2}`}
                      onPress={sh ? () => router.push(`/shipment/${sh.id}`) : undefined}
                      right={(
                        <View style={{ alignItems: 'flex-end', gap: space.xs, flexShrink: 0 }}>
                          {d.rating ? <Stars value={d.rating} /> : null}
                          {sh ? <StatusChip status={sh.status} /> : <Badge label="Bo'sh" tone="success" />}
                        </View>
                      )}
                    />
                  );
                })}
              </ListGroup>
            </Appear>
          )}
      </ScrollView>
    </Screen>
  );
}
