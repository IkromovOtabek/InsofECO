import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Gap, Screen, StatusChip, Txt } from '@/design/primitives';
import { Icon, ProgressBar, Row, Section, daysLeft } from '@/design/ui';
import { useDrivers, useShipments, useVehicles } from '@/features/eco/api';

export default function Transport() {
  const router = useRouter();
  const v = useVehicles(); const d = useDrivers(); const sh = useShipments('NEW,ACCEPTED,LOADING,EN_ROUTE,DELIVERED');
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={v.isFetching} onRefresh={() => { void v.refetch(); void sh.refetch(); }} />}>
        <Txt v="heading" style={{ marginBottom: 8 }}>Transportlar</Txt>
        {(v.data ?? []).map((x) => {
          const drv = (d.data ?? []).find((y) => y.userId === x.driverUserId); const svc = daysLeft(x.nextServiceAt);
          return (
            <Card key={x.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View><Txt v="heading">{x.brand ?? x.type} · {x.plateNumber}</Txt><Txt v="caption" color="secondary">{x.capacityTons ? `${x.capacityTons} t` : `${x.capacityM3} m³`} · {x.odometerKm ? `${x.odometerKm.toLocaleString('ru-RU')} km` : ''}{drv ? ` · ${drv.fullName}` : ' · haydovchisiz'}</Txt></View>
                <Icon name="bus" size={26} />
              </View>
              <Gap h={10} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="speedometer-outline" size={14} /><Txt v="caption" color="secondary">Yoqilg'i {x.fuelPercent ?? '—'}%</Txt></View>
              <Gap h={4} /><ProgressBar value={x.fuelPercent ?? 0} tone={(x.fuelPercent ?? 0) < 25 ? 'danger' : 'info'} height={6} />
              <Txt v="caption" color={svc !== null && svc < 7 ? 'danger' : 'secondary'} style={{ marginTop: 8 }}>🔧 Texnik ko'rik: {x.nextServiceAt ? new Date(x.nextServiceAt).toLocaleDateString('ru-RU') : '—'}{svc !== null ? ` (${svc} kun)` : ''}</Txt>
            </Card>
          );
        })}
        <Section title="Yetkazib berish (faol)">
          {(sh.data ?? []).length === 0 ? <Txt color="secondary" style={{ padding: 12 }}>Faol yuklar yo'q</Txt> : null}
          {(sh.data ?? []).map((s, i, arr) => <Row key={s.id} icon="cube-outline" iconTone="info" title={`№${s.number} ${s.cargo}`} subtitle={`${s.warehouse.name} → ${s.project.name}${s.driver ? ` · ${s.driver.fullName}` : ''}`} right={<StatusChip status={s.status} />} onPress={() => router.push(`/shipment/${s.id}`)} last={i === arr.length - 1} />)}
        </Section>
        <Gap h={30} />
      </ScrollView>
    </Screen>
  );
}
