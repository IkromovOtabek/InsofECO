import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Callout, Card, EmptyState, ListItem, Txt, fmtUnit, typeScale } from '@/design/primitives';
import { Avatar, Confirm, fmtShort, tabIcon, toast } from '@/design/ui';
import {
  ActionGrid, AttentionList, BarChartCard, BreakdownCard, ChipGroup, HBarList, HeroCard, KpiGrid, ListGroup, OfflineBanner, PageHeader,
  ProgressCard, Reveal, SectionHead, SkeletonDashboard, SkeletonList, type ActionItem, type AttentionItem, type KpiItem,
} from '@/design/blocks';
import { SearchField } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { ERP_ROLE_MODULE, LIST_MODULE, ModuleTone, radius, size, space, textRoom } from '@/design/tokens';
import { floatingTabBar, tabsOptions } from '@/design/nav';
import { Appear, PressScale, stagger, useHeaderRaise, useReducedMotion } from '@/design/motion';
import { useSession } from '@/core/session';
import { MapView, Marker } from '@/core/map';
import { config } from '@/core/config';
import { erpAuth, type ErpCard, type ErpHomeData, type ErpLiveTruck, type ErpRole, type ErpRow, type ErpSection, type ErpSectionChart } from '@/core/erp';
import { erpRoleConfig, type ErpTabSpec } from './roles';
import { roleDashboard, type QuickSpec, type RoleDashboard } from './dashboards';
import { useErpHome, useErpList, useErpNotifications } from './api';
import { ErpRowItem, ROW_ICON, RowsGroup, SectionEmpty, cardHref, idSeg, isZero, listModule, parseHint, splitValue, statusLabel } from './ui';
import { RangeCalendar } from './range-calendar';
import { ProgressChart } from './charts';
import { ErpAiChat } from './ai-chat';
import { DailyReportSheet } from './daily-report';
import { FleetScreen } from './fleet';
import { pinStore } from '@/core/pin';
import { kv } from '@/core/storage';
import type { IconName } from '@/design/icons';
import { setBadge } from '@/core/push';

export { SectionEmpty };

/**
 * ERP bo'limlarining ekranlari — dizayn tizimi bloklari ustida, `docs/redesign/demo.html` bilan 1:1.
 *
 * Bosh sahifa — demo `roleScreen()` tartibi: sarlavha → davr chiplari → hero → KPI 2×2 → 4 tezkor amal (birinchisi asosiy) →
 * "E'tibor talab qiladi" → grafik → reja (progress) → taqsimot → (qolgan server bo'limlari) → suzuvchi tab paneli.
 * Raqamlarni server beradi (`/api/mobile/home`); qaysi karta qaysi blokka tushishi — `dashboards.ts`.
 * Ma'lumoti yo'q blok ko'rsatilmaydi — raqam o'ylab topilmaydi.
 */

/** Rol → ikonka plitkalarining modul toni. */
const roleModule = (role: ErpRole): ModuleTone => ERP_ROLE_MODULE[role] ?? 'brand';

/** Tab ekranlari o'z sarlavhasini chizadi (PageHeader); AI va xabarlar — navigator sarlavhasi bilan. */
const ownHeader = (t: ErpTabSpec) => t.screen.kind !== 'ai' && t.screen.kind !== 'notifications';

// ───────────────────────── Tablar ─────────────────────────

/** Rol tablari — `roles.ts` dagi `tabs` (spek `docs/redesign/roles/<ROLE>.json`), suzuvchi panel; haydovchida katta variant. */
export function ErpTabs({ role }: { role: ErpRole }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const cfg = erpRoleConfig(role);
  const driver = role === 'DRIVER';
  // Direktor: "Tasdiqlar" tabida kutayotganlar soni (bosh sahifadagi bilan bitta kesh)
  const approvals = useErpList(cfg.ai ? cfg.listKey : '').data?.rows.length ?? 0;
  return (
    <Tabs tabBar={floatingTabBar({ driver })} screenOptions={tabsOptions(c, insets.bottom, { driver, reduce })}>
      {cfg.tabs.map((t) => (
        <Tabs.Screen
          key={t.route}
          name={t.route}
          options={{
            title: t.title,
            headerShown: !ownHeader(t),
            tabBarIcon: tabIcon(t.icon, { driver }),
            tabBarBadge: t.screen.kind === 'work' && cfg.ai && approvals > 0 ? approvals : undefined,
          }}
        />
      ))}
    </Tabs>
  );
}

/**
 * Tab route fayli shu komponentni chaqiradi: `<ErpTabRoute role="SALES" route="customers" />`.
 * Ekran turi `roles.ts` dagi `tabs` dan olinadi — har tab haqiqiy ekran.
 */
export function ErpTabRoute({ role, route }: { role: ErpRole; route: string }) {
  const cfg = erpRoleConfig(role);
  const spec = cfg.tabs.find((t) => t.route === route);
  const s = spec?.screen ?? { kind: 'sections' as const };
  const title = spec?.title ?? "Bo'limlar";
  switch (s.kind) {
    case 'home': return <ErpHome />;
    case 'work': return <ErpList listKey={cfg.listKey} title={title} />;
    case 'list': return <ErpList listKey={s.key} title={title} fallback={<ErpSections title={title} embedded />} />;
    case 'ai': return <ErpAiChat />;
    case 'map': return <ErpMapTab title={title} />;
    case 'road': return <ErpRoadTab title={title} />;
    case 'menu': return <ErpMenu />;
    case 'notifications':
    case 'sections':
    default: return <ErpSections title={title} />;
  }
}

/** Tab ekrani sarlavhasi — demo `.appbar` (scroll paytida ko'tariladi). */
function TabHeader({ title, raised, onBack, actions }: { title: string; raised?: boolean; onBack?: () => void; actions?: React.ComponentProps<typeof PageHeader>['actions'] }) {
  const insets = useSafeAreaInsets();
  return <PageHeader title={title} raised={raised} onBack={onBack} actions={actions} style={{ paddingTop: insets.top + space.sm }} />;
}

// ───────────────────────── Bosh sahifa modeli ─────────────────────────

type Bars = Extract<ErpSectionChart, { kind: 'bars' }>;
type Columns = Extract<ErpSectionChart, { kind: 'columns' }>;
type Donut = Extract<ErpSectionChart, { kind: 'donut' }>;
type Progress = Extract<ErpSectionChart, { kind: 'progress' }>;

interface DashModel {
  hero: ErpCard | null;
  kpis: ErpCard[];
  /** Qolgan holat kartalari (e'tibor talab qilmaydiganlari). */
  more: ErpCard[];
  /** Xavf/ogohlantirish rangidagi, nol bo'lmagan kartalar. */
  alertCards: ErpCard[];
  alertSections: ErpSection[];
  chart: ErpSection | null;
  breakdown: ErpSection | null;
  progress: { section: ErpSection; item: Progress['items'][number]; rest: Progress['items'] } | null;
  rest: ErpSection[];
}

/** Server kartalari va bo'limlarini rol speki bo'yicha bloklarga taqsimlaydi. Raqam qo'shilmaydi. */
function buildModel(data: ErpHomeData, cfg: RoleDashboard): DashModel {
  const cards = data.cards;
  const hero = (cfg.hero && cards.find((x) => cfg.hero!.includes(x.key))) || cards[0] || null;
  const pool = cards.filter((x) => x !== hero);
  const kpis: ErpCard[] = [];
  for (const k of cfg.kpis) { const f = pool.find((x) => x.key === k); if (f && kpis.length < 4) kpis.push(f); }
  const left = pool.filter((x) => !kpis.includes(x));
  const calm = new Set(cfg.calm ?? []);
  const alarming = (x: ErpCard) => (x.tone === 'danger' || x.tone === 'warning') && !calm.has(x.key) && !isZero(x.value);
  // KPI 4 tadan kam bo'lsa — qolgan (e'tibor talab qilmaydigan) kartalardan to'ldiriladi
  for (const x of left) if (kpis.length < Math.min(4, cfg.kpis.length || 4) && !alarming(x)) kpis.push(x);
  const rest0 = left.filter((x) => !kpis.includes(x));

  const sections = data.sections.filter((s) => !cfg.hide?.some((re) => re.test(s.title)));
  const alertSections: ErpSection[] = [];
  let chart: ErpSection | null = null, breakdown: ErpSection | null = null;
  let progress: DashModel['progress'] = null;
  const rest: ErpSection[] = [];
  for (const s of sections) {
    const k = s.chart?.kind;
    if (cfg.attention.some((re) => re.test(s.title)) && s.rows.length) { alertSections.push(s); continue; }
    if (!chart && cfg.chart && cfg.chart.section.test(s.title)
      && (cfg.chart.kind === 'bars' ? k === 'bars' || k === 'columns' : k === 'donut')) { chart = s; continue; }
    if (!breakdown && cfg.breakdown && k === 'donut' && cfg.breakdown.test(s.title)) { breakdown = s; continue; }
    if (!progress && cfg.progress && s.chart?.kind === 'progress' && cfg.progress.section.test(s.title)) {
      const items = s.chart.items;
      const item = (cfg.progress.item && items.find((i) => i.pct != null && cfg.progress!.item!.test(i.label))) || items.find((i) => i.pct != null);
      if (item) { progress = { section: s, item, rest: items.filter((i) => i !== item) }; continue; }
    }
    rest.push(s);
  }
  return { hero, kpis, more: rest0.filter((x) => !alarming(x)), alertCards: rest0.filter(alarming), alertSections, chart, breakdown, progress, rest };
}

/** Hero sparkline'i — rol grafigining tanlangan seriyasi (kamida 2 nuqta va bitta musbat qiymat). */
function sparkOf(s: ErpSection | null, idx?: number): number[] | undefined {
  if (idx == null || !s?.chart) return undefined;
  const ch = s.chart;
  const pts = ch.kind === 'bars' ? ch.points.map((p) => p.values[idx] ?? 0)
    : ch.kind === 'columns' ? ch.groups.map((g) => g.values[idx] ?? 0) : [];
  return pts.length > 1 && pts.some((v) => v > 0) ? pts : undefined;
}

/** Donut qiymati → server matni ("1,2 mln", "14 reys"); topilmasa qisqa raqam. */
const donutFormat = (ch: Donut) => (n: number) => ch.items.find((i) => i.value === n)?.text ?? fmtShort(n);

/** Ustunli grafik uchun seriyalar: `bars` (davr) yoki `columns` (oylar). */
function barSeries(ch: Bars | Columns, pick: number[]) {
  const idx = pick.filter((i) => i < ch.series.length).slice(0, 2);
  if (ch.kind === 'bars') {
    return { labels: ch.points.map((p) => p.label), series: idx.map((i) => ({ name: ch.series[i]!.label, data: ch.points.map((p) => p.values[i] ?? 0) })) };
  }
  return { labels: ch.groups.map((g) => g.label), series: idx.map((i) => ({ name: ch.series[i]!.label, data: ch.groups.map((g) => g.values[i] ?? 0) })) };
}

const progressCaption = (it: Progress['items'][number]) =>
  `fakt ${it.fact}${it.plan != null ? ` · plan ${it.plan}` : ''}${it.pct != null && it.pct > 100 ? (it.invert ? ' · rejadan oshdi' : ' · rejadan ortiq') : ''}`;

/**
 * Bo'lim qatori bosilganda — kartochka (`target`) yoki ro'yxat (`open`). Qatorning o'z `open`i bo'lim
 * `target`idan ustun (masalan "Bog'liq bo'lim" qatori). Id'da bo'shliq/apostrof bo'lishi mumkin
 * (direktor muammosi `over-Ish haqi`) — shuning uchun kodlanadi.
 */
const rowHref = (s: ErpSection, r: ErpRow) => (r.open ? `/erp/list/${r.open}` : s.target ? `/erp/${s.target}/${idSeg(r.id)}` : null);

/**
 * Ro'yxat kaliti → kartochka kaliti, ro'yxat va kartochka nomi farq qilsa. "Muammolar" (`brig-issues`) va
 * "Smena hisobotlari" (`brig-shifts`) qatorlari ilgari `/erp/brig-issues/<id>` ni ochardi — server bunday
 * kartochkani bilmaydi ("Kartochka ochilmadi"); server ham endi xaritalaydi, eski server uchun bu yerda ham.
 */
const DETAIL_OF: Record<string, string> = { 'brig-issues': 'brig-issue', 'brig-shifts': 'brig-shift' };

/** Jonli reyslar xaritasini kim ochadi (server `GET /api/mobile/fleet` ruxsati bilan bir xil). */
const FLEET_ROLES: ErpRole[] = ['DIRECTOR', 'LOGISTICS', 'MECHANIC'];

/** Ro'yxat bo'limlarida bosh sahifada ko'rinadigan qatorlar soni ("Barchasi" — qolgani). */
const SECTION_ROWS = 6;
/** Demo "E'tibor talab qiladi" — 3 qator; qolgani "Barchasi" bilan ochiladi. */
const ATTENTION_ROWS = 3;

/** Server karta ikonkasi → plitka ikonkasi (eski nomlarni `IconTile` o'zi tarjima qiladi). */
const cardIcon = (x: ErpCard) => (x.icon ?? 'activity') as IconName;

/** Server kartasi → demo KPI (`.card.kpi`): plitka, yorliq, qiymat, rangli o'zgarish. */
function kpiOf(x: ErpCard, module: ModuleTone, onPress?: () => void): KpiItem {
  const h = parseHint(x.hint, x.key);
  return {
    label: x.label, value: x.value, icon: cardIcon(x), module, onPress,
    delta: h.delta ? { text: h.delta.text, tone: h.delta.tone } : undefined,
    tone: x.tone === 'danger' ? 'danger' : undefined,
  };
}

// ───────────────────────── Bosh ekran ─────────────────────────

export function ErpHome() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raise = useHeaderRaise();
  const erp = useSession((s) => s.erp);
  const sessionRole: ErpRole = erp?.role ?? 'DIRECTOR';
  const cfg = roleDashboard(sessionRole);
  // Davr — server hisoblaydi, ilova faqat parametrni yuboradi. Chipsiz rollar (kassa, haydovchi) — doim "bugun".
  const [params, setParams] = useState<Record<string, string>>(() => (cfg.fixedPeriod ? { [sessionRole === 'DIRECTOR' ? 'revenue' : 'period']: cfg.fixedPeriod } : {}));
  const { data, isLoading, refetch, isRefetching, error, isPlaceholderData } = useErpHome(params);
  const [calOpen, setCalOpen] = useState(false);
  const [allAlerts, setAllAlerts] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const pending = useErpList(cfg.countList?.key ?? '');
  const unread = useErpNotifications().data?.unread ?? 0;
  useEffect(() => { setBadge(unread); }, [unread]);

  const model = useMemo(() => (data ? buildModel(data, cfg) : null), [data, cfg]);
  const go = (href: string) => router.push(href as never);
  const rcfg = erpRoleConfig(data?.role ?? sessionRole);
  const roleLabel = data?.roleLabel ?? erp?.roleLabel ?? rcfg.label;
  const fullName = data?.fullName ?? erp?.fullName ?? '';

  const header = (
    <PageHeader
      overline={fullName ? `${roleLabel} · ${fullName}` : roleLabel}
      title={cfg.title}
      avatar={{ name: fullName || roleLabel }}
      onAvatar={() => go(`/${rcfg.group}/menu`)}
      bell={{ onPress: () => go('/erp/bildirishnomalar'), count: unread || undefined }}
      raised={raise.raised}
      style={{ paddingTop: insets.top + space.sm }}
    />
  );

  if (!isLoading && (!data || !model)) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        {header}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.pageX }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
        >
          <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring." onRetry={() => void refetch()} />
        </ScrollView>
      </View>
    );
  }

  const blocks: React.ReactNode[] = [];
  let tail: React.ReactNode = null;

  if (data && model) {
    const module = roleModule(data.role);
    const openCard = (card: ErpCard) => { const h = cardHref(card); return h ? () => go(h) : undefined; };

    // ── Davr chiplari (filtrli karta: direktorda Tushum, qolganlarda bosh ko'rsatkich) ──
    const filtered = data.cards.find((x) => x.filters?.length && x.filterParam);
    const allowed = new Set<string>([...cfg.periods, 'custom']);
    const chips = cfg.periods.length && filtered?.filters ? filtered.filters.filter((f) => allowed.has(f.key)) : [];
    const activeChip = calOpen ? 'custom' : filtered?.filters?.find((f) => f.active)?.key ?? chips[0]?.key ?? '';
    const setFilter = (key: string) => {
      if (!filtered?.filterParam) return;
      if (key === 'custom') { setCalOpen((v) => !v); return; }
      const p = filtered.filterParam;
      setCalOpen(false);
      setParams((prev) => { const n = { ...prev, [p]: key }; delete n.from; delete n.to; return n; });
    };
    const applyRange = (from: string, to: string) => {
      if (!filtered?.filterParam) return;
      setCalOpen(false);
      setParams((prev) => ({ ...prev, [filtered.filterParam!]: 'custom', from, to }));
    };

    if (error) blocks.push(<OfflineBanner key="off" visible title="Yangilab bo'lmadi" onRetry={() => void refetch()} />);

    if (chips.length > 1) {
      blocks.push(<ChipGroup key="chips" items={chips.map((f) => ({ key: f.key, label: f.label }))} value={activeChip} onChange={setFilter} />);
      if (calOpen) blocks.push(<RangeCalendar key="cal" from={filtered?.range?.from} to={filtered?.range?.to} onApply={applyRange} onClose={() => setCalOpen(false)} />);
    }

    // ── Hero: rolning bosh ko'rsatkichi + rol grafigidan sparkline ──
    const hero = model.hero;
    if (hero) {
      const h = parseHint(hero.hint, hero.key);
      const v = splitValue(hero.value);
      const href = cardHref(hero);
      blocks.push(
        <PressScale key="hero" onPress={href ? () => go(href) : undefined} disabled={!href} scale={0.985} accessibilityRole={href ? 'button' : undefined}>
          <HeroCard
            label={hero.label}
            value={isPlaceholderData ? '…' : v.num}
            unit={isPlaceholderData ? undefined : v.unit}
            delta={h.delta ? { text: h.delta.long, dir: h.delta.dir, tone: h.delta.tone } : undefined}
            spark={sparkOf(model.chart, cfg.spark)}
          >
            {h.rest ? <Txt v="tSm" numberOfLines={2} style={{ color: c.textOnInverseMuted }}>{h.rest}</Txt> : null}
          </HeroCard>
        </PressScale>,
      );
    }

    // ── KPI 2×2 ──
    if (model.kpis.length) blocks.push(<KpiGrid key="kpi" items={model.kpis.map((k) => kpiOf(k, module, openCard(k)))} />);

    // ── 4 tezkor amal (birinchisi asosiy) ──
    const quick = resolveQuick(cfg.quick, data, rcfg.group, !!rcfg.ai, module, go);
    if (quick.length) blocks.push(<ActionGrid key="qa" items={quick} />);

    // ── Kuzatuv va hisobot: jonli reyslar xaritasi, kunlik Excel hisobot (direktor; xarita — mexanikka ham) ──
    if (data.role === 'DIRECTOR' || data.role === 'MECHANIC') {
      const onRoad = data.sections.find((x) => /^Yo'ldagi reyslar/.test(x.title))?.rows.length ?? data.live?.length ?? 0;
      blocks.push(
        <ListGroup key="track">
          <ListItem
            icon="map" module="logistics" title="Reyslar xaritada"
            subtitle={onRoad ? `${onRoad} ta mashina yo'lda · jonli kuzatuv` : "Jonli kuzatuv: mashinalar, ETA, haydovchi"}
            onPress={() => go('/erp/fleet')}
          />
          {data.role === 'DIRECTOR' ? (
            <ListItem icon="download" module={module} title="Kunlik hisobot (Excel)" subtitle="Sotuv, ishlab chiqarish, reyslar, to'lovlar, muammolar" onPress={() => setReportOpen(true)} />
          ) : null}
        </ListGroup>,
      );
    }

    // ── E'tibor talab qiladi (bo'sh bo'lsa blok yo'q) ──
    const attention: AttentionItem[] = [];
    const pendingCount = pending.data?.rows.length ?? 0;
    if (cfg.countList && pendingCount > 0) {
      attention.push({ title: cfg.countList.title, sub: cfg.countList.sub, icon: cfg.countList.icon, module, badge: { text: String(pendingCount), tone: 'warning' }, onPress: () => go(`/${rcfg.group}/work`) });
    }
    for (const x of model.alertCards) {
      const h = parseHint(x.hint, x.key);
      attention.push({ title: x.label, sub: h.rest, icon: cardIcon(x), module, badge: { text: x.value, tone: x.tone === 'danger' ? 'danger' : 'warning' }, onPress: openCard(x) });
    }
    for (const s of model.alertSections) {
      for (const r of s.rows.slice(0, SECTION_ROWS)) {
        const href = rowHref(s, r);
        attention.push({
          title: r.title, sub: r.subtitle, icon: (s.icon ?? ROW_ICON[s.target ?? ''] ?? 'triangle-alert') as IconName, module: listModule(s.target) === 'brand' ? module : listModule(s.target),
          value: r.right,
          badge: r.status ? { text: statusLabel(r.status), tone: r.tone ?? 'neutral' } : r.tone === 'danger' ? { text: 'Muhim', tone: 'danger' } : r.tone === 'warning' ? { text: 'Diqqat', tone: 'warning' } : undefined,
          onPress: href ? () => go(href) : undefined,
        });
      }
    }
    if (attention.length) {
      const extra = attention.length > ATTENTION_ROWS;
      blocks.push(
        <SectionHead
          key="att-h" title="E'tibor talab qiladi"
          action={extra ? (allAlerts ? 'Yashirish' : `Barchasi (${attention.length})`) : undefined}
          onAction={extra ? () => setAllAlerts((v) => !v) : undefined}
        />,
      );
      blocks.push(<AttentionList key="att" items={allAlerts ? attention : attention.slice(0, ATTENTION_ROWS)} />);
    }

    // ── Grafik ──
    const chartCfg = cfg.chart;
    const ch = model.chart?.chart;
    if (ch && chartCfg) {
      if (ch.kind === 'bars' || ch.kind === 'columns') {
        const b = barSeries(ch, chartCfg.series ?? [0]);
        blocks.push(<BarChartCard key="chart" title={chartCfg.title ?? model.chart!.title} unit={ch.kind === 'bars' ? ch.total : undefined} labels={b.labels} series={b.series} />);
      } else if (ch.kind === 'donut') {
        blocks.push(<HBarList key="chart" title={chartCfg.title ?? model.chart!.title} unit={`jami ${ch.total}`} items={ch.items.map((i) => ({ label: i.label, value: i.value }))} format={donutFormat(ch)} />);
      }
    }

    // ── Reja (progress) ──
    if (model.progress) {
      const it = model.progress.item;
      // Server `open` bersa (direktor nazorati: tushum → zayavkalar, xarajat → kirim-chiqim) karta bosiladi
      const card = <ProgressCard title={it.label} value={it.pct ?? 0} caption={progressCaption(it)} tone={it.tone} />;
      blocks.push(it.open
        ? <PressScale key="pg" onPress={() => go(`/erp/list/${it.open}`)} scale={0.985} accessibilityRole="button">{card}</PressScale>
        : <View key="pg">{card}</View>);
    }

    // ── Taqsimot ──
    const bd = model.breakdown?.chart;
    if (bd?.kind === 'donut') {
      blocks.push(<BreakdownCard key="bd" title={model.breakdown!.title} unit={`jami ${bd.total}`} items={bd.items.map((i) => ({ label: i.label, value: i.value }))} format={donutFormat(bd)} />);
    }

    // ── Qolgan server ma'lumotlari — demo uslubidagi bo'limlar ──
    if (model.progress?.rest.length) {
      blocks.push(<SectionHead key="pg-h" title={model.progress.section.title} />);
      blocks.push(<ProgressChart key="pg-rest" chart={{ kind: 'progress', items: model.progress.rest }} onOpen={(k) => go(`/erp/list/${k}`)} />);
    }
    if (model.more.length) {
      blocks.push(<SectionHead key="more-h" title="Boshqa ko'rsatkichlar" />);
      blocks.push(<KpiGrid key="more" items={model.more.map((k) => kpiOf(k, module, openCard(k)))} />);
    }
    for (const s of model.rest) {
      for (const el of serverSection(s, (t) => (t && LIST_MODULE[t]) || module, go, FLEET_ROLES.includes(data.role) && s.target === 'trips' ? { label: 'Xaritada', href: '/erp/fleet' } : undefined)) blocks.push(el);
    }

    // Logistika xaritasi "Xarita" tabida; boshqa rollar: GPS'i bor mashinalar — kichik xarita (demo bloklaridan keyin)
    if (!data.fleet && data.live?.length) tail = <LiveTrucks trucks={data.live} onMap={FLEET_ROLES.includes(data.role) ? () => go('/erp/fleet') : undefined} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      {header}
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        <Reveal loading={isLoading} skeleton={<SkeletonDashboard chips={cfg.periods.length > 1} />} style={{ paddingHorizontal: space.pageX, paddingTop: space.xs }}>
          {blocks}
        </Reveal>
        {tail}
      </ScrollView>
      {data?.role === 'DIRECTOR' ? <DailyReportSheet open={reportOpen} onClose={() => setReportOpen(false)} /> : null}
    </View>
  );
}

/**
 * Serverning qolgan bo'limi — demo bloklari: grafik kartasi, taqsimot yoki sarlavha + ListGroup qatorlari.
 * `Reveal` bolalari bo'lib ketma-ket kiradi (har biri alohida blok).
 */
function serverSection(s: ErpSection, moduleOf: (target?: string) => ModuleTone, onGo: (href: string) => void, extra?: { label: string; href: string }): React.ReactNode[] {
  const ch = s.chart;
  const k = `s-${s.title}`;
  if (ch?.kind === 'bars' || ch?.kind === 'columns') {
    const b = barSeries(ch, ch.kind === 'columns' ? [0, 1] : [0]);
    return [<BarChartCard key={k} title={s.title} unit={ch.kind === 'bars' ? ch.total : undefined} labels={b.labels} series={b.series} />];
  }
  if (ch?.kind === 'donut') {
    return [<BreakdownCard key={k} title={s.title} unit={`jami ${ch.total}`} items={ch.items.map((i) => ({ label: i.label, value: i.value }))} format={donutFormat(ch)} />];
  }
  if (!ch && s.rows.length === 0) return [];
  const many = !ch && s.target && s.rows.length > SECTION_ROWS;
  return [
    <SectionHead
      key={`${k}-h`}
      title={s.title}
      action={extra && s.rows.length ? extra.label : s.target && s.rows.length && listable(s.target) ? 'Barchasi' : undefined}
      onAction={extra && s.rows.length ? () => onGo(extra.href) : s.target && listable(s.target) ? () => onGo(`/erp/list/${s.target}`) : undefined}
    />,
    ch?.kind === 'progress'
      ? <ProgressChart key={k} chart={ch} onOpen={(key) => onGo(`/erp/list/${key}`)} />
      : (
        <RowsGroup
          key={k}
          rows={many ? s.rows.slice(0, SECTION_ROWS) : s.rows}
          icon={s.icon ?? ROW_ICON[s.target ?? ''] ?? 'circle'}
          module={moduleOf(s.target)}
          onRow={(r) => { const h = rowHref(s, r); return h ? () => onGo(h) : undefined; }}
        />
      ),
  ];
}

/** Kartochka turi ro'yxat sifatida ham ochiladimi (`problem`, `dash`, `sex` — faqat kartochka). */
const listable = (target: string) => !['problem', 'dash', 'sex', 'rep', 'activity'].includes(target);

/** Spekdagi tezkor amallar → mavjud manzillar. Rolga yopiq yoki ma'lumoti yo'q amal tushib qoladi. */
function resolveQuick(specs: QuickSpec[], data: ErpHomeData, group: string, hasAi: boolean, module: ModuleTone, go: (h: string) => void): ActionItem[] {
  const hasNew = (k: string) => data.quick.some((q) => q.kind === 'new' && q.key === k) || data.create?.key === k;
  const hasList = (k: string) => data.quick.some((q) => q.kind === 'list' && q.key === k);
  const out: ActionItem[] = [];
  const add = (label: string, icon: ActionItem['icon'], href: string, m: ModuleTone = module) => out.push({ label, icon, module: m, onPress: () => go(href) });
  for (const q of specs) {
    const t = q.to;
    if (t.kind === 'new' && hasNew(t.key)) add(q.label, q.icon, `/erp/new/${t.key}`);
    else if (t.kind === 'list') {
      if (data.list.key === t.key) add(q.label, q.icon, `/${group}/work`);
      else if (hasList(t.key)) add(q.label, q.icon, `/erp/list/${t.key}`, listModule(t.key) === 'brand' ? module : listModule(t.key));
    } else if (t.kind === 'tab') {
      if (t.tab !== 'ai' || hasAi) add(q.label, q.icon, `/${group}/${t.tab}`);
    } else if (t.kind === 'card') {
      const card = data.cards.find((x) => (typeof t.key === 'string' ? x.key === t.key : t.key.test(x.key)));
      const h = card ? cardHref(card) : null;
      if (h) add(q.label, q.icon, h);
    } else if (t.kind === 'row') {
      const s = data.sections.find((x) => t.section.test(x.title));
      const r = s?.rows[0];
      if (s && r) {
        // Marshrut — faqat yuklangan / yo'ldagi reysda
        if (t.open === 'route') { if (r.status === 'LOADED' || r.status === 'ON_ROAD') add(q.label, q.icon, `/yolda/${r.id}`); }
        else if (s.target) add(q.label, q.icon, `/erp/${s.target}/${r.id}`);
      }
    }
  }
  // Spekdagi amal rolga ochiq bo'lmasa — serverning boshqa bo'limlari bilan to'ldiriladi (4 tagacha)
  for (const q of data.quick) {
    if (out.length >= 4 || specs.length < 4) break;
    if (q.kind !== 'list' || q.key === data.list.key || out.some((o) => o.label === q.label)) continue;
    add(q.label, ROW_ICON[q.key] ?? 'folder', `/erp/list/${q.key}`, listModule(q.key) === 'brand' ? module : listModule(q.key));
  }
  return out.slice(0, 4);
}

// ───────────────────────── Yo'ldagi mashinalar ─────────────────────────

/**
 * Bosh ekrandagi jonli xarita: haydovchi qayerda va reys boshidan beri necha km yurdi.
 * Ma'lumot ERP'dan keladi (`/api/mobile/home` → `live`), ruxsat ham o'sha yerda hal bo'ladi —
 * sotuvchiga faqat o'zi ochgan zayavkalarning mashinalari ko'rinadi.
 */
function LiveTrucks({ trucks, onMap }: { trucks: ErpLiveTruck[]; onMap?: () => void }) {
  const { c } = useTheme();
  const router = useRouter();

  // Barcha mashinani qamrab oladigan ko'rinish; bittada ham chetda qolmasin deb chekka + zaxira
  const lats = trucks.map((t) => t.lat), lngs = trucks.map((t) => t.lng);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(0.04, (Math.max(...lats) - Math.min(...lats)) * 1.6),
    longitudeDelta: Math.max(0.04, (Math.max(...lngs) - Math.min(...lngs)) * 1.6),
  };

  return (
    <View style={{ paddingHorizontal: space.pageX, paddingTop: space.xl }}>
      <SectionHead title={`Yo'lda · ${trucks.length} ta`} action={onMap ? 'Xaritada' : undefined} onAction={onMap} />
      {/* Xarita kalitisiz build'da pastdagi ro'yxat qoladi, ya'ni ma'lumot
          yo'qolmaydi, faqat ko'rinish soddalashadi (`core/config.ts`). */}
      {config.mapsEnabled && (
      <View style={{ height: 190, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault, marginBottom: space.sm }}>
        {/* Scroll bilan urishmasin deb xarita ichida siljimaydi — tafsilot pastdagi qatordan ochiladi */}
        <MapView style={{ flex: 1 }} initialRegion={region} interactive={false}>
          {trucks.map((t) => (
            <Marker key={t.ref} coordinate={{ latitude: t.lat, longitude: t.lng }} tone="info" />
          ))}
        </MapView>
      </View>
      )}
      <Card style={{ paddingVertical: 0 }}>
        {trucks.map((t, i) => {
          const km = fmtUnit(t.km, 'km');
          return (
            <ListItem
              key={t.ref}
              icon="truck"
              module="logistics"
              title={`${t.plate} · ${t.driver}`}
              subtitle={`${t.customer} · ${t.status}${t.etaMin != null ? ` · ~${t.etaMin} daq` : ''}`}
              right={<Txt v="bodyStrong" numberOfLines={1} style={{ flexShrink: 0, minWidth: textRoom(km, typeScale.bodyStrong.fontSize) }}>{km}</Txt>}
              last={i === trucks.length - 1}
              onPress={t.tripId ? () => router.push(`/erp/trips/${t.tripId}` as never) : undefined}
            />
          );
        })}
      </Card>
    </View>
  );
}

// ───────────────────────── Ishchi ro'yxat (demo "ERP ro'yxat") ─────────────────────────

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

/** Qator izohidagi sana: "02.10.2026", "2026-10-02" yoki "02.10 14:20". Topilmasa null (sarlavha qo'yilmaydi). */
function rowDate(r: ErpRow): Date | null {
  const t = `${r.subtitle ?? ''} ${r.title}`;
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(t);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /\b(\d{1,2})\.(\d{2})\s+\d{1,2}:\d{2}\b/.exec(t);
  if (m) {
    const now = new Date();
    const d = new Date(now.getFullYear(), Number(m[2]) - 1, Number(m[1]));
    if (d.getTime() - now.getTime() > 31 * 86_400_000) d.setFullYear(now.getFullYear() - 1);
    return d;
  }
  return null;
}

/** Demo sarlavhalari: "Bugun", "Kecha", aks holda "28-sen". */
function dayLabel(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (diff === 0) return 'Bugun';
  if (diff === 1) return 'Kecha';
  if (diff === -1) return 'Ertaga';
  return `${d.getDate()}-${MONTHS[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

/** Ketma-ket bir kunlik qatorlar guruhi. Hamma qatorda sana bo'lsagina guruhlanadi — aks holda bitta guruh, sarlavhasiz. */
function groupByDay(rows: ErpRow[]): { label: string | null; rows: ErpRow[] }[] {
  const dates = rows.map(rowDate);
  if (!rows.length || dates.some((d) => !d)) return [{ label: null, rows }];
  const out: { label: string; rows: ErpRow[] }[] = [];
  rows.forEach((r, i) => {
    const l = dayLabel(dates[i]!);
    const last = out[out.length - 1];
    if (last && last.label === l) last.rows.push(r); else out.push({ label: l, rows: [r] });
  });
  return out;
}

/**
 * Ro'yxat — demo "ERP ro'yxat" (shot 03): sarlavha (orqaga + "+"), qidiruv, sonli chiplar, kun sarlavhalari
 * ("Bugun", "Kecha" — sana bo'lsa), ListGroup qatorlari: plitka, nom, izoh, o'ngda qiymat va holat nishoni.
 * `fallback` — ro'yxat rolga ochiq bo'lmasa (server rad etsa) shu ko'rsatiladi.
 */
export function ErpList({ listKey, title, onBack, fallback }: { listKey: string; title?: string; onBack?: () => void; fallback?: React.ReactNode }) {
  const { c } = useTheme();
  const router = useRouter();
  const raise = useHeaderRaise();
  const [q, setQ] = useState('');
  // Filtrlar bo'lsa (ishlab chiqarish "Zayavkalar"i) — tanlangani serverga yuboriladi
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data, isLoading, refetch, isRefetching, error } = useErpList(listKey, q.trim() || undefined, filter);
  const home = useErpHome().data;
  const filters = data?.filters;
  const active = filters?.find((f) => f.active);
  const module = listModule(listKey);
  const canCreate = !!home && (home.create?.key === listKey || home.quick.some((x) => x.kind === 'new' && x.key === listKey));
  const groups = useMemo(() => groupByDay(data?.rows ?? []), [data?.rows]);

  if (fallback && error && !data && !isLoading) return <>{fallback}</>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <TabHeader
        title={data?.title ?? title ?? "Ro'yxat"}
        onBack={onBack}
        raised={raise.raised}
        actions={canCreate ? [{ icon: 'plus', label: 'Yangi', onPress: () => router.push(`/erp/new/${listKey}` as never) }] : undefined}
      />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl, gap: space.stack }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        <SearchField value={q} onChangeText={setQ} placeholder="Nomi, raqam yoki mijoz" />
        {filters?.length ? (
          <ChipGroup items={filters.map((f) => ({ key: f.key, label: f.label, count: f.count }))} value={active?.key ?? filters[0]!.key} onChange={setFilter} />
        ) : null}
        {isLoading ? <SkeletonList rows={6} />
          : error && !data ? <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring." onRetry={() => void refetch()} />
          : !data || data.rows.length === 0 ? <EmptyState title="Hech narsa topilmadi" hint={q ? "Boshqa so'z bilan qidiring" : active ? `"${active.label}" bo'yicha hujjat yo'q` : undefined} />
          : (
            <Reveal replay={filter}>
              {groups.flatMap((g, gi) => [
                g.label ? <Txt key={`h${gi}`} v="overline" color="muted" style={{ marginBottom: -space.xs }}>{g.label}</Txt> : null,
                <ListGroup key={`g${gi}`}>
                  {g.rows.map((r) => (
                    <ErpRowItem key={r.id} row={r} icon={ROW_ICON[listKey] ?? 'circle'} module={module} onPress={() => router.push(`/erp/${DETAIL_OF[listKey] ?? listKey}/${idSeg(r.id)}` as never)} />
                  ))}
                </ListGroup>,
              ])}
            </Reveal>
          )}
      </ScrollView>
    </View>
  );
}

// ───────────────────────── Bo'limlar (direktor tabi, menyudagi ro'yxatlar) ─────────────────────────

/**
 * Rolga ochiq barcha bo'limlar — yangi hujjat formalari va ro'yxatlar (`/api/mobile/home` → `quick`),
 * kompyuterdagi ERP menyusidagi har bir bo'lim. `embedded` — boshqa tab ichida (ro'yxat rolga yopiq bo'lsa).
 */
export function ErpSections({ title, embedded }: { title: string; embedded?: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  const raise = useHeaderRaise();
  const erp = useSession((s) => s.erp);
  const module = roleModule(erp?.role ?? 'DIRECTOR');
  const { data, isLoading, refetch, isRefetching } = useErpHome();
  const quick = data?.quick ?? [];
  const lists = quick.filter((q) => q.kind === 'list');
  const forms = quick.filter((q) => q.kind === 'new');
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <TabHeader title={title} raised={raise.raised} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        <Reveal loading={isLoading} skeleton={<SkeletonList rows={6} />}>
          {embedded ? <Callout key="emb" tone="neutral" icon="info">Bu bo&apos;lim sizning rolingizga ochilmagan — mavjud bo&apos;limlar:</Callout> : null}
          {forms.length ? <SectionHead key="f-h" title="Yangi hujjat" /> : null}
          {forms.length ? (
            <ListGroup key="f">
              {forms.map((q) => <ListItem key={`new-${q.key}`} icon="plus" module={module} title={q.label} onPress={() => router.push(`/erp/new/${q.key}` as never)} />)}
            </ListGroup>
          ) : null}
          {lists.length ? <SectionHead key="l-h" title="Ro'yxatlar" /> : null}
          {lists.length ? (
            <ListGroup key="l">
              {lists.map((q) => <ListItem key={`list-${q.key}`} icon={ROW_ICON[q.key] ?? q.icon} module={listModule(q.key) === 'brand' ? module : listModule(q.key)} title={q.label} onPress={() => router.push(`/erp/list/${q.key}` as never)} />)}
            </ListGroup>
          ) : null}
          {!forms.length && !lists.length ? <EmptyState key="e" title="Bo'limlar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void refetch()} /> : null}
        </Reveal>
      </ScrollView>
    </View>
  );
}

// ───────────────────────── Logistika: "Xarita" tabi ─────────────────────────

/**
 * Faol reyslar xaritasi — direktorning "Reyslar xaritada" ekrani bilan bitta komponent (`./fleet.tsx`):
 * 12 s da yangilanadi, holat rangidagi belgilar, bosilganda pastdan reys oynasi, "hammasini ko'rsatish".
 */
function ErpMapTab({ title }: { title: string }) {
  return <FleetScreen title={title} />;
}

// ───────────────────────── Haydovchi: "Yo'l" tabi ─────────────────────────

/** Joriy (ochiq) reys: yuklangan / yo'ldagi bo'lsa marshrut, aks holda reys kartochkasi. */
function ErpRoadTab({ title }: { title: string }) {
  const { c } = useTheme();
  const router = useRouter();
  const raise = useHeaderRaise();
  const { data, isLoading, refetch, isRefetching } = useErpHome();
  const s = data?.sections.find((x) => /^Ochiq reyslarim/.test(x.title));
  const r = s?.rows[0];
  const onRoad = r?.status === 'LOADED' || r?.status === 'ON_ROAD';
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <TabHeader title={title} raised={raise.raised} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        <Reveal loading={isLoading} skeleton={<SkeletonList rows={2} />}>
          {r ? <SectionHead key="h" title="Joriy reys" /> : null}
          {r ? (
            <ListGroup key="r">
              <ErpRowItem row={r} icon="truck" module="logistics" onPress={() => router.push(`/erp/trips/${r.id}` as never)} />
            </ListGroup>
          ) : null}
          {r && onRoad ? <Button key="go" size="xl" icon="navigation" title="Marshrutni ochish" onPress={() => router.push(`/yolda/${r.id}` as never)} /> : null}
          {r && !onRoad ? <Button key="open" size="xl" variant="secondary" icon="truck" title="Reys kartochkasi" onPress={() => router.push(`/erp/trips/${r.id}` as never)} /> : null}
          {r && !onRoad ? <Txt key="hint" v="tSm" align="center">Marshrut beton yuklangach ochiladi</Txt> : null}
          {!r ? <EmptyState key="e" icon="navigation" title="Ochiq reys yo'q" hint="Dispetcher reys biriktirganda yo'l shu yerda ochiladi" /> : null}
        </Reveal>
      </ScrollView>
    </View>
  );
}

// ───────────────────────── Profil / menyu ─────────────────────────

export function ErpMenu() {
  const { c } = useTheme();
  const router = useRouter();
  const raise = useHeaderRaise();
  const { erp, signOut } = useSession();
  const cfg = erp ? erpRoleConfig(erp.role) : null;
  const module = roleModule(erp?.role ?? 'DIRECTOR');
  const [hasPin, setHasPin] = React.useState(false);
  // "Bo'limlar" ro'yxati standart yig'iq — ochiq/yopiqligi eslab qolinadi
  const [sectionsOpen, setSectionsOpenRaw] = useState(() => kv.getBoolean('erp.menu.sectionsOpen') ?? false);
  const toggleSections = () => setSectionsOpenRaw((v) => { kv.set('erp.menu.sectionsOpen', !v); return !v; });
  React.useEffect(() => { void pinStore.has().then(setHasPin); }, []);
  // Bo'limlar ro'yxati — `/api/mobile/home` dagi `quick`: kompyuterdagi ERP menyusida ko'ringan har bir bo'lim shu yerda ham turadi.
  const quick = useErpHome().data?.quick ?? [];
  const lists = quick.filter((q) => q.kind === 'list');
  const forms = quick.filter((q) => q.kind === 'new');
  // Hisobni o'chirish (do'kon talabi): xodim hisobini direktor bergan — darhol o'chirilmaydi,
  // so'rov direktorga tushadi (Sozlamalar → Hisob so'rovlari), tasdiqlansa login yopiladi.
  const [delAsk, setDelAsk] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const isDirector = erp?.role === 'DIRECTOR';
  const canFleet = !!erp && FLEET_ROLES.includes(erp.role);
  const [delBusy, setDelBusy] = useState(false);
  const [delPending, setDelPending] = useState<boolean | null>(null);
  useEffect(() => { erpAuth.deletionStatus().then((r) => setDelPending(r.pending)).catch(() => setDelPending(false)); }, []);
  const requestDeletion = async () => {
    setDelBusy(true);
    try {
      await erpAuth.requestDeletion();
      setDelAsk(false); setDelPending(true);
      toast.info("Direktor tasdiqlagach hisobingiz yopiladi.", "So'rov yuborildi");
    } catch (e) { toast.error((e as Error).message, 'Xato'); } finally { setDelBusy(false); }
  };
  const cancelDeletion = async () => {
    try { await erpAuth.cancelDeletion(); setDelPending(false); toast.success("So'rov qaytarib olindi"); }
    catch (e) { toast.error((e as Error).message, 'Xato'); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <TabHeader title="Menyu" raised={raise.raised} />
      <ScrollView onScroll={raise.onScroll} scrollEventThrottle={raise.scrollEventThrottle} style={{ backgroundColor: c.bgApp }} contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl }}>
        <Appear>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <Avatar name={erp?.fullName} size={size.avatarLg} tone="brand" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="overline" color="brand" numberOfLines={1}>{erp?.roleLabel}</Txt>
              <Txt v="titleMd" numberOfLines={1}>{erp?.fullName}</Txt>
              <Txt v="caption" numberOfLines={1}>{erp?.login}</Txt>
            </View>
          </Card>
        </Appear>

        <Appear delay={stagger(1)} style={{ marginTop: space.md }}>
          <Callout tone="brand" icon="refresh-cw">
            {`${cfg?.label ?? 'ERP'} bo'limi — ekrandagi raqamlar kompyuterdagi Insof ERP bilan bir xil, bevosita bog'langan.`}
          </Callout>
        </Appear>

        {lists.length || forms.length ? (
          <Appear delay={stagger(2)} style={{ marginTop: space.xl }}>
            <SectionHead
              title="Bo'limlar"
              count={lists.length + forms.length}
              action={sectionsOpen ? 'Yashirish' : "Ko'rsatish"}
              onAction={toggleSections}
            />
            {sectionsOpen ? (
              <ListGroup>
                {forms.map((q) => (
                  <ListItem key={`new-${q.key}`} icon="plus" module={module} title={q.label} subtitle="Yangi hujjat" onPress={() => router.push(`/erp/new/${q.key}` as never)} />
                ))}
                {lists.map((q) => (
                  <ListItem key={`list-${q.key}`} icon={ROW_ICON[q.key] ?? q.icon} module={listModule(q.key)} title={q.label} onPress={() => router.push(`/erp/list/${q.key}` as never)} />
                ))}
              </ListGroup>
            ) : null}
          </Appear>
        ) : null}

        {canFleet ? (
          <Appear delay={stagger(2)} style={{ marginTop: space.xl }}>
            <SectionHead title="Kuzatuv va hisobot" />
            <ListGroup>
              <ListItem icon="map" module="logistics" title="Reyslar xaritada" subtitle="Jonli kuzatuv: mashina, haydovchi, ETA" onPress={() => router.push('/erp/fleet' as never)} />
              {isDirector ? (
                <ListItem icon="download" module={module} title="Kunlik hisobot (Excel)" subtitle="Kunni tanlang — fayl ulashiladi yoki ochiladi" onPress={() => setReportOpen(true)} />
              ) : null}
            </ListGroup>
          </Appear>
        ) : null}

        <Appear delay={stagger(3)} style={{ marginTop: space.xl }}>
          <SectionHead title="Ilova" />
          <ListGroup>
            <ListItem icon="settings" module={module} title="Sozlamalar" subtitle="Mavzu, palitra, til va yordam" onPress={() => router.push('/settings' as never)} />
            <ListItem icon="bell" module={module} title="Bildirishnomalar" onPress={() => router.push('/erp/bildirishnomalar' as never)} />
          </ListGroup>
        </Appear>

        <Appear delay={stagger(4)} style={{ marginTop: space.xl }}>
          <SectionHead title="Xavfsizlik" />
          <ListGroup>
            <ListItem
              icon="grid-3x3" module={module}
              title="PIN kod"
              subtitle={hasPin ? "Yoqilgan — o'chirish uchun bosing" : 'Ilovani ochishda tez kirish'}
              onPress={() => router.push(hasPin ? '/(auth)/pin?mode=off' : '/(auth)/pin')}
            />
            <ListItem
              icon="lock" module={module}
              title="Parolni o'zgartirish"
              subtitle="Boshqa qurilmalardagi seanslar yopiladi"
              onPress={() => router.push('/(auth)/change-password')}
            />
          </ListGroup>
        </Appear>

        <Appear delay={stagger(5)} style={{ marginTop: space.xl }}>
          <SectionHead title="Hisob" />
          <ListGroup>
            {delPending ? (
              <ListItem icon="hourglass" tone="warning" title="Hisobni o'chirish so'ralgan" subtitle="Direktor tasdig'i kutilmoqda. Fikringiz o'zgarsa — bosing" onPress={() => void cancelDeletion()} />
            ) : (
              <ListItem icon="user-x" tone="danger" title="Hisobni o'chirish" subtitle="So'rov direktorga boradi; tasdiqlansa login yopiladi" onPress={() => setDelAsk(true)} />
            )}
          </ListGroup>
        </Appear>

        <Appear delay={stagger(6)} style={{ marginTop: space.xl }}>
          <Button variant="secondary" icon="log-out" title="Chiqish" onPress={() => void signOut()} />
        </Appear>
      </ScrollView>
      <Confirm
        open={delAsk}
        onClose={() => setDelAsk(false)}
        onConfirm={() => void requestDeletion()}
        danger
        loading={delBusy}
        title="Hisobni o'chirish"
        confirmLabel="So'rov yuborish"
        message="Hisobingizni direktor bergan, shuning uchun so'rov unga boradi. Tasdiqlangach login yopiladi, ilova va kompyuterdagi seanslar tugaydi. Xodim kartangiz (HR) saqlanib qoladi."
      />
      {isDirector ? <DailyReportSheet open={reportOpen} onClose={() => setReportOpen(false)} /> : null}
    </View>
  );
}
