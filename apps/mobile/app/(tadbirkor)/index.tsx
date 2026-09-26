import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Gap, IconButton, KPICard, ListItem, Panel, ProgressBar, Screen, StatusChip, Txt, fmtDate, fmtSum, fmtUnit } from '@/design/primitives';
import { BarChart, Breakdown, Legend, StatusLine, fmtRel, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { useTadbirkorDashboard } from '@/features/eco/api';
import { useSession } from '@/core/session';
import { EXPENSE_LABEL } from '@insof/shared';

const money = (v: number) => `${fmtShort(v)} so'm`;
const TASK_LABEL: Record<string, string> = { TODO: 'Rejada', IN_PROGRESS: 'Jarayonda', REVIEW: 'Tekshiruvda', DONE: 'Bajarildi' };

/**
 * Tadbirkor bosh sahifasi: sarlavha (tashkilot + salom + bildirishnoma) → moliya KPI (Foyda hero) →
 * KPI setkasi → holatlar → grafik → loyihalar progressi → xarajat tarkibi → material → hodisalar → vazifalar.
 */
export default function TadbirkorHome() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, active } = useSession();
  const d = useTadbirkorDashboard();
  const k = d.data?.kpi ?? {};
  const n = (x: unknown) => Number(x ?? 0);
  const unread = (d.data?.notifications ?? []).some((x) => !x.readAt);
  const grid = { flexBasis: '48%' as const, flexGrow: 1 };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: insets.top + space.md, paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={d.isFetching} onRefresh={() => void d.refetch()} tintColor={c.textMuted} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt v="overline" numberOfLines={1}>{active?.organization.name}</Txt>
            <Txt v="titleLg" numberOfLines={1}>Salom, {(user?.fullName ?? '').split(' ')[0]}</Txt>
          </View>
          <IconButton icon="bell" label="Bildirishnomalar" variant="secondary" badge={unread} onPress={() => router.push('/(tadbirkor)/notifications')} />
        </View>
        <Gap h={space.xl} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.grid }}>
          <KPICard hero label="Foyda" value={fmtSum(n(k.profit))} caption="Bugungi holat" icon="wallet" style={{ flexBasis: '100%' }} onPress={() => router.push('/(tadbirkor)/finance')} />
          <KPICard label="Daromad" value={money(n(k.income))} icon="trending-up" style={grid} />
          <KPICard label="Xarajat" value={money(n(k.expense))} icon="trending-down" style={grid} />
          <KPICard label="Faol loyihalar" value={String(n(k.activeProjects))} icon="building" style={grid} onPress={() => router.push('/(tadbirkor)/projects')} />
          <KPICard label="Faol buyurtmalar" value={String(n(k.activeOrders))} icon="clipboard-list" style={grid} onPress={() => router.push('/(tadbirkor)/orders')} />
          <KPICard label="Quruvchilar" value={String(n(k.workers))} icon="users" module="production" style={grid} onPress={() => router.push('/(tadbirkor)/workers')} />
          <KPICard label="Haydovchilar" value={String(n(k.drivers))} icon="car" module="logistics" style={grid} onPress={() => router.push('/(tadbirkor)/drivers')} />
          <KPICard label="Bugungi xarajat" value={money(n(k.todayExpense))} icon="trending-down" tone="danger" style={grid} />
          <KPICard label="Umumiy daromad" value={money(n(k.income))} icon="trending-up" tone="success" style={grid} onPress={() => router.push('/(tadbirkor)/finance')} />
          <KPICard label="Kutilayotgan daromad" value={money(n(k.expectedIncome))} icon="clock" style={grid} />
          <KPICard label="Ochiq buyurtmalar" value={String(n(k.openOrders))} icon="circle-plus" tone="warning" style={grid} onPress={() => router.push('/(tadbirkor)/orders')} />
          <KPICard label="Tugallanayotgan ishlar" value={String(n(k.finishingOrders))} icon="check-check" style={grid} />
          <KPICard label="Material so'rovlari" value={String(n(k.pendingRequests))} icon="package" module="warehouse" tone={n(k.pendingRequests) ? 'warning' : undefined} style={grid} onPress={() => router.push('/(tadbirkor)/materials')} />
        </View>

        <Panel title="Holatlar">
          {(d.data?.statusLines ?? []).map((s) => <StatusLine key={s.text} icon={s.icon} text={s.text} />)}
          {(d.data?.statusLines ?? []).length === 0 ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Hozircha holat yo&apos;q</Txt> : null}
        </Panel>

        <Panel title="Daromad va xarajat" action="Moliya" onAction={() => router.push('/(tadbirkor)/finance')}>
          <View style={{ paddingVertical: space.sm }}>
            <BarChart data={(d.data?.months ?? []).map((m) => ({ label: m.label, a: Number(m.income), b: Number(m.expense) }))} />
            <Legend items={[{ label: 'Daromad', tone: 'chart1' }, { label: 'Xarajat', tone: 'chart2' }]} />
          </View>
        </Panel>

        <Panel title="Loyihalar progressi" action="Barchasi" onAction={() => router.push('/(tadbirkor)/projects')}>
          {(d.data?.projects ?? []).map((p, i, arr) => (
            <Pressable
              key={p.id} accessibilityRole="button" accessibilityLabel={p.name}
              onPress={() => router.push(`/project/${p.id}`)} android_ripple={{ color: c.bgMuted }}
              style={({ pressed }) => [{ minHeight: size.row, paddingVertical: space.md, borderBottomWidth: i === arr.length - 1 ? 0 : size.hairline, borderBottomColor: c.borderSubtle }, pressed && { backgroundColor: c.bgMuted }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, marginBottom: space.sm }}>
                <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{p.name}</Txt>
                <StatusChip status={p.status} />
              </View>
              <ProgressBar value={p.progress} tone={p.status === 'DELAYED' ? 'warning' : undefined} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs }}>
                <Txt v="caption">{p.progress}% · {fmtShort(p.spent)} / {fmtShort(p.budget)} so&apos;m</Txt>
                <Txt v="caption">{p.deadline ? `muddat ${fmtDate(p.deadline)}` : ''}</Txt>
              </View>
            </Pressable>
          ))}
          {(d.data?.projects ?? []).length === 0 ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Faol loyiha yo&apos;q</Txt> : null}
        </Panel>

        <Panel title="Xarajat tarkibi">
          <View style={{ paddingVertical: space.sm }}>
            <Breakdown rows={(d.data?.expenseByCategory ?? []).slice(0, 5).map((e) => ({ label: EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL] ?? e.category, value: Number(e.amount) }))} />
          </View>
        </Panel>

        {(d.data?.lowMaterials ?? []).length ? (
          <Panel title="Material holati" action="Ombor" onAction={() => router.push('/(tadbirkor)/materials')}>
            {d.data!.lowMaterials.map((m, i, arr) => <ListItem key={m.id} icon="circle-alert" tone="danger" title={m.name} subtitle={`${fmtUnit(m.stock, m.unit)} qoldi · minimal ${fmtUnit(m.minStock, m.unit)}`} last={i === arr.length - 1} />)}
          </Panel>
        ) : null}

        <Panel title="Oxirgi hodisalar" action="Barchasi" onAction={() => router.push('/(tadbirkor)/notifications')}>
          {(d.data?.notifications ?? []).map((x, i, arr) => <ListItem key={x.id} title={x.title} subtitle={x.body} right={<Txt v="caption">{fmtRel(x.createdAt)}</Txt>} last={i === arr.length - 1} />)}
          {(d.data?.notifications ?? []).length === 0 ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Hodisalar yo&apos;q</Txt> : null}
        </Panel>

        <Gap h={space.section} />
        <Card>
          <Txt v="overline">Vazifalar</Txt>
          <Txt v="bodyStrong" style={{ marginTop: space.xs }}>{(d.data?.tasks ?? []).map((t) => `${TASK_LABEL[t.status] ?? t.status}: ${t.count}`).join(' · ') || '—'}</Txt>
        </Card>
      </ScrollView>
    </Screen>
  );
}
