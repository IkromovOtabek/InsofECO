import React, { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EXPENSE_LABEL } from '@insof/shared';
import { ActionGrid, AttentionItem, AttentionList, BarChartCard, BreakdownCard, HBarList, HeroCard, KpiGrid, ListGroup, PageHeader, ProgressCard, SectionHead } from '@/design/blocks';
import { EmptyState, Gap, ListItem, Screen, Txt } from '@/design/primitives';
import { fmtRel, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { Loader } from '@/design/loader';
import { useTadbirkorDashboard } from '@/features/eco/api';
import { avatarUri } from '@/features/auth/api';
import { useSession } from '@/core/session';

const n = (x: unknown) => Number(x ?? 0);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
/** So'm → "38,6" (mln). */
const mln = (v: number) => (v / 1_000_000).toFixed(1).replace('.', ',');

/**
 * Tadbirkor "Biznesim": sarlavha (doim ko'rinadi) → Foyda hero (oy / jami, 6 oylik trend) → 4 KPI →
 * diqqat talab → tezkor amallar → loyihalar (o'rtacha bajarilish, byudjet sarfi) → xarajat tarkibi →
 * daromad/xarajat dinamikasi → oxirgi hodisalar. Manbasi yo'q blok ko'rsatilmaydi.
 */
export default function TadbirkorHome() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, active } = useSession();
  const d = useTadbirkorDashboard();
  const [period, setPeriod] = useState(0);
  const x = d.data;
  const k = x?.kpi ?? {};
  const unread = (x?.notifications ?? []).filter((y) => !y.readAt).length;

  const header = (
    <PageHeader
      overline={active?.organization.name ?? 'Tadbirkor · Insof ECO'}
      title="Biznesim"
      actions={[{ icon: 'bell', label: 'Bildirishnomalar', badge: unread || false, onPress: () => router.push('/(tadbirkor)/notifications') }]}
      avatar={{ name: user?.fullName ?? undefined, uri: avatarUri(user?.avatarUrl) ?? undefined }}
      onAvatar={() => router.push('/(tadbirkor)/profile')}
    />
  );

  if (!x) {
    return (
      <Screen padded={false} style={{ paddingTop: insets.top }}>
        {header}
        {d.isError ? <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void d.refetch()} /> : <Loader style={{ marginTop: space.xxxl }} />}
      </Screen>
    );
  }

  // Foyda: joriy oy (months oxirgisi) yoki jami; trend — 6 oylik foyda.
  const months = x.months ?? [];
  const profitSeries = months.map((m) => n(m.income) - n(m.expense));
  const cur = profitSeries[profitSeries.length - 1] ?? 0;
  const prev = profitSeries[profitSeries.length - 2];
  const change = prev !== undefined && prev !== 0 ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null;
  const delta = period === 0 && change !== null
    ? { text: `${change > 0 ? '+' : ''}${change}% o'tgan oyga`, dir: change >= 0 ? ('up' as const) : ('down' as const), tone: change >= 0 ? ('success' as const) : ('danger' as const) }
    : undefined;

  const workers = n(k.workers);
  const working = n(k.workingWorkers);
  const delayed = n(k.delayedProjects);

  const attention = ([
    n(k.pendingRequests) ? { title: 'Material zayavkalari', sub: "Quruvchilar so'radi, tasdiq kerak", icon: 'clipboard-list', module: 'warehouse', badge: { text: String(n(k.pendingRequests)), tone: 'warning' }, onPress: () => router.push('/(tadbirkor)/materials') } : null,
    n(k.finishingOrders) ? { title: 'Ish qabul qilish', sub: 'Tekshiruvdagi naryadlar', icon: 'check-check', module: 'production', badge: { text: String(n(k.finishingOrders)), tone: 'info' }, onPress: () => router.push('/(tadbirkor)/orders') } : null,
    n(k.lowMaterials) ? { title: 'Material yetishmaydi', sub: (x.lowMaterials ?? []).slice(0, 2).map((m) => m.name).join(', ') || 'Minimal zaxiradan past', icon: 'package', module: 'warehouse', badge: { text: String(n(k.lowMaterials)), tone: 'danger' }, onPress: () => router.push('/(tadbirkor)/materials') } : null,
    n(k.openOrders) ? { title: 'Ochiq buyurtmalar', sub: 'Quruvchi biriktirilmagan', icon: 'circle-plus', module: 'brand', badge: { text: String(n(k.openOrders)), tone: 'warning' }, onPress: () => router.push('/(tadbirkor)/orders') } : null,
    delayed ? { title: 'Kechikayotgan loyihalar', sub: "Muddat o'tgan yoki kechikmoqda", icon: 'clock', module: 'production', badge: { text: String(delayed), tone: 'danger' }, onPress: () => router.push('/(tadbirkor)/projects') } : null,
  ] as (AttentionItem | null)[]).filter((a): a is AttentionItem => !!a);

  const projects = x.projects ?? [];
  const avgProgress = projects.length ? Math.round(projects.reduce((s, p) => s + n(p.progress), 0) / projects.length) : 0;
  const budgetBars = projects.filter((p) => n(p.budget) > 0).map((p) => ({ label: p.name, value: pct(n(p.spent), n(p.budget)) }));
  const expense = (x.expenseByCategory ?? []).map((e) => ({ label: EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL] ?? e.category, value: n(e.amount) }));
  const hasMonths = months.some((m) => n(m.income) > 0 || n(m.expense) > 0);

  return (
    <Screen padded={false} style={{ paddingTop: insets.top }}>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={d.isFetching} onRefresh={() => void d.refetch()} tintColor={c.textMuted} />}
      >
        <HeroCard
          label={period === 0 ? 'Foyda · bu oy' : 'Foyda · jami'}
          value={period === 0 ? cur : n(k.profit)}
          format={mln}
          unit="mln so'm"
          delta={delta}
          spark={period === 0 && profitSeries.length > 1 ? profitSeries : undefined}
          periods={['Oy', 'Jami']}
          period={period}
          onPeriod={setPeriod}
        />
        <Gap h={space.grid} />
        <KpiGrid
          items={[
            { label: 'Faol loyihalar', value: n(k.activeProjects), icon: 'hard-hat', module: 'production', delta: delayed ? { text: `${delayed} kechikkan`, tone: 'warning' } : undefined, onPress: () => router.push('/(tadbirkor)/projects') },
            { label: 'Kutilgan tushum', value: fmtShort(n(k.expectedIncome)), icon: 'wallet', module: 'brand', onPress: () => router.push('/(tadbirkor)/finance') },
            { label: 'Ishdagi quruvchi', value: `${working} / ${workers}`, icon: 'users', module: 'production', delta: workers ? { text: `${pct(working, workers)}%`, tone: 'success' } : undefined, onPress: () => router.push('/(tadbirkor)/workers') },
            { label: "Yo'ldagi yuk", value: `${n(k.shipmentsEnRoute)} reys`, icon: 'truck', module: 'logistics', onPress: () => router.push('/(tadbirkor)/transport') },
          ]}
        />

        <Gap h={space.section} />
        <SectionHead title="Diqqat talab" count={attention.length || undefined} />
        {attention.length ? <AttentionList items={attention} /> : (
          <ListGroup><EmptyState compact icon="circle-check" title="Hammasi joyida" hint="Tasdiq kutayotgan ish yo'q" /></ListGroup>
        )}

        <Gap h={space.section} />
        <SectionHead title="Tezkor amallar" />
        <ActionGrid
          items={[
            { label: 'Buyurtma', icon: 'plus', onPress: () => router.push('/(tadbirkor)/new-order') },
            { label: 'Loyiha', icon: 'hard-hat', module: 'production', onPress: () => router.push('/(tadbirkor)/new-project') },
            { label: 'Xarajat', icon: 'receipt', module: 'brand', onPress: () => router.push({ pathname: '/(tadbirkor)/finance', params: { seg: 'expense' } }) },
            { label: 'Quruvchi', icon: 'users', module: 'production', onPress: () => router.push('/(tadbirkor)/workers') },
          ]}
        />

        <Gap h={space.section} />
        <SectionHead title="Loyihalar" action="Barchasi" onAction={() => router.push('/(tadbirkor)/projects')} />
        {projects.length ? (
          <>
            <ProgressCard title="Loyihalar o'rtacha bajarilishi" value={avgProgress} caption={`${projects.length} loyiha${delayed ? ` · ${delayed} tasi muddatdan o'tgan` : ''}`} tone={delayed ? 'warning' : undefined} />
            {budgetBars.length ? (<><Gap h={space.grid} /><HBarList title="Loyiha byudjeti sarfi" unit="%" items={budgetBars} format={(v) => `${v}%`} /></>) : null}
            <Gap h={space.grid} />
            <ListGroup>
              {projects.map((p) => (
                <ListItem key={p.id} icon="building" module="production" tone={p.status === 'DELAYED' ? 'warning' : undefined} title={p.name} subtitle={`${n(p.progress)}% · ${fmtShort(p.spent)} / ${fmtShort(p.budget)} so'm`} onPress={() => router.push(`/project/${p.id}`)} />
              ))}
            </ListGroup>
          </>
        ) : (
          <ListGroup><EmptyState compact icon="hard-hat" title="Faol loyiha yo'q" hint="Yangi loyiha yarating — byudjet va muddatni shu yerda kuzatasiz" action="Loyiha yaratish" onAction={() => router.push('/(tadbirkor)/new-project')} /></ListGroup>
        )}

        {expense.length ? (<><Gap h={space.section} /><BreakdownCard title="Xarajat tarkibi" unit="so'm" items={expense} /></>) : null}

        {hasMonths ? (
          <>
            <Gap h={space.section} />
            <BarChartCard title="Daromad va xarajat" unit="so'm" labels={months.map((m) => m.label)} series={[{ name: 'Daromad', data: months.map((m) => n(m.income)) }, { name: 'Xarajat', data: months.map((m) => n(m.expense)) }]} />
          </>
        ) : null}

        <Gap h={space.section} />
        <SectionHead title="Oxirgi hodisalar" action="Barchasi" onAction={() => router.push('/(tadbirkor)/notifications')} />
        {(x.notifications ?? []).length ? (
          <ListGroup>
            {x.notifications.map((y) => <ListItem key={y.id} icon={y.readAt ? 'bell' : 'bell-ring'} tone={y.readAt ? 'neutral' : 'brand'} title={y.title} subtitle={y.body} subtitleLines={1} right={<Txt v="caption">{fmtRel(y.createdAt)}</Txt>} />)}
          </ListGroup>
        ) : (
          <ListGroup><EmptyState compact icon="bell" title="Hodisalar yo'q" hint="Yangi buyurtma, zayavka va to'lovlar shu yerda ko'rinadi" /></ListGroup>
        )}
      </ScrollView>
    </Screen>
  );
}
