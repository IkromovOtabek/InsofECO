import React from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OrderStatus } from '@insof/shared';
import { Button, Card, Divider, EmptyState, Gap, ListItem, Panel, Row, Screen, StatusChip, Txt, fmtDate, fmtM3, fmtSum, fmtTime } from '@/design/primitives';
import { Icon, toast } from '@/design/ui';
import { radius, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { useOrder, useOrderAction } from '@/features/orders/api';
import { usePlan } from '@/features/dispatch/api';
import { useSession } from '@/core/session';
import { DeliveryStatus } from '@insof/shared';

/** Umumiy buyurtma ekrani: Tadbirkor — tasdiqlash/rad/rejalashtirish; Quruvchi — kuzatish/bekor. */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const role = useSession((s) => s.active?.role);
  const orgId = useSession((s) => s.active?.organization.id);
  const q = useOrder(id);
  const act = useOrderAction(id);
  const plan = usePlan(id);
  const o = q.data;
  if (!o) {
    return (
      <Screen>
        {q.isError ? <EmptyState icon="circle-alert" title="Buyurtma yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" action="Qayta urinish" onAction={() => void q.refetch()} /> : <ActivityIndicator color={c.brand} style={{ marginTop: space.xxxl }} />}
      </Screen>
    );
  }
  const isPlant = role === 'TADBIRKOR' && o.plantOrgId === orgId;
  const err = (e: Error) => toast.error(e.message, 'Xato');

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.x10 }}>
        <Row style={{ justifyContent: 'space-between', gap: space.sm }}>
          <Txt v="titleMd" style={{ flex: 1 }} numberOfLines={1}>№{o.number}</Txt>
          <StatusChip status={o.status} />
        </Row>
        <Txt color="muted">{isPlant ? o.client.name : o.plant.name}</Txt>
        <Gap />
        <Card>
          {o.items.map((i) => <Row key={i.id} style={{ justifyContent: 'space-between', paddingVertical: space.xs, gap: space.sm }}><Txt v="bodyStrong" style={{ flex: 1 }}>{i.gradeSnapshot} · {fmtM3(i.volumeM3)}</Txt><Txt>{fmtSum(i.unitPriceSnapshot)}/m³</Txt></Row>)}
          {Number(o.deliveryFee) > 0 ? <Row style={{ justifyContent: 'space-between', paddingVertical: space.xs }}><Txt>Yetkazish</Txt><Txt>{fmtSum(o.deliveryFee)}</Txt></Row> : null}
          <Divider style={{ marginVertical: space.sm }} />
          <Row style={{ justifyContent: 'space-between' }}><Txt v="titleSm">Jami</Txt><Txt v="titleSm" color="brand">{fmtSum(o.totalAmount)}</Txt></Row>
          <Gap h={space.sm} />
          <Txt v="caption">{fmtDate(o.scheduledAt)} {fmtTime(o.scheduledAt)} · har {o.intervalMinutes} daq{o.needsPump ? ' · nasos' : ''}</Txt>
          <Txt v="caption">{o.address}</Txt>
          {o.note ? <Txt v="caption">Izoh: {o.note}</Txt> : null}
          {o.credit?.exceeded ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: c.dangerBg }}>
              <Icon name="circle-alert" tone="danger" size={size.iconMd} />
              <Txt v="bodySm" color="danger" style={{ flex: 1 }}>Kredit limit oshgan (qarz {fmtSum(o.credit.debt)}) — to'lov kiriting yoki limitni kengaytiring</Txt>
            </View>
          ) : null}
        </Card>
        <Gap />

        {isPlant && o.status === 'SUBMITTED' ? (
          <Row style={{ gap: space.md }}>
            <Button title="Rad etish" variant="danger" icon="x" style={{ flex: 1 }} onPress={() => Alert.prompt?.('Sabab', undefined, (reason) => act.mutate({ action: 'reject', body: { reason: reason || 'Sabab ko\'rsatilmadi' } }, { onError: err })) ?? act.mutate({ action: 'reject', body: { reason: 'Imkoniyat yo\'q' } }, { onError: err })} />
            <Button title="Tasdiqlash" icon="check" style={{ flex: 2 }} loading={act.isPending} onPress={() => act.mutate({ action: 'confirm', body: {} }, { onError: err })} />
          </Row>
        ) : null}
        {isPlant && o.status === 'CONFIRMED' ? <Button title="Reyslarga bo'lish" icon="truck" loading={plan.isPending} onPress={() => plan.mutate(undefined, { onError: err })} /> : null}
        {!isPlant && ['DRAFT', 'SUBMITTED', 'CONFIRMED'].includes(o.status) ? <Button title="Buyurtmani bekor qilish" variant="ghost" onPress={() => Alert.alert('Bekor qilish', o.status === 'CONFIRMED' ? '24 soatdan kam qolgan bo\'lsa jarima qo\'llanadi' : 'Ishonchingiz komilmi?', [{ text: 'Yo\'q', style: 'cancel' }, { text: 'Ha', style: 'destructive', onPress: () => act.mutate({ action: 'cancel', body: {} }, { onError: err }) }])} /> : null}
        {!isPlant && o.status === 'DELIVERED' ? <Button title="Yakuniy qabul (buyurtmani yopish)" icon="circle-check" onPress={() => Alert.alert('Yakunlash', 'Barcha reyslar qabul qilingan', [{ text: 'OK' }])} /> : null}

        <Panel title="Reyslar" icon="truck">
          {(o.deliveries ?? []).length === 0 ? <EmptyState icon="truck" title={o.status === 'CONFIRMED' ? 'Reyslar hali bo\'linmagan' : 'Reyslar hali yo\'q'} hint={o.status === 'CONFIRMED' ? 'Zavod reyslarga bo\'lgach shu yerda ko\'rinadi' : undefined} /> : null}
          {(o.deliveries ?? []).map((d, i, arr) => (
            <ListItem key={d.id} icon="truck" module="logistics" title={`Reys ${d.sequence} · ${fmtM3(d.plannedM3)} · ${fmtTime(d.plannedAt)}`} subtitle={d.driver ? `${d.driver.user.fullName ?? d.driver.user.phone} · ${d.vehicle?.plateNumber ?? ''}` : 'Haydovchi biriktirilmagan'} right={<StatusChip status={d.status as DeliveryStatus} />} onPress={() => router.push(`/delivery/${d.id}`)} last={i === arr.length - 1} />
          ))}
        </Panel>
      </ScrollView>
    </Screen>
  );
}
void (0 as unknown as OrderStatus);
