import React, { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, KpiGrid, ListGroup, Reveal, SkeletonList } from '@/design/blocks';
import { EmptyState, ListItem, Screen, fmtDateFull, fmtM3, fmtUnit, statusLabel, statusTone } from '@/design/primitives';
import { daysLeft } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useDrivers, useShipments, useVehicles } from '@/features/eco/api';

type SegKey = 'vehicles' | 'shipments';

/** Transport: KPI (mashina, faol yuk, kam yoqilg'i, ko'rik yaqin) → Mashinalar / Yetkazishlar chiplari → ListGroup. */
export default function Transport() {
  const router = useRouter();
  const { c } = useTheme();
  const v = useVehicles(); const d = useDrivers(); const sh = useShipments('NEW,ACCEPTED,LOADING,EN_ROUTE,DELIVERED');
  const [seg, setSeg] = useState<SegKey>('vehicles');
  const vehicles = v.data ?? [];
  const shipments = sh.data ?? [];
  const lowFuel = vehicles.filter((x) => x.fuelPercent != null && x.fuelPercent < 25).length;
  const svcSoon = vehicles.filter((x) => { const s = daysLeft(x.nextServiceAt); return s !== null && s < 7; }).length;
  const cur = seg === 'vehicles' ? v : sh;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={v.isRefetching || sh.isRefetching} onRefresh={() => { void v.refetch(); void sh.refetch(); }} tintColor={c.textMuted} />}
      >
        {v.data ? (
          <KpiGrid items={[
            { label: 'Mashinalar', value: vehicles.length, icon: 'bus', module: 'logistics', onPress: () => setSeg('vehicles') },
            { label: 'Faol yuklar', value: shipments.length, icon: 'package', module: 'logistics', onPress: () => setSeg('shipments') },
            { label: "Kam yoqilg'i", value: lowFuel, icon: 'gauge', tone: lowFuel ? 'danger' : undefined },
            { label: "Ko'rik yaqin", value: svcSoon, icon: 'wrench', tone: svcSoon ? 'warning' : undefined },
          ]} />
        ) : null}
        <ChipGroup<SegKey>
          items={[{ key: 'vehicles', label: 'Mashinalar', count: vehicles.length || undefined }, { key: 'shipments', label: 'Yetkazishlar', count: shipments.length || undefined }]}
          value={seg} onChange={setSeg}
        />
        {cur.isLoading ? <SkeletonList rows={4} />
          : cur.isError && !cur.data ? <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void cur.refetch()} />
          : seg === 'vehicles' ? (
            vehicles.length === 0 ? <EmptyState icon="bus" title="Hozircha transport yo'q" hint="Qo'shilgan mashinalar shu yerda ko'rinadi" /> : (
              <Reveal key="v" gap={space.sm}>
                <ListGroup>
                  {vehicles.map((x) => {
                    const drv = (d.data ?? []).find((y) => y.userId === x.driverUserId);
                    const svc = daysLeft(x.nextServiceAt);
                    const soon = svc !== null && svc < 7;
                    const fuel = x.fuelPercent;
                    const line1 = `${x.capacityTons ? fmtUnit(x.capacityTons, 't') : fmtM3(x.capacityM3 ?? 0)}${x.odometerKm ? ` · ${fmtUnit(x.odometerKm, 'km')}` : ''} · ${drv?.fullName ?? 'haydovchisiz'}`;
                    const line2 = `Texnik ko'rik: ${x.nextServiceAt ? fmtDateFull(x.nextServiceAt) : '—'}${svc !== null ? ` (${svc} kun)` : ''}`;
                    return (
                      <ListItem
                        key={x.id} icon="bus" module="logistics" tone={soon ? 'warning' : undefined} chevron={false}
                        title={`${x.brand ?? x.type} · ${x.plateNumber}`}
                        subtitle={`${line1}\n${line2}`}
                        value={fuel != null ? `${fuel}% yoqilg'i` : undefined}
                        badge={soon ? { text: "Ko'rik", tone: 'warning' } : fuel != null && fuel < 25 ? { text: "Kam yoqilg'i", tone: 'danger' } : undefined}
                      />
                    );
                  })}
                </ListGroup>
              </Reveal>
            )
          ) : (
            shipments.length === 0 ? <EmptyState icon="package" title="Faol yuklar yo'q" hint="Material so'rovi tasdiqlanganda yuk shu yerda paydo bo'ladi" /> : (
              <Reveal key="s" gap={space.sm}>
                <ListGroup>
                  {shipments.map((s) => (
                    <ListItem
                      key={s.id} icon="package" module="logistics"
                      title={`№${s.number} ${s.cargo}`}
                      subtitle={`${s.warehouse.name} → ${s.project.name}${s.driver ? `\n${s.driver.fullName ?? s.driver.phone}` : '\nHaydovchi biriktirilmagan'}`}
                      badge={{ text: statusLabel(s.status), tone: statusTone(s.status) }}
                      onPress={() => router.push(`/shipment/${s.id}`)}
                    />
                  ))}
                </ListGroup>
              </Reveal>
            )
          )}
      </ScrollView>
    </Screen>
  );
}
