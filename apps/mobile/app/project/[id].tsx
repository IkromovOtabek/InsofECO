import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EXPENSE_LABEL, SPECIALTY_LABEL } from '@insof/shared';
import { BreakdownCard, ChipGroup, KpiGrid, ListGroup, ProgressCard, SectionHead, StickyActionBar } from '@/design/blocks';
import { Badge, Card, EmptyState, Gap, ListItem, ProgressBar, Screen, StatusChip, Txt, fmtDate, fmtDateFull, fmtSum } from '@/design/primitives';
import { dialog, Avatar, daysLeft, fmtShort, toast } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Loader } from '@/design/loader';
import { useAction, useProject } from '@/features/eco/api';
import { useSession } from '@/core/session';

const TABS = [{ key: 'overview', label: 'Umumiy' }, { key: 'tasks', label: 'Vazifalar' }, { key: 'team', label: 'Quruvchilar' }, { key: 'materials', label: 'Materiallar' }, { key: 'transport', label: 'Transport' }, { key: 'finance', label: 'Moliya' }, { key: 'docs', label: 'Hujjatlar' }] as const;
type TabKey = (typeof TABS)[number]['key'];
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Past', MEDIUM: "O'rta", HIGH: 'Muhim' };

/** Kalit — qiymat qatori (ListGroup ichida; birinchisidan keyin ichki chiziq). */
function KV({ k, v, first, tone }: { k: string; v: string; first?: boolean; tone?: 'danger' }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row, paddingVertical: space.sm, paddingHorizontal: space.card }}>
      {first ? null : <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: space.card, right: space.md, height: size.hairline, backgroundColor: c.borderSubtle }} />}
      <Txt v="bodySm" color="muted" style={{ flexShrink: 0 }}>{k}</Txt>
      <Txt v="body" color={tone ?? 'strong'} align="right" style={{ flex: 1 }}>{v}</Txt>
    </View>
  );
}

/**
 * Loyiha tafsiloti — sarlavha kartasi (nom, holat, progress, muddat) → bo'lim chiplari (7 ta) → bo'lim.
 * Tadbirkor holatni pastki paneldan o'zgartiradi; Quruvchi faqat ko'radi.
 */
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
        {q.isError ? <EmptyState icon="circle-alert" title="Loyiha yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} /> : <Loader style={{ marginTop: space.xxxl }} />}
      </Screen>
    );
  }
  const dl = daysLeft(p.deadline);
  const doneTasks = p.tasks.filter((t) => t.status === 'DONE').length;
  const budget = Number(p.budget);
  const spent = Number(p.spent);
  const overBudget = spent > budget;
  const change = (status: string) => setStatus.mutate(status, { onSuccess: () => toast.success('Holat yangilandi'), onError: (e) => toast.error(e.message, 'Xato') });

  return (
    <Screen padded={false}>
      <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: space.xxl }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>
          <Card style={{ padding: space.panel }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
              <Txt v="overline" numberOfLines={1} style={{ flex: 1 }}>{p.clientName ?? 'Loyiha'}</Txt>
              <StatusChip status={p.status} />
            </View>
            <Txt v="titleLg" style={{ marginTop: space.xs }}>{p.name}</Txt>
            <Txt v="bodySm" color="muted">{p.address}</Txt>
            <Gap h={space.md} />
            <ProgressBar value={p.progress} tone={p.status === 'DELAYED' ? 'warning' : p.status === 'COMPLETED' ? 'success' : 'brand'} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm, gap: space.sm }}>
              <Txt v="bodyStrong">{p.progress}% bajarildi</Txt>
              {dl === null ? null : dl < 0 ? <Badge tone="danger" icon="clock" label={`${-dl} kun kechikdi`} /> : <Badge tone="neutral" icon="calendar-days" label={`${dl} kun qoldi`} />}
            </View>
          </Card>
        </View>
        <View style={{ backgroundColor: c.bgApp, paddingHorizontal: space.pageX, paddingVertical: space.sm }}>
          <ChipGroup items={TABS.map((t) => ({ key: t.key, label: t.label }))} value={tab} onChange={setTab} />
        </View>
        <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>
          {tab === 'overview' ? (
            <>
              <KpiGrid items={[
                { label: 'Byudjet', value: fmtShort(budget), icon: 'wallet', module: 'brand' },
                { label: 'Sarflangan', value: fmtShort(spent), icon: 'trending-down', tone: overBudget ? 'danger' : undefined, delta: budget ? { text: `${Math.round((spent / budget) * 100)}%`, tone: overBudget ? 'danger' : 'warning' } : undefined, onPress: () => setTab('finance') },
                { label: 'Quruvchilar', value: p.members.length, icon: 'users', module: 'production', onPress: () => setTab('team') },
                { label: 'Vazifalar', value: `${doneTasks}/${p.tasks.length}`, icon: 'square-check', module: 'production', onPress: () => setTab('tasks') },
              ]} />
              {budget > 0 ? (
                <>
                  <Gap h={space.grid} />
                  <ProgressCard title="Byudjet ijrosi" value={Math.min(100, Math.round((spent / budget) * 100))} tone={overBudget ? 'danger' : 'info'} caption={`${fmtSum(spent)} / ${fmtSum(budget)} · qoldiq ${fmtSum(budget - spent)}`} />
                </>
              ) : null}
              <Gap h={space.section} />
              <SectionHead title="Ma'lumot" />
              <ListGroup>
                <KV first k="Boshlanish" v={p.startDate ? fmtDateFull(p.startDate) : '—'} />
                <KV k="Muddat" v={p.deadline ? fmtDateFull(p.deadline) : '—'} tone={dl !== null && dl < 0 ? 'danger' : undefined} />
                {p.clientName ? <KV k="Buyurtmachi" v={p.clientName} /> : null}
                <KV k="Manzil" v={p.address} />
              </ListGroup>
              {p.description ? (
                <>
                  <Gap h={space.section} />
                  <SectionHead title="Tavsif" />
                  <Card><Txt v="body">{p.description}</Txt></Card>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'tasks' ? (
            <>
              <SectionHead title="Vazifalar" count={p.tasks.length || undefined} />
              {p.tasks.length ? (
                <ListGroup>
                  {p.tasks.map((t) => <ListItem key={t.id} icon={t.status === 'DONE' ? 'square-check' : t.status === 'REVIEW' ? 'clock' : 'circle'} tone={t.status === 'DONE' ? 'success' : t.status === 'REVIEW' ? 'warning' : 'brand'} title={t.title} subtitle={`${t.assignee?.fullName ?? 'Biriktirilmagan'}${t.dueDate ? ` · ${fmtDate(t.dueDate)}` : ''}`} right={<Badge label={PRIORITY_LABEL[t.priority] ?? t.priority} tone={t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'neutral'} icon={null} />} />)}
                </ListGroup>
              ) : <ListGroup><EmptyState compact icon="clipboard-list" title="Vazifalar yo'q" hint="Yangi vazifa qo'shilganda shu yerda ko'rinadi" /></ListGroup>}
            </>
          ) : null}

          {tab === 'team' ? (
            <>
              <SectionHead title="Quruvchilar" count={p.members.length || undefined} />
              {p.members.length ? (
                <ListGroup>
                  {p.members.map((m) => <ListItem key={m.user.id} leading={<Avatar name={m.user.fullName} />} title={m.user.fullName ?? m.user.phone} subtitle={m.user.workerProfile ? SPECIALTY_LABEL[m.user.workerProfile.specialty as keyof typeof SPECIALTY_LABEL] : m.user.phone} onPress={() => router.push(`/worker/${m.user.id}`)} />)}
                </ListGroup>
              ) : <ListGroup><EmptyState compact icon="users" title="A'zolar yo'q" hint="Quruvchi biriktirilganda shu yerda ko'rinadi" /></ListGroup>}
            </>
          ) : null}

          {tab === 'materials' ? (
            <>
              <SectionHead title="Material so'rovlari" count={p.materialRequests.length || undefined} />
              {p.materialRequests.length ? (
                <ListGroup>
                  {p.materialRequests.map((r) => <ListItem key={r.id} icon="package" tone={r.status === 'CONFIRMED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'} title={`${r.material.name} — ${r.quantity} ${r.material.unit}`} subtitle={`№${r.number}${r.reason ? ` · ${r.reason}` : ''}`} right={<StatusChip status={r.status} />} />)}
                </ListGroup>
              ) : <ListGroup><EmptyState compact icon="package" title="So'rovlar yo'q" hint="Quruvchi material so'raganda shu yerda ko'rinadi" /></ListGroup>}
            </>
          ) : null}

          {tab === 'transport' ? (
            <>
              <SectionHead title="Yetkazib berishlar" count={p.shipments.length || undefined} />
              {p.shipments.length ? (
                <ListGroup>
                  {p.shipments.map((s) => <ListItem key={s.id} icon="truck" module="logistics" title={`№${s.number} ${s.cargo}`} subtitle={`${s.driver?.fullName ?? "Haydovchi yo'q"} · ${s.vehicle?.plateNumber ?? ''}`} right={<StatusChip status={s.status} />} onPress={() => router.push(`/shipment/${s.id}`)} />)}
                </ListGroup>
              ) : <ListGroup><EmptyState compact icon="truck" title="Yuklar yo'q" hint="Material yetkazish rejalashtirilganda shu yerda ko'rinadi" /></ListGroup>}
            </>
          ) : null}

          {tab === 'finance' ? (
            <>
              <KpiGrid items={[
                { label: 'Daromad', value: fmtShort(p.incomeTotal), icon: 'trending-up', module: 'brand', tone: 'success' },
                { label: 'Kutilmoqda', value: fmtShort(p.expectedIncome), icon: 'hourglass', module: 'brand' },
                { label: 'Xarajat', value: fmtShort(p.spent), icon: 'trending-down', tone: 'danger' },
                { label: 'Qoldiq byudjet', value: fmtShort(budget - spent), icon: 'wallet', tone: overBudget ? 'danger' : undefined },
              ]} />
              {p.expenseByCategory.length ? (
                <><Gap h={space.grid} /><BreakdownCard title="Xarajat tarkibi" unit="so'm" items={p.expenseByCategory.map((e) => ({ label: EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL] ?? e.category, value: Number(e.amount) }))} /></>
              ) : null}
              <Gap h={space.section} />
              <SectionHead title="Oxirgi xarajatlar" />
              {p.expenses.length ? (
                <ListGroup>
                  {p.expenses.slice(0, 15).map((e) => <ListItem key={e.id} icon="circle-arrow-up" tone="danger" title={e.description} subtitle={`${EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL] ?? e.category} · ${fmtDateFull(e.date)}`} right={<Txt v="bodyStrong" color="danger">−{fmtShort(e.amount)}</Txt>} />)}
                </ListGroup>
              ) : <ListGroup><EmptyState compact icon="receipt" title="Xarajatlar yo'q" /></ListGroup>}
            </>
          ) : null}

          {tab === 'docs' ? (
            <>
              <SectionHead title="Hujjatlar, foto/video" count={p.documents.length || undefined} />
              <ListGroup>
                {p.documents.map((d) => <ListItem key={d.id} icon={d.kind === 'photo' || d.kind === 'video' ? 'image' : 'file-text'} tone={d.kind === 'photo' ? 'info' : 'brand'} title={d.name} subtitle={fmtDateFull(d.createdAt)} />)}
                <ListItem icon="chart-column" tone="neutral" title="Hisobot (PDF)" subtitle="Progress, xarajat, jamoa — keyingi versiyada" />
              </ListGroup>
            </>
          ) : null}
        </View>
      </ScrollView>

      {role === 'TADBIRKOR' ? (
        <StickyActionBar
          primary={{
            title: "Holatni o'zgartirish", icon: 'refresh-cw', loading: setStatus.isPending,
            onPress: () => dialog('Loyiha holati', undefined, [{ text: 'Faol', onPress: () => change('ACTIVE') }, { text: 'Kechikmoqda', onPress: () => change('DELAYED') }, { text: "To'xtatish", onPress: () => change('ON_HOLD') }, { text: 'Tugallandi', onPress: () => change('COMPLETED') }, { text: 'Bekor', style: 'cancel' }]),
          }}
        />
      ) : null}
    </Screen>
  );
}
