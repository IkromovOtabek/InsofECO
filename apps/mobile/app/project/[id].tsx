import React, { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EXPENSE_LABEL, SPECIALTY_LABEL } from '@insof/shared';
import { Badge, Button, EmptyState, Gap, KPICard, ListItem, Panel, ProgressBar, Screen, StatusChip, Txt, fmtDate, fmtDateFull, fmtSum } from '@/design/primitives';
import { Avatar, Breakdown, Tabs, daysLeft, fmtShort } from '@/design/ui';
import { space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { useAction, useProject } from '@/features/eco/api';
import { useSession } from '@/core/session';

const TABS = [{ key: 'overview', label: 'Umumiy' }, { key: 'tasks', label: 'Vazifalar' }, { key: 'team', label: 'Quruvchilar' }, { key: 'materials', label: 'Materiallar' }, { key: 'transport', label: 'Transport' }, { key: 'finance', label: 'Moliya' }, { key: 'docs', label: 'Hujjatlar' }] as const;
type TabKey = (typeof TABS)[number]['key'];
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Past', MEDIUM: "O'rta", HIGH: 'Muhim' };

/** Loyiha tafsiloti — 7 bo'lim (tab). Tadbirkor tahrirlaydi, Quruvchi ko'radi. */
export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const role = useSession((s) => s.active?.role);
  const q = useProject(id);
  const [tab, setTab] = useState<TabKey>('overview');
  const setStatus = useAction<string>((status) => ({ path: `/projects/${id}`, method: 'PATCH', body: { status } }), ['projects', 'dash']);
  const p = q.data;
  if (!p) {
    return (
      <Screen>
        {q.isError ? <EmptyState icon="circle-alert" title="Loyiha yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" action="Qayta urinish" onAction={() => void q.refetch()} /> : <ActivityIndicator color={c.brand} style={{ marginTop: space.xxxl }} />}
      </Screen>
    );
  }
  const dl = daysLeft(p.deadline);
  const doneTasks = p.tasks.filter((t) => t.status === 'DONE').length;
  const overBudget = Number(p.spent) > Number(p.budget);
  const kpi = { flex: 1, minWidth: '46%' as const };
  return (
    <Screen padded={false}>
      <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: space.x10 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} tintColor={c.brand} />}>
        <View style={{ padding: space.lg, paddingBottom: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}><Txt v="titleMd" style={{ flex: 1 }}>{p.name}</Txt><StatusChip status={p.status} /></View>
          <Txt v="body" color="muted">{p.address}{p.clientName ? ` · ${p.clientName}` : ''}</Txt>
          <Gap h={space.md} />
          <ProgressBar value={p.progress} tone={p.status === 'DELAYED' ? 'warning' : p.status === 'COMPLETED' ? 'success' : 'brand'} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm }}>
            <Txt v="bodyStrong">Progress: {p.progress}%</Txt>
            {dl === null ? null : dl < 0 ? <Badge tone="danger" icon="clock" label={`${-dl} kun kechikdi`} /> : <Badge tone="neutral" icon="calendar-days" label={`${dl} kun qoldi`} />}
          </View>
        </View>
        <View style={{ backgroundColor: c.bgApp, paddingHorizontal: space.lg, paddingBottom: space.xs }}><Tabs value={tab} onChange={setTab} items={TABS.map((t) => ({ key: t.key, label: t.label }))} /></View>
        <View style={{ paddingHorizontal: space.lg }}>
          {tab === 'overview' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm }}>
                <KPICard label="Byudjet" value={fmtShort(p.budget)} icon="wallet" style={kpi} />
                <KPICard label="Sarflangan" value={fmtShort(p.spent)} icon="trending-down" tone={overBudget ? 'danger' : 'warning'} style={kpi} />
                <KPICard label="Quruvchilar" value={String(p.members.length)} icon="users" style={kpi} />
                <KPICard label="Vazifalar" value={`${doneTasks}/${p.tasks.length}`} icon="square-check" tone="success" style={kpi} />
              </View>
              <Panel title="Byudjet ijrosi" icon="chart-pie">
                <View style={{ paddingVertical: space.sm }}>
                  <ProgressBar value={(Number(p.spent) / Math.max(1, Number(p.budget))) * 100} tone={overBudget ? 'danger' : 'info'} />
                  <Txt v="caption" style={{ marginTop: space.sm }}>{fmtSum(p.spent)} / {fmtSum(p.budget)} · qoldiq {fmtSum(Number(p.budget) - Number(p.spent))}</Txt>
                </View>
              </Panel>
              {p.description ? <Panel title="Tavsif" icon="file-text"><Txt v="body" style={{ paddingVertical: space.sm }}>{p.description}</Txt></Panel> : null}
              <Panel title="Muddatlar" icon="calendar-days">
                <ListItem icon="calendar-days" title="Boshlanish" subtitle={p.startDate ? fmtDateFull(p.startDate) : '—'} />
                <ListItem icon="flag" tone={dl !== null && dl < 0 ? 'danger' : 'brand'} title="Deadline" subtitle={p.deadline ? fmtDateFull(p.deadline) : '—'} last />
              </Panel>
              {role === 'TADBIRKOR' ? (<><Gap h={space.lg} /><Button title="Holatni o'zgartirish" variant="secondary" size="md" icon="refresh-cw" onPress={() => Alert.alert('Holat', undefined, [{ text: 'Faol', onPress: () => setStatus.mutate('ACTIVE') }, { text: 'Kechikmoqda', onPress: () => setStatus.mutate('DELAYED') }, { text: "To'xtatish", onPress: () => setStatus.mutate('ON_HOLD') }, { text: 'Tugallandi', onPress: () => setStatus.mutate('COMPLETED') }, { text: 'Bekor', style: 'cancel' }])} /></>) : null}
            </>
          ) : null}
          {tab === 'tasks' ? (
            <Panel title={`Vazifalar (${doneTasks}/${p.tasks.length})`} icon="clipboard-list" style={{ marginTop: space.sm }}>
              {p.tasks.length === 0 ? <EmptyState icon="clipboard-list" title="Vazifalar yo'q" hint="Yangi vazifa qo'shilganda shu yerda ko'rinadi" /> : null}
              {p.tasks.map((t, i, arr) => <ListItem key={t.id} icon={t.status === 'DONE' ? 'square-check' : t.status === 'REVIEW' ? 'clock' : 'circle'} tone={t.status === 'DONE' ? 'success' : t.status === 'REVIEW' ? 'warning' : 'brand'} title={t.title} subtitle={`${t.assignee?.fullName ?? 'Biriktirilmagan'}${t.dueDate ? ` · ${fmtDate(t.dueDate)}` : ''}`} right={<Badge label={PRIORITY_LABEL[t.priority] ?? t.priority} tone={t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'neutral'} icon={null} />} last={i === arr.length - 1} />)}
            </Panel>
          ) : null}
          {tab === 'team' ? (
            <Panel title="Quruvchilar" icon="users" style={{ marginTop: space.sm }}>
              {p.members.map((m, i, arr) => <ListItem key={m.user.id} leading={<Avatar name={m.user.fullName} />} title={m.user.fullName ?? m.user.phone} subtitle={m.user.workerProfile ? SPECIALTY_LABEL[m.user.workerProfile.specialty as keyof typeof SPECIALTY_LABEL] : m.user.phone} onPress={() => router.push(`/worker/${m.user.id}`)} last={i === arr.length - 1} />)}
              {p.members.length === 0 ? <EmptyState icon="users" title="A'zolar yo'q" hint="Quruvchi biriktirilganda shu yerda ko'rinadi" /> : null}
            </Panel>
          ) : null}
          {tab === 'materials' ? (
            <Panel title="Material so'rovlari" icon="package" style={{ marginTop: space.sm }}>
              {p.materialRequests.map((r, i, arr) => <ListItem key={r.id} icon="package" tone={r.status === 'CONFIRMED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'} title={`${r.material.name} — ${r.quantity} ${r.material.unit}`} subtitle={`#${r.number}${r.reason ? ` · ${r.reason}` : ''}`} right={<StatusChip status={r.status} />} last={i === arr.length - 1} />)}
              {p.materialRequests.length === 0 ? <EmptyState icon="package" title="So'rovlar yo'q" hint="Quruvchi material so'raganda shu yerda ko'rinadi" /> : null}
            </Panel>
          ) : null}
          {tab === 'transport' ? (
            <Panel title="Yetkazib berishlar" icon="truck" style={{ marginTop: space.sm }}>
              {p.shipments.map((s, i, arr) => <ListItem key={s.id} icon="truck" module="logistics" title={`№${s.number} ${s.cargo}`} subtitle={`${s.driver?.fullName ?? 'Haydovchi yo\'q'} · ${s.vehicle?.plateNumber ?? ''}`} right={<StatusChip status={s.status} />} onPress={() => router.push(`/shipment/${s.id}`)} last={i === arr.length - 1} />)}
              {p.shipments.length === 0 ? <EmptyState icon="truck" title="Yuklar yo'q" hint="Material yetkazish rejalashtirilganda shu yerda ko'rinadi" /> : null}
            </Panel>
          ) : null}
          {tab === 'finance' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm }}>
                <KPICard label="Daromad" value={fmtShort(p.incomeTotal)} icon="trending-up" tone="success" style={kpi} />
                <KPICard label="Kutilmoqda" value={fmtShort(p.expectedIncome)} icon="hourglass" style={kpi} />
                <KPICard label="Xarajat" value={fmtShort(p.spent)} icon="trending-down" tone="danger" style={kpi} />
              </View>
              <Panel title="Xarajat tarkibi" icon="chart-pie"><View style={{ paddingVertical: space.sm }}><Breakdown rows={p.expenseByCategory.map((e) => ({ label: EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL], value: Number(e.amount) }))} /></View></Panel>
              <Panel title="Oxirgi xarajatlar" icon="receipt">
                {p.expenses.length === 0 ? <EmptyState icon="receipt" title="Xarajatlar yo'q" /> : null}
                {p.expenses.slice(0, 15).map((e, i, arr) => <ListItem key={e.id} icon="circle-arrow-up" tone="danger" title={e.description} subtitle={`${EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL]} · ${fmtDateFull(e.date)}`} right={<Txt v="bodyStrong" color="danger">−{fmtShort(e.amount)}</Txt>} last={i === arr.length - 1} />)}
              </Panel>
            </>
          ) : null}
          {tab === 'docs' ? (
            <Panel title="Hujjatlar, foto/video, hisobot" icon="files" style={{ marginTop: space.sm }}>
              {p.documents.map((d) => <ListItem key={d.id} icon={d.kind === 'photo' || d.kind === 'video' ? 'image' : 'file-text'} tone={d.kind === 'photo' ? 'info' : 'brand'} title={d.name} subtitle={fmtDateFull(d.createdAt)} />)}
              <ListItem icon="chart-column" tone="neutral" title="Hisobot (PDF)" subtitle="Progress, xarajat, jamoa — keyingi versiyada" last />
            </Panel>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
