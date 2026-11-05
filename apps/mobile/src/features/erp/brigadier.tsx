import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Callout, Card, EmptyState, IconButton, ListGroup, ListItem, ProgressBar, Txt } from '@/design/primitives';
import { ActionGrid, AttentionList, HeroCard, KpiGrid, PageHeader, Reveal, SectionHead, SkeletonDashboard, SkeletonList } from '@/design/blocks';
import { Icon, type IconName } from '@/design/icons';
import { Avatar, dialog, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { PressScale, useHeaderRaise } from '@/design/motion';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { setBadge } from '@/core/push';
import type { ErpBrigMember, ErpBrigTask, ErpBrigadeToday } from '@/core/erp';
import { LogoutButton } from '@/features/auth/logout';
import { useErpAction, useErpHome, useErpNotifications } from './api';
import { ErpHome, ErpList } from './screens';
import { idSeg } from './ui';
import { DefectSheet, FactSheet } from './brigadier-sheets';

/**
 * Brigadir kabineti — `docs/redesign/brigada-shablonlar.html`, 01 + 02 + 03 birga (smenasiz):
 *   01 «Keyingi qadam» — bosh sahifa: qadamlar (Davomat → Ish → Tayyor), qorong'i karta va bitta katta tugma;
 *   02 «Tez fakt» — topshiriq kartasida tugma, raqam klaviaturali fakt oynasi;
 *   03 «Katta plitkalar» — muammo yozmasdan, plitka va variantlar bilan (`/erp/muammo`).
 * 3 tab — Bugun · Topshiriqlar · Men. Ish tartibida SMENA YO'Q: kun ochilmaydi va yopilmaydi.
 * Ma'lumot — `/api/mobile/home` → `brigadeToday` (ERP `lib/mobile/brigadier.ts`). Eski ERP bermasa — umumiy ekranlar.
 */

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ','));
/** `brig-issue:<id>` (server aralash ro'yxati) → kartochka manzili. */
const refHref = (ref: string) => { const i = ref.indexOf(':'); return i > 0 ? `/erp/${ref.slice(0, i)}/${idSeg(ref.slice(i + 1))}` : null; };
const errText = (e: unknown) => (e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech'; };

/** Server javob bermadi — umumiy bosh sahifadagi bilan bir xil matn. */
function OfflineState({ onRetry, refreshing }: { onRetry: () => void; refreshing: boolean }) {
  const { c } = useTheme();
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.pageX }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRetry} tintColor={c.brand} />}
    >
      <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring." onRetry={onRetry} />
    </ScrollView>
  );
}

type SheetKind = null | { kind: 'fact'; task: ErpBrigTask } | { kind: 'defect' };

/** «Ishni boshlash» — tasdiq bilan (`task.start`; smena yo'q — faqat topshiriqqa vaqt yoziladi). */
function useStartTask() {
  const run = useErpAction();
  const [busy, setBusy] = useState<string | null>(null);
  const start = (x: ErpBrigTask) => dialog('Ishni boshlash', `${x.taskNo} · ${x.product} — boshlansinmi? Boshlangan vaqt topshiriqqa yoziladi.`, [
    { text: "Yo'q", style: 'cancel' },
    {
      text: 'Ha, boshlash',
      onPress: async () => {
        setBusy(x.id);
        try {
          const r = await run.mutateAsync({ action: 'task.start', id: x.id });
          toast.success(r?.message ?? 'Ish boshlandi', x.taskNo);
        } catch (e) {
          toast.error(errText(e));
        } finally {
          setBusy(null);
        }
      },
    },
  ]);
  return { start, busy };
}

/** Bosh sahifa va Topshiriqlar tabi uchun oyna — fakt (02) yoki brak. */
function BrigSheets({ t, sheet, onClose }: { t: ErpBrigadeToday; sheet: SheetKind; onClose: () => void }) {
  if (!sheet) return null;
  if (sheet.kind === 'fact') {
    const x = sheet.task;
    return <FactSheet task={{ id: x.id, taskNo: x.taskNo, product: x.product, unit: x.unit, left: x.left }} reasons={t.defectReasons} onClose={onClose} />;
  }
  return <DefectSheet refId={t.ref} products={t.products} reasons={t.defectReasons} onClose={onClose} />;
}

/** Kun qadamlari (maket 01, smenasiz): Davomat → Ish → Tayyor. Bajarilgani — yashil belgi, joriysi — brend doira. */
function Steps({ on }: { on: 1 | 2 | 3 }) {
  const { c } = useTheme();
  const items = ['Davomat', 'Ish', 'Tayyor'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: space.sm }} accessibilityLabel={`${on}-qadam: ${items[on - 1]}`}>
      {items.map((label, i) => {
        const n = i + 1;
        const done = n < on, cur = n === on;
        return (
          <React.Fragment key={label}>
            {i > 0 ? <View style={{ flex: 1, height: 2, marginTop: space.md - 1, borderRadius: radius.pill, backgroundColor: n <= on ? c.successSolid : c.borderDefault }} /> : null}
            <View style={{ alignItems: 'center', gap: space.xs, minWidth: space.x12 + space.lg }}>
              <View style={{
                width: space.xxl, height: space.xxl, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
                backgroundColor: done ? c.successSolid : cur ? c.brand : c.bgSurface, borderWidth: done || cur ? 0 : 1.5, borderColor: c.borderDefault,
              }}>
                {done ? <Icon name="check" size={size.iconSm - 2} color={c.textOnSolid} strokeWidth={3} /> : <Txt v="badge" style={{ color: cur ? c.textOnBrand : c.textMuted }}>{n}</Txt>}
              </View>
              <Txt v="caption" style={{ color: cur ? c.textStrong : c.textMuted }}>{label}</Txt>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ───────────────────────── Bugun (maket 01) ─────────────────────────

export function BrigadierHome() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raise = useHeaderRaise();
  const erp = useSession((s) => s.erp);
  const { data, isLoading, refetch, isRefetching } = useErpHome();
  const unread = useErpNotifications().data?.unread ?? 0;
  useEffect(() => { setBadge(unread); }, [unread]);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const starter = useStartTask();

  const t = data?.brigadeToday;
  // Eski ERP (`brigadeToday` yo'q) yoki brigada biriktirilmagan — umumiy bosh sahifa (u sababini ko'rsatadi)
  if (data && !t) return <ErpHome />;

  const go = (href: string) => router.push(href as never);
  const name = data?.fullName ?? erp?.fullName ?? '';
  const first = name.split(' ')[0] ?? '';

  const header = (
    <PageHeader
      overline={t ? `Brigadir · ${t.brigade.name}` : 'Brigadir'}
      title={`${greeting()}${first ? `, ${first}` : ''}`}
      avatar={{ name: name || 'Brigadir' }}
      onAvatar={() => go('/(erp-brigadier)/menu')}
      bell={{ onPress: () => go('/erp/bildirishnomalar'), count: unread || undefined }}
      raised={raise.raised}
      style={{ paddingTop: insets.top + space.sm }}
    />
  );

  // So'rov xato bilan tugadi (server javob bermadi) — bo'sh ekran emas, sabab va «Qayta urinish»
  if (!isLoading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        {header}
        <OfflineState onRetry={() => void refetch()} refreshing={isRefetching} />
      </View>
    );
  }

  const blocks: React.ReactNode[] = [];
  if (t) {
    const a = t.attendance;
    const now = t.now;
    // Keyingi qadam: avval davomat (belgilanmaganlar bor), keyin ish (ochiq topshiriq), bo'lmasa — tayyor
    const step: 1 | 2 | 3 = a.total > 0 && a.notMarked > 0 ? 1 : now ? 2 : 3;

    blocks.push(<Steps key="steps" on={step} />);

    // ── Qorong'i karta: hozir nima qilish kerak ──
    if (step === 1) {
      blocks.push(
        <HeroCard key="now" label="1-qadam · davomat" value={String(a.present)} unit={`/ ${a.total} keldi`}>
          <Txt v="titleMd" style={{ color: c.textOnInverse }}>Davomatni belgilang</Txt>
          <Txt v="caption" style={{ color: c.textOnInverseMuted }}>{`${a.notMarked} kishi belgilanmagan · Face ID bilan kelganlar o'zi chiqadi`}</Txt>
        </HeroCard>,
      );
    } else if (step === 2 && now) {
      blocks.push(
        <PressScale key="now" onPress={() => go(`/erp/tasks/${idSeg(now.id)}`)} scale={0.985} accessibilityRole="button">
          <HeroCard label={`${now.taskNo} · muddat ${now.dueToday ? 'bugun' : now.due}`} value={fmt(now.done)} unit={`/ ${fmt(now.qty)} ${now.unit}`}>
            <Txt v="titleMd" numberOfLines={1} style={{ color: c.textOnInverse }}>{now.product}</Txt>
            <ProgressBar value={now.pct} tone={now.blocked ? 'danger' : now.late ? 'warning' : 'brand'} />
            <Txt v="caption" numberOfLines={1} style={{ color: c.textOnInverseMuted }}>
              {`${fmt(now.left)} ${now.unit} qoldi · ${now.customer}${now.blocked || now.late ? ` · ${now.phase}` : ''}`}
            </Txt>
          </HeroCard>
        </PressScale>,
      );
    } else {
      blocks.push(
        <HeroCard key="now" label="Bugun" value={t.day ? fmt(t.day.fact) : '0'} unit={t.day ? `/ ${fmt(t.day.plan)} ${t.day.unit}` : undefined}>
          <Txt v="titleMd" style={{ color: c.textOnInverse }}>Faol topshiriq qolmadi</Txt>
          <Txt v="caption" style={{ color: c.textOnInverseMuted }}>Kun hisoboti o&apos;zi tuziladi — hech narsa yopish shart emas</Txt>
        </HeroCard>,
      );
    }

    // ── Bitta katta tugma ──
    const cta = step === 1
      ? { el: <Button title={`Davomatni belgilash · ${a.present}/${a.total}`} icon="users" size="lg" variant="success" onPress={() => go('/erp/brigada-davomat')} />, hint: "keyingi qadam — ish · yoki «Topshiriqlar»dan boshlang" }
      : step === 2 && now
        ? now.blocked
          ? { el: <Button title={now.phase} icon="clock" size="lg" variant="secondary" disabled onPress={() => undefined} />, hint: "muammo hal bo'lishini kuting yoki «Topshiriqlar»dan boshqasini oching" }
          : !now.started
            ? { el: <Button title="Ishni boshlash" icon="zap" size="lg" variant="success" loading={starter.busy === now.id} onPress={() => starter.start(now)} />, hint: `${now.taskNo} · ${fmt(now.left)} ${now.unit}` }
            : { el: <Button title="Fakt yozish" icon="plus" size="lg" onPress={() => setSheet({ kind: 'fact', task: now })} />, hint: `qoldiq ${fmt(now.left)} ${now.unit} · «Hammasi» bilan yakunlanadi` }
        : { el: <Button title="Ish tarixi" icon="history" size="lg" variant="secondary" onPress={() => go('/erp/list/brig-days')} />, hint: 'kunlar bo‘yicha bajarilgan ish va brak' };
    blocks.push(
      <View key="cta" style={{ gap: space.xs }}>
        {cta.el}
        <Txt v="caption" color="muted" align="center">{cta.hint}</Txt>
      </View>,
    );

    // ── 4 ko'rsatkich: topshiriqlar, muammo, davomat, brak ──
    blocks.push(
      <KpiGrid
        key="kpi"
        items={[
          { label: 'Topshiriq', value: `${t.done.done} / ${t.done.total}`, delta: { text: `bajarildi · ${t.done.label}`, tone: 'success' }, icon: 'clipboard-list', module: 'production', onPress: () => go('/(erp-brigadier)/work') },
          { label: 'Muammo', value: String(t.issues.open), tone: t.issues.open ? 'danger' : undefined, delta: { text: t.issues.open ? 'ochiq · bildirish' : 'bildirish', tone: t.issues.open ? 'danger' : 'neutral' }, icon: 'triangle-alert', onPress: () => go('/erp/muammo') },
          { label: 'Davomat', value: `${a.present} / ${a.total}`, delta: { text: a.notMarked ? `${a.notMarked} belgilanmagan` : a.late ? `${a.late} kechikdi` : 'keldi', tone: a.notMarked || a.late ? 'warning' : 'success' }, icon: 'users', module: 'logistics', onPress: () => go('/erp/brigada-davomat') },
          { label: 'Brak', value: t.defect.text, delta: { text: t.defect.pct ? `${t.defect.pct} · qayd qilish` : 'bugun · qayd qilish', tone: t.defect.pct ? 'warning' : 'neutral' }, icon: 'circle-x', module: 'warehouse', onPress: () => setSheet({ kind: 'defect' }) },
        ]}
      />,
    );

    // ── Bugungi reja (keyingi topshiriqlar) ──
    const next = t.tasks.filter((x) => x.id !== now?.id).slice(0, 3);
    if (next.length) {
      blocks.push(<SectionHead key="plan-h" title={step === 2 ? 'Keyin' : 'Bugungi reja'} action={t.tasks.length > 3 ? `Barchasi (${t.tasks.length})` : undefined} onAction={() => go('/(erp-brigadier)/work')} />);
      blocks.push(
        <ListGroup key="plan">
          {next.map((x) => (
            <ListItem
              key={x.id}
              icon={x.blocked ? 'package' : 'clipboard-list'}
              tone={x.blocked ? 'danger' : x.started ? 'warning' : 'info'}
              title={`${x.taskNo} · ${x.product}`}
              subtitle={`${x.blocked ? x.phase : `muddat ${x.dueToday ? 'bugun' : x.due}`} · ${fmt(x.done)}/${fmt(x.qty)}`}
              value={`${fmt(x.left)} ${x.unit}`}
              onPress={() => go(`/erp/tasks/${idSeg(x.id)}`)}
            />
          ))}
        </ListGroup>,
      );
    }

    // ── Nima to'xtab turibdi ──
    if (t.issues.rows.length) {
      blocks.push(<SectionHead key="iss-h" title="To'xtab turibdi" action={t.issues.open > 3 ? `Barchasi (${t.issues.open})` : undefined} onAction={() => go('/erp/list/brig-issues')} />);
      blocks.push(
        <AttentionList
          key="iss"
          items={t.issues.rows.slice(0, 3).map((r) => ({
            title: r.title, sub: r.subtitle, icon: r.tone === 'danger' ? 'wrench' : 'triangle-alert', module: 'brand',
            badge: r.right ? { text: r.right, tone: r.tone === 'danger' ? 'danger' : 'warning' } : undefined,
            onPress: () => { const h = refHref(r.id); if (h) go(h); },
          }))}
        />,
      );
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      {header}
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingBottom: space.xxxl + size.tabBar }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        <Reveal loading={isLoading} skeleton={<SkeletonDashboard actions={0} rows={2} />} style={{ paddingHorizontal: space.pageX, paddingTop: space.xs }}>
          {blocks}
        </Reveal>
      </ScrollView>
      {t ? <BrigSheets t={t} sheet={sheet} onClose={() => setSheet(null)} /> : null}
    </View>
  );
}

// ───────────────────────── Topshiriqlar (maket 02) ─────────────────────────

function TaskCard({ t, busy, onOpen, onFact, onStart }: { t: ErpBrigTask; busy: boolean; onOpen: () => void; onFact: () => void; onStart: () => void }) {
  return (
    <PressScale onPress={onOpen} scale={0.985} accessibilityRole="button">
      <Card style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Txt v="caption" color="muted" mono>{t.taskNo}</Txt>
          <Badge label={t.phase} tone={t.tone} />
          <View style={{ flex: 1 }} />
          <Txt v="caption" color={t.late ? 'danger' : 'muted'}>{t.dueToday ? 'bugun' : t.due}</Txt>
        </View>
        <Txt v="titleSm" numberOfLines={2}>{t.product}</Txt>
        <ProgressBar value={t.pct} tone={t.blocked ? 'danger' : t.late ? 'warning' : 'brand'} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="bodyStrong">{`${fmt(t.done)} / ${fmt(t.qty)} ${t.unit}`}</Txt>
            <Txt v="caption" color="muted" numberOfLines={1}>{`${fmt(t.left)} qoldi · ${t.customer}`}</Txt>
          </View>
          {t.blocked
            ? <Button title="Kutish" icon="clock" variant="secondary" full={false} disabled onPress={() => undefined} />
            : !t.started
              ? <Button title="Boshlash" icon="zap" variant="success" full={false} loading={busy} onPress={onStart} />
              : <Button title="Fakt" icon="plus" full={false} onPress={onFact} />}
        </View>
      </Card>
    </PressScale>
  );
}

export function BrigadierTasks() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raise = useHeaderRaise();
  const { data, isLoading, refetch, isRefetching } = useErpHome();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const starter = useStartTask();

  const t = data?.brigadeToday;
  if (data && !t) return <ErpList listKey="tasks" title="Topshiriqlar" />;
  if (!isLoading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <PageHeader title="Topshiriqlar" style={{ paddingTop: insets.top + space.sm }} />
        <OfflineState onRetry={() => void refetch()} refreshing={isRefetching} />
      </View>
    );
  }

  const tasks = t?.tasks ?? [];
  const go = (href: string) => router.push(href as never);
  // Sarlavhadagi «⚡ 42 / 60 m³» — bugungi fakt / reja
  const dayChip = t?.day ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, height: size.touch - space.sm, borderRadius: radius.pill, backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.borderSubtle }}>
      <Icon name="zap" size={size.iconSm} color={c.brand} />
      <Txt v="chip">{`${fmt(t.day.fact)} / ${fmt(t.day.plan)} ${t.day.unit}`}</Txt>
    </View>
  ) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title="Topshiriqlar" right={dayChip} raised={raise.raised} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl + size.tabBar, gap: space.stack }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        {isLoading ? <SkeletonList rows={3} /> : tasks.length ? tasks.map((x) => (
          <TaskCard
            key={x.id} t={x} busy={starter.busy === x.id}
            onOpen={() => go(`/erp/tasks/${idSeg(x.id)}`)}
            onFact={() => setSheet({ kind: 'fact', task: x })}
            onStart={() => starter.start(x)}
          />
        )) : <EmptyState compact icon="clipboard-check" title="Faol topshiriq yo'q" hint="Brigadangizga topshiriq berilsa shu yerda chiqadi" />}
        <ListGroup>
          <ListItem icon="circle-check" module="production" title="Bajarilgan topshiriqlar" subtitle="Hammasi — holat bo'yicha filtr bilan" onPress={() => go('/erp/list/tasks')} />
        </ListGroup>
      </ScrollView>
      {t ? <BrigSheets t={t} sheet={sheet} onClose={() => setSheet(null)} /> : null}
    </View>
  );
}

// ───────────────────────── Brigada davomati (maket 01, 2-ekran) ─────────────────────────

const MARK: Record<'present' | 'late' | 'absent' | 'none', { icon: IconName; solid: 'successSolid' | 'warningSolid' | 'dangerSolid' | 'bgMuted' }> = {
  present: { icon: 'check', solid: 'successSolid' },
  late: { icon: 'clock', solid: 'warningSolid' },
  absent: { icon: 'x', solid: 'dangerSolid' },
  none: { icon: 'minus', solid: 'bgMuted' },
};
const markOf = (m: ErpBrigMember) => (!m.marked ? 'none' : m.late ? 'late' : m.present ? 'present' : 'absent');

/** Bitta a'zo — avatar, pastki burchakda holat belgisi, tepada Face ID belgisi; bosilsa uning kartochkasi. */
function Member({ m, onPress }: { m: ErpBrigMember; onPress: () => void }) {
  const { c } = useTheme();
  const k = MARK[markOf(m)];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${m.fullName}: ${m.label}`} style={{ width: '25%', alignItems: 'center', gap: space.xs, paddingVertical: space.xs }}>
      <View>
        <Avatar name={m.fullName} size={size.avatarLg - space.xs} tone={markOf(m) === 'absent' ? 'danger' : 'brand'} />
        {m.face ? (
          <View style={{ position: 'absolute', left: -space.xs, top: -space.xs, width: space.xl, height: space.xl, borderRadius: radius.pill, backgroundColor: c.moduleProduction, borderWidth: 2, borderColor: c.bgSurface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="scan-line" size={size.iconSm - 4} color={c.textOnSolid} strokeWidth={2.4} />
          </View>
        ) : null}
        <View style={{ position: 'absolute', right: -space.xs, bottom: -space.xs, width: space.xl + 2, height: space.xl + 2, borderRadius: radius.pill, backgroundColor: c[k.solid], borderWidth: 2, borderColor: c.bgSurface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={k.icon} size={size.iconSm - 4} color={markOf(m) === 'none' ? c.textMuted : c.textOnSolid} strokeWidth={3} />
        </View>
      </View>
      <Txt v="caption" align="center" numberOfLines={2} style={{ color: markOf(m) === 'absent' ? c.danger : c.textBody }}>{m.fullName}</Txt>
    </Pressable>
  );
}

/** Kim keldi — avatarlar to'ri. Face ID bilan kelganlar o'zi belgilanadi; bosilsa xodim kartochkasi (Keldi / Kechikdi / Ketdi). */
export function BrigadeAttendanceScreen({ onBack }: { onBack: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useErpHome();
  const run = useErpAction();
  const t = data?.brigadeToday;
  const a = t?.attendance;

  const markRest = () => dialog('Qolganlari keldi', "Belgilanmagan brigada a'zolari «Keldi» deb belgilansinmi? Face ID'da ro'yxatga olinganlar yuz bilan belgilanadi.", [
    { text: "Yo'q", style: 'cancel' },
    {
      text: 'Ha, belgilash',
      onPress: async () => {
        try {
          const r = await run.mutateAsync({ action: 'att.all', id: t!.ref });
          toast.success(r?.message ?? 'Belgilandi', 'Davomat');
        } catch (e) {
          toast.error(errText(e));
        }
      },
    },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title="Kim keldi?" overline={t ? `Davomat · ${t.brigade.name}` : 'Davomat'} onBack={onBack} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: insets.bottom + space.xxxl, gap: space.stack }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        {isLoading || !a ? <SkeletonList rows={5} /> : a.members.length ? (
          <>
            <Card style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt v="titleSm">Brigada tarkibi</Txt>
                <Badge label={`${a.present} / ${a.total} keldi`} tone={a.notMarked ? 'warning' : 'success'} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md }}>
                {a.members.map((m) => <Member key={m.id} m={m} onPress={() => router.push(`/erp/sex-emp/${idSeg(m.id)}` as never)} />)}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
                {([['successSolid', 'keldi'], ['warningSolid', 'kechikdi'], ['dangerSolid', 'kelmadi'], ['moduleProduction', 'Face ID']] as const).map(([k, l]) => (
                  <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    <View style={{ width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: c[k] }} />
                    <Txt v="caption" color="muted">{l}</Txt>
                  </View>
                ))}
              </View>
            </Card>
            <Callout tone="info" icon="scan-line">Face ID bilan kelganlar o&apos;zi belgilanadi — qolganini bosib o&apos;zgartiring.</Callout>
            {a.notMarked ? <Button title={`Qolganlari keldi · ${a.notMarked} kishi`} icon="check" size="lg" variant="success" loading={run.isPending} onPress={markRest} /> : null}
            {data?.faceAttendance ? <Button title="Yuz bilan belgilash" icon="scan-line" size="lg" variant="secondary" onPress={() => router.push('/erp/face' as never)} /> : null}
          </>
        ) : <EmptyState compact icon="users" title="Brigadaga xodim taqsimlanmagan" hint="Ishlab chiqarish yoki otdel kadrga ayting" />}
      </ScrollView>
    </View>
  );
}

// ───────────────────────── Men ─────────────────────────

/** «Men» — shaxsiy hamma narsa bitta joyda (so'rovnoma, xabarlar, murojaat va smena grafigi yo'q). */
export function BrigadierMenu() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raise = useHeaderRaise();
  const erp = useSession((s) => s.erp);
  const { data } = useErpHome();
  const t = data?.brigadeToday;
  const go = (href: string) => router.push(href as never);
  const lists = new Set((data?.quick ?? []).filter((q) => q.kind === 'list').map((q) => q.key));
  // Server bo'limni yopgan bo'lsa (tarif, ruxsat) — qator chiqmaydi
  const has = (k: string) => !data || lists.has(k);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title="Men" raised={raise.raised} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl + size.tabBar, gap: space.stack }}
      >
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Avatar name={erp?.fullName} size={size.avatarLg} tone="brand" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="titleMd" numberOfLines={1}>{erp?.fullName}</Txt>
            <Txt v="caption" color="muted" numberOfLines={1}>{`Brigadir${t ? ` · ${t.brigade.name}` : ''}`}</Txt>
            <Txt v="caption" color="faint" numberOfLines={1}>{erp?.login}</Txt>
          </View>
          <IconButton icon="settings" label="Sozlamalar" variant="secondary" onPress={() => go('/settings')} />
        </Card>

        <ActionGrid
          primaryIndex={null}
          items={[
            ...(data?.selfAttendance ? [{ label: 'Davomatim', icon: 'calendar-days' as const, module: 'logistics' as const, onPress: () => go('/erp/davomatim') }] : []),
            ...(has('oyligim') ? [{ label: 'Ish haqim', icon: 'wallet' as const, module: 'brand' as const, onPress: () => go('/erp/list/oyligim') }] : []),
            ...(has('vazifalarim') ? [{ label: 'Vazifalar', icon: 'clipboard-check' as const, module: 'production' as const, onPress: () => go('/erp/list/vazifalarim') }] : []),
            ...(has('arizalarim') ? [{ label: 'Arizalarim', icon: 'file-text' as const, module: 'warehouse' as const, onPress: () => go('/erp/list/arizalarim') }] : []),
          ]}
        />

        <SectionHead title="Ish" />
        <ListGroup>
          {has('brig-days') ? <ListItem icon="history" module="production" title="Ish tarixi" subtitle="Kunlar bo'yicha: bajarilgan ish, brak" onPress={() => go('/erp/list/brig-days')} /> : null}
          {has('brig-issues') ? <ListItem icon="triangle-alert" tone="danger" title="Muammolar" subtitle="Ochiq va hal qilinganlar" onPress={() => go('/erp/list/brig-issues')} /> : null}
          {t ? <ListItem icon="package" module="warehouse" title="Mening skladim" subtitle="Qo'limdagi xomashyo" onPress={() => go(`/erp/brig-stock/${idSeg(t.brigade.id)}`)} /> : null}
          {has('cheklistim') ? <ListItem icon="square-check" module="production" title="Bugungi cheklist" onPress={() => go('/erp/list/cheklistim')} /> : null}
        </ListGroup>

        <SectionHead title="Ariza va rivojlanish" />
        <ListGroup>
          <ListItem icon="plus" module="brand" title="Ariza yuborish" subtitle="Avans, kechikish yoki kelmaslik sababi" onPress={() => go('/erp/new/ariza')} />
          {has('kpim') ? <ListItem icon="star" module="brand" title="KPI'm" onPress={() => go('/erp/list/kpim')} /> : null}
          {has('kurslarim') ? <ListItem icon="layers" module="brand" title="Kurslarim" onPress={() => go('/erp/list/kurslarim')} /> : null}
        </ListGroup>

        <LogoutButton size="md" textColor={c.danger} />
      </ScrollView>
    </View>
  );
}
