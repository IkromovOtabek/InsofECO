import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EXPENSE_LABEL } from '@insof/shared';
import { ActionGrid, AttentionItem, AttentionList, BarChartCard, BreakdownCard, HeroCard, KpiGrid, KpiItem, ListGroup, PageHeader, Reveal, SectionHead } from '@/design/blocks';
import { EmptyState, ListItem, ProgressBar, Screen, Txt } from '@/design/primitives';
import { haptic, useHeaderRaise } from '@/design/motion';
import { fmtRel, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { Project, useTadbirkorDashboard } from '@/features/eco/api';
import { avatarUri } from '@/features/auth/api';
import { useSession } from '@/core/session';

const n = (x: unknown) => Number(x ?? 0);
/** So'm → "38,6" (mln). */
const mln = (v: number) => (v / 1_000_000).toFixed(1).replace('.', ',');
/** Oldingi davrga nisbatan o'zgarish, %; taqqoslab bo'lmasa null. */
const change = (cur: number, prev?: number) => (prev !== undefined && prev !== 0 ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null);
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}%`;
/** Davrlar: API oylik (6 oy) va jami ko'rsatkichlarni beradi — haftalik ma'lumot yo'q, shuning uchun "Hafta" yo'q. */
const PERIODS = ['Oy', '6 oy', 'Jami'];

/** Demo `.li` loyiha qatori: nom + ingichka progress chizig'i, o'ngda foiz. */
function ProjectRow({ p, first, onPress }: { p: Project; first: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(100, n(p.progress)));
  const late = p.status === 'DELAYED';
  return (
    <Pressable
      onPress={() => { haptic.selection(); onPress(); }} accessibilityRole="button" accessibilityLabel={`${p.name}, ${Math.round(pct)}%`}
      android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row, paddingVertical: space.md, paddingHorizontal: space.card }, pressed && { backgroundColor: c.bgSubtle }]}
    >
      {first ? null : <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: space.card, right: space.card, height: size.hairline, backgroundColor: c.borderSubtle }} />}
      <View style={{ flex: 1, minWidth: 0, gap: space.sm }}>
        <Txt v="listTitle" numberOfLines={1}>{p.name}</Txt>
        <ProgressBar value={pct} tone={late ? 'warning' : 'brand'} />
      </View>
      <Txt v="listValue" style={{ fontVariant: ['tabular-nums'] }}>{`${Math.round(pct)}%`}</Txt>
    </Pressable>
  );
}

/**
 * Tadbirkor bosh sahifasi — demo 01 (1:1): sarlavha (avatar, tashkilot, salom, qo'ng'iroq) →
 * "Sof foyda" hero (davr tanlagich ichida, trend) → 4 KPI (Daromad, Xarajat, Buyurtma, Reyslar) →
 * 4 tezkor amal → Loyihalar (progress qatorlari) → e'tibor talab → xarajat tarkibi → dinamika → hodisalar.
 * Manbasi yo'q blok ko'rsatilmaydi; raqamlar faqat /dashboard/tadbirkor dan.
 */
export default function TadbirkorHome() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, active } = useSession();
  const d = useTadbirkorDashboard();
  const [period, setPeriod] = useState(0);
  const raise = useHeaderRaise();
  const x = d.data;
  const k = x?.kpi ?? {};
  const unread = (x?.notifications ?? []).filter((y) => !y.readAt).length;
  const first = (user?.fullName ?? '').split(' ')[0];

  // Davr bo'yicha daromad / xarajat / foyda. Oy — joriy oy (o'tgan oyga nisbatan), 6 oy — yig'indi, Jami — butun davr.
  const months = x?.months ?? [];
  const inc = months.map((m) => n(m.income));
  const exp = months.map((m) => n(m.expense));
  const profitSeries = months.map((_, i) => inc[i]! - exp[i]!);
  const last = months.length - 1;
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const cur = period === 0
    ? { inc: inc[last] ?? 0, exp: exp[last] ?? 0 }
    : period === 1 ? { inc: sum(inc), exp: sum(exp) } : { inc: n(k.income), exp: n(k.expense) };
  const profit = period === 2 ? n(k.profit) : cur.inc - cur.exp;
  const profitCh = period === 0 ? change(profitSeries[last] ?? 0, profitSeries[last - 1]) : null;
  const incCh = period === 0 ? change(cur.inc, inc[last - 1]) : null;
  const expCh = period === 0 ? change(cur.exp, exp[last - 1]) : null;

  const activeOrders = n(k.activeOrders);
  const openOrders = n(k.openOrders);
  const enRoute = n(k.shipmentsEnRoute);
  const delayed = n(k.delayedProjects);

  const kpis: KpiItem[] = [
    { label: 'Daromad', value: fmtShort(cur.inc), icon: 'wallet', module: 'brand', delta: incCh !== null ? { text: signed(incCh), tone: incCh >= 0 ? 'success' : 'danger' } : undefined, onPress: () => router.push({ pathname: '/(tadbirkor)/finance', params: { seg: 'income' } }) },
    { label: 'Xarajat', value: fmtShort(cur.exp), icon: 'arrow-down', module: 'warehouse', delta: expCh !== null ? { text: signed(expCh), tone: expCh > 0 ? 'warning' : 'success' } : undefined, onPress: () => router.push({ pathname: '/(tadbirkor)/finance', params: { seg: 'expense' } }) },
    { label: 'Buyurtma', value: activeOrders, icon: 'package', module: 'production', delta: openOrders ? { text: `+${openOrders} yangi`, tone: 'success' } : undefined, onPress: () => router.push('/(tadbirkor)/orders') },
    { label: 'Reyslar', value: enRoute, icon: 'truck', module: 'logistics', delta: enRoute ? { text: "yo'lda", tone: 'info' } : undefined, onPress: () => router.push('/(tadbirkor)/transport') },
  ];

  const attention = ([
    n(k.pendingRequests) ? { title: 'Material zayavkalari', sub: "Quruvchilar so'radi, tasdiq kerak", icon: 'clipboard-list', module: 'warehouse', badge: { text: String(n(k.pendingRequests)), tone: 'warning' }, onPress: () => router.push('/(tadbirkor)/materials') } : null,
    n(k.finishingOrders) ? { title: 'Ish qabul qilish', sub: 'Tekshiruvdagi naryadlar', icon: 'check-check', module: 'production', badge: { text: String(n(k.finishingOrders)), tone: 'info' }, onPress: () => router.push('/(tadbirkor)/orders') } : null,
    n(k.lowMaterials) ? { title: 'Material yetishmaydi', sub: (x?.lowMaterials ?? []).slice(0, 2).map((m) => m.name).join(', ') || 'Minimal zaxiradan past', icon: 'package', module: 'warehouse', badge: { text: String(n(k.lowMaterials)), tone: 'danger' }, onPress: () => router.push('/(tadbirkor)/materials') } : null,
    delayed ? { title: 'Kechikayotgan loyihalar', sub: "Muddat o'tgan yoki kechikmoqda", icon: 'clock', module: 'production', badge: { text: String(delayed), tone: 'danger' }, onPress: () => router.push('/(tadbirkor)/projects') } : null,
  ] as (AttentionItem | null)[]).filter((a): a is AttentionItem => !!a);

  const projects = x?.projects ?? [];
  const expense = (x?.expenseByCategory ?? []).map((e) => ({ label: EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL] ?? e.category, value: n(e.amount) })).filter((e) => e.value > 0);
  const hasMonths = months.some((m) => n(m.income) > 0 || n(m.expense) > 0);
  const notices = x?.notifications ?? [];

  return (
    <Screen padded={false} style={{ paddingTop: insets.top }}>
      <PageHeader
        overline={active?.organization.name ?? 'Tadbirkor · Insof ECO'}
        title={first ? `Salom, ${first}` : 'Biznesim'}
        bell={{ onPress: () => router.push('/(tadbirkor)/notifications'), dot: unread > 0 }}
        avatar={{ name: user?.fullName ?? undefined, uri: avatarUri(user?.avatarUrl) ?? undefined }}
        onAvatar={() => router.push('/(tadbirkor)/profile')}
        raised={raise.raised}
      />
      <ScrollView
        onScroll={raise.onScroll} scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={d.isFetching && !d.isLoading} onRefresh={() => void d.refetch()} tintColor={c.textMuted} />}
      >
        {!x && d.isError ? (
          <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void d.refetch()} />
        ) : (
          <Reveal loading={!x}>
            <HeroCard
              label="Sof foyda"
              value={profit}
              format={mln}
              unit="mln so'm"
              delta={profitCh !== null ? { text: `${Math.abs(profitCh)}%`, dir: profitCh >= 0 ? 'up' : 'down', tone: profitCh >= 0 ? 'success' : 'danger' } : undefined}
              spark={period < 2 && hasMonths && profitSeries.length > 1 ? profitSeries : undefined}
              periods={PERIODS}
              period={period}
              onPeriod={setPeriod}
            />
            <KpiGrid items={kpis} />
            <ActionGrid
              items={[
                { label: 'Buyurtma', icon: 'plus', onPress: () => router.push('/(tadbirkor)/new-order') },
                { label: 'Loyiha', icon: 'hard-hat', module: 'production', onPress: () => router.push('/(tadbirkor)/new-project') },
                { label: 'Reys', icon: 'truck', module: 'logistics', onPress: () => router.push('/(tadbirkor)/transport') },
                { label: 'Jamoa', icon: 'users', module: 'warehouse', onPress: () => router.push('/(tadbirkor)/workers') },
              ]}
            />

            <SectionHead title="Loyihalar" action="Barchasi" onAction={() => router.push('/(tadbirkor)/projects')} />
            {projects.length ? (
              <ListGroup>
                {projects.map((p, i) => <ProjectRow key={p.id} p={p} first={i === 0} onPress={() => router.push(`/project/${p.id}`)} />)}
              </ListGroup>
            ) : (
              <ListGroup><EmptyState compact icon="hard-hat" title="Faol loyiha yo'q" hint="Yangi loyiha yarating — byudjet va muddatni shu yerda kuzatasiz" action="Loyiha yaratish" onAction={() => router.push('/(tadbirkor)/new-project')} /></ListGroup>
            )}

            {attention.length ? [
              <SectionHead key="ah" title="E'tibor talab qiladi" />,
              <AttentionList key="al" items={attention} />,
            ] : null}

            {expense.length ? <BreakdownCard title="Xarajat tarkibi" unit="so'm" items={expense} /> : null}

            {hasMonths ? (
              <BarChartCard title="Daromad va xarajat" unit="so'm" labels={months.map((m) => m.label)} series={[{ name: 'Daromad', data: inc }, { name: 'Xarajat', data: exp }]} />
            ) : null}

            {notices.length ? [
              <SectionHead key="nh" title="Oxirgi hodisalar" action="Barchasi" onAction={() => router.push('/(tadbirkor)/notifications')} />,
              <ListGroup key="nl">
                {notices.map((y) => <ListItem key={y.id} icon={y.readAt ? 'bell' : 'bell-ring'} tone={y.readAt ? 'neutral' : 'brand'} title={y.title} subtitle={y.body} subtitleLines={1} right={<Txt v="tSm">{fmtRel(y.createdAt)}</Txt>} />)}
              </ListGroup>,
            ] : null}
          </Reveal>
        )}
      </ScrollView>
    </Screen>
  );
}
