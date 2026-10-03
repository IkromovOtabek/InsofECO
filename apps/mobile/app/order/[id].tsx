import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DeliveryStatus } from '@insof/shared';
import { ListGroup, Reveal, SectionHead, SkeletonList, StickyActionBar, StickyPrimary } from '@/design/blocks';
import { Badge, Button, Callout, Card, EmptyState, Input, KVList, ListItem, Screen, StatusChip, Timeline, Txt, fmtDate, fmtM3, fmtNum, fmtTime, statusLabel, statusTone } from '@/design/primitives';
import { Sheet, dialog, toast } from '@/design/ui';
import { space } from '@/design/tokens';
import { useOrder, useOrderAction } from '@/features/orders/api';
import { usePlan } from '@/features/dispatch/api';
import { useSession } from '@/core/session';

/** Buyurtma bosqichlari (demo "Jarayon"). */
const FLOW: { status: string; title: string }[] = [
  { status: 'SUBMITTED', title: 'Buyurtma yuborildi' },
  { status: 'CONFIRMED', title: 'Zavod tasdig\'i' },
  { status: 'SCHEDULED', title: "Reyslarga bo'lindi" },
  { status: 'IN_PROGRESS', title: 'Yetkazilmoqda' },
  { status: 'DELIVERED', title: 'Yetkazildi' },
  { status: 'COMPLETED', title: 'Yakunlandi' },
];
function orderSteps(status: string): { title: string; sub?: string; state: 'done' | 'now' | 'todo' }[] {
  if (status === 'REJECTED' || status === 'CANCELLED') {
    return [{ title: FLOW[0]!.title, state: 'done' }, { title: status === 'REJECTED' ? 'Rad etildi' : 'Bekor qilindi', state: 'now' }];
  }
  const at = status === 'DRAFT' ? -1 : FLOW.findIndex((f) => f.status === status);
  return FLOW.map((f, i) => ({ title: f.title, state: i < at || (i === at && status === 'COMPLETED') ? 'done' : i === at + 1 ? 'now' : 'todo', sub: i === at + 1 ? 'Kutilmoqda' : undefined }));
}

/**
 * Umumiy buyurtma ekrani: sarlavha kartasi (raqam, holat, summa) → tarkib → tafsilotlar → reyslar;
 * amallar pastki panelda. Tadbirkor (zavod) — tasdiqlash / rad etish (sabab — Sheet, har platformada) / reyslarga bo'lish;
 * Quruvchi — kuzatish / bekor qilish.
 */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const role = useSession((s) => s.active?.role);
  const orgId = useSession((s) => s.active?.organization.id);
  const q = useOrder(id);
  const act = useOrderAction(id);
  const plan = usePlan(id);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const o = q.data;
  if (!o) {
    return (
      <Screen padded={false}>
        {q.isError ? <EmptyState icon="circle-alert" title="Buyurtma yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} /> : (
          <Reveal loading skeleton={<SkeletonList rows={4} />} style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>{null}</Reveal>
        )}
      </Screen>
    );
  }
  const isPlant = role === 'TADBIRKOR' && o.plantOrgId === orgId;
  const err = (e: Error) => toast.error(e.message, 'Xato');
  const reject = () => act.mutate({ action: 'reject', body: { reason: reason.trim() } }, { onSuccess: () => { setRejectOpen(false); setReason(''); toast.success('Buyurtma rad etildi'); }, onError: err });
  const cancel = () => dialog('Bekor qilish', o.status === 'CONFIRMED' ? "24 soatdan kam qolgan bo'lsa jarima qo'llanadi" : 'Ishonchingiz komilmi?', [{ text: "Yo'q", style: 'cancel' }, { text: 'Ha, bekor qilish', style: 'destructive', onPress: () => act.mutate({ action: 'cancel', body: {} }, { onError: err }) }], { tone: 'danger', icon: 'circle-x' });

  // Pastki panel: holat va rolga qarab bitta asosiy amal.
  let bar: { primary: StickyPrimary; secondary?: { title: string; icon?: 'x'; onPress: () => void } } | null = null;
  if (isPlant && o.status === 'SUBMITTED') bar = { primary: { title: 'Tasdiqlash', icon: 'check', loading: act.isPending, onPress: () => act.mutate({ action: 'confirm', body: {} }, { onError: err }) }, secondary: { title: 'Rad etish', icon: 'x', onPress: () => setRejectOpen(true) } };
  else if (isPlant && o.status === 'CONFIRMED') bar = { primary: { title: "Reyslarga bo'lish", icon: 'truck', loading: plan.isPending, onPress: () => plan.mutate(undefined, { onError: err }) } };
  else if (!isPlant && o.status === 'DELIVERED') bar = { primary: { title: 'Yakuniy qabul', icon: 'circle-check', variant: 'success', onPress: () => dialog('Yakunlash', 'Barcha reyslar qabul qilingan', [{ text: 'OK' }]) } };
  else if (!isPlant && ['DRAFT', 'SUBMITTED', 'CONFIRMED'].includes(o.status)) bar = { primary: { title: 'Buyurtmani bekor qilish', icon: 'x', variant: 'danger', loading: act.isPending, onPress: cancel } };

  const details: { label: string; value: string; tone?: 'danger' }[] = [
    { label: 'Yetkazish', value: `${fmtDate(o.scheduledAt)} · ${fmtTime(o.scheduledAt)}` },
    { label: 'Interval', value: `har ${o.intervalMinutes} daqiqa` },
    { label: 'Nasos', value: o.needsPump ? 'Kerak' : 'Kerak emas' },
    ...(o.site ? [{ label: 'Obyekt', value: o.site.name }] : []),
    { label: 'Manzil', value: o.address },
    ...(o.note ? [{ label: 'Izoh', value: o.note }] : []),
  ];
  const composition = [
    ...o.items.map((i) => ({ label: `${i.gradeSnapshot} · ${fmtM3(i.volumeM3)}`, value: `${fmtNum(Math.round(Number(i.unitPriceSnapshot)))} so'm / m³` })),
    ...(Number(o.deliveryFee) > 0 ? [{ label: 'Yetkazish narxi', value: `${fmtNum(Math.round(Number(o.deliveryFee)))} so'm` }] : []),
  ];
  const deliveries = o.deliveries ?? [];

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxl }}>
        <Reveal>
          <Card style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Txt v="overline" numberOfLines={1} style={{ flex: 1 }}>{o.items.map((i) => `${i.gradeSnapshot} · ${fmtM3(i.volumeM3)}`).join(' + ')}</Txt>
              <Badge label={statusLabel(o.status)} tone={statusTone(o.status)} />
            </View>
            <Txt v="metric" numberOfLines={1} adjustsFontSizeToFit>
              {fmtNum(Math.round(Number(o.totalAmount)))}
              <Txt v="tSm">{" so'm"}</Txt>
            </Txt>
            <Txt v="tSm" numberOfLines={2}>{`№${o.number} · ${isPlant ? o.client.name : o.plant.name}`}</Txt>
          </Card>

          {o.credit?.exceeded ? (
            <Callout tone="danger">
              {`Kredit limit oshgan (qarz ${fmtNum(Math.round(o.credit.debt))} so'm) — to'lov kiriting yoki limitni kengaytiring`}
            </Callout>
          ) : null}

          <KVList rows={details} />
          <KVList rows={composition} />

          <SectionHead title="Jarayon" />
          <Card><Timeline steps={orderSteps(o.status)} /></Card>

          <SectionHead title="Reyslar" count={deliveries.length || undefined} />
          {deliveries.length ? (
            <ListGroup>
              {deliveries.map((d) => (
                <ListItem key={d.id} icon="truck" module="logistics" title={`Reys ${d.sequence} · ${fmtM3(d.plannedM3)} · ${fmtTime(d.plannedAt)}`} subtitle={d.driver ? `${d.driver.user.fullName ?? d.driver.user.phone} · ${d.vehicle?.plateNumber ?? ''}` : 'Haydovchi biriktirilmagan'} right={<StatusChip status={d.status as DeliveryStatus} />} onPress={() => router.push(`/delivery/${d.id}`)} />
              ))}
            </ListGroup>
          ) : (
            <ListGroup>
              <EmptyState compact icon="truck" title={o.status === 'CONFIRMED' ? "Reyslar hali bo'linmagan" : "Reyslar hali yo'q"} hint={o.status === 'CONFIRMED' ? (isPlant ? "Pastdagi \"Reyslarga bo'lish\" tugmasini bosing" : "Zavod reyslarga bo'lgach shu yerda ko'rinadi") : undefined} />
            </ListGroup>
          )}
        </Reveal>
      </ScrollView>

      {bar ? <StickyActionBar primary={bar.primary} secondary={bar.secondary} /> : null}

      <Sheet
        open={rejectOpen} onClose={() => setRejectOpen(false)} title="Rad etish sababi"
        footer={<Button title="Rad etish" icon="x" variant="danger" size="lg" loading={act.isPending} disabled={reason.trim().length < 3} onPress={reject} />}
      >
        <Input label="Sabab" value={reason} onChangeText={setReason} placeholder="Masalan: bu sanaga imkoniyat yo'q" hint="Mijozga yuboriladi · kamida 3 belgi" multiline autoFocus />
      </Sheet>
    </Screen>
  );
}
