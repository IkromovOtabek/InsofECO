import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Callout, Card, EmptyState, IconButton, ListItem, Txt, fmtUnit, typeScale } from '@/design/primitives';
import { fmtShort, tabIcon } from '@/design/ui';
import {
  ActionGrid, AttentionList, BarChartCard, BreakdownCard, ChipGroup, HBarList, HeroCard, KpiGrid, ListGroup, OfflineBanner, PageHeader,
  ProgressCard, Reveal, SectionHead, SkeletonDashboard, SkeletonList, type ActionItem, type AttentionItem, type KpiItem,
} from '@/design/blocks';
import { SearchField } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { ERP_ROLE_MODULE, LIST_MODULE, ModuleTone, radius, size, space, textRoom } from '@/design/tokens';
import { floatingTabBar, tabsOptions } from '@/design/nav';
import { PressScale, useHeaderRaise, useReducedMotion } from '@/design/motion';
import { useSession } from '@/core/session';
import { LogoutButton } from '@/features/auth/logout';
import { DriverMarker, MapView, useMapScrollLock } from '@/core/map';
import { config } from '@/core/config';
import { type ErpCard, type ErpHomeData, type ErpLiveTruck, type ErpRole, type ErpRow, type ErpSection, type ErpSectionChart } from '@/core/erp';
import { erpRoleConfig, type ErpRoleConfig, type ErpTabSpec } from './roles';
import { roleDashboard, type QuickSpec, type RoleDashboard } from './dashboards';
import { useErpHome, useErpList, useErpNotifications } from './api';
import { ErpRowItem, ROW_ICON, RowsGroup, SectionEmpty, cardHref, idSeg, isZero, listModule, parseHint, splitValue, statusLabel } from './ui';
import { RangeCalendar } from './range-calendar';
import { ProgressChart } from './charts';
import { ErpAiChat } from './ai-chat';
import { DailyReportSheet } from './daily-report';
import { AttendanceHomeCard, attendanceAccessOf } from './attendance';
import { FleetScreen } from './fleet';
import { StaffAttendanceScreen } from './staff-attendance';
import { KirimScreen } from './kirim';
import { ShipmentBanner } from './shipments';
import { AvtoPartsBanner } from './avto-parts';
import { ArendaScreen } from './arenda';
import { ControlScreen } from './control';
import { MENU_GROUPS, groupOf, loadChip, loadFavs, matches, saveChip, saveFavs, type MenuItem } from './menu-catalog';
import type { IconName } from '@/design/icons';
import { setBadge } from '@/core/push';
import { useDebounced } from '@/shared/hooks';

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
  // Direktor: tasdiq kutayotganlar soni (bosh sahifadagi bilan bitta kesh) — ishchi ro'yxat tabi bo'lsa o'shanda,
  // bo'lmasa (Tasdiqlar tab emas, alohida ekran) "Asosiy" tabida
  const approvals = useErpList(cfg.ai ? cfg.listKey : '').data?.rows.length ?? 0;
  const badgeOn: ErpTabSpec['screen']['kind'] = cfg.tabs.some((t) => t.screen.kind === 'work') ? 'work' : 'home';
  // Sklad: snabjeniye jo'natmasi kelsa ekranning tepasidan banner tushadi (qaysi tabda bo'lmasin)
  const shipments = role === 'WAREHOUSE';
  const tabs = (
    <Tabs tabBar={floatingTabBar({ driver })} screenOptions={tabsOptions(c, insets.bottom, { driver, reduce })}>
      {cfg.tabs.map((t) => (
        <Tabs.Screen
          key={t.route}
          name={t.route}
          options={{
            title: t.title,
            headerShown: !ownHeader(t),
            tabBarIcon: tabIcon(t.icon, { driver }),
            tabBarBadge: t.screen.kind === badgeOn && cfg.ai && approvals > 0 ? approvals : undefined,
          }}
        />
      ))}
    </Tabs>
  );
  // Tepadan tushadigan bannerlar: sklad — jo'natma qabul qilish, mexanik — yangi avto zapchastlar
  if (!shipments && role !== 'MECHANIC') return tabs;
  return (
    <View style={{ flex: 1 }}>
      {tabs}
      {shipments ? <ShipmentBanner /> : <AvtoPartsBanner />}
    </View>
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
    // Filtrli tab (direktor «Qarzlar» → mijozlar ro'yxatining «Qarzdorlar» filtri): sarlavha — tab nomi
    case 'list': return <ErpList listKey={s.key} title={title} heading={s.filter ? title : undefined} initialFilter={s.filter} fallback={<ErpSections title={title} embedded />} />;
    case 'ai': return <ErpAiChat />;
    case 'map': return <ErpMapTab title={title} />;
    case 'road': return <ErpRoadTab title={title} />;
    case 'menu': return <ErpMenu />;
    case 'attendance': return <StaffAttendanceScreen />;
    case 'kirim': return <KirimScreen title={title} />;
    case 'arenda': return <ArendaScreen title={title} />;
    case 'control': return <ControlScreen title={title} />;
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
  const cards = cfg.hideCards ? data.cards.filter((x) => !cfg.hideCards!.includes(x.key)) : data.cards;
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
const DETAIL_OF: Record<string, string> = { 'brig-issues': 'brig-issue', 'brig-shifts': 'brig-shift', 'brig-days': 'brig-day', 'arenda-jurnal': 'arenda-tx', 'arenda-shops': 'arenda-shop', 'arenda-debtors': 'arenda-shop', 'arenda-svet': 'arenda-shop' };

/** Jonli reyslar xaritasini kim ochadi (server `GET /api/mobile/fleet` ruxsati bilan bir xil). */
const FLEET_ROLES: ErpRole[] = ['DIRECTOR', 'LOGISTICS', 'MECHANIC', 'DISPATCHER'];

/** Rolning ishchi ro'yxati (`listKey`): tab bo'lsa — tab; bo'lmasa (direktor tasdiqlari) — orqaga tugmali ro'yxat ekrani. */
const hasWorkTab = (r: ErpRoleConfig) => r.tabs.some((t) => t.screen.kind === 'work');
const workHref = (r: ErpRoleConfig) => (hasWorkTab(r) ? `/${r.group}/work` : `/erp/list/${r.listKey}`);

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
  const mapLock = useMapScrollLock();
  const pending = useErpList(cfg.countList?.key ?? '');
  const unread = useErpNotifications().data?.unread ?? 0;
  useEffect(() => { setBadge(unread); }, [unread]);

  const model = useMemo(() => (data ? buildModel(data, cfg) : null), [data, cfg]);
  const go = (href: string) => router.push(href as never);
  const rcfg = erpRoleConfig(data?.role ?? sessionRole);
  const roleLabel = data?.roleLabel ?? erp?.roleLabel ?? rcfg.label;
  const fullName = data?.fullName ?? erp?.fullName ?? '';
  // «Davomat» (o'z davomati, jadval, ruxsat bo'lsa skaner) — kontentni egallamasin: sarlavhada, qo'ng'iroq yonida
  const attAccess = attendanceAccessOf(data);

  const header = (
    <PageHeader
      overline={fullName ? `${roleLabel} · ${fullName}` : roleLabel}
      title={cfg.title}
      avatar={{ name: fullName || roleLabel }}
      onAvatar={() => go(`/${rcfg.group}/menu`)}
      actions={attAccess ? [{ icon: 'user-check', label: 'Davomat', onPress: () => go('/erp/face') }] : undefined}
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

    // ── Davomat (sarlavha ostida): "Keldim", 16:30 dan "Ketdim" (GPS + yuz skaneri) va rahbarga "Xodimlar davomati" ──
    if (data.selfAttendance || data.attendanceManage) blocks.push(<AttendanceHomeCard key="att-self" data={data} module={module} />);

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
    const quick = resolveQuick(cfg.quick, data, rcfg, module, go);
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
      attention.push({ title: cfg.countList.title, sub: cfg.countList.sub, icon: cfg.countList.icon, module, badge: { text: String(pendingCount), tone: 'warning' }, onPress: () => go(workHref(rcfg)) });
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
    if (!data.fleet && data.live?.length) tail = <LiveTrucks trucks={data.live} onTouchLock={mapLock.onTouchLock} onMap={FLEET_ROLES.includes(data.role) ? () => go('/erp/fleet') : undefined} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      {header}
      <ScrollView
        // Ichidagi kichik xaritani surganda sahifa aylanmasin (LiveTrucks)
        scrollEnabled={mapLock.scrollEnabled}
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

/**
 * Spekdagi tezkor amallar → mavjud manzillar. Rolga yopiq yoki ma'lumoti yo'q amal tushib qoladi.
 * Ishchi ro'yxat — tab yoki `/erp/list/…` (`workHref`), AI — orqaga tugmali `/erp/ai` ekrani.
 */
function resolveQuick(specs: QuickSpec[], data: ErpHomeData, role: ErpRoleConfig, module: ModuleTone, go: (h: string) => void): ActionItem[] {
  const group = role.group;
  const work = workHref(role);
  const hasNew = (k: string) => data.quick.some((q) => q.kind === 'new' && q.key === k) || data.create?.key === k;
  const hasList = (k: string) => data.quick.some((q) => q.kind === 'list' && q.key === k);
  const out: ActionItem[] = [];
  const add = (label: string, icon: ActionItem['icon'], href: string, m: ModuleTone = module, badge?: number) => out.push({ label, icon, module: m, onPress: () => go(href), badge });
  const cardCount = (k?: string) => (k ? Number(data.cards.find((x) => x.key === k)?.value) || undefined : undefined);
  for (const spec of specs) {
    // Forma yoki ro'yxat rolga ochiq bo'lmasa (eski server / direktor ruxsat bermagan) — zaxira manzil
    const open = spec.to.kind === 'new' ? hasNew(spec.to.key) : spec.to.kind === 'list' ? data.list.key === spec.to.key || hasList(spec.to.key) : true;
    const q = !open && spec.orElse ? spec.orElse : spec;
    const t = q.to;
    if (t.kind === 'new' && hasNew(t.key)) add(q.label, q.icon, `/erp/new/${t.key}`);
    else if (t.kind === 'list') {
      if (data.list.key === t.key) add(q.label, q.icon, work);
      else if (hasList(t.key)) add(q.label, q.icon, `/erp/list/${t.key}${t.filter ? `?f=${t.filter}` : ''}`, listModule(t.key) === 'brand' ? module : listModule(t.key), cardCount(q === spec ? spec.badgeCard : undefined));
    } else if (t.kind === 'tab') {
      if (t.tab === 'work') add(q.label, q.icon, work);
      else if (t.tab === 'ai') { if (role.ai) add(q.label, q.icon, '/erp/ai'); }
      else add(q.label, q.icon, `/${group}/${t.tab}`);
    } else if (t.kind === 'href') {
      add(q.label, q.icon, t.href);
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

/** Eski server `live[].stale` bermaydi — shunda oxirgi nuqta (`at`) shundan eski bo'lsa belgi kulrang. */
const LIVE_STALE_MS = 10 * 60_000;
/** Shundan sekin — turibdi: yo'nalish o'qi va tezlik yozuvi yo'q (`fleet.tsx` bilan bir xil). */
const LIVE_HEADING_MIN_KMH = 3;
/** Eskirganmi: server `stale` (fleet bilan bir xil `gpsSilentMin` chegarasi), bo'lmasa mijoz 10 daqiqa chegarasi. */
const liveStale = (t: ErpLiveTruck, now: number) => (typeof t.stale === 'boolean' ? t.stale : !!t.at && now - Date.parse(t.at) > LIVE_STALE_MS);
/** " · 34 km/soat" yoki " · GPS 12 daq oldin" (eski server `at` bermasa — bo'sh). */
function liveGpsNote(t: ErpLiveTruck, now: number): string {
  if (!t.at) return '';
  if (liveStale(t, now)) {
    const seen = t.lastSeenAt && Number.isFinite(Date.parse(t.lastSeenAt)) ? t.lastSeenAt : t.at;
    const m = Math.max(0, Math.round((now - Date.parse(seen)) / 60_000));
    return ` · GPS ${m < 60 ? `${m} daq` : `${Math.floor(m / 60)} soat`} oldin`;
  }
  if (t.speedKmh == null) return '';
  return t.speedKmh < LIVE_HEADING_MIN_KMH ? ' · turibdi' : ` · ${Math.round(t.speedKmh)} km/soat`;
}

/**
 * Bosh ekrandagi jonli xarita: haydovchi qayerda va reys boshidan beri necha km yurdi.
 * Ma'lumot ERP'dan keladi (`/api/mobile/home` → `live`), ruxsat ham o'sha yerda hal bo'ladi —
 * sotuvchiga faqat o'zi ochgan zayavkalarning mashinalari ko'rinadi.
 */
function LiveTrucks({ trucks, onMap, onTouchLock }: { trucks: ErpLiveTruck[]; onMap?: () => void; onTouchLock?: (locked: boolean) => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const now = Date.now();

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
        {/* Surish va ikki barmoq bilan yaqinlashtirish ishlaydi; barmoq xaritada turganda sahifa
            aylanmaydi (`useMapScrollLock`). Mashina bosilsa — reys kartochkasi */}
        <MapView style={{ flex: 1 }} initialRegion={region} rotateEnabled={false} pitchEnabled={false} zoomControls onTouchLock={onTouchLock}>
          {trucks.map((t) => {
            const stale = liveStale(t, now);
            const moving = !stale && t.speedKmh != null && t.speedKmh >= LIVE_HEADING_MIN_KMH;
            return (
              <DriverMarker
                key={t.ref}
                coordinate={{ latitude: t.lat, longitude: t.lng }}
                status={stale ? 'offline' : 'moving'}
                heading={moving && t.heading != null ? t.heading : null}
                caption={moving ? `${Math.round(t.speedKmh!)} km/soat` : null}
                onPress={t.tripId ? () => router.push(`/erp/trips/${t.tripId}` as never) : undefined}
              />
            );
          })}
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
              subtitle={`${t.customer} · ${t.status}${t.etaMin != null ? ` · ~${t.etaMin} daq` : ''}${liveGpsNote(t, now)}`}
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
export function ErpList({ listKey, title, heading, onBack, fallback, initialFilter }: {
  listKey: string; title?: string;
  /** Server sarlavhasi o'rniga doim shu (tab nomi) — `title` esa faqat server sarlavha bermasa. */ heading?: string;
  onBack?: () => void; fallback?: React.ReactNode; initialFilter?: string;
}) {
  const { c } = useTheme();
  const router = useRouter();
  const raise = useHeaderRaise();
  const [q, setQ] = useState('');
  // Filtrlar bo'lsa (ishlab chiqarish "Zayavkalar"i) — tanlangani serverga yuboriladi; tezkor amal `?f=` bilan ochishi mumkin
  const [filter, setFilter] = useState<string | undefined>(initialFilter);
  // Qidiruv — yozib bo'lingach (350 ms) so'raladi; oldingi natija turadi, har harfda skelet chiqmaydi
  const dq = useDebounced(q.trim());
  const { data, isLoading, refetch, isRefetching, error } = useErpList(listKey, dq || undefined, filter);
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
        title={heading ?? data?.title ?? title ?? "Ro'yxat"}
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
 * kompyuterdagi ERP menyusidagi har bir bo'lim — har qatorda 4 tadan plitka (`ActionGrid`). `embedded` — boshqa tab ichida (ro'yxat rolga yopiq bo'lsa).
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
            <ActionGrid key="f" primaryIndex={null} items={forms.map((q) => ({ label: q.label, icon: (ROW_ICON[q.key] ?? q.icon ?? 'plus') as IconName, module, onPress: () => router.push(`/erp/new/${q.key}` as never) }))} />
          ) : null}
          {lists.length ? <SectionHead key="l-h" title="Ro'yxatlar" /> : null}
          {lists.length ? (
            <ActionGrid key="l" primaryIndex={null} items={lists.map((q) => ({ label: q.label, icon: (ROW_ICON[q.key] ?? q.icon) as IconName, module: listModule(q.key) === 'brand' ? module : listModule(q.key), onPress: () => router.push(`/erp/list/${q.key}` as never) }))} />
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

/**
 * Menyudagi "Davomat va reyslar" — ish haqi asosi. Otdel kadrda davomat — alohida tab, shuning uchun bu yerda yo'q.
 * Ruxsat serverda ham tekshiriladi (`lib/mobile/staff-attendance.ts`).
 */
function payLinksFor(role: ErpRole, canViewTable: boolean | null): { href: string; title: string; subtitle: string; icon: IconName; module?: ModuleTone }[] {
  const out: { href: string; title: string; subtitle: string; icon: IconName; module?: ModuleTone }[] = [];
  // Jadval — hamma xodimga faqat ko'rish uchun (yangi ERP `attendance.canViewTable`); eski ERP'da — avvalgidek rahbarlarga
  if (role !== 'HR' && (canViewTable ?? (role === 'DIRECTOR' || role === 'PRODUCTION' || role === 'SUPERVISOR'))) {
    out.push({ href: '/erp/davomat', title: 'Xodimlar davomati', subtitle: 'Keldi, ketdi, soat, kechikish — barcha xodimlar', icon: 'clock' });
  }
  if (role === 'DIRECTOR' || role === 'HR' || role === 'LOGISTICS' || role === 'DISPATCHER') {
    out.push({ href: '/erp/haydovchilar', title: 'Haydovchilar: reyslar va davomat', subtitle: "Oy bo'yicha reys, hajm, km, ish kunlari", icon: 'truck', module: 'logistics' });
  }
  if (role === 'DRIVER') {
    out.push({ href: '/erp/reyslarim', title: 'Mening reyslarim', subtitle: "Oy bo'yicha reyslar, hajm va ish kunlari", icon: 'truck', module: 'logistics' });
  }
  return out;
}

/**
 * Menyu — artifaktdagi M3 shabloni: qidiruv, guruh chiplari (Sevimli · Boshqaruv · Sotuv · Moliya…) va tanlangan
 * guruhning bo'limlari; har qatorda yulduzcha — sevimlilarga qo'shish (telefonda, rol bo'yicha). Qidiruv hamma
 * guruh bo'yicha ishlaydi. Bo'limlar — `/api/mobile/home` → `quick` (vebdagi menyu) + rolning maxsus ekranlari.
 */
export function ErpMenu() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const raise = useHeaderRaise();
  const { erp } = useSession();
  const role: ErpRole = erp?.role ?? 'DIRECTOR';
  const cfg = erp ? erpRoleConfig(erp.role) : null;
  const module = roleModule(role);
  const homeData = useErpHome().data;
  const [reportOpen, setReportOpen] = useState(false);
  const isDirector = role === 'DIRECTOR';
  // Direktor: Tasdiqlar pastki panelda emas — menyuda soni bilan turadi
  const workCount = useErpList(cfg?.ai && !hasWorkTab(cfg) ? cfg.listKey : '').data?.rows.length ?? 0;
  const [q, setQ] = useState('');
  const [favs, setFavs] = useState(() => loadFavs(role));
  const [chip, setChipRaw] = useState(loadChip);
  const go = (href: string) => () => router.push(href as never);

  const items: MenuItem[] = [];
  if (cfg?.ai && !hasWorkTab(cfg)) {
    items.push({ id: 'work', label: cfg.workTitle, sub: roleDashboard(role).countList?.sub, icon: cfg.workIcon, module, group: 'boshqaruv', badge: workCount || undefined, onPress: go(workHref(cfg)) });
  }
  if (cfg?.ai) items.push({ id: 'ai', label: 'AI yordamchi', sub: 'Zavod haqida savol — javob ERP raqamlaridan', icon: 'sparkles', module, group: 'boshqaruv', onPress: go('/erp/ai') });
  if (isDirector) items.push({ id: 'report', label: 'Kunlik hisobot (Excel)', sub: 'Kunni tanlang — fayl ulashiladi yoki ochiladi', icon: 'download', module, group: 'boshqaruv', onPress: () => setReportOpen(true) });
  if (FLEET_ROLES.includes(role)) items.push({ id: 'fleet', label: 'Reyslar xaritada', sub: 'Jonli kuzatuv: mashina, haydovchi, ETA', icon: 'map', module: 'logistics', group: 'logistika', onPress: go('/erp/fleet') });
  if (role === 'WAREHOUSE' || role === 'PROCUREMENT') {
    items.push({ id: 'jonatma', label: "Jo'natmalar", sub: role === 'WAREHOUSE' ? 'Qabul kutayotgan nakladnoylar' : "Skladga jo'natganlaringiz va natijasi", icon: 'package-check', module: 'warehouse', group: 'sklad', onPress: go('/erp/jonatma') });
  }
  for (const l of payLinksFor(role, homeData?.attendance?.canViewTable ?? null)) {
    items.push({ id: l.href, label: l.title, sub: l.subtitle, icon: l.icon, module: l.module ?? module, group: l.module === 'logistics' ? 'logistika' : 'kadr', onPress: go(l.href) });
  }
  if (homeData?.selfAttendance) items.push({ id: 'davomatim', label: 'Mening davomatim', sub: homeData.selfAttendance.label, icon: 'calendar-days', module, group: 'kadr', onPress: go('/erp/davomatim') });
  for (const x of homeData?.quick ?? []) {
    if (x.kind === 'new') items.push({ id: `new:${x.key}`, label: x.label, sub: 'Yangi hujjat', icon: 'plus', module, group: 'yangi', onPress: go(`/erp/new/${x.key}`) });
    else items.push({ id: `list:${x.key}`, label: x.label, icon: ROW_ICON[x.key] ?? x.icon, module: listModule(x.key) === 'brand' ? module : listModule(x.key), group: groupOf(x.key), onPress: go(`/erp/list/${x.key}`) });
  }

  const favSet = new Set(favs);
  const favItems = favs.map((id) => items.find((it) => it.id === id)).filter((x): x is MenuItem => !!x);
  const groups = MENU_GROUPS.map((g) => ({ ...g, items: items.filter((it) => it.group === g.key) })).filter((g) => g.items.length);
  const chips = [{ key: 'fav', label: 'Sevimli', count: favItems.length }, ...groups.map((g) => ({ key: g.key as string, label: g.label, count: g.items.length }))];
  const active = chips.some((x) => x.key === chip) ? chip : 'fav';
  const searching = !!q.trim();
  const shown = searching ? items.filter((it) => matches(it, q)) : active === 'fav' ? favItems : groups.find((g) => g.key === active)?.items ?? [];
  const groupLabel = (g: MenuItem['group']) => MENU_GROUPS.find((x) => x.key === g)?.label;
  const setChip = (k: string) => { setChipRaw(k); saveChip(k); };
  const toggleFav = (id: string) => setFavs((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    saveFavs(role, next);
    return next;
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader
        overline={erp?.fullName ? `${erp.roleLabel} · ${erp.fullName}` : erp?.roleLabel}
        title="Menyu"
        avatar={{ name: erp?.fullName || erp?.roleLabel || 'ERP' }}
        onAvatar={go('/settings')}
        raised={raise.raised}
        style={{ paddingTop: insets.top + space.sm }}
      />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl, gap: space.stack }}
      >
        <SearchField value={q} onChangeText={setQ} placeholder={items.length ? `${items.length} bo'lim ichidan qidirish` : "Bo'lim qidirish"} />
        {!searching && chips.length > 1 ? <ChipGroup items={chips} value={active} onChange={setChip} scroll /> : null}
        {shown.length ? (
          <ListGroup>
            {shown.map((it) => (
              <ListItem
                key={it.id}
                icon={it.icon}
                module={it.module}
                title={it.label}
                subtitle={searching ? [groupLabel(it.group), it.sub].filter(Boolean).join(' · ') : it.sub}
                subtitleLines={1}
                onPress={it.onPress}
                right={(
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    {it.badge ? <Badge label={String(it.badge)} tone="warning" /> : null}
                    <IconButton
                      icon="star" tone="faint" active={favSet.has(it.id)}
                      label={favSet.has(it.id) ? 'Sevimlilardan olish' : "Sevimlilarga qo'shish"}
                      onPress={() => toggleFav(it.id)}
                    />
                  </View>
                )}
              />
            ))}
          </ListGroup>
        ) : (
          <EmptyState
            compact
            icon={searching ? 'search' : 'star'}
            title={searching ? 'Hech narsa topilmadi' : homeData ? "Sevimlilar hali bo'sh" : "Bo'limlar yuklanmoqda"}
            hint={searching ? "Boshqa so'z bilan qidiring" : homeData ? "Guruhni tanlang va bo'lim yonidagi yulduzchani bosing" : undefined}
          />
        )}

        <SectionHead title="Ilova" />
        <ListGroup>
          {/* Bildirishnomalar, PIN kod, parol va hisobni o'chirish — Sozlamalar ichida (hamma kabinet uchun bir joy) */}
          <ListItem icon="settings" module={module} title="Sozlamalar" subtitle="Til, mavzu, bildirishnomalar, PIN, parol, hisob" onPress={go('/settings')} />
        </ListGroup>
        <LogoutButton size="md" textColor={c.danger} />
      </ScrollView>
      {isDirector ? <DailyReportSheet open={reportOpen} onClose={() => setReportOpen(false)} /> : null}
    </View>
  );
}
