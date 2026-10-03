import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DeliveryStatus } from '@insof/shared';
import { ListGroup, SectionHead, StickyActionBar, StickyPrimary } from '@/design/blocks';
import { Button, Callout, Card, EmptyState, Gap, Input, ListItem, Screen, StatusChip, Txt, fmtDate, fmtM3, fmtSum, fmtTime } from '@/design/primitives';
import { Sheet, dialog, toast } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Loader } from '@/design/loader';
import { useOrder, useOrderAction } from '@/features/orders/api';
import { usePlan } from '@/features/dispatch/api';
import { useSession } from '@/core/session';

/** Kalit — qiymat qatori (ListGroup ichida; birinchisidan keyin ichki chiziq). */
function KV({ k, v, first, strong }: { k: string; v: string; first?: boolean; strong?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row, paddingVertical: space.sm, paddingHorizontal: space.card }}>
      {first ? null : <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: space.card, right: space.md, height: size.hairline, backgroundColor: c.borderSubtle }} />}
      <Txt v="bodySm" color="muted" style={{ flexShrink: 0 }}>{k}</Txt>
      <Txt v={strong ? 'bodyStrong' : 'body'} color={strong ? 'brand' : 'strong'} align="right" style={{ flex: 1 }}>{v}</Txt>
    </View>
  );
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
      <Screen>
        {q.isError ? <EmptyState icon="circle-alert" title="Buyurtma yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} /> : <Loader style={{ marginTop: space.xxxl }} />}
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

  const details: [string, string][] = [
    ['Sana', `${fmtDate(o.scheduledAt)} · ${fmtTime(o.scheduledAt)}`],
    ['Interval', `har ${o.intervalMinutes} daqiqa`],
    ['Nasos', o.needsPump ? 'Kerak' : 'Kerak emas'],
    ...(o.site ? [['Obyekt', o.site.name] as [string, string]] : []),
    ['Manzil', o.address],
    ...(o.note ? [['Izoh', o.note] as [string, string]] : []),
  ];
  const deliveries = o.deliveries ?? [];

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: space.xxl }}>
        <Card style={{ padding: space.panel }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <Txt v="overline" numberOfLines={1} style={{ flex: 1 }}>{isPlant ? o.client.name : o.plant.name}</Txt>
            <StatusChip status={o.status} />
          </View>
          <Txt v="titleLg" style={{ marginTop: space.xs }}>Buyurtma №{o.number}</Txt>
          <Txt v="bodySm" color="muted">{o.items.map((i) => `${i.gradeSnapshot} · ${fmtM3(i.volumeM3)}`).join(' + ')}</Txt>
          <Gap h={space.md} />
          <Txt v="caption">Jami</Txt>
          <Txt v="metric" color="brand" numberOfLines={1} adjustsFontSizeToFit>{fmtSum(o.totalAmount)}</Txt>
        </Card>

        {o.credit?.exceeded ? (
          <Callout tone="danger" style={{ marginTop: space.grid }}>
            {`Kredit limit oshgan (qarz ${fmtSum(o.credit.debt)}) — to'lov kiriting yoki limitni kengaytiring`}
          </Callout>
        ) : null}

        <Gap h={space.section} />
        <SectionHead title="Tarkib" />
        <ListGroup>
          {o.items.map((i, idx) => <KV key={i.id} first={idx === 0} k={`${i.gradeSnapshot} · ${fmtM3(i.volumeM3)}`} v={`${fmtSum(i.unitPriceSnapshot)} / m³`} />)}
          {Number(o.deliveryFee) > 0 ? <KV k="Yetkazish" v={fmtSum(o.deliveryFee)} /> : null}
          <KV k="Jami" v={fmtSum(o.totalAmount)} strong />
        </ListGroup>

        <Gap h={space.section} />
        <SectionHead title="Tafsilotlar" />
        <ListGroup>
          {details.map(([k, v], i) => <KV key={k} k={k} v={v} first={i === 0} />)}
        </ListGroup>

        <Gap h={space.section} />
        <SectionHead title="Reyslar" count={deliveries.length || undefined} icon="truck" />
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
