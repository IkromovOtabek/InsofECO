import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Gap, IconTile, ListItem, Panel, ProgressBar, Screen, StatusChip, Txt, fmtDateFull, fmtM3, fmtUnit } from '@/design/primitives';
import { Icon, daysLeft } from '@/design/ui';
import { space } from '@/design/tokens';
import { useDrivers, useShipments, useVehicles } from '@/features/eco/api';

export default function Transport() {
  const router = useRouter();
  const v = useVehicles(); const d = useDrivers(); const sh = useShipments('NEW,ACCEPTED,LOADING,EN_ROUTE,DELIVERED');
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }} refreshControl={<RefreshControl refreshing={v.isFetching} onRefresh={() => { void v.refetch(); void sh.refetch(); }} />}>
        <Txt v="titleSm" style={{ marginBottom: space.sm }}>Transportlar</Txt>
        {(v.data ?? []).length === 0 && !v.isLoading ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Hozircha transport yo&apos;q</Txt> : null}
        {(v.data ?? []).map((x) => {
          const drv = (d.data ?? []).find((y) => y.userId === x.driverUserId); const svc = daysLeft(x.nextServiceAt);
          const soon = svc !== null && svc < 7;
          return (
            <Card key={x.id} style={{ marginBottom: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <IconTile icon="bus" module="logistics" />
                <View style={{ flex: 1 }}>
                  <Txt v="titleSm">{x.brand ?? x.type} · {x.plateNumber}</Txt>
                  <Txt v="caption">{x.capacityTons ? fmtUnit(x.capacityTons, 't') : fmtM3(x.capacityM3 ?? 0)}{x.odometerKm ? ` · ${fmtUnit(x.odometerKm, 'km')}` : ''}{drv ? ` · ${drv.fullName}` : ' · haydovchisiz'}</Txt>
                </View>
              </View>
              <Gap h={space.md} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Icon name="gauge" tone="muted" />
                <Txt v="caption">Yoqilg&apos;i {x.fuelPercent ?? '—'}%</Txt>
              </View>
              <Gap h={space.xs} />
              <ProgressBar value={x.fuelPercent ?? 0} tone={(x.fuelPercent ?? 0) < 25 ? 'danger' : 'info'} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
                <Icon name="wrench" tone={soon ? 'danger' : 'muted'} />
                <Txt v="caption" color={soon ? 'danger' : 'muted'}>Texnik ko&apos;rik: {x.nextServiceAt ? fmtDateFull(x.nextServiceAt) : '—'}{svc !== null ? ` (${svc} kun)` : ''}</Txt>
              </View>
            </Card>
          );
        })}
        <Panel title="Yetkazib berish (faol)">
          {(sh.data ?? []).length === 0 ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Faol yuklar yo&apos;q</Txt> : null}
          {(sh.data ?? []).map((s, i, arr) => <ListItem key={s.id} icon="package" module="logistics" title={`№${s.number} ${s.cargo}`} subtitle={`${s.warehouse.name} → ${s.project.name}${s.driver ? ` · ${s.driver.fullName}` : ''}`} right={<StatusChip status={s.status} />} onPress={() => router.push(`/shipment/${s.id}`)} last={i === arr.length - 1} />)}
        </Panel>
        <Gap h={space.xxxl} />
      </ScrollView>
    </Screen>
  );
}
