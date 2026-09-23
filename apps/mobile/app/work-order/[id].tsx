import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SPECIALTY_LABEL } from '@insof/shared';
import { Button, Card, Field, Gap, Screen, StatusChip, Txt, fmtSum } from '@/design/primitives';
import { Avatar, Pill, ProgressBar, Row, Section, Stars, daysLeft } from '@/design/ui';
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
  const err = (e: Error) => Alert.alert('Xato', e.message);
  const o = q.data;
  if (!o) return <Screen><Txt color="secondary">Yuklanmoqda…</Txt></Screen>;
  const idx = FLOW.indexOf(o.status); const dl = daysLeft(o.deadline);
  const isTadbirkor = role === 'TADBIRKOR'; const isWorker = role === 'QURUVCHI';

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="caption" color="secondary">№{o.number} · {o.project?.name ?? 'Loyihasiz'}</Txt><StatusChip status={o.status} /></View>
        <Txt v="title" style={{ marginTop: 2 }}>{o.title}</Txt>
        <Gap h={12} />
        {o.status !== 'CANCELLED' ? (
          <Card>
            <ProgressBar value={((idx + 1) / FLOW.length) * 100} tone={o.status === 'PAID' ? 'success' : 'brand'} height={6} />
            <View style={{ marginTop: 10 }}>{FLOW.map((s, i) => <View key={s} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i <= idx ? c.brandPrimary : c.border, marginRight: 10 }} /><Txt v="caption" color={i <= idx ? 'primary' : 'secondary'} style={i === idx ? { fontWeight: '700' } : undefined}>{FLOW_LABEL[s]}</Txt></View>)}</View>
          </Card>
        ) : null}
        <Section title="Tafsilotlar">
          <Row icon="document-text" title="Vazifa" subtitle={o.description ?? '—'} />
          <Row icon="location" title="Manzil" subtitle={o.address} />
          <Row icon="cash" iconTone="success" title="To'lov" subtitle={fmtSum(o.price)} />
          <Row icon="calendar" iconTone={dl !== null && dl < 0 && idx < 5 ? 'danger' : 'brand'} title="Deadline" subtitle={`${new Date(o.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}${dl !== null ? dl < 0 ? ` · ${-dl} kun kechikdi` : ` · ${dl} kun qoldi` : ''}`} last />
        </Section>
        {o.worker ? (
          <Section title="Quruvchi">
            <Row avatarName={o.worker.fullName} title={o.worker.fullName ?? o.worker.phone} subtitle={o.worker.workerProfile ? SPECIALTY_LABEL[o.worker.workerProfile.specialty as keyof typeof SPECIALTY_LABEL] : ''} right={o.worker.workerProfile ? <Stars value={o.worker.workerProfile.ratingAvg} /> : undefined} onPress={isTadbirkor ? () => router.push(`/worker/${o.worker!.id}`) : undefined} last />
          </Section>
        ) : null}
        {(o.photoKeys.length || o.workerComment) ? (
          <Section title="Topshirilgan ish"><View style={{ paddingVertical: 8 }}><View style={{ flexDirection: 'row', gap: 8 }}>{o.photoKeys.map((k) => <View key={k} style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: c.bgSurfaceMuted, alignItems: 'center', justifyContent: 'center' }}><Txt>📷</Txt></View>)}</View>{o.workerComment ? <Txt v="callout" style={{ marginTop: 8 }}>{o.workerComment}</Txt> : null}{o.reviewComment ? <Txt v="callout" color="secondary" style={{ marginTop: 6 }}>Tadbirkor: {o.reviewComment}</Txt> : null}</View></Section>
        ) : null}

        <Gap h={20} />
        {/* ───── Harakatlar ───── */}
        {isTadbirkor && o.status === 'NEW' ? <><Button title="Buyurtmani qabul qilish" loading={accept.isPending} onPress={() => accept.mutate(undefined, { onError: err })} /><Gap h={10} /><Button title="Bekor qilish" variant="ghost" size="md" onPress={() => cancel.mutate(undefined, { onError: err })} /></> : null}
        {isTadbirkor && o.status === 'ACCEPTED' ? (
          <Card>
            <Txt v="heading">Quruvchi biriktirish</Txt><Txt v="caption" color="secondary">Bo'sh qolsa — ochiq buyurtma, quruvchilar o'zi oladi</Txt><Gap h={8} />
            {(workers.data ?? []).filter((w) => !w.activeWork).slice(0, 8).map((w, i, arr) => <Row key={w.userId} avatarName={w.fullName} title={w.fullName ?? ''} subtitle={w.profile ? `${SPECIALTY_LABEL[w.profile.specialty as keyof typeof SPECIALTY_LABEL]} · ⭐ ${w.profile.ratingAvg}` : ''} onPress={() => assign.mutate(w.userId, { onError: err })} last={i === arr.length - 1} />)}
          </Card>
        ) : null}
        {isWorker && ['ACCEPTED', 'WORKER_ASSIGNED'].includes(o.status) ? <Button title={o.status === 'ACCEPTED' ? 'Qabul qilish va boshlash' : 'Ishni boshlash'} size="xl" loading={start.isPending} onPress={() => start.mutate(undefined, { onError: err })} /> : null}
        {isWorker && o.status === 'IN_PROGRESS' ? (
          <Card>
            <Txt v="heading">Ish tugadi</Txt><Gap h={10} />
            <Button title="📷 Foto yuklash" variant="secondary" size="md" onPress={() => Alert.alert('Foto', 'Kamera — presigned S3 (keyingi versiya). Demo foto biriktiriladi.')} /><Gap h={10} />
            <Field value={comment} onChangeText={setComment} placeholder="📝 Izoh" />
            <Button title="ISHNI TOPSHIRISH" size="xl" loading={submit.isPending} onPress={() => submit.mutate(undefined, { onError: err })} />
          </Card>
        ) : null}
        {isTadbirkor && o.status === 'REVIEW' ? (
          <Card>
            <Txt v="heading">Tekshiruv</Txt><Gap h={10} />
            <Field value={comment} onChangeText={setComment} placeholder="Izoh (ixtiyoriy)" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Qayta ishlash" variant="ghost" size="md" style={{ flex: 1 }} onPress={() => review.mutate({ approve: false }, { onError: err })} />
              <Button title="Qabul qilish ⭐5" size="md" style={{ flex: 2 }} loading={review.isPending} onPress={() => Alert.alert('Baho', 'Quruvchini baholang', [5, 4, 3].map((r) => ({ text: `${'⭐'.repeat(r)}`, onPress: () => review.mutate({ approve: true, rating: r }, { onError: err }) })))} />
            </View>
          </Card>
        ) : null}
        {isTadbirkor && o.status === 'DONE' ? <Button title={`To'lash — ${fmtSum(o.price)}`} loading={pay.isPending} onPress={() => pay.mutate(undefined, { onError: err })} /> : null}
        {o.status === 'PAID' ? <View style={{ alignItems: 'center' }}><Pill label="To'lov amalga oshirilgan" tone="success" icon="checkmark-circle" /></View> : null}
        <View style={{ display: 'none' }}><Avatar name="x" /></View>
      </ScrollView>
    </Screen>
  );
}
