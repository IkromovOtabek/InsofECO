import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OrderStatus } from '@insof/shared';
import { Button, Card, Gap, ListItem, Row, Screen, StatusChip, Txt, fmtDate, fmtM3, fmtSum, fmtTime } from '@/design/primitives';
import { useOrder, useOrderAction } from '@/features/orders/api';
import { usePlan } from '@/features/dispatch/api';
import { useSession } from '@/core/session';
import { DeliveryStatus } from '@insof/shared';

/** Umumiy buyurtma ekrani: Tadbirkor — tasdiqlash/rad/rejalashtirish; Quruvchi — kuzatish/bekor. */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const role = useSession((s) => s.active?.role);
  const orgId = useSession((s) => s.active?.organization.id);
  const q = useOrder(id);
  const act = useOrderAction(id);
  const plan = usePlan(id);
  const o = q.data;
  if (!o) return <Screen><Txt color="secondary">Yuklanmoqda…</Txt></Screen>;
  const isPlant = role === 'TADBIRKOR' && o.plantOrgId === orgId;
  const err = (e: Error) => Alert.alert('Xato', e.message);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="title">№{o.number}</Txt>
          <StatusChip status={o.status} />
        </Row>
        <Txt color="secondary">{isPlant ? o.client.name : o.plant.name}</Txt>
        <Gap />
        <Card>
          {o.items.map((i) => <Row key={i.id} style={{ justifyContent: 'space-between', paddingVertical: 4 }}><Txt v="bodyStrong">{i.gradeSnapshot} · {fmtM3(i.volumeM3)}</Txt><Txt>{fmtSum(i.unitPriceSnapshot)}/m³</Txt></Row>)}
          {Number(o.deliveryFee) > 0 ? <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}><Txt>Yetkazish</Txt><Txt>{fmtSum(o.deliveryFee)}</Txt></Row> : null}
          <Gap h={8} />
          <Row style={{ justifyContent: 'space-between' }}><Txt v="heading">Jami</Txt><Txt v="heading" color="brand">{fmtSum(o.totalAmount)}</Txt></Row>
          <Gap h={8} />
          <Txt v="caption" color="secondary">{fmtDate(o.scheduledAt)} {fmtTime(o.scheduledAt)} · har {o.intervalMinutes} daq{o.needsPump ? ' · nasos' : ''}</Txt>
          <Txt v="caption" color="secondary">{o.address}</Txt>
          {o.note ? <Txt v="caption" color="secondary">Izoh: {o.note}</Txt> : null}
          {o.credit?.exceeded ? <Txt v="bodyStrong" color="danger" style={{ marginTop: 6 }}>⚠️ Kredit limiti oshgan (qarz {fmtSum(o.credit.debt)})</Txt> : null}
        </Card>
        <Gap />

        {isPlant && o.status === 'SUBMITTED' ? (
          <Row style={{ gap: 12 }}>
            <Button title="Rad etish" variant="danger" style={{ flex: 1 }} onPress={() => Alert.prompt?.('Sabab', undefined, (reason) => act.mutate({ action: 'reject', body: { reason: reason || 'Sabab ko\'rsatilmadi' } }, { onError: err })) ?? act.mutate({ action: 'reject', body: { reason: 'Imkoniyat yo\'q' } }, { onError: err })} />
            <Button title="Tasdiqlash" style={{ flex: 2 }} loading={act.isPending} onPress={() => act.mutate({ action: 'confirm', body: {} }, { onError: err })} />
          </Row>
        ) : null}
        {isPlant && o.status === 'CONFIRMED' ? <Button title="Reyslarga bo'lish" loading={plan.isPending} onPress={() => plan.mutate(undefined, { onError: err })} /> : null}
        {!isPlant && ['DRAFT', 'SUBMITTED', 'CONFIRMED'].includes(o.status) ? <Button title="Buyurtmani bekor qilish" variant="ghost" onPress={() => Alert.alert('Bekor qilish', o.status === 'CONFIRMED' ? '24 soatdan kam qolgan bo\'lsa jarima qo\'llanadi' : 'Ishonchingiz komilmi?', [{ text: 'Yo\'q', style: 'cancel' }, { text: 'Ha', style: 'destructive', onPress: () => act.mutate({ action: 'cancel', body: {} }, { onError: err }) }])} /> : null}
        {!isPlant && o.status === 'DELIVERED' ? <Button title="Yakuniy qabul (buyurtmani yopish)" onPress={() => Alert.alert('Yakunlash', 'Barcha reyslar qabul qilingan', [{ text: 'OK' }])} /> : null}

        <Gap h={24} />
        <Txt v="heading">Reyslar</Txt>
        <Gap h={8} />
        <Card>
          {(o.deliveries ?? []).length === 0 ? <Txt color="secondary">{o.status === 'CONFIRMED' ? 'Zavod reyslarga bo\'lishini kuting' : 'Reyslar hali yo\'q'}</Txt> : null}
          {(o.deliveries ?? []).map((d) => (
            <ListItem key={d.id} title={`Reys ${d.sequence} · ${fmtM3(d.plannedM3)} · ${fmtTime(d.plannedAt)}`} subtitle={d.driver ? `${d.driver.user.fullName ?? d.driver.user.phone} · ${d.vehicle?.plateNumber ?? ''}` : 'Haydovchi biriktirilmagan'} right={<StatusChip status={d.status as DeliveryStatus} />} onPress={() => router.push(`/delivery/${d.id}`)} />
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
void (0 as unknown as OrderStatus);
