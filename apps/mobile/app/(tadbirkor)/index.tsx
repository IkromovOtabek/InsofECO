import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Gap, Screen, StatusChip, Txt } from '@/design/primitives';
import { BarChart, Breakdown, Icon, Kpi, Legend, ProgressBar, Row, Section, StatusLine, fmtRel, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useTadbirkorDashboard } from '@/features/eco/api';
import { useSession } from '@/core/session';
import { EXPENSE_LABEL } from '@insof/shared';

/** Navy hero ichidagi raqam: Daromad / Xarajat / Foyda. */
function HeroStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { c, shape } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: shape.card, padding: 10 }}>
      <Txt v="caption" style={{ color: c.textOnBrand, opacity: 0.75 }}>{label}</Txt>
      <Txt v="heading" style={{ color: accent ? c.brandAccent : c.textOnBrand, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
    </View>
  );
}

/**
 * Tadbirkor bosh sahifasi — "Boshqaruv" skini: navy hero (tashkilot, salom, bugungi moliya) → KPI 2×N → holatlar → grafik →
 * loyihalar progressi → material → bildirishnomalar. Ma'lumot zich, burchaklar o'tkir.
 */
export default function TadbirkorHome() {
  const router = useRouter();
  const { c, shape } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, active } = useSession();
  const d = useTadbirkorDashboard();
  const k = d.data?.kpi ?? {};
  const n = (x: unknown) => Number(x ?? 0);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={d.isFetching} onRefresh={() => void d.refetch()} tintColor={c.textOnBrand} />}>
        {/* Navy hero: tashkilot · salom · bugungi moliya bir qarashda */}
        <View style={{ backgroundColor: c.brandPrimary, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 36, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt v="caption" style={{ color: c.textOnBrand, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.8 }} numberOfLines={1}>{active?.organization.name}</Txt>
              <Txt v="title" color="onBrand">Salom, {(user?.fullName ?? '').split(' ')[0]} 👋</Txt>
            </View>
            <Pressable onPress={() => router.push('/(tadbirkor)/notifications')} hitSlop={8} style={{ width: 44, height: 44, borderRadius: shape.card, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="notifications-outline" size={22} color={c.textOnBrand} />
              {(d.data?.notifications ?? []).some((x) => !x.readAt) ? <View style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: c.brandAccent }} /> : null}
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 20, gap: 10 }}>
            <HeroStat label="Daromad" value={fmtShort(n(k.income))} />
            <HeroStat label="Xarajat" value={fmtShort(n(k.expense))} />
            <HeroStat label="Foyda" value={fmtShort(n(k.profit))} accent />
          </View>
        </View>

        <View style={{ padding: 16, marginTop: -20 }}>
        {/* KPI 2×N */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Kpi label="Faol loyihalar" value={String(n(k.activeProjects))} icon="business" tone="brand" onPress={() => router.push('/(tadbirkor)/projects')} />
          <Kpi label="Faol buyurtmalar" value={String(n(k.activeOrders))} icon="clipboard" onPress={() => router.push('/(tadbirkor)/orders')} />
          <Kpi label="Quruvchilar" value={String(n(k.workers))} icon="people" onPress={() => router.push('/(tadbirkor)/workers')} />
          <Kpi label="Haydovchilar" value={String(n(k.drivers))} icon="car" onPress={() => router.push('/(tadbirkor)/drivers')} />
          <Kpi label="Bugungi xarajat" value={fmtShort(n(k.todayExpense))} icon="trending-down" tone="danger" />
          <Kpi label="Umumiy daromad" value={fmtShort(n(k.income))} icon="trending-up" tone="success" onPress={() => router.push('/(tadbirkor)/finance')} />
          <Kpi label="Kutilayotgan daromad" value={fmtShort(n(k.expectedIncome))} icon="time" tone="info" />
          <Kpi label="Ochiq buyurtmalar" value={String(n(k.openOrders))} icon="add-circle" tone="warning" onPress={() => router.push('/(tadbirkor)/orders')} />
          <Kpi label="Tugallanayotgan ishlar" value={String(n(k.finishingOrders))} icon="checkmark-done" tone="brand" />
          <Kpi label="Material so'rovlari" value={String(n(k.pendingRequests))} icon="cube" tone={n(k.pendingRequests) ? 'warning' : 'primary'} onPress={() => router.push('/(tadbirkor)/materials')} />
        </View>

        <Section title="Holatlar">
          {(d.data?.statusLines ?? []).map((s) => <StatusLine key={s.text} icon={s.icon} text={s.text} />)}
        </Section>

        <Section title="Daromad va xarajat" action="Moliya" onAction={() => router.push('/(tadbirkor)/finance')}>
          <View style={{ paddingVertical: 8 }}>
            <BarChart data={(d.data?.months ?? []).map((m) => ({ label: m.label, a: Number(m.income), b: Number(m.expense) }))} />
            <Legend items={[{ label: 'Daromad', tone: 'brand' }, { label: 'Xarajat', tone: 'accent' }]} />
          </View>
        </Section>

        <Section title="Loyihalar progressi" action="Barchasi" onAction={() => router.push('/(tadbirkor)/projects')}>
          {(d.data?.projects ?? []).map((p, i, arr) => (
            <Pressable key={p.id} onPress={() => router.push(`/project/${p.id}`)} style={{ paddingVertical: 10, borderBottomWidth: i === arr.length - 1 ? 0 : 0.5, borderBottomColor: c.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{p.name}</Txt>
                <StatusChip status={p.status} />
              </View>
              <ProgressBar value={p.progress} tone={p.status === 'DELAYED' ? 'warning' : undefined} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Txt v="caption" color="secondary">{p.progress}% · {fmtShort(p.spent)} / {fmtShort(p.budget)}</Txt>
                <Txt v="caption" color="secondary">{p.deadline ? `muddat ${new Date(p.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}` : ''}</Txt>
              </View>
            </Pressable>
          ))}
        </Section>

        <Section title="Xarajat tarkibi">
          <View style={{ paddingVertical: 8 }}>
            <Breakdown rows={(d.data?.expenseByCategory ?? []).slice(0, 5).map((e) => ({ label: EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL] ?? e.category, value: Number(e.amount) }))} />
          </View>
        </Section>

        {(d.data?.lowMaterials ?? []).length ? (
          <Section title="Material holati" action="Ombor" onAction={() => router.push('/(tadbirkor)/materials')}>
            {d.data!.lowMaterials.map((m, i, arr) => <Row key={m.id} icon="alert-circle" iconTone="danger" title={m.name} subtitle={`${m.stock} ${m.unit} qoldi · minimal ${m.minStock}`} last={i === arr.length - 1} />)}
          </Section>
        ) : null}

        <Section title="Oxirgi hodisalar" action="Barchasi" onAction={() => router.push('/(tadbirkor)/notifications')}>
          {(d.data?.notifications ?? []).map((x, i, arr) => <Row key={x.id} title={x.title} subtitle={x.body} right={<Txt v="caption" color="secondary">{fmtRel(x.createdAt)}</Txt>} last={i === arr.length - 1} />)}
          {(d.data?.notifications ?? []).length === 0 ? <Txt color="secondary" style={{ padding: 12 }}>Hodisalar yo'q</Txt> : null}
        </Section>
        <Gap h={12} />
        <Card style={{ backgroundColor: c.brandPrimary, borderColor: c.brandPrimary }}>
          <Txt v="caption" style={{ color: c.textOnBrand, opacity: 0.8 }}>VAZIFALAR</Txt>
          <Txt v="heading" color="onBrand" style={{ marginTop: 4 }}>{(d.data?.tasks ?? []).map((t) => `${({ TODO: 'Rejada', IN_PROGRESS: 'Jarayonda', REVIEW: 'Tekshiruvda', DONE: 'Bajarildi' })[t.status] ?? t.status}: ${t.count}`).join(' · ') || '—'}</Txt>
        </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
