import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Card, EmptyState, Gap, IconTile, KPICard, ListItem, Panel, ProgressBar, Screen, Txt, fmtDateFull, fmtM3, fmtUnit } from '@/design/primitives';
import { daysLeft } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useMyVehicle } from '@/features/eco/api';

export default function MyTransport() {
  const q = useMyVehicle(); const v = q.data; const svc = daysLeft(v?.nextServiceAt);
  const low = (v?.fuelPercent ?? 0) < 25;
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}>
        {!v ? (q.isLoading ? null : <EmptyState title="Transport biriktirilmagan" hint="Tadbirkor mashina biriktiradi" icon="bus" />) : (
          <>
            <Card style={{ alignItems: 'center', paddingVertical: space.xxl }}>
              <IconTile icon="bus" module="logistics" size={size.avatarLg} />
              <Gap h={space.md} />
              <Txt v="titleMd">{v.brand ?? v.type}</Txt>
              <Txt v="titleSm" color="muted" mono>{v.plateNumber}</Txt>
            </Card>
            <Gap h={space.grid} />
            <View style={{ flexDirection: 'row', gap: space.grid }}>
              <KPICard label="Yuk sig'imi" value={v.capacityTons ? fmtUnit(v.capacityTons, 't') : fmtM3(v.capacityM3 ?? 0)} icon="scale" module="logistics" style={{ flex: 1 }} />
              <KPICard label="Probeg" value={v.odometerKm ? fmtUnit(v.odometerKm, 'km') : '—'} icon="gauge" module="logistics" style={{ flex: 1 }} />
            </View>
            <Panel title="Yoqilg'i">
              <View style={{ paddingVertical: space.sm }}>
                <Txt v="metricHero" color={low ? 'danger' : 'strong'}>{v.fuelPercent ?? '—'}%</Txt>
                <Gap h={space.sm} />
                <ProgressBar value={v.fuelPercent ?? 0} tone={low ? 'danger' : 'info'} height={size.progress + space.xs} />
              </View>
            </Panel>
            <Panel title="Texnik xizmat">
              <ListItem icon="wrench" tone={svc !== null && svc < 7 ? 'danger' : undefined} module="logistics" title="Texnik ko'rik" subtitle={v.nextServiceAt ? `${fmtDateFull(v.nextServiceAt)}${svc !== null ? ` · ${svc} kun qoldi` : ''}` : 'Belgilanmagan'} />
              <ListItem icon="droplets" module="logistics" title="Moy almashtirish" subtitle="Har 10 000 km" last />
            </Panel>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
