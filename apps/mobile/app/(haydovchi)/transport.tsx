import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { ProgressCard, Reveal, SkeletonList } from '@/design/blocks';
import { BigStat } from '@/design/driver';
import { Badge, Card, EmptyState, IconTile, KVList, Screen, Txt, fmtDateFull, fmtM3, fmtUnit } from '@/design/primitives';
import { daysLeft } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { useMyVehicle } from '@/features/eco/api';

/**
 * Kabina: mening mashinam — demo detal tartibi: xulosa kartasi (raqam, holat) → katta ko'rsatkichlar →
 * yoqilg'i chizig'i → kalit-qiymat ro'yxati (sig'im, probeg, texnik ko'rik). Ma'lumoti yo'q qator ko'rsatilmaydi.
 */
export default function MyTransport() {
  const { c } = useTheme();
  const q = useMyVehicle(); const v = q.data; const svc = daysLeft(v?.nextServiceAt);
  const low = (v?.fuelPercent ?? 100) < 25;
  const stats = v ? [
    v.fuelPercent != null ? { value: `${v.fuelPercent}%`, label: "Yoqilg'i", tone: low ? ('danger' as const) : ('primary' as const) } : null,
    v.capacityTons || v.capacityM3 ? { value: v.capacityTons ? fmtUnit(v.capacityTons, 't') : fmtM3(v.capacityM3), label: "Sig'im" } : null,
    v.odometerKm ? { value: fmtUnit(v.odometerKm, 'km'), label: 'Probeg' } : null,
  ].filter((s): s is NonNullable<typeof s> => !!s) : [];
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        <Reveal loading={q.isLoading} skeleton={<SkeletonList rows={3} />}>
          {q.isError && !v ? (
            <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} />
          ) : !v ? (
            <EmptyState icon="truck" title="Mashina biriktirilmagan" hint="Tadbirkor mashina biriktiradi" />
          ) : [
            <Card key="sum" style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.panel }}>
              <IconTile icon="truck" module="logistics" size={size.driverTouch} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt v="overline" numberOfLines={1}>{v.brand ?? v.type}</Txt>
                <Txt v="titleLg" mono numberOfLines={1} adjustsFontSizeToFit>{v.plateNumber}</Txt>
              </View>
              {low ? <Badge label="Yoqilg'i kam" tone="danger" /> : null}
            </Card>,
            stats.length ? (
              <Card key="stats" style={{ padding: space.panel }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  {stats.map((s) => <BigStat key={s.label} value={s.value} label={s.label} tone={'tone' in s ? s.tone : undefined} />)}
                </View>
              </Card>
            ) : null,
            v.fuelPercent != null ? <ProgressCard key="fuel" title="Yoqilg'i" value={v.fuelPercent} tone={low ? 'danger' : 'info'} caption={low ? "Yoqilg'i kam — quying" : undefined} /> : null,
            <KVList
              key="kv"
              rows={[
                { label: 'Turi', value: v.type },
                ...(v.capacityTons ? [{ label: "Sig'im", value: fmtUnit(v.capacityTons, 't') }] : []),
                ...(v.capacityM3 ? [{ label: 'Hajm', value: fmtM3(v.capacityM3) }] : []),
                ...(v.odometerKm ? [{ label: 'Probeg', value: fmtUnit(v.odometerKm, 'km') }] : []),
                { label: "Texnik ko'rik", value: v.nextServiceAt ? `${fmtDateFull(v.nextServiceAt)}${svc !== null ? ` · ${svc < 0 ? `${-svc} kun o'tdi` : `${svc} kun`}` : ''}` : 'Belgilanmagan', tone: svc !== null && svc < 7 ? 'danger' : undefined },
              ]}
            />,
          ]}
        </Reveal>
      </ScrollView>
    </Screen>
  );
}
