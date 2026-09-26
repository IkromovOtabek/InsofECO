import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SPECIALTY_LABEL } from '@insof/shared';
import { Badge, Button, Card, EmptyState, Gap, IconTile, Input, ListItem, Panel, ProgressBar, Screen, StatusChip, Txt, fmtDateFull, fmtSum } from '@/design/primitives';
import { Avatar, Stars, StatusLine, daysLeft, toast } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { useAction, useWorkOrder, useWorkers } from '@/features/eco/api';
import { useSession } from '@/core/session';

const FLOW = ['NEW', 'ACCEPTED', 'WORKER_ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'PAID'];
const FLOW_LABEL: Record<string, string> = { NEW: 'Yangi', ACCEPTED: 'Qabul qilindi', WORKER_ASSIGNED: 'Quruvchi biriktirildi', IN_PROGRESS: 'Jarayonda', REVIEW: 'Tekshiruv', DONE: 'Tugallandi', PAID: "To'lov olindi" };

/** Ish buyurtmasi: holat zanjiri + rolga qarab harakat tugmalari. */
export default function WorkOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const role = useSession((s) => s.active?.role);
  const q = useWorkOrder(id);
  const workers = useWorkers();
  const [comment, setComment] = useState('');
  const inv = ['work-orders', 'dash', 'finance', 'projects'];
  const accept = useAction(() => ({ path: `/work-orders/${id}/accept` }), inv);
  const assign = useAction<string>((w) => ({ path: `/work-orders/${id}/assign`, body: { workerUserId: w } }), inv);
  const start = useAction(() => ({ path: `/work-orders/${id}/start` }), inv);
  const submit = useAction(() => ({ path: `/work-orders/${id}/submit`, body: { photoKeys: ['photo/demo.jpg'], comment } }), inv);
  const review = useAction<{ approve: boolean; rating?: number }>((v) => ({ path: `/work-orders/${id}/review`, body: { ...v, comment } }), inv);
  const pay = useAction(() => ({ path: `/work-orders/${id}/pay` }), inv);
  const cancel = useAction(() => ({ path: `/work-orders/${id}/cancel` }), inv);
  const err = (e: Error) => toast.error(e.message, 'Xato');
  const o = q.data;
  if (!o) {
    return (
      <Screen>
        {q.isError ? <EmptyState icon="circle-alert" title="Ish buyurtmasi yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" action="Qayta urinish" onAction={() => void q.refetch()} /> : <ActivityIndicator color={c.brand} style={{ marginTop: space.xxxl }} />}
      </Screen>
    );
  }
  const idx = FLOW.indexOf(o.status); const dl = daysLeft(o.deadline);
  const isTadbirkor = role === 'TADBIRKOR'; const isWorker = role === 'QURUVCHI';
  const freeWorkers = (workers.data ?? []).filter((w) => !w.activeWork).slice(0, 8);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.x10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}><Txt v="overline" style={{ flex: 1 }} numberOfLines={1}>№{o.number} · {o.project?.name ?? 'Loyihasiz'}</Txt><StatusChip status={o.status} /></View>
        <Txt v="titleMd" style={{ marginTop: 2 }}>{o.title}</Txt>
        <Gap h={space.md} />
        {o.status !== 'CANCELLED' ? (
          <Card>
            <ProgressBar value={((idx + 1) / FLOW.length) * 100} tone={o.status === 'PAID' ? 'success' : 'brand'} />
            <View style={{ marginTop: space.sm }}>
              {FLOW.map((s, i) => <StatusLine key={s} icon={i < idx ? 'circle-check' : i === idx ? 'circle-dot' : 'circle'} tone={i < idx ? 'success' : i === idx ? 'brand' : 'neutral'} text={i === idx ? `${FLOW_LABEL[s]} — hozir` : FLOW_LABEL[s]!} />)}
            </View>
          </Card>
        ) : null}
        <Panel title="Tafsilotlar" icon="clipboard-list">
          <ListItem icon="file-text" title="Vazifa" subtitle={o.description ?? '—'} />
          <ListItem icon="map-pin" title="Manzil" subtitle={o.address} />
          <ListItem icon="banknote" tone="success" title="To'lov" subtitle={fmtSum(o.price)} />
          <ListItem icon="calendar-days" tone={dl !== null && dl < 0 && idx < 5 ? 'danger' : 'brand'} title="Deadline" subtitle={`${fmtDateFull(o.deadline)}${dl !== null ? dl < 0 ? ` · ${-dl} kun kechikdi` : ` · ${dl} kun qoldi` : ''}`} last />
        </Panel>
        {o.worker ? (
          <Panel title="Quruvchi" icon="hard-hat">
            <ListItem leading={<Avatar name={o.worker.fullName} />} title={o.worker.fullName ?? o.worker.phone} subtitle={o.worker.workerProfile ? SPECIALTY_LABEL[o.worker.workerProfile.specialty as keyof typeof SPECIALTY_LABEL] : ''} right={o.worker.workerProfile ? <Stars value={o.worker.workerProfile.ratingAvg} /> : undefined} onPress={isTadbirkor ? () => router.push(`/worker/${o.worker!.id}`) : undefined} last />
          </Panel>
        ) : null}
        {(o.photoKeys.length || o.workerComment) ? (
          <Panel title="Topshirilgan ish" icon="image">
            <View style={{ paddingVertical: space.sm }}>
              {o.photoKeys.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{o.photoKeys.map((k) => <IconTile key={k} icon="image" tone="neutral" size={size.driverTouch + space.sm} />)}</View> : null}
              {o.workerComment ? <Txt v="body" style={{ marginTop: space.sm }}>{o.workerComment}</Txt> : null}
              {o.reviewComment ? <Txt v="body" color="muted" style={{ marginTop: space.sm }}>Tadbirkor: {o.reviewComment}</Txt> : null}
            </View>
          </Panel>
        ) : null}

        <Gap h={space.xl} />
        {/* ───── Harakatlar ───── */}
        {isTadbirkor && o.status === 'NEW' ? <><Button title="Buyurtmani qabul qilish" icon="check" loading={accept.isPending} onPress={() => accept.mutate(undefined, { onError: err })} /><Gap h={space.sm} /><Button title="Bekor qilish" variant="ghost" size="md" onPress={() => Alert.alert('Bekor qilish', 'Ish buyurtmasi bekor qilinadi. Davom etasizmi?', [{ text: 'Yo\'q', style: 'cancel' }, { text: 'Ha', style: 'destructive', onPress: () => cancel.mutate(undefined, { onError: err }) }])} /></> : null}
        {isTadbirkor && o.status === 'ACCEPTED' ? (
          <Card>
            <Txt v="titleSm">Quruvchi biriktirish</Txt><Txt v="caption">Bo'sh qolsa — ochiq buyurtma, quruvchilar o'zi oladi</Txt><Gap h={space.sm} />
            {freeWorkers.length === 0 ? <EmptyState icon="users" title="Bo'sh quruvchi yo'q" hint="Hozir hammasi band — buyurtma ochiq qoladi" /> : null}
            {freeWorkers.map((w, i, arr) => <ListItem key={w.userId} leading={<Avatar name={w.fullName} />} title={w.fullName ?? ''} subtitle={w.profile ? SPECIALTY_LABEL[w.profile.specialty as keyof typeof SPECIALTY_LABEL] : ''} right={w.profile ? <Stars value={w.profile.ratingAvg} /> : undefined} onPress={() => assign.mutate(w.userId, { onError: err })} last={i === arr.length - 1} />)}
          </Card>
        ) : null}
        {isWorker && ['ACCEPTED', 'WORKER_ASSIGNED'].includes(o.status) ? <Button title={o.status === 'ACCEPTED' ? 'Qabul qilish va boshlash' : 'Ishni boshlash'} size="xl" icon="hammer" loading={start.isPending} onPress={() => start.mutate(undefined, { onError: err })} /> : null}
        {isWorker && o.status === 'IN_PROGRESS' ? (
          <Card>
            <Txt v="titleSm">Ish tugadi</Txt><Gap h={space.sm} />
            <Button title="Foto yuklash" icon="camera" variant="secondary" size="md" onPress={() => Alert.alert('Foto', 'Kamera — presigned S3 (keyingi versiya). Demo foto biriktiriladi.')} /><Gap h={space.sm} />
            <Input value={comment} onChangeText={setComment} placeholder="Izoh" />
            <Button title="Ishni topshirish" size="xl" icon="check-check" loading={submit.isPending} onPress={() => submit.mutate(undefined, { onError: err })} />
          </Card>
        ) : null}
        {isTadbirkor && o.status === 'REVIEW' ? (
          <Card>
            <Txt v="titleSm">Tekshiruv</Txt><Gap h={space.sm} />
            <Input value={comment} onChangeText={setComment} placeholder="Izoh (ixtiyoriy)" />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button title="Qayta ishlash" variant="ghost" size="md" icon="refresh-cw" style={{ flex: 1 }} onPress={() => review.mutate({ approve: false }, { onError: err })} />
              <Button title="Qabul qilish va baholash" size="md" icon="star" style={{ flex: 2 }} loading={review.isPending} onPress={() => Alert.alert('Baho', 'Quruvchini baholang', [...[5, 4, 3].map((r) => ({ text: `${r} yulduz`, onPress: () => review.mutate({ approve: true, rating: r }, { onError: err }) })), { text: 'Bekor', style: 'cancel' as const }])} />
            </View>
          </Card>
        ) : null}
        {isTadbirkor && o.status === 'DONE' ? <Button title={`To'lash — ${fmtSum(o.price)}`} icon="wallet" loading={pay.isPending} onPress={() => pay.mutate(undefined, { onError: err })} /> : null}
        {o.status === 'PAID' ? <View style={{ alignItems: 'center' }}><Badge label="To'lov amalga oshirilgan" tone="success" icon="circle-check" /></View> : null}
        {o.status === 'CANCELLED' ? <View style={{ alignItems: 'center' }}><Badge label="Bekor qilingan" tone="danger" icon="circle-x" /></View> : null}
      </ScrollView>
    </Screen>
  );
}
