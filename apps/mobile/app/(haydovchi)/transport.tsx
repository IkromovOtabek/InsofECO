import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { ListGroup, SectionHead } from '@/design/blocks';
import { BigStat } from '@/design/driver';
import { Card, EmptyState, Gap, IconTile, ListItem, ProgressBar, Screen, Skeleton, Txt, fmtDateFull, fmtM3, fmtUnit } from '@/design/primitives';
import { daysLeft } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useMyVehicle } from '@/features/eco/api';

/** Kabina: mening mashinam — raqam, katta yoqilg'i ko'rsatkichi, sig'im/probeg, texnik xizmat. */
export default function MyTransport() {
  const { c } = useTheme();
  const q = useMyVehicle(); const v = q.data; const svc = daysLeft(v?.nextServiceAt);
  const low = (v?.fuelPercent ?? 100) < 25;
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        {q.isLoading ? (
          <View style={{ gap: space.grid }}>
            <Skeleton height={space.x12 * 3} radius={radius.card} />
            <Skeleton height={space.x12 * 2} radius={radius.card} />
          </View>
        ) : q.isError && !v ? (
          <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} />
        ) : !v ? (
          <EmptyState icon="truck" title="Mashina biriktirilmagan" hint="Tadbirkor mashina biriktiradi" />
        ) : (
          <>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.panel }}>
              <IconTile icon="truck" module="logistics" size={size.driverTouch} />
              <View style={{ flex: 1 }}>
                <Txt v="overline">{v.brand ?? v.type}</Txt>
                <Txt v="titleLg" mono numberOfLines={1} adjustsFontSizeToFit>{v.plateNumber}</Txt>
              </View>
            </Card>

            <Gap h={space.grid} />
            <Card style={{ padding: space.panel }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <BigStat value={v.fuelPercent != null ? `${v.fuelPercent}%` : '—'} label="Yoqilg'i" tone={low ? 'danger' : 'primary'} />
                <BigStat value={v.capacityTons ? fmtUnit(v.capacityTons, 't') : fmtM3(v.capacityM3 ?? 0)} label="Sig'im" />
                <BigStat value={v.odometerKm ? fmtUnit(v.odometerKm, 'km') : '—'} label="Probeg" />
              </View>
              {v.fuelPercent != null ? (
                <>
                  <Gap h={space.lg} />
                  <ProgressBar value={v.fuelPercent} tone={low ? 'danger' : 'info'} height={size.progress + space.xs} />
                  {low ? <Txt v="bodyStrong" color="danger" style={{ marginTop: space.sm }}>Yoqilg&apos;i kam — quying</Txt> : null}
                </>
              ) : null}
            </Card>

            <Gap h={space.section} />
            <SectionHead title="Texnik xizmat" icon="wrench" />
            <ListGroup>
              <ListItem
                size="lg" icon="wrench" module="logistics" tone={svc !== null && svc < 7 ? 'danger' : undefined}
                title="Texnik ko'rik" subtitle={v.nextServiceAt ? fmtDateFull(v.nextServiceAt) : 'Belgilanmagan'}
                right={svc !== null ? <Txt v="titleSm" color={svc < 7 ? 'danger' : 'strong'}>{svc < 0 ? `${-svc} kun o'tdi` : `${svc} kun`}</Txt> : undefined}
              />
              <ListItem size="lg" icon="droplets" module="logistics" title="Moy almashtirish" subtitle="Har 10 000 km" />
            </ListGroup>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
