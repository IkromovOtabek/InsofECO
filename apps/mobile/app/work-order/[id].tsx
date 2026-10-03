import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SPECIALTY_LABEL } from '@insof/shared';
import { ListGroup, SectionHead, StickyActionBar, StickyPrimary } from '@/design/blocks';
import { Badge, Button, Card, EmptyState, Gap, IconTile, Input, ListItem, ProgressBar, Screen, StatusChip, Txt, fmtDateFull, fmtSum } from '@/design/primitives';
import { dialog, Avatar, IconName, Stars, daysLeft, toast } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { useAction, useWorkOrder, useWorkers } from '@/features/eco/api';
import { useSession } from '@/core/session';
import { Loader } from '@/design/loader';

const FLOW = ['NEW', 'ACCEPTED', 'WORKER_ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'PAID'];
const FLOW_LABEL: Record<string, string> = { NEW: 'Yangi', ACCEPTED: 'Qabul qilindi', WORKER_ASSIGNED: 'Quruvchi biriktirildi', IN_PROGRESS: 'Jarayonda', REVIEW: 'Tekshiruv', DONE: 'Tugallandi', PAID: "To'lov olindi" };

/** Kalit — qiymat qatori (ListGroup ichida; birinchisidan keyin ichki chiziq). */
function KV({ k, v, first, tone }: { k: string; v: string; first?: boolean; tone?: 'brand' | 'danger' }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row, paddingVertical: space.sm, paddingHorizontal: space.card }}>
      {first ? null : <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: space.card, right: space.md, height: size.hairline, backgroundColor: c.borderSubtle }} />}
      <Txt v="bodySm" color="muted" style={{ flexShrink: 0 }}>{k}</Txt>
      <Txt v={tone ? 'bodyStrong' : 'body'} color={tone ?? 'strong'} align="right" style={{ flex: 1 }}>{v}</Txt>
    </View>
  );
}

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
      <Screen>
        {q.isError ? <EmptyState icon="circle-alert" title="Ish buyurtmasi yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} /> : <Loader style={{ marginTop: space.xxxl }} />}
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

  const details: [string, string, ('brand' | 'danger')?][] = [
    ['Loyiha', o.project?.name ?? 'Loyihasiz'],
    ['Vazifa', o.description ?? '—'],
    ['Manzil', o.address],
    ['Muddat', `${fmtDateFull(o.deadline)}${dl === null || idx >= 5 ? '' : dl < 0 ? ` · ${-dl} kun kechikdi` : ` · ${dl} kun qoldi`}`, late ? 'danger' : undefined],
    ["To'lov", fmtSum(o.price), 'brand'],
  ];

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
          <Card style={{ padding: space.panel }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Txt v="overline" numberOfLines={1} style={{ flex: 1 }}>{`Ish №${o.number}`}</Txt>
              <StatusChip status={o.status} />
            </View>
            <Txt v="titleLg" style={{ marginTop: space.xs }}>{o.title}</Txt>
            <Gap h={space.md} />
            <Txt v="caption">To&apos;lov</Txt>
            <Txt v="metric" color="brand" numberOfLines={1} adjustsFontSizeToFit>{fmtSum(o.price)}</Txt>
            {o.status === 'CANCELLED' ? (
              <Badge label="Bekor qilingan" tone="danger" icon="circle-x" style={{ alignSelf: 'flex-start', marginTop: space.md }} />
            ) : (
              <>
                <Gap h={space.md} />
                <ProgressBar value={((idx + 1) / FLOW.length) * 100} tone={o.status === 'PAID' ? 'success' : 'brand'} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm, gap: space.sm }}>
                  <Txt v="caption">{`Bosqich ${idx + 1} / ${FLOW.length}`}</Txt>
                  <Txt v="caption" color={o.status === 'PAID' ? 'success' : 'brand'} numberOfLines={1}>{FLOW_LABEL[o.status] ?? o.status}</Txt>
                </View>
                {idx >= 0 && idx < FLOW.length - 1 ? <Txt v="caption" color="muted" style={{ marginTop: space.xs }}>{`Keyingi: ${FLOW_LABEL[FLOW[idx + 1]!]}`}</Txt> : null}
              </>
            )}
          </Card>

          <Gap h={space.section} />
          <SectionHead title="Tafsilotlar" />
          <ListGroup>
            {details.map(([k, v, tone], i) => <KV key={k} k={k} v={v} tone={tone} first={i === 0} />)}
          </ListGroup>

          {o.worker ? (
            <>
              <Gap h={space.section} />
              <SectionHead title="Quruvchi" icon="hard-hat" />
              <ListGroup>
                <ListItem
                  leading={<Avatar name={o.worker.fullName} />} title={o.worker.fullName ?? o.worker.phone}
                  subtitle={o.worker.workerProfile ? SPECIALTY_LABEL[o.worker.workerProfile.specialty as keyof typeof SPECIALTY_LABEL] : undefined}
                  right={o.worker.workerProfile ? <Stars value={o.worker.workerProfile.ratingAvg} /> : undefined}
                  onPress={isTadbirkor ? () => router.push(`/worker/${o.worker!.id}`) : undefined}
                />
              </ListGroup>
            </>
          ) : null}

          {isTadbirkor && o.status === 'ACCEPTED' ? (
            <>
              <Gap h={space.section} />
              <SectionHead title="Quruvchi biriktirish" icon="users" />
              <Txt v="caption" color="muted" style={{ marginBottom: space.sm }}>Bo&apos;sh qolsa — ochiq buyurtma, quruvchilar o&apos;zi oladi</Txt>
              <ListGroup>
                {freeWorkers.length === 0 ? <EmptyState compact icon="users" title="Bo'sh quruvchi yo'q" hint="Hozir hammasi band — buyurtma ochiq qoladi" /> : freeWorkers.map((w) => (
                  <ListItem
                    key={w.userId} leading={<Avatar name={w.fullName} />} title={w.fullName ?? ''}
                    subtitle={w.profile ? SPECIALTY_LABEL[w.profile.specialty as keyof typeof SPECIALTY_LABEL] : undefined}
                    right={w.profile ? <Stars value={w.profile.ratingAvg} /> : undefined}
                    onPress={assign.isPending ? undefined : () => assign.mutate(w.userId, { onError: err })}
                  />
                ))}
              </ListGroup>
            </>
          ) : null}

          {(o.photoKeys.length || o.workerComment || o.reviewComment) ? (
            <>
              <Gap h={space.section} />
              <SectionHead title="Topshirilgan ish" icon="image" />
              <Card>
                {o.photoKeys.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{o.photoKeys.map((k) => <IconTile key={k} icon="image" tone="neutral" size={size.driverTouch + space.sm} />)}</View> : null}
                {o.workerComment ? <Txt v="body" style={{ marginTop: o.photoKeys.length ? space.sm : 0 }}>{o.workerComment}</Txt> : null}
                {o.reviewComment ? <Txt v="body" color="muted" style={{ marginTop: space.sm }}>{`Tadbirkor: ${o.reviewComment}`}</Txt> : null}
              </Card>
            </>
          ) : null}

          {isWorker && o.status === 'IN_PROGRESS' ? (
            <>
              <Gap h={space.section} />
              <SectionHead title="Ishni topshirish" icon="camera" />
              <Card>
                <Button title="Foto yuklash" icon="camera" variant="secondary" onPress={() => dialog('Foto', 'Kamera — presigned S3 (keyingi versiya). Demo foto biriktiriladi.')} />
                <Gap h={space.md} />
                <Input label="Izoh" value={comment} onChangeText={setComment} placeholder="Nima qilindi, nimaga e'tibor berish kerak" multiline containerStyle={{ marginBottom: 0 }} />
              </Card>
            </>
          ) : null}

          {isTadbirkor && o.status === 'REVIEW' ? (
            <>
              <Gap h={space.section} />
              <SectionHead title="Tekshiruv" icon="clipboard-check" />
              <Card>
                <Input label="Izoh (ixtiyoriy)" value={comment} onChangeText={setComment} placeholder="Quruvchiga izoh" multiline containerStyle={{ marginBottom: 0 }} />
              </Card>
            </>
          ) : null}

          {o.status === 'PAID' ? (
            <View style={{ alignItems: 'center', marginTop: space.section }}><Badge label="To'lov amalga oshirilgan" tone="success" icon="circle-check" /></View>
          ) : null}
        </ScrollView>

        {bar ? <StickyActionBar primary={bar.primary} secondary={bar.secondary} /> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
