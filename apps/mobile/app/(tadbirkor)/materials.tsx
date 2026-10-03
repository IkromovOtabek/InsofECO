import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { ChipGroup, ListGroup, SectionHead } from '@/design/blocks';
import { Badge, Button, EmptyState, Gap, IconButton, Input, ListItem, Screen, StatusChip, Txt, fmtSum, fmtUnit } from '@/design/primitives';
import { Appear } from '@/design/motion';
import { dialog, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { ListSkeleton } from '@/features/erp/ui';
import { useAction, useDrivers, useMaterialRequests, useMaterials } from '@/features/eco/api';

type SegKey = 'requests' | 'stock';

/** Materiallar: so'rovlar (tasdiqlash/rad etish qatorning o'zida → yuk yaratiladi) + ombor holati (qidiruv, toifa guruhlari). */
export default function Materials() {
  const { c } = useTheme();
  const [seg, setSeg] = useState<SegKey>('requests');
  const [search, setSearch] = useState('');
  const mats = useMaterials();
  const reqs = useMaterialRequests();
  const drivers = useDrivers();
  const approve = useAction<{ id: string; driverUserId?: string; vehicleId?: string }>((v) => ({ path: `/material-requests/${v.id}/approve`, body: { driverUserId: v.driverUserId, vehicleId: v.vehicleId } }), ['material-requests', 'materials', 'shipments', 'dash']);
  const reject = useAction<{ id: string; reason: string }>((v) => ({ path: `/material-requests/${v.id}/reject`, body: { reason: v.reason } }), ['material-requests', 'dash']);

  const onApprove = (id: string) => {
    const free = (drivers.data ?? []).filter((d) => !d.currentShipment);
    dialog('Haydovchi biriktirish', 'Yuk kimga beriladi?', [
      ...free.slice(0, 3).map((d) => ({ text: `${d.fullName} (${d.vehicle?.plateNumber ?? '—'})`, onPress: () => approve.mutate({ id, driverUserId: d.userId, vehicleId: d.vehicle?.id }, { onError: (e) => toast.error(e.message, 'Xato') }) })),
      { text: 'Keyinroq (ochiq yuk)', onPress: () => approve.mutate({ id }, { onError: (e) => toast.error(e.message, 'Xato') }) },
      { text: 'Bekor', style: 'cancel' },
    ]);
  };
  const pending = (reqs.data ?? []).filter((r) => r.status === 'PENDING');
  const others = (reqs.data ?? []).filter((r) => r.status !== 'PENDING');
  const needle = search.trim().toLowerCase();
  const stock = (mats.data ?? []).filter((m) => !needle || `${m.name} ${m.category}`.toLowerCase().includes(needle));
  const lowCount = (mats.data ?? []).filter((m) => m.low).length;
  const byCat = stock.reduce<Record<string, typeof stock>>((acc, m) => { (acc[m.category] ??= []).push(m); return acc; }, {});
  const cur = seg === 'requests' ? reqs : mats;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={reqs.isRefetching || mats.isRefetching} onRefresh={() => { void reqs.refetch(); void mats.refetch(); }} tintColor={c.textMuted} />}
      >
        <ChipGroup<SegKey>
          items={[{ key: 'requests', label: "So'rovlar", count: pending.length || undefined }, { key: 'stock', label: 'Ombor', count: lowCount || undefined }]}
          value={seg} onChange={setSeg}
        />
        {cur.isLoading ? <ListSkeleton rows={5} />
          : cur.isError && !cur.data ? <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void cur.refetch()} />
          : seg === 'requests' ? (
            pending.length === 0 && others.length === 0 ? <EmptyState title="So'rovlar yo'q" hint="Quruvchi material so'raganda shu yerda ko'rinadi" icon="package" /> : (
              <Appear key="r">
                {pending.length ? (
                  <>
                    <SectionHead title="Tasdiq kutmoqda" count={pending.length} icon="clock" />
                    <ListGroup>
                      {pending.map((r) => (
                        <View key={r.id}>
                          <ListItem
                            icon="package" module="warehouse" tone="warning" chevron={false}
                            title={`${r.material.name} — ${fmtUnit(r.quantity, r.material.unit)}`}
                            subtitle={`№${r.number} · ${r.project.name}${r.reason ? `\nSabab: ${r.reason}` : ''}`}
                            right={<Txt v="bodyStrong" style={{ flexShrink: 0 }}>{`≈ ${fmtSum(Number(r.material.price) * Number(r.quantity))}`}</Txt>}
                          />
                          <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.card, paddingBottom: space.md }}>
                            <IconButton icon="x" label="Rad etish" tone="danger" variant="secondary" onPress={() => reject.mutate({ id: r.id, reason: 'Hozircha imkoniyat yo\'q' }, { onError: (e) => toast.error(e.message, 'Xato') })} />
                            <View style={{ flex: 1 }}>
                              <Button title="Qabul qilish" icon="check" loading={approve.isPending && approve.variables?.id === r.id} onPress={() => onApprove(r.id)} />
                            </View>
                          </View>
                        </View>
                      ))}
                    </ListGroup>
                    <Gap h={space.section} />
                  </>
                ) : null}
                {others.length ? (
                  <>
                    <SectionHead title="Tarix" count={others.length} icon="history" />
                    <ListGroup>
                      {others.map((r) => (
                        <ListItem
                          key={r.id} icon={r.shipment?.driver ? 'truck' : 'package'} module="warehouse" chevron={false}
                          title={`№${r.number} ${r.material.name} — ${fmtUnit(r.quantity, r.material.unit)}`}
                          subtitle={`${r.project.name}${r.rejectReason ? ` · ${r.rejectReason}` : ''}${r.shipment?.driver ? `\n${r.shipment.driver.fullName ?? r.shipment.driver.phone}` : ''}`}
                          right={<StatusChip status={r.status} />}
                        />
                      ))}
                    </ListGroup>
                  </>
                ) : null}
              </Appear>
            )
          ) : (
            <>
              <Input
                value={search} onChangeText={setSearch} placeholder="Material yoki toifa…" left="search" autoCorrect={false} returnKeyType="search"
                right={search ? <IconButton icon="x" label="Tozalash" tone="muted" size={size.touch - space.sm} onPress={() => setSearch('')} /> : null}
                containerStyle={{ marginBottom: 0 }}
              />
              {stock.length === 0 ? (
                <EmptyState icon={needle ? 'search' : 'warehouse'} title={needle ? 'Hech narsa topilmadi' : "Omborda material yo'q"} hint={needle ? "Boshqa so'z bilan qidiring" : undefined} />
              ) : (
                <Appear key="st">
                  {Object.entries(byCat).map(([cat, list], ci) => (
                    <View key={cat} style={{ marginTop: ci ? space.lg : 0 }}>
                      <SectionHead title={cat} count={list.length} />
                      <ListGroup>
                        {list.map((m) => (
                          <ListItem
                            key={m.id} icon="package" module="warehouse" tone={m.low ? 'danger' : undefined} chevron={false}
                            title={m.name}
                            subtitle={`${fmtSum(m.price)} / ${m.unit} · minimal ${fmtUnit(m.minStock, m.unit)}`}
                            right={(
                              <View style={{ alignItems: 'flex-end', gap: space.xs, flexShrink: 0 }}>
                                <Txt v="bodyStrong" color={m.low ? 'danger' : 'strong'}>{fmtUnit(m.stock, m.unit)}</Txt>
                                {m.low ? <Badge label="Kam" tone="danger" icon="triangle-alert" /> : null}
                              </View>
                            )}
                          />
                        ))}
                      </ListGroup>
                    </View>
                  ))}
                </Appear>
              )}
            </>
          )}
      </ScrollView>
    </Screen>
  );
}
