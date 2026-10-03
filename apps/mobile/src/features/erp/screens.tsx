import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Callout, Card, EmptyState, IconButton, Input, ListItem, Txt, fmtUnit, typeScale } from '@/design/primitives';
import { Avatar, Confirm, fmtShort, tabIcon, toast } from '@/design/ui';
import { ActionGrid, AttentionList, BarChartCard, BreakdownCard, ChipGroup, HBarList, HeroCard, ListGroup, OfflineBanner, PageHeader, ProgressCard, SectionHead, type ActionItem, type AttentionItem } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { ERP_ROLE_MODULE, LIST_MODULE, ModuleTone, radius, size, space, textRoom, toneColors } from '@/design/tokens';
import { tabsOptions } from '@/design/nav';
import { Appear, PressScale, stagger } from '@/design/motion';
import { useSession } from '@/core/session';
import MapView, { Marker } from 'react-native-maps';
import { config } from '@/core/config';
import { erpAuth, type ErpCard, type ErpFleetTruck, type ErpHomeData, type ErpLiveTruck, type ErpRole, type ErpRow, type ErpSection, type ErpSectionChart } from '@/core/erp';
import { AI_TAB, MENU_TAB, erpRoleConfig } from './roles';
import { roleDashboard, type QuickSpec, type RoleDashboard } from './dashboards';
import { useErpHome, useErpList, useErpNotifications } from './api';
import { DashSkeleton, ErpKpiGrid, ListSkeleton, ROW_ICON, RowsGroup, SectionEmpty, cardHref, isZero, listModule, parseHint, splitValue, statusLabel } from './ui';
import { RangeCalendar } from './range-calendar';
import { ProgressChart } from './charts';
import { pinStore } from '@/core/pin';
import { kv } from '@/core/storage';
import type { IconName } from '@/design/icons';
import { setBadge } from '@/core/push';

export { SectionEmpty };

/**
 * ERP bo'limlarining ekranlari — dizayn tizimi bloklari ustida.
 *
 * Bosh sahifa: sarlavha → davr chiplari → bosh ko'rsatkich → 4 KPI → tezkor amallar →
 * "E'tibor talab qiladi" → grafik / taqsimot / plan → server bo'limlari.
 * Raqamlarni server beradi (`/api/mobile/home`); qaysi karta qaysi blokka tushishi — `dashboards.ts`.
 */

/** Rol → ikonka plitkalarining modul toni. */
const roleModule = (role: ErpRole): ModuleTone => ERP_ROLE_MODULE[role] ?? 'brand';

// ───────────────────────── Tablar ─────────────────────────

export function ErpTabs({ role }: { role: ErpRole }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cfg = erpRoleConfig(role);
  const create = useErpHome().data?.create ?? null;
  const driver = role === 'DRIVER';
  // Direktor: "Tasdiqlar" tabida kutayotganlar soni (bosh sahifadagi bilan bitta kesh)
  const approvals = useErpList(cfg.ai ? cfg.listKey : '').data?.rows.length ?? 0;
  const danger = toneColors(c, 'danger');
  return (
    <Tabs screenOptions={tabsOptions(c, insets.bottom, { driver })}>
      <Tabs.Screen name="index" options={{ title: cfg.homeTitle, headerShown: false, tabBarIcon: tabIcon(cfg.homeIcon, { driver }) }} />
      <Tabs.Screen
        name="work"
        options={{
          title: cfg.workTitle,
          tabBarIcon: tabIcon(cfg.workIcon, { driver }),
          tabBarBadge: cfg.ai && approvals > 0 ? approvals : undefined,
          tabBarBadgeStyle: { backgroundColor: danger.solid, color: c.textOnSolid },
          headerRight: create
            ? () => <IconButton icon="plus" label="Yangi" tone="brand" onPress={() => router.push(`/erp/new/${create.key}` as never)} style={{ marginRight: space.sm }} />
            : undefined,
        }}
      />
      {cfg.ai ? <Tabs.Screen name="ai" options={{ title: AI_TAB.title, tabBarIcon: tabIcon(AI_TAB.icon, { driver }) }} /> : null}
      <Tabs.Screen name="menu" options={{ title: MENU_TAB.title, tabBarIcon: tabIcon(MENU_TAB.icon, { driver }) }} />
    </Tabs>
  );
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

/** Hero sparkline'i — asosiy grafikning tanlangan seriyasi (kamida 2 nuqta va bitta musbat qiymat). */
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

/** Bo'lim qatori bosilganda — kartochka (`target`) yoki ro'yxat (`open`). */
const rowHref = (s: ErpSection, r: ErpRow) => (s.target ? `/erp/${s.target}/${r.id}` : r.open ? `/erp/list/${r.open}` : null);

/** Ro'yxat bo'limlarida bosh sahifada ko'rinadigan qatorlar soni ("Barchasi" — qolgani). */
const SECTION_ROWS = 6;

// ───────────────────────── Bosh ekran ─────────────────────────

export function ErpHome() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const erp = useSession((s) => s.erp);
  const sessionRole: ErpRole = erp?.role ?? 'DIRECTOR';
  const cfg = roleDashboard(sessionRole);
  // Davr — server hisoblaydi, ilova faqat parametrni yuboradi. Chipsiz rollar (kassa, haydovchi) — doim "bugun".
  const [params, setParams] = useState<Record<string, string>>(() => (cfg.fixedPeriod ? { [sessionRole === 'DIRECTOR' ? 'revenue' : 'period']: cfg.fixedPeriod } : {}));
  const { data, isLoading, refetch, isRefetching, error, isPlaceholderData } = useErpHome(params);
  const [calOpen, setCalOpen] = useState(false);
  const pending = useErpList(cfg.countList?.key ?? '');
  const unread = useErpNotifications().data?.unread ?? 0;
  useEffect(() => { setBadge(unread); }, [unread]);

  const model = useMemo(() => (data ? buildModel(data, cfg) : null), [data, cfg]);

  if (isLoading) return <View style={{ flex: 1, backgroundColor: c.bgApp }}><DashSkeleton topInset={insets.top} /></View>;
  if (!data || !model) {
    return (
      <ScrollView
        style={{ backgroundColor: c.bgApp }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: insets.top }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        <EmptyState icon="cloud-off" title="Ma'lumot kelmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void refetch()} />
      </ScrollView>
    );
  }

  const role = data.role;
  const rcfg = erpRoleConfig(role);
  const module = roleModule(role);
  const go = (href: string) => router.push(href as never);
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

  // ── Bosh ko'rsatkich ──
  const hero = model.hero;
  const heroHint = hero ? parseHint(hero.hint, hero.key) : {};
  const heroVal = hero ? splitValue(hero.value) : null;
  const heroHref = hero ? cardHref(hero) : null;

  // ── Tezkor amallar (faqat rolga ochiq manzillar) ──
  const quick = resolveQuick(cfg.quick, data, rcfg.group, !!rcfg.ai, module, go);

  // ── E'tibor talab qiladi ──
  const attention: AttentionItem[] = [];
  const pendingCount = pending.data?.rows.length ?? 0;
  if (cfg.countList && pendingCount > 0) {
    attention.push({ title: cfg.countList.title, sub: cfg.countList.sub, icon: cfg.countList.icon, module, badge: { text: String(pendingCount), tone: 'warning' }, onPress: () => go(`/${rcfg.group}/work`) });
  }
  for (const x of model.alertCards) {
    const h = parseHint(x.hint, x.key);
    attention.push({ title: x.label, sub: h.rest, icon: (x.icon ?? 'triangle-alert') as IconName, module, value: x.value, badge: { text: x.tone === 'danger' ? 'Muhim' : 'Diqqat', tone: x.tone === 'danger' ? 'danger' : 'warning' }, onPress: openCard(x) });
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
  const moreAlerts = model.alertSections.find((s) => s.target && s.rows.length > SECTION_ROWS);

  const chartCfg = cfg.chart;
  const spark = sparkOf(model.chart, cfg.spark);
  const rowModule = (target?: string): ModuleTone => (target && LIST_MODULE[target]) || module;
  let step = 0;
  const next = () => stagger(++step);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader
        overline={`${data.roleLabel} · ${data.fullName}`}
        title={cfg.title}
        avatar={{ name: data.fullName }}
        onAvatar={() => go(`/${rcfg.group}/menu`)}
        actions={[{ icon: unread > 0 ? 'bell-ring' : 'bell', label: 'Bildirishnomalar', badge: unread || undefined, onPress: () => go('/erp/bildirishnomalar') }]}
        style={{ paddingTop: insets.top + space.sm }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        <View style={{ paddingHorizontal: space.pageX, gap: space.lg }}>
          <OfflineBanner visible={!!error} title="Yangilab bo'lmadi" onRetry={() => void refetch()} />

          {chips.length > 1 ? (
            <View style={{ gap: space.md }}>
              <ChipGroup items={chips.map((f) => ({ key: f.key, label: f.label }))} value={activeChip} onChange={setFilter} />
              {calOpen ? <RangeCalendar from={filtered?.range?.from} to={filtered?.range?.to} onApply={applyRange} onClose={() => setCalOpen(false)} /> : null}
            </View>
          ) : null}

          {hero && heroVal ? (
            <Appear>
              <PressScale onPress={heroHref ? () => go(heroHref) : undefined} disabled={!heroHref} scale={0.985} accessibilityRole={heroHref ? 'button' : undefined}>
                <HeroCard
                  label={hero.label}
                  value={isPlaceholderData ? '…' : heroVal.num}
                  unit={isPlaceholderData ? undefined : heroVal.unit}
                  delta={heroHint.delta ? { text: heroHint.delta.long, dir: heroHint.delta.dir, tone: heroHint.delta.tone } : undefined}
                  spark={spark}
                >
                  {heroHint.rest ? <Txt v="caption" numberOfLines={2} style={{ color: c.textOnInverseMuted }}>{heroHint.rest}</Txt> : null}
                </HeroCard>
              </PressScale>
            </Appear>
          ) : null}

          {model.kpis.length ? <ErpKpiGrid items={model.kpis.map((k) => ({ card: k, module, onPress: openCard(k) }))} offset={1} /> : null}

          {quick.length ? <ActionGrid items={quick} /> : null}
        </View>

        <View style={{ paddingHorizontal: space.pageX, paddingTop: space.xl }}>
          <SectionHead
            title="E'tibor talab qiladi"
            count={attention.length || undefined}
            action={moreAlerts ? 'Barchasi' : undefined}
            onAction={moreAlerts?.target ? () => go(`/erp/list/${moreAlerts.target}`) : undefined}
          />
          {attention.length
            ? <Appear delay={next()}><AttentionList items={attention} /></Appear>
            : <Callout tone="success" icon="circle-check">Hozircha shoshilinch ish yo&apos;q</Callout>}
        </View>

        {/* Logistika: faol reyslar xaritada; boshqa rollar: GPS'i bor mashinalar — kichik xarita */}
        {data.fleet ? <FleetMap fleet={data.fleet} /> : data.live?.length ? <LiveTrucks trucks={data.live} /> : null}

        {model.chart?.chart || model.breakdown?.chart?.kind === 'donut' || model.progress ? (
          <View style={{ paddingHorizontal: space.pageX, paddingTop: space.xl, gap: space.grid }}>
            <SectionHead title="Tahlil" />
            {model.chart?.chart && chartCfg ? (
              <Appear delay={next()}>
                {(model.chart.chart.kind === 'bars' || model.chart.chart.kind === 'columns') ? (() => {
                  const ch = model.chart!.chart as Bars | Columns;
                  const b = barSeries(ch, chartCfg.series ?? [0]);
                  return <BarChartCard title={chartCfg.title ?? model.chart!.title} unit={ch.kind === 'bars' ? ch.total : undefined} labels={b.labels} series={b.series} />;
                })() : model.chart.chart.kind === 'donut' ? (
                  <HBarList title={chartCfg.title ?? model.chart.title} unit={`jami ${model.chart.chart.total}`} items={model.chart.chart.items.map((i) => ({ label: i.label, value: i.value }))} format={donutFormat(model.chart.chart)} />
                ) : null}
              </Appear>
            ) : null}
            {model.breakdown?.chart?.kind === 'donut' ? (
              <Appear delay={next()}>
                <BreakdownCard title={model.breakdown.title} unit={`jami ${model.breakdown.chart.total}`} items={model.breakdown.chart.items.map((i) => ({ label: i.label, value: i.value }))} format={donutFormat(model.breakdown.chart)} />
              </Appear>
            ) : null}
            {model.progress ? (
              <Appear delay={next()} style={{ gap: space.grid }}>
                <ProgressCard title={model.progress.item.label} value={model.progress.item.pct ?? 0} caption={progressCaption(model.progress.item)} tone={model.progress.item.tone} />
                {model.progress.rest.length ? <ProgressChart chart={{ kind: 'progress', items: model.progress.rest }} onOpen={(k) => go(`/erp/list/${k}`)} /> : null}
              </Appear>
            ) : null}
          </View>
        ) : null}

        {model.more.length ? (
          <View style={{ paddingHorizontal: space.pageX, paddingTop: space.xl }}>
            <SectionHead title="Boshqa ko'rsatkichlar" />
            <ErpKpiGrid items={model.more.map((k) => ({ card: k, module, onPress: openCard(k) }))} />
          </View>
        ) : null}

        {model.rest.map((s) => (
          <View key={s.title} style={{ paddingHorizontal: space.pageX, paddingTop: space.xl }}>
            <ServerSection s={s} module={rowModule(s.target)} onGo={go} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Serverning qolgan bo'limi — diagrammasiga qarab blok, aks holda qatorlar guruhi. */
function ServerSection({ s, module: m, onGo }: { s: ErpSection; module: ModuleTone; onGo: (href: string) => void }) {
  const ch = s.chart;
  const many = !ch && s.target && s.rows.length > SECTION_ROWS;
  if (ch?.kind === 'bars' || ch?.kind === 'columns') {
    const b = barSeries(ch, ch.kind === 'columns' ? [0, 1] : [0]);
    return <BarChartCard title={s.title} unit={ch.kind === 'bars' ? ch.total : undefined} labels={b.labels} series={b.series} />;
  }
  if (ch?.kind === 'donut') {
    return <BreakdownCard title={s.title} unit={`jami ${ch.total}`} items={ch.items.map((i) => ({ label: i.label, value: i.value }))} format={donutFormat(ch)} />;
  }
  return (
    <>
      <SectionHead
        title={s.title}
        count={!ch && s.rows.length ? s.rows.length : undefined}
        action={s.target && s.rows.length ? 'Barchasi' : undefined}
        onAction={s.target ? () => onGo(`/erp/list/${s.target}`) : undefined}
      />
      {ch?.kind === 'progress' ? <ProgressChart chart={ch} onOpen={(k) => onGo(`/erp/list/${k}`)} />
        : s.rows.length === 0 ? <SectionEmpty text={s.empty} />
        : (
          <RowsGroup
            rows={many ? s.rows.slice(0, SECTION_ROWS) : s.rows}
            icon={s.icon ?? ROW_ICON[s.target ?? ''] ?? 'circle'}
            module={m}
            onRow={(r) => { const h = rowHref(s, r); return h ? () => onGo(h) : undefined; }}
          />
        )}
    </>
  );
}

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
function LiveTrucks({ trucks }: { trucks: ErpLiveTruck[] }) {
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
      <SectionHead title={`Yo'lda · ${trucks.length} ta`} />
      {/* Kalitsiz Android'da xarita ilovani yiqitadi — bunday holda pastdagi ro'yxat qoladi,
          ya'ni ma'lumot yo'qolmaydi, faqat ko'rinish soddalashadi (`core/config.ts`). */}
      {config.mapsEnabled && (
      <View style={{ height: 190, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault, marginBottom: space.sm }}>
        {/* Scroll bilan urishmasin deb xarita ichida siljimaydi — tafsilot pastdagi qatordan ochiladi */}
        <MapView style={{ flex: 1 }} initialRegion={region} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}>
          {trucks.map((t) => (
            <Marker
              key={t.ref}
              coordinate={{ latitude: t.lat, longitude: t.lng }}
              title={`${t.plate} · ${t.km} km`}
              description={`${t.driver} → ${t.customer}`}
              pinColor={c.infoSolid}
            />
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

// ───────────────────────── Logistika: faol reyslar xaritasi ─────────────────────────

const FLEET_MAP_HEIGHT = 300;
/** Tanlangan mashinaga yaqinlashish masshtabi (~1 km) */
const FOCUS_DELTA = 0.012;

/** "12 daq oldin" — GPS nuqtasining yoshi. */
function agoLabel(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return 'hozir';
  if (m < 60) return `${m} daq oldin`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} soat oldin` : `${Math.floor(h / 24)} kun oldin`;
}

/**
 * Logistika bosh ekrani: faol reyslar xaritada, ostida reysdagi mashinalar ro'yxati.
 * Qator bosilsa xarita o'sha mashinaga yaqinlashadi va belgisi ajratiladi; yana bosilsa
 * hamma mashina qaytadan ko'rinadi. GPS'siz reys ro'yxatda turadi ("GPS yo'q"), xaritada emas.
 * Ro'yxat ERP'dan keladi (`/api/mobile/home` → `fleet`, 30 s da bir yangilanadi).
 * Vebdagi logistika panelidagi blokning aynan o'zi — telefonda "o'ng tomon" pastga tushadi.
 */
function FleetMap({ fleet }: { fleet: ErpFleetTruck[] }) {
  const { c } = useTheme();
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const located = fleet.filter((t): t is ErpFleetTruck & { gps: NonNullable<ErpFleetTruck['gps']> } => !!t.gps);
  const coords = located.map((t) => ({ latitude: t.gps.lat, longitude: t.gps.lng }));

  const region = coords.length
    ? {
      latitude: (Math.min(...coords.map((p) => p.latitude)) + Math.max(...coords.map((p) => p.latitude))) / 2,
      longitude: (Math.min(...coords.map((p) => p.longitude)) + Math.max(...coords.map((p) => p.longitude))) / 2,
      latitudeDelta: Math.max(0.04, (Math.max(...coords.map((p) => p.latitude)) - Math.min(...coords.map((p) => p.latitude))) * 1.6),
      longitudeDelta: Math.max(0.04, (Math.max(...coords.map((p) => p.longitude)) - Math.min(...coords.map((p) => p.longitude))) * 1.6),
    }
    : null;

  const showAll = () => {
    if (coords.length > 1) mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: true });
    else if (coords[0]) mapRef.current?.animateToRegion({ latitude: coords[0].latitude, longitude: coords[0].longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 400);
  };

  const pick = (t: ErpFleetTruck) => {
    if (selected === t.ref) { setSelected(null); showAll(); return; }
    setSelected(t.ref);
    if (!t.gps) { toast.show(`${t.plate}: GPS yo'q — xaritada ko'rsatib bo'lmaydi`, 'warning'); return; }
    if (!config.mapsEnabled) { toast.show('Bu qurilmada xarita yo\'q', 'warning'); return; }
    mapRef.current?.animateToRegion({ latitude: t.gps.lat, longitude: t.gps.lng, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA }, 500);
  };

  const sel = selected ? fleet.find((t) => t.ref === selected) : null;

  return (
    <View style={{ paddingHorizontal: space.pageX, paddingTop: space.xl }}>
      <SectionHead
        title={`Faol reyslar · ${fleet.length} ta`}
        action={fleet.length ? 'Barchasi' : undefined}
        onAction={() => router.push('/erp/list/trips' as never)}
      />
      {/* Kalitsiz Android'da xarita ilovani yiqitadi — bunday holda ro'yxat qoladi (`core/config.ts`). */}
      {config.mapsEnabled && region ? (
        <View style={{ height: FLEET_MAP_HEIGHT, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault, marginBottom: space.sm }}>
          <MapView
            ref={(r) => { mapRef.current = r; }}
            style={{ flex: 1 }}
            initialRegion={region}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            onPress={() => { if (selected) { setSelected(null); showAll(); } }}
          >
            {located.map((t) => {
              const active = selected === t.ref;
              return (
                <Marker
                  key={t.ref}
                  coordinate={{ latitude: t.gps.lat, longitude: t.gps.lng }}
                  title={`${t.plate} · ${t.driver}`}
                  description={`${t.customer} · ${t.phase}${t.gps.etaMin != null ? ` · ~${t.gps.etaMin} daq` : ''}`}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => { setSelected(t.ref); mapRef.current?.animateToRegion({ latitude: t.gps.lat, longitude: t.gps.lng, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA }, 500); }}
                  zIndex={active ? 2 : 1}
                >
                  {/* Davlat raqami yozilgan plitka — vebdagi belgining o'zi; tanlangani brend rangda */}
                  <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: active ? c.brand : c.textStrong, borderWidth: size.ring, borderColor: c.bgSurface }}>
                    <Txt v="overline" style={{ color: active ? c.textOnBrand : c.bgSurface }} numberOfLines={1}>{t.plate}</Txt>
                  </View>
                </Marker>
              );
            })}
          </MapView>
          {/* Hamma mashinani qaytadan ko'rsatish — tanlov bor yoki xarita surilgan bo'lsa */}
          <View style={{ position: 'absolute', right: space.sm, bottom: space.sm }}>
            <IconButton icon="locate-fixed" label="Hamma mashinani ko'rsatish" variant="secondary" onPress={() => { setSelected(null); showAll(); }} />
          </View>
        </View>
      ) : (
        <Card style={{ marginBottom: space.sm, paddingVertical: space.xl, alignItems: 'center' }}>
          <Txt v="bodySm" color="muted" align="center">
            {fleet.length === 0 ? 'Faol reys yo\'q' : config.mapsEnabled ? 'Hozircha birorta haydovchidan GPS kelmayapti — haydovchi yo\'lga chiqsa mashina shu yerda ko\'rinadi' : 'Bu qurilmada xarita yo\'q — ro\'yxat pastda'}
          </Txt>
        </Card>
      )}

      {fleet.length ? (
        <Card style={{ paddingVertical: 0 }}>
          {fleet.map((t, i) => {
            const active = selected === t.ref;
            const gps = t.gps;
            const line2 = [
              t.phase,
              t.plannedAt ? `reja ${t.plannedAt}` : null,
              t.delay,
              gps ? `GPS ${agoLabel(gps.at)}${gps.etaMin != null ? ` · ~${gps.etaMin} daq` : ''}${gps.km != null ? ` · ${fmtUnit(gps.km, 'km')}` : ''}` : 'GPS yo\'q',
            ].filter(Boolean).join(' · ');
            return (
              <ListItem
                key={t.tripId}
                icon="truck"
                module="logistics"
                tone={t.openIssues ? 'danger' : undefined}
                title={`${t.plate} · ${t.driver}`}
                subtitle={`${t.customer} · ${t.address}\n${line2}`}
                subtitleLines={2}
                last={i === fleet.length - 1}
                onPress={() => pick(t)}
                chevron={false}
                style={active ? { backgroundColor: c.bgMuted } : undefined}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 0 }}>
                    <Badge label={t.delay && t.delayTone ? t.delay : gps ? 'GPS' : 'GPS yo\'q'} tone={t.delayTone ?? (gps ? 'success' : 'neutral')} icon={null} />
                    <IconButton icon="chevron-right" label={`${t.ref} kartochkasi`} tone="muted" onPress={() => router.push(`/erp/trips/${t.tripId}` as never)} />
                  </View>
                }
              />
            );
          })}
        </Card>
      ) : null}

      {sel ? (
        <Txt v="caption" color="muted" style={{ marginTop: space.sm }}>
          {sel.gps ? `Xaritada: ${sel.plate} · ${sel.ref}` : `${sel.plate} — GPS yo'q${sel.driverPhone ? ` · ${sel.driverPhone}` : ''}`}
        </Txt>
      ) : null}
    </View>
  );
}

// ───────────────────────── Ishchi ro'yxat ─────────────────────────

export function ErpList({ listKey }: { listKey: string }) {
  const { c } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  // Filtrlar bo'lsa (ishlab chiqarish "Zayavkalar"i) — tanlangani serverga yuboriladi
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data, isLoading, refetch, isRefetching, error } = useErpList(listKey, q.trim() || undefined, filter);
  const filters = data?.filters;
  const active = filters?.find((f) => f.active);
  const module = listModule(listKey);

  return (
    <ScrollView
      style={{ backgroundColor: c.bgApp }}
      contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.lg, paddingBottom: space.xxxl, gap: space.md }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
    >
      <Input
        value={q}
        onChangeText={setQ}
        placeholder="Qidirish…"
        left="search"
        right={q ? <IconButton icon="x" label="Tozalash" tone="muted" size={size.touch - space.sm} onPress={() => setQ('')} /> : null}
        autoCorrect={false}
        returnKeyType="search"
        containerStyle={{ marginBottom: 0 }}
      />
      {filters?.length ? (
        <ChipGroup items={filters.map((f) => ({ key: f.key, label: f.label, count: f.count }))} value={active?.key ?? filters[0]!.key} onChange={setFilter} />
      ) : null}
      {isLoading ? <ListSkeleton />
        : error && !data ? <EmptyState icon="cloud-off" title="Ma'lumot kelmadi" hint="Internetni tekshiring" onRetry={() => void refetch()} />
        : !data || data.rows.length === 0 ? <EmptyState title="Hech narsa topilmadi" hint={q ? 'Boshqa so\'z bilan qidiring' : active ? `"${active.label}" bo'yicha hujjat yo'q` : undefined} />
        : (
          <Appear>
            <Txt v="caption" color="muted" style={{ marginBottom: space.sm }}>{`${data.rows.length} ta`}</Txt>
            <RowsGroup rows={data.rows} icon={ROW_ICON[listKey] ?? 'circle'} module={module} onRow={(r) => () => router.push(`/erp/${listKey}/${r.id}` as never)} />
          </Appear>
        )}
    </ScrollView>
  );
}

// ───────────────────────── Profil / menyu ─────────────────────────

export function ErpMenu() {
  const { c } = useTheme();
  const router = useRouter();
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
      <ScrollView style={{ backgroundColor: c.bgApp }} contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.lg, paddingBottom: space.xxxl }}>
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
    </View>
  );
}
