import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SPECIALTY_LABEL } from '@insof/shared';
import { ListGroup, Reveal, SectionHead, SkeletonList, StickyActionBar, StickyPrimary } from '@/design/blocks';
import { Badge, Button, Card, EmptyState, IconTile, Input, KVList, ListItem, Screen, Timeline, Txt, fmtDateFull, fmtNum, fmtSum, statusLabel, statusTone } from '@/design/primitives';
import { dialog, Avatar, IconName, Stars, daysLeft, toast } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { useAction, useWorkOrder, useWorkers } from '@/features/eco/api';
import { useSession } from '@/core/session';

const FLOW = ['NEW', 'ACCEPTED', 'WORKER_ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'PAID'];
const FLOW_LABEL: Record<string, string> = { NEW: 'Yangi', ACCEPTED: 'Qabul qilindi', WORKER_ASSIGNED: 'Quruvchi biriktirildi', IN_PROGRESS: 'Jarayonda', REVIEW: 'Tekshiruv', DONE: 'Tugallandi', PAID: "To'lov olindi" };

/**
 * Ish buyurtmasi: sarlavha kartasi (raqam, holat, to'lov, bosqich) → tafsilotlar → quruvchi → topshirilgan ish;
 * rolga va holatga qarab bitta asosiy amal pastki panelda.
 */
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
      <Screen padded={false}>
        {q.isError ? <EmptyState icon="circle-alert" title="Ish buyurtmasi yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} /> : (
          <Reveal loading skeleton={<SkeletonList rows={4} />} style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>{null}</Reveal>
        )}
      </Screen>
    );
  }
  const idx = FLOW.indexOf(o.status); const dl = daysLeft(o.deadline);
  const isTadbirkor = role === 'TADBIRKOR'; const isWorker = role === 'QURUVCHI';
  const freeWorkers = (workers.data ?? []).filter((w) => !w.activeWork).slice(0, 8);
  const late = dl !== null && dl < 0 && idx < 5;

  // Pastki panel: rol va holatga qarab bitta asosiy amal.
  let bar: { primary: StickyPrimary; secondary?: { title: string; icon?: IconName; onPress: () => void } } | null = null;
  if (isTadbirkor && o.status === 'NEW') {
    bar = {
      primary: { title: 'Qabul qilish', icon: 'check', loading: accept.isPending, onPress: () => accept.mutate(undefined, { onError: err }) },
      secondary: { title: 'Bekor', icon: 'x', onPress: () => dialog('Bekor qilish', 'Ish buyurtmasi bekor qilinadi. Davom etasizmi?', [{ text: "Yo'q", style: 'cancel' }, { text: 'Ha', style: 'destructive', onPress: () => cancel.mutate(undefined, { onError: err }) }], { tone: 'danger', icon: 'circle-x' }) },
    };
  } else if (isWorker && ['ACCEPTED', 'WORKER_ASSIGNED'].includes(o.status)) {
    bar = { primary: { title: o.status === 'ACCEPTED' ? 'Qabul qilish va boshlash' : 'Ishni boshlash', icon: 'hammer', loading: start.isPending, onPress: () => start.mutate(undefined, { onError: err }) } };
  } else if (isWorker && o.status === 'IN_PROGRESS') {
    bar = { primary: { title: 'Ishni topshirish', icon: 'check-check', variant: 'success', loading: submit.isPending, onPress: () => submit.mutate(undefined, { onError: err }) } };
  } else if (isTadbirkor && o.status === 'REVIEW') {
    bar = {
      primary: { title: 'Qabul va baho', icon: 'star', loading: review.isPending, onPress: () => dialog('Baho', 'Quruvchini baholang', [...[5, 4, 3].map((r) => ({ text: `${r} yulduz`, onPress: () => review.mutate({ approve: true, rating: r }, { onError: err }) })), { text: 'Bekor', style: 'cancel' as const }]) },
      secondary: { title: 'Qayta ishlash', icon: 'refresh-cw', onPress: () => review.mutate({ approve: false }, { onError: err }) },
    };
  } else if (isTadbirkor && o.status === 'DONE') {
    bar = { primary: { title: `To'lash — ${fmtSum(o.price)}`, icon: 'wallet', variant: 'success', loading: pay.isPending, onPress: () => pay.mutate(undefined, { onError: err }) } };
  }

  const details: { label: string; value: string; tone?: 'danger' }[] = [
    { label: 'Loyiha', value: o.project?.name ?? 'Loyihasiz' },
    ...(o.description ? [{ label: 'Vazifa', value: o.description }] : []),
    { label: 'Manzil', value: o.address },
    { label: 'Muddat', value: `${fmtDateFull(o.deadline)}${dl === null || idx >= 5 ? '' : dl < 0 ? ` · ${-dl} kun kechikdi` : ` · ${dl} kun qoldi`}`, tone: late ? 'danger' : undefined },
  ];
  const steps = o.status === 'CANCELLED'
    ? [{ title: FLOW_LABEL.NEW!, state: 'done' as const }, { title: 'Bekor qilindi', state: 'now' as const }]
    : FLOW.map((f, i) => ({ title: FLOW_LABEL[f] ?? f, state: (i < idx || (i === idx && f === 'PAID') ? 'done' : i === idx ? 'now' : 'todo') as 'done' | 'now' | 'todo', sub: i === idx && f !== 'PAID' ? 'Joriy bosqich' : undefined }));

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
          <Reveal>
            <Card style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                <Txt v="overline" numberOfLines={1} style={{ flex: 1 }}>{`Ish №${o.number} · ${o.title}`}</Txt>
                <Badge label={statusLabel(o.status)} tone={statusTone(o.status)} />
              </View>
              <Txt v="metric" numberOfLines={1} adjustsFontSizeToFit>
                {fmtNum(Math.round(Number(o.price)))}
                <Txt v="tSm">{" so'm"}</Txt>
              </Txt>
              <Txt v="tSm" numberOfLines={2}>{`${o.project?.name ?? 'Loyihasiz'} · ${fmtDateFull(o.createdAt)}`}</Txt>
            </Card>

            <KVList rows={details} />

            <SectionHead title="Jarayon" />
            <Card><Timeline steps={steps} /></Card>

            {o.worker ? [
              <SectionHead key="wh" title="Quruvchi" />,
              <ListGroup key="wl">
                <ListItem
                  leading={<Avatar name={o.worker.fullName} />} title={o.worker.fullName ?? o.worker.phone}
                  subtitle={o.worker.workerProfile ? SPECIALTY_LABEL[o.worker.workerProfile.specialty as keyof typeof SPECIALTY_LABEL] : undefined}
                  right={o.worker.workerProfile ? <Stars value={o.worker.workerProfile.ratingAvg} /> : undefined}
                  onPress={isTadbirkor ? () => router.push(`/worker/${o.worker!.id}`) : undefined}
                />
              </ListGroup>,
            ] : null}

            {isTadbirkor && o.status === 'ACCEPTED' ? [
              <SectionHead key="ah" title="Quruvchi biriktirish" />,
              <Txt key="at" v="tSm">Bo&apos;sh qolsa — ochiq buyurtma, quruvchilar o&apos;zi oladi</Txt>,
              <ListGroup key="al">
                {freeWorkers.length === 0 ? <EmptyState compact icon="users" title="Bo'sh quruvchi yo'q" hint="Hozir hammasi band — buyurtma ochiq qoladi" /> : freeWorkers.map((w) => (
                  <ListItem
                    key={w.userId} leading={<Avatar name={w.fullName} />} title={w.fullName ?? ''}
                    subtitle={w.profile ? SPECIALTY_LABEL[w.profile.specialty as keyof typeof SPECIALTY_LABEL] : undefined}
                    right={w.profile ? <Stars value={w.profile.ratingAvg} /> : undefined}
                    onPress={assign.isPending ? undefined : () => assign.mutate(w.userId, { onError: err })}
                  />
                ))}
              </ListGroup>,
            ] : null}

            {(o.photoKeys.length || o.workerComment || o.reviewComment) ? [
              <SectionHead key="ph" title="Topshirilgan ish" />,
              <Card key="pc" style={{ gap: space.sm }}>
                {o.photoKeys.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{o.photoKeys.map((k) => <IconTile key={k} icon="image" tone="neutral" size={size.driverTouch + space.sm} />)}</View> : null}
                {o.workerComment ? <Txt v="body">{o.workerComment}</Txt> : null}
                {o.reviewComment ? <Txt v="body" color="muted">{`Tadbirkor: ${o.reviewComment}`}</Txt> : null}
              </Card>,
            ] : null}

            {isWorker && o.status === 'IN_PROGRESS' ? [
              <SectionHead key="sh" title="Ishni topshirish" />,
              <Card key="sc" style={{ gap: space.md }}>
                <Button title="Foto yuklash" icon="camera" variant="secondary" onPress={() => dialog('Foto', 'Kamera — presigned S3 (keyingi versiya). Demo foto biriktiriladi.')} />
                <Input label="Izoh" value={comment} onChangeText={setComment} placeholder="Nima qilindi, nimaga e'tibor berish kerak" multiline containerStyle={{ marginBottom: 0 }} />
              </Card>,
            ] : null}

            {isTadbirkor && o.status === 'REVIEW' ? [
              <SectionHead key="rh" title="Tekshiruv" />,
              <Card key="rc">
                <Input label="Izoh (ixtiyoriy)" value={comment} onChangeText={setComment} placeholder="Quruvchiga izoh" multiline containerStyle={{ marginBottom: 0 }} />
              </Card>,
            ] : null}
          </Reveal>
        </ScrollView>

        {bar ? <StickyActionBar primary={bar.primary} secondary={bar.secondary} /> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
