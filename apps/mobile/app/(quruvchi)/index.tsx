import React from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionGrid, AttentionItem, AttentionList, BarChartCard, BreakdownCard, HeroCard, KpiGrid, KpiItem, ListGroup, PageHeader, ProgressCard, SectionHead } from '@/design/blocks';
import { EmptyState, Gap, ListItem, Screen, StatusChip, fmtDate, fmtM3, fmtNum, fmtTime } from '@/design/primitives';
import { fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useMaterialRequests, useProjects, useQuruvchiDashboard } from '@/features/eco/api';
import { Order, useOrders } from '@/features/orders/api';
import { useBilling } from '@/features/billing/api';
import { avatarUri } from '@/features/auth/api';
import { useSession } from '@/core/session';

const n = (x: unknown) => Number(x ?? 0);
const DEAD = ['DRAFT', 'REJECTED', 'CANCELLED'];
const ACTIVE_ORDER = ['SUBMITTED', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS'];
const WEEKS = 6;
/** So'm → "186,4" (mln). */
const mln = (v: number) => (v / 1_000_000).toFixed(1).replace('.', ',');

function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }
function weekStart(back: number) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - back * 7); return d; }

/**
 * Beton buyurtmalari ro'yxati (sahifalangan, scheduledAt bo'yicha kamayuvchi) `since` sanasidan beri to'liqmi:
 * keyingi sahifa yo'q yoki eng eski yozuv `since`dan oldin bo'lsa — yig'indi haqiqiy.
 */
const covers = (items: Order[], next: string | null, since: Date) => !next || (items.length > 0 && new Date(items[items.length - 1]!.scheduledAt) < since);

/**
 * Quruvchi "Obyektlarim": material sotib oluvchi + ijrochi. Sarlavha doim ko'rinadi →
 * hero (bu oy beton xarajati; buyurtma bo'lmasa — oylik daromad) → 4 KPI → diqqat talab →
 * tezkor amallar (1-chi: Beton buyurtma) → obyekt progressi → haftalik hajm → marka tarkibi →
 * faol beton buyurtmalari → faol ishlar. Ma'lumoti yo'q blok ko'rsatilmaydi.
 */
export default function QuruvchiHome() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, active } = useSession();
  const d = useQuruvchiDashboard();
  const ord = useOrders();
  const bill = useBilling();
  const proj = useProjects();
  const mreq = useMaterialRequests();
  const x = d.data;

  const orders = (ord.data?.items ?? []).filter((o) => !DEAD.includes(o.status));
  const next = ord.data?.nextCursor ?? null;
  const m0 = monthStart();
  const monthOrders = orders.filter((o) => new Date(o.scheduledAt) >= m0);
  const monthComplete = !!ord.data && covers(ord.data.items, next, m0);
  const spend = monthOrders.reduce((s, o) => s + n(o.totalAmount), 0);
  const useSpendHero = monthComplete && orders.length > 0;

  // Haftalik hajm (m³) — faqat ro'yxat shu davrni to'liq qamrasa.
  const w0 = weekStart(WEEKS - 1);
  const weeksComplete = !!ord.data && covers(ord.data.items, next, w0);
  const weekly = Array.from({ length: WEEKS }, (_, i) => {
    const from = weekStart(WEEKS - 1 - i); const to = new Date(from); to.setDate(to.getDate() + 7);
    return orders.filter((o) => { const t = new Date(o.scheduledAt); return t >= from && t < to; }).reduce((s, o) => s + n(o.totalVolumeM3), 0);
  });
  const weekLabels = Array.from({ length: WEEKS }, (_, i) => fmtDate(weekStart(WEEKS - 1 - i)));
  const byGrade = new Map<string, number>();
  monthOrders.forEach((o) => o.items.forEach((it) => byGrade.set(it.gradeSnapshot, (byGrade.get(it.gradeSnapshot) ?? 0) + n(it.volumeM3) * n(it.unitPriceSnapshot))));
  const gradeItems = [...byGrade.entries()].map(([label, value]) => ({ label, value }));

  const activeOrders = orders.filter((o) => ACTIVE_ORDER.includes(o.status));
  const submitted = activeOrders.filter((o) => o.status === 'SUBMITTED').length;
  const delivered = orders.filter((o) => o.status === 'DELIVERED');
  const sites = (proj.data ?? []).filter((p) => p.status === 'ACTIVE' || p.status === 'DELAYED');
  const reqs = mreq.data ?? [];
  const arrived = reqs.filter((r) => r.status === 'DELIVERED' && r.shipment);
  const enRoute = orders.filter((o) => o.status === 'IN_PROGRESS').length + reqs.filter((r) => r.shipment && ['LOADING', 'EN_ROUTE'].includes(r.shipment.status)).length;
  const openInvoices = (bill.data?.invoices ?? []).filter((i) => i.status === 'OPEN' || i.status === 'PARTIALLY_PAID');
  const debt = n(bill.data?.totalDebt);

  const kpis = ([
    proj.data ? { label: 'Faol obyektlar', value: sites.length, icon: 'hard-hat', module: 'production', onPress: sites.length === 1 ? () => router.push(`/project/${sites[0]!.id}`) : undefined } : null,
    ord.data || mreq.data ? { label: "Yo'ldagi yuk", value: `${enRoute} reys`, icon: 'truck', module: 'logistics', onPress: () => router.push('/(quruvchi)/materials') } : null,
    ord.data ? { label: 'Beton buyurtmalar', value: activeOrders.length, icon: 'receipt', module: 'brand', delta: submitted ? { text: `${submitted} tasdiqda`, tone: 'warning' } : undefined } : null,
    bill.data ? { label: "To'lanmagan", value: fmtShort(debt), icon: 'wallet', module: 'brand', tone: debt > 0 ? 'danger' : undefined, delta: openInvoices.length ? { text: `${openInvoices.length} schyot`, tone: 'danger' } : undefined } : null,
  ] as (KpiItem | null)[]).filter((k): k is KpiItem => !!k);

  const attention = ([
    arrived.length ? { title: 'Yuk yetib keldi', sub: `${arrived[0]!.material.name} · qabul qiling`, icon: 'package-check', module: 'logistics', badge: { text: String(arrived.length), tone: 'warning' }, onPress: () => router.push('/(quruvchi)/materials') } : null,
    delivered.length ? { title: 'Beton yetkazildi', sub: `№${delivered[0]!.number} · yakuniy qabul`, icon: 'circle-check', module: 'logistics', badge: { text: String(delivered.length), tone: 'warning' }, onPress: () => router.push(`/order/${delivered[0]!.id}`) } : null,
    openInvoices.length ? { title: "To'lov kutilmoqda", sub: `${openInvoices.length} ta schyot`, icon: 'banknote', module: 'brand', value: `${fmtShort(debt)} so'm`, badge: { text: String(openInvoices.length), tone: 'info' } } : null,
    x?.openOrders ? { title: 'Ochiq ish buyurtmalari', sub: 'Qabul qiling va ishni boshlang', icon: 'zap', module: 'brand', badge: { text: String(x.openOrders), tone: 'info' }, onPress: () => router.push('/(quruvchi)/orders') } : null,
    x?.todayTasks.length ? { title: 'Bugungi vazifalar', sub: x.todayTasks[0]!.title, icon: 'square-check', module: 'production', badge: { text: String(x.todayTasks.length), tone: x.todayTasks.some((t) => t.priority === 'HIGH') ? 'danger' : 'neutral' }, onPress: () => router.push('/(quruvchi)/tasks') } : null,
  ] as (AttentionItem | null)[]).filter((a): a is AttentionItem => !!a);

  const site = sites[0];
  const refreshing = d.isFetching || ord.isFetching;
  const refresh = () => { void d.refetch(); void ord.refetch(); void bill.refetch(); void proj.refetch(); void mreq.refetch(); };

  return (
    <Screen padded={false} style={{ paddingTop: insets.top }}>
      <PageHeader
        overline={active?.organization.name ?? 'Quruvchi · Insof ECO'}
        title="Obyektlarim"
        actions={[{ icon: 'message-circle', label: 'Xabarlar', onPress: () => router.push('/(quruvchi)/messages') }]}
        avatar={{ name: user?.fullName ?? undefined, uri: avatarUri(user?.avatarUrl) ?? undefined }}
        onAvatar={() => router.push('/(quruvchi)/profile')}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.textMuted} />}>
        {useSpendHero ? (
          <HeroCard
            label="Bu oy beton xarajati" value={spend} format={mln} unit="mln so'm"
            delta={monthOrders.length ? { text: `${monthOrders.length} buyurtma · ${fmtM3(monthOrders.reduce((s, o) => s + n(o.totalVolumeM3), 0))}`, dir: 'up', tone: 'info' } : undefined}
            spark={weeksComplete && weekly.some((v) => v > 0) ? weekly : undefined}
          />
        ) : x ? (
          <HeroCard
            label="Bu oy daromad" value={n(x.earnings.month)} format={(v) => fmtNum(Math.round(v))} unit="so'm"
            delta={n(x.earnings.monthPending) > 0 ? { text: `${fmtShort(x.earnings.monthPending)} kutilmoqda`, dir: 'up', tone: 'warning' } : undefined}
          />
        ) : null}

        {kpis.length ? (<><Gap h={space.grid} /><KpiGrid items={kpis} /></>) : null}

        <Gap h={space.section} />
        <SectionHead title="Diqqat talab" count={attention.length || undefined} />
        {attention.length ? <AttentionList items={attention} /> : (
          <ListGroup><EmptyState compact icon="circle-check" title="Hammasi joyida" hint="Qabul qilinadigan yuk yoki to'lov yo'q" /></ListGroup>
        )}

        <Gap h={space.section} />
        <SectionHead title="Tezkor amallar" />
        <ActionGrid
          items={[
            { label: 'Beton buyurtma', icon: 'plus', onPress: () => router.push('/(quruvchi)/new-order') },
            { label: "Material so'rovi", icon: 'shopping-cart', module: 'warehouse', onPress: () => router.push('/(quruvchi)/new-request') },
            { label: 'Yukni kuzatish', icon: 'map', module: 'logistics', onPress: () => router.push('/(quruvchi)/materials') },
            { label: 'Kalkulyator', icon: 'calculator', module: 'production', onPress: () => router.push('/(shop)/kalkulyator') },
          ]}
        />

        {site ? (
          <>
            <Gap h={space.section} />
            <SectionHead title="Obyekt" action={sites.length > 1 ? `Yana ${sites.length - 1}` : undefined} onAction={sites.length > 1 ? () => router.push(`/project/${sites[1]!.id}`) : undefined} />
            <ProgressCard title={site.name} value={n(site.progress)} caption={site.address} tone={site.status === 'DELAYED' ? 'warning' : undefined} />
          </>
        ) : null}

        {weeksComplete && weekly.some((v) => v > 0) ? (
          <><Gap h={space.section} /><BarChartCard title="Buyurtma qilingan beton" unit="m³" labels={weekLabels} series={[{ name: 'Beton', data: weekly }]} format={(v) => fmtNum(v)} /></>
        ) : null}

        {monthComplete && gradeItems.length ? (<><Gap h={space.section} /><BreakdownCard title="Bu oy · marka bo'yicha" unit="so'm" items={gradeItems} /></>) : null}

        <Gap h={space.section} />
        <SectionHead title="Beton buyurtmalari" action="Yangi" onAction={() => router.push('/(quruvchi)/new-order')} />
        {activeOrders.length || delivered.length ? (
          <ListGroup>
            {[...delivered, ...activeOrders].slice(0, 6).map((o) => (
              <ListItem key={o.id} icon="truck" module="logistics" title={`№${o.number} · ${o.items.map((i) => i.gradeSnapshot).join(', ')} · ${fmtM3(o.totalVolumeM3)}`} subtitle={`${o.site?.name ?? o.address} · ${fmtDate(o.scheduledAt)} ${fmtTime(o.scheduledAt)}`} subtitleLines={1} right={<StatusChip status={o.status} />} onPress={() => router.push(`/order/${o.id}`)} />
            ))}
          </ListGroup>
        ) : (
          <ListGroup><EmptyState compact icon="truck" title="Faol buyurtma yo'q" hint="Marka, hajm va obyektni tanlang — zavod 3 qadamda qabul qiladi" action="Beton buyurtma" onAction={() => router.push('/(quruvchi)/new-order')} /></ListGroup>
        )}

        {(x?.activeOrders ?? []).length ? (
          <>
            <Gap h={space.section} />
            <SectionHead title="Faol ishlarim" action="Barchasi" onAction={() => router.push('/(quruvchi)/orders')} />
            <ListGroup>
              {x!.activeOrders.slice(0, 5).map((o) => (
                <ListItem key={o.id} icon="hammer" module="production" title={o.title} subtitle={`${o.project?.name ?? ''} · muddat ${fmtDate(o.deadline)}`} subtitleLines={1} right={<StatusChip status={o.status} />} onPress={() => router.push(`/work-order/${o.id}`)} />
              ))}
              <ListItem icon="banknote" tone="success" title="Bu oy daromad" subtitle={`To'langan ${fmtShort(x!.earnings.monthPaid)} · kutilmoqda ${fmtShort(x!.earnings.monthPending)}`} onPress={() => router.push('/(quruvchi)/earnings')} />
            </ListGroup>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
