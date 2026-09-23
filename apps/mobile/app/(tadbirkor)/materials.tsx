import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { Button, Card, EmptyState, Gap, Screen, StatusChip, Txt, fmtSum } from '@/design/primitives';
import { Pill, ProgressBar, Segmented } from '@/design/ui';
import { useTheme } from '@/design/theme';
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
      ...free.slice(0, 3).map((d) => ({ text: `${d.fullName} (${d.vehicle?.plateNumber ?? '—'})`, onPress: () => approve.mutate({ id, driverUserId: d.userId, vehicleId: d.vehicle?.id }, { onError: (e) => Alert.alert('Xato', e.message) }) })),
      { text: 'Keyinroq (ochiq yuk)', onPress: () => approve.mutate({ id }, { onError: (e) => Alert.alert('Xato', e.message) }) },
      { text: 'Bekor', style: 'cancel' },
    ]);
  };
  const pending = (reqs.data ?? []).filter((r) => r.status === 'PENDING');
  const others = (reqs.data ?? []).filter((r) => r.status !== 'PENDING');
  const byCat = (mats.data ?? []).reduce<Record<string, typeof mats.data>>((acc, m) => { (acc[m.category] ??= []).push(m); return acc; }, {});

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Segmented value={seg} onChange={setSeg} items={[{ key: 'requests', label: `So'rovlar${pending.length ? ` (${pending.length})` : ''}` }, { key: 'stock', label: 'Ombor' }]} /></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }} refreshControl={<RefreshControl refreshing={reqs.isFetching || mats.isFetching} onRefresh={() => { void reqs.refetch(); void mats.refetch(); }} />}>
        {seg === 'requests' ? (
          <>
            {pending.length === 0 ? <EmptyState title="Yangi so'rovlar yo'q" /> : null}
            {pending.map((r) => (
              <Card key={r.id} style={{ marginBottom: 10, borderColor: c.warning }}>
                <Txt v="caption" color="secondary">Material Request #{r.number}</Txt>
                <Txt v="heading">{r.material.name} — {r.quantity} {r.material.unit}</Txt>
                <Txt v="caption" color="secondary">Loyiha: {r.project.name}{r.reason ? ` · Sabab: ${r.reason}` : ''} · ≈ {fmtSum(Number(r.material.price) * Number(r.quantity))}</Txt>
                <Gap h={12} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button title="Rad etish" variant="ghost" size="md" style={{ flex: 1 }} onPress={() => reject.mutate({ id: r.id, reason: 'Hozircha imkoniyat yo\'q' })} />
                  <Button title="Qabul qilish" size="md" style={{ flex: 2 }} loading={approve.isPending} onPress={() => onApprove(r.id)} />
                </View>
              </Card>
            ))}
            {others.map((r) => (
              <Card key={r.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="bodyStrong">#{r.number} {r.material.name} — {r.quantity} {r.material.unit}</Txt><StatusChip status={r.status} /></View>
                <Txt v="caption" color="secondary">{r.project.name}{r.shipment?.driver ? ` · 🚚 ${r.shipment.driver.fullName}` : ''}{r.rejectReason ? ` · ${r.rejectReason}` : ''}</Txt>
              </Card>
            ))}
          </>
        ) : (
          Object.entries(byCat).map(([cat, list]) => (
            <View key={cat} style={{ marginBottom: 16 }}>
              <Txt v="heading" style={{ marginBottom: 8 }}>{cat}</Txt>
              {(list ?? []).map((m) => {
                const pct = Number(m.minStock) ? Math.min(100, (Number(m.stock) / (Number(m.minStock) * 3)) * 100) : 100;
                return (
                  <Card key={m.id} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}><Txt v="bodyStrong">{m.name}</Txt><Txt v="caption" color="secondary">Narx: {fmtSum(m.price)} / {m.unit} · minimal {m.minStock}</Txt></View>
                      <View style={{ alignItems: 'flex-end' }}><Txt v="subtitle" color={m.low ? 'danger' : 'primary'}>{Number(m.stock)}</Txt><Txt v="caption" color="secondary">{m.unit}</Txt></View>
                    </View>
                    <Gap h={8} />
                    <ProgressBar value={pct} tone={m.low ? 'danger' : pct < 50 ? 'warning' : 'success'} height={6} />
                    {m.low ? <View style={{ marginTop: 8 }}><Pill label={`⚠️ ${Number(m.stock)} ${m.unit} qoldi`} tone="danger" /></View> : null}
                  </Card>
                );
              })}
            </View>
          ))
        )}
        <Gap h={30} />
      </ScrollView>
    </Screen>
  );
}
