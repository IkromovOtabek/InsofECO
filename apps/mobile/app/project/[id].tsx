import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EXPENSE_LABEL, SPECIALTY_LABEL } from '@insof/shared';
import { Button, Card, Gap, Screen, StatusChip, Txt, fmtSum } from '@/design/primitives';
import { Avatar, Breakdown, Icon, Kpi, Pill, ProgressBar, Row, Section, Segmented, daysLeft, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useAction, useProject } from '@/features/eco/api';
import { useSession } from '@/core/session';

const TABS = [{ key: 'overview', label: 'Umumiy' }, { key: 'tasks', label: 'Vazifalar' }, { key: 'team', label: 'Quruvchilar' }, { key: 'materials', label: 'Materiallar' }, { key: 'transport', label: 'Transport' }, { key: 'finance', label: 'Moliya' }, { key: 'docs', label: 'Hujjatlar' }] as const;

/** Loyiha tafsiloti — 7 bo'lim (segment). Tadbirkor tahrirlaydi, Quruvchi ko'radi. */
export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const role = useSession((s) => s.active?.role);
  const q = useProject(id);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('overview');
  const setStatus = useAction<string>((status) => ({ path: `/projects/${id}`, method: 'PATCH', body: { status } }), ['projects', 'dash']);
  const p = q.data;
  if (!p) return <Screen><Txt color="secondary">Yuklanmoqda…</Txt></Screen>;
  const dl = daysLeft(p.deadline);
  const doneTasks = p.tasks.filter((t) => t.status === 'DONE').length;
  return (
    <Screen padded={false}>
      <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}>
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}><Txt v="title" style={{ flex: 1, marginRight: 8 }}>{p.name}</Txt><StatusChip status={p.status} /></View>
          <Txt v="callout" color="secondary">{p.address}{p.clientName ? ` · ${p.clientName}` : ''}</Txt>
          <Gap h={12} />
          <ProgressBar value={p.progress} tone={p.status === 'DELAYED' ? 'warning' : p.status === 'COMPLETED' ? 'success' : 'brand'} height={10} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}><Txt v="bodyStrong">Progress: {p.progress}%</Txt><Txt v="caption" color={dl !== null && dl < 0 ? 'danger' : 'secondary'}>{dl === null ? '' : dl < 0 ? `${-dl} kun kechikdi` : `${dl} kun qoldi`}</Txt></View>
        </View>
        <View style={{ backgroundColor: c.bgCanvas, paddingHorizontal: 16, paddingBottom: 4 }}><Segmented value={tab} onChange={setTab} items={TABS as never} /></View>
        <View style={{ paddingHorizontal: 16 }}>
          {tab === 'overview' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                <Kpi label="Byudjet" value={fmtShort(p.budget)} icon="wallet" /><Kpi label="Sarflangan" value={fmtShort(p.spent)} icon="trending-down" tone={Number(p.spent) > Number(p.budget) ? 'danger' : 'warning'} />
                <Kpi label="Quruvchilar" value={String(p.members.length)} icon="people" /><Kpi label="Vazifalar" value={`${doneTasks}/${p.tasks.length}`} icon="checkbox" tone="success" />
              </View>
              <Section title="Byudjet ijrosi"><View style={{ paddingVertical: 8 }}><ProgressBar value={(Number(p.spent) / Math.max(1, Number(p.budget))) * 100} tone={Number(p.spent) > Number(p.budget) ? 'danger' : 'info'} /><Txt v="caption" color="secondary" style={{ marginTop: 6 }}>{fmtSum(p.spent)} / {fmtSum(p.budget)} · qoldiq {fmtSum(Number(p.budget) - Number(p.spent))}</Txt></View></Section>
              {p.description ? <Section title="Tavsif"><Txt v="callout" style={{ paddingVertical: 8 }}>{p.description}</Txt></Section> : null}
              <Section title="Muddatlar"><Row icon="calendar" title="Boshlanish" subtitle={p.startDate ? new Date(p.startDate).toLocaleDateString('ru-RU') : '—'} /><Row icon="flag" iconTone={dl !== null && dl < 0 ? 'danger' : 'brand'} title="Deadline" subtitle={p.deadline ? new Date(p.deadline).toLocaleDateString('ru-RU') : '—'} last /></Section>
              {role === 'TADBIRKOR' ? (<><Gap h={16} /><Button title="Holatni o'zgartirish" variant="secondary" size="md" onPress={() => Alert.alert('Holat', undefined, [{ text: 'Faol', onPress: () => setStatus.mutate('ACTIVE') }, { text: 'Kechikmoqda', onPress: () => setStatus.mutate('DELAYED') }, { text: "To'xtatish", onPress: () => setStatus.mutate('ON_HOLD') }, { text: 'Tugallandi', onPress: () => setStatus.mutate('COMPLETED') }, { text: 'Bekor', style: 'cancel' }])} /></>) : null}
            </>
          ) : null}
          {tab === 'tasks' ? (
            <Section title={`Vazifalar (${doneTasks}/${p.tasks.length})`} style={{ marginTop: 8 }}>
              {p.tasks.map((t, i, arr) => <Row key={t.id} icon={t.status === 'DONE' ? 'checkbox' : t.status === 'REVIEW' ? 'time' : 'square-outline'} iconTone={t.status === 'DONE' ? 'success' : t.status === 'REVIEW' ? 'warning' : 'brand'} title={t.title} subtitle={`${t.assignee?.fullName ?? 'Biriktirilmagan'}${t.dueDate ? ` · ${new Date(t.dueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}` : ''}`} right={<Pill label={({ LOW: 'Past', MEDIUM: "O'rta", HIGH: 'Muhim' })[t.priority]} tone={t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'neutral'} />} last={i === arr.length - 1} />)}
            </Section>
          ) : null}
          {tab === 'team' ? (
            <Section title="Quruvchilar" style={{ marginTop: 8 }}>
              {p.members.map((m, i, arr) => <Row key={m.user.id} avatarName={m.user.fullName} title={m.user.fullName ?? m.user.phone} subtitle={m.user.workerProfile ? SPECIALTY_LABEL[m.user.workerProfile.specialty as keyof typeof SPECIALTY_LABEL] : m.user.phone} onPress={() => router.push(`/worker/${m.user.id}`)} last={i === arr.length - 1} />)}
              {p.members.length === 0 ? <Txt color="secondary" style={{ padding: 12 }}>A'zolar yo'q</Txt> : null}
            </Section>
          ) : null}
          {tab === 'materials' ? (
            <Section title="Material so'rovlari" style={{ marginTop: 8 }}>
              {p.materialRequests.map((r, i, arr) => <Row key={r.id} icon="cube" iconTone={r.status === 'CONFIRMED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'} title={`${r.material.name} — ${r.quantity} ${r.material.unit}`} subtitle={`#${r.number}${r.reason ? ` · ${r.reason}` : ''}`} right={<StatusChip status={r.status} />} last={i === arr.length - 1} />)}
              {p.materialRequests.length === 0 ? <Txt color="secondary" style={{ padding: 12 }}>So'rovlar yo'q</Txt> : null}
            </Section>
          ) : null}
          {tab === 'transport' ? (
            <Section title="Yetkazib berishlar" style={{ marginTop: 8 }}>
              {p.shipments.map((s, i, arr) => <Row key={s.id} icon="bus" iconTone="info" title={`№${s.number} ${s.cargo}`} subtitle={`${s.driver?.fullName ?? 'Haydovchi yo\'q'} · ${s.vehicle?.plateNumber ?? ''}`} right={<StatusChip status={s.status} />} onPress={() => router.push(`/shipment/${s.id}`)} last={i === arr.length - 1} />)}
              {p.shipments.length === 0 ? <Txt color="secondary" style={{ padding: 12 }}>Yuklar yo'q</Txt> : null}
            </Section>
          ) : null}
          {tab === 'finance' ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}><Kpi label="Daromad" value={fmtShort(p.incomeTotal)} tone="success" /><Kpi label="Kutilmoqda" value={fmtShort(p.expectedIncome)} tone="info" /><Kpi label="Xarajat" value={fmtShort(p.spent)} tone="danger" /></View>
              <Section title="Xarajat tarkibi"><View style={{ paddingVertical: 8 }}><Breakdown rows={p.expenseByCategory.map((e) => ({ label: EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL], value: Number(e.amount) }))} /></View></Section>
              <Section title="Oxirgi xarajatlar">{p.expenses.slice(0, 15).map((e, i, arr) => <Row key={e.id} icon="arrow-up-circle" iconTone="danger" title={e.description} subtitle={`${EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL]} · ${new Date(e.date).toLocaleDateString('ru-RU')}`} right={<Txt v="bodyStrong" color="danger">−{fmtShort(e.amount)}</Txt>} last={i === arr.length - 1} />)}</Section>
            </>
          ) : null}
          {tab === 'docs' ? (
            <Section title="Hujjatlar, foto/video, hisobot" style={{ marginTop: 8 }}>
              {p.documents.map((d, i, arr) => <Row key={d.id} icon={d.kind === 'photo' ? 'image' : d.kind === 'video' ? 'videocam' : 'document-text'} iconTone={d.kind === 'photo' ? 'info' : 'brand'} title={d.name} subtitle={new Date(d.createdAt).toLocaleDateString('ru-RU')} last={i === arr.length - 1} />)}
              <Row icon="bar-chart" title="Hisobot (PDF)" subtitle="Progress, xarajat, jamoa — keyingi versiyada" last />
            </Section>
          ) : null}
        </View>
      </ScrollView>
      <View style={{ display: 'none' }}><Avatar name="x" /><Icon name="add" /><Card /></View>
    </Screen>
  );
}
