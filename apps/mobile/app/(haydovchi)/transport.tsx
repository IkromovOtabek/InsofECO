import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Card, EmptyState, Gap, Screen, Txt } from '@/design/primitives';
import { Icon, Kpi, ProgressBar, Row, Section, daysLeft } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useMyVehicle } from '@/features/eco/api';

export default function MyTransport() {
  const { c } = useTheme();
  const q = useMyVehicle(); const v = q.data; const svc = daysLeft(v?.nextServiceAt);
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}>
        {!v ? (q.isLoading ? null : <EmptyState title="Transport biriktirilmagan" hint="Tadbirkor mashina biriktiradi" />) : (
          <>
            <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
              <Icon name="bus" size={56} color={c.brandPrimary} />
              <Gap h={10} />
              <Txt v="title">{v.brand ?? v.type}</Txt>
              <Txt v="subtitle" color="secondary" style={{ letterSpacing: 2 }}>{v.plateNumber}</Txt>
            </Card>
            <Gap h={10} />
            <View style={{ flexDirection: 'row', gap: 10 }}><Kpi label="Yuk sig'imi" value={v.capacityTons ? `${v.capacityTons} t` : `${v.capacityM3} m³`} icon="scale" /><Kpi label="Probeg" value={v.odometerKm ? `${Math.round(v.odometerKm / 1000)}k km` : '—'} icon="speedometer" /></View>
            <Section title="Yoqilg'i">
              <View style={{ paddingVertical: 8 }}><Txt v="display" color={(v.fuelPercent ?? 0) < 25 ? 'danger' : 'brand'}>{v.fuelPercent ?? '—'}%</Txt><Gap h={8} /><ProgressBar value={v.fuelPercent ?? 0} tone={(v.fuelPercent ?? 0) < 25 ? 'danger' : 'info'} height={10} /></View>
            </Section>
            <Section title="Texnik xizmat">
              <Row icon="construct" iconTone={svc !== null && svc < 7 ? 'danger' : 'brand'} title="Texnik ko'rik" subtitle={v.nextServiceAt ? `${new Date(v.nextServiceAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}${svc !== null ? ` · ${svc} kun qoldi` : ''}` : 'Belgilanmagan'} />
              <Row icon="water" title="Moy almashtirish" subtitle="Har 10 000 km" last />
            </Section>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
