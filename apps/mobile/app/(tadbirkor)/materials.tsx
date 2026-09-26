import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Gap, ProgressBar, Screen, StatusChip, Txt, fmtSum, fmtUnit } from '@/design/primitives';
import { Icon, Tabs, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useAction, useDrivers, useMaterialRequests, useMaterials } from '@/features/eco/api';

/** Materiallar: ombor holati + so'rovlar (tasdiqlash/rad etish → yuk yaratiladi). */
export default function Materials() {
  const { c } = useTheme();
  const [seg, setSeg] = useState<'requests' | 'stock'>('requests');
  const mats = useMaterials();
  const reqs = useMaterialRequests();
  const drivers = useDrivers();
  const approve = useAction<{ id: string; driverUserId?: string; vehicleId?: string }>((v) => ({ path: `/material-requests/${v.id}/approve`, body: { driverUserId: v.driverUserId, vehicleId: v.vehicleId } }), ['material-requests', 'materials', 'shipments', 'dash']);
  const reject = useAction<{ id: string; reason: string }>((v) => ({ path: `/material-requests/${v.id}/reject`, body: { reason: v.reason } }), ['material-requests', 'dash']);

  const onApprove = (id: string) => {
    const free = (drivers.data ?? []).filter((d) => !d.currentShipment);
    Alert.alert('Haydovchi biriktirish', 'Yuk kimga beriladi?', [
      ...free.slice(0, 3).map((d) => ({ text: `${d.fullName} (${d.vehicle?.plateNumber ?? '—'})`, onPress: () => approve.mutate({ id, driverUserId: d.userId, vehicleId: d.vehicle?.id }, { onError: (e) => toast.error(e.message, 'Xato') }) })),
      { text: 'Keyinroq (ochiq yuk)', onPress: () => approve.mutate({ id }, { onError: (e) => toast.error(e.message, 'Xato') }) },
      { text: 'Bekor', style: 'cancel' },
    ]);
  };
  const pending = (reqs.data ?? []).filter((r) => r.status === 'PENDING');
  const others = (reqs.data ?? []).filter((r) => r.status !== 'PENDING');
  const byCat = (mats.data ?? []).reduce<Record<string, typeof mats.data>>((acc, m) => { (acc[m.category] ??= []).push(m); return acc; }, {});

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>
        <Tabs value={seg} onChange={setSeg} items={[{ key: 'requests', label: "So'rovlar", count: pending.length || undefined }, { key: 'stock', label: 'Ombor' }]} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingTop: space.md }} refreshControl={<RefreshControl refreshing={reqs.isFetching || mats.isFetching} onRefresh={() => { void reqs.refetch(); void mats.refetch(); }} />}>
        {seg === 'requests' ? (
          <>
            {pending.length === 0 && others.length === 0 && !reqs.isLoading ? <EmptyState title="So'rovlar yo'q" hint="Quruvchi material so'raganda shu yerda ko'rinadi" icon="package" /> : null}
            {pending.map((r) => (
              <Card key={r.id} style={{ marginBottom: space.md, borderColor: c.warning }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                  <Txt v="overline">So&apos;rov №{r.number}</Txt>
                  <StatusChip status={r.status} />
                </View>
                <Txt v="titleSm" style={{ marginTop: space.xs }}>{r.material.name} — {fmtUnit(r.quantity, r.material.unit)}</Txt>
                <Txt v="caption">Loyiha: {r.project.name}{r.reason ? ` · Sabab: ${r.reason}` : ''} · ≈ {fmtSum(Number(r.material.price) * Number(r.quantity))}</Txt>
                <Gap h={space.md} />
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button title="Rad etish" variant="ghost" style={{ flex: 1 }} onPress={() => reject.mutate({ id: r.id, reason: 'Hozircha imkoniyat yo\'q' }, { onError: (e) => toast.error(e.message, 'Xato') })} />
                  <Button title="Qabul qilish" icon="check" style={{ flex: 2 }} loading={approve.isPending} onPress={() => onApprove(r.id)} />
                </View>
              </Card>
            ))}
            {others.map((r) => (
              <Card key={r.id} style={{ marginBottom: space.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                  <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>№{r.number} {r.material.name} — {fmtUnit(r.quantity, r.material.unit)}</Txt>
                  <StatusChip status={r.status} />
                </View>
                <Txt v="caption">{r.project.name}{r.rejectReason ? ` · ${r.rejectReason}` : ''}</Txt>
                {r.shipment?.driver ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }}>
                    <Icon name="truck" tone="muted" />
                    <Txt v="caption">{r.shipment.driver.fullName}</Txt>
                  </View>
                ) : null}
              </Card>
            ))}
          </>
        ) : (
          Object.entries(byCat).map(([cat, list]) => (
            <View key={cat} style={{ marginBottom: space.lg }}>
              <Txt v="titleSm" style={{ marginBottom: space.sm }}>{cat}</Txt>
              {(list ?? []).map((m) => {
                const pct = Number(m.minStock) ? Math.min(100, (Number(m.stock) / (Number(m.minStock) * 3)) * 100) : 100;
                return (
                  <Card key={m.id} style={{ marginBottom: space.sm }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                      <View style={{ flex: 1 }}>
                        <Txt v="bodyStrong">{m.name}</Txt>
                        <Txt v="caption">Narx: {fmtSum(m.price)} / {m.unit} · minimal {fmtUnit(m.minStock, m.unit)}</Txt>
                      </View>
                      <Txt v="metric" color={m.low ? 'danger' : 'strong'}>{fmtUnit(m.stock, m.unit)}</Txt>
                    </View>
                    <Gap h={space.sm} />
                    <ProgressBar value={pct} tone={m.low ? 'danger' : pct < 50 ? 'warning' : 'success'} />
                    {m.low ? <Badge label={`${fmtUnit(m.stock, m.unit)} qoldi`} tone="danger" icon="triangle-alert" style={{ marginTop: space.sm }} /> : null}
                  </Card>
                );
              })}
            </View>
          ))
        )}
        <Gap h={space.xxxl} />
      </ScrollView>
    </Screen>
  );
}
