import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Callout, EmptyState, IconTile, Txt } from '@/design/primitives';
import { ChipGroup, KpiGrid, ListGroup, PageHeader, Reveal, SectionHead, SkeletonList, type KpiItem } from '@/design/blocks';
import { Icon, type IconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { alpha, elevation, moduleColors, radius, size, space, type ModuleTone, type Tone } from '@/design/tokens';
import { PressScale, useHeaderRaise } from '@/design/motion';
import { ApiException } from '@/core/api';
import type { ErpListData } from '@/core/erp';
import { useErpList } from './api';
import { ErpRowItem, ROW_ICON, idSeg, listModule } from './ui';

/**
 * Mexanik — «Kirim» tabi: pul kerak bo'lsa so'rov (Transport / Zavod / Boshqalar) va o'z so'rovlari.
 *
 * Formalar serverda (`/api/mobile/form?key=kirim-transport|kirim-zavod|kirim-boshqa`), umumiy `/erp/new/<key>` ekrani
 * ochadi; yaratilgach server `{ key: 'kirim', id }` qaytaradi — kartochka `/erp/kirim/<id>` (tasdiq, rad, pul berish,
 * bekor qilish — serverning amallari). Ro'yxat — `/api/mobile/list?key=kirim` (mexanikka faqat o'ziniki).
 * Server hali yangilanmagan bo'lsa ro'yxat o'rnida izoh chiqadi, bo'lim kartalari baribir ishlaydi.
 */

interface Choice { form: string; title: string; hint: string; icon: IconName; module: ModuleTone }

const CHOICES: Choice[] = [
  { form: 'kirim-transport', title: 'Transport', hint: "Mashina ta'miri, ehtiyot qism, shina", icon: 'truck', module: 'logistics' },
  { form: 'kirim-zavod', title: 'Zavod', hint: 'Uskuna, elektr, bino', icon: 'factory', module: 'production' },
  { form: 'kirim-boshqa', title: 'Boshqalar', hint: 'Boshqa xarajatlar', icon: 'shapes', module: 'warehouse' },
];

const STEPS: { title: string; icon: IconName; tone: Tone }[] = [
  { title: 'Siz yuborasiz', icon: 'send', tone: 'brand' },
  { title: 'Ish boshqaruvchi tasdiqlaydi', icon: 'circle-check', tone: 'info' },
  { title: 'Kassa pul beradi', icon: 'banknote', tone: 'success' },
];

/** So'rov holatlari: server filtr chipi yorlig'i (boshlanishi) va qator holati (enum yoki o'zbekcha nom). */
type Bucket = 'pending' | 'approved' | 'paid';
const BUCKET: Record<Bucket, { label: string; prefixes: string[]; statuses: string[] }> = {
  pending: { label: 'Kutilmoqda', prefixes: ['kutil'], statuses: ['NEW', 'PENDING', 'Kutilmoqda', 'Yangi'] },
  approved: { label: 'Tasdiqlangan', prefixes: ['tasdiq'], statuses: ['APPROVED', 'Tasdiqlangan'] },
  paid: { label: 'Berilgan', prefixes: ['beril', "to'lan", 'pul beril'], statuses: ['PAID', 'Berilgan', "To'langan", 'Pul berildi'] },
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[ʻ‘’`ʼ]/g, "'");

/** Server filtri (chip) — yorlig'i bo'yicha. */
const filterOf = (d: ErpListData | undefined, b: Bucket) => d?.filters?.find((f) => BUCKET[b].prefixes.some((p) => norm(f.label).startsWith(p)));

/**
 * Holat bo'yicha son: server chiplari bo'lsa — ularning soni (har doim to'liq, tanlangan filtrdan qat'i nazar);
 * chipsiz eski javobda — qatorlar holatidan. Ikkalasi ham yo'q — null (KPI ko'rsatilmaydi, son o'ylab topilmaydi).
 */
function countOf(d: ErpListData | undefined, b: Bucket): number | null {
  if (!d) return null;
  if (d.filters?.length) return filterOf(d, b)?.count ?? null;
  if (!d.rows.some((r) => r.status)) return null;
  return d.rows.filter((r) => r.status && BUCKET[b].statuses.includes(r.status)).length;
}

/** Server rad etdi (ro'yxat hali yo'q yoki rolga yopiq) — tarmoq xatosidan farqli izoh. */
const notReady = (e: unknown) => (e instanceof ApiException && (e.status === 404 || e.status === 403)) || e instanceof SyntaxError;

export function KirimScreen({ title = 'Kirim' }: { title?: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raise = useHeaderRaise();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data, isLoading, refetch, isRefetching, error } = useErpList('kirim', undefined, filter);
  const filters = data?.filters;
  const active = filters?.find((f) => f.active);
  const go = (href: string) => router.push(href as never);

  const kpis: KpiItem[] = [];
  const pick = (b: Bucket) => { const f = filterOf(data, b); return f ? () => setFilter(f.key) : undefined; };
  const pending = countOf(data, 'pending');
  const approved = countOf(data, 'approved');
  const paid = countOf(data, 'paid');
  if (pending != null) kpis.push({ label: BUCKET.pending.label, value: pending, tone: pending ? 'warning' : undefined, onPress: pick('pending') });
  if (approved != null) kpis.push({ label: BUCKET.approved.label, value: approved, tone: approved ? 'info' : undefined, delta: approved ? { text: 'kassada', tone: 'success' } : undefined, onPress: pick('approved') });
  if (paid != null) kpis.push({ label: BUCKET.paid.label, value: paid, tone: paid ? 'success' : undefined, onPress: pick('paid') });

  let list: React.ReactNode;
  if (isLoading) list = <SkeletonList rows={4} />;
  else if (error && !data) {
    list = (
      <Callout tone="warning" icon="cloud-off">
        <View style={{ gap: space.sm }}>
          <Txt v="bodySm" color="warning">
            {notReady(error)
              ? "So'rovlar ro'yxati hali ochilmadi — ERP serveri yangilanishi kerak. Yuqoridagi bo'limlar orqali so'rov yuborishga urinib ko'ring."
              : "So'rovlar yuklanmadi. Internetni tekshirib, qayta urinib ko'ring."}
          </Txt>
          <Button size="md" variant="secondary" full={false} icon="refresh-cw" title="Qayta urinish" onPress={() => void refetch()} />
        </View>
      </Callout>
    );
  } else if (!data || data.rows.length === 0) {
    // Tanlangan holatda bo'sh, boshqasida bor — "so'rov yo'q" deyish noto'g'ri bo'lardi
    const elsewhere = !!active && !!filters?.some((f) => f.key !== active.key && f.count > 0);
    list = elsewhere
      ? <EmptyState compact icon="hand-coins" title={`"${active!.label}" bo'yicha so'rov yo'q`} hint="Boshqa holatni tanlang" />
      : <EmptyState compact icon="hand-coins" title="Hali so'rov yo'q" hint="Pul kerak bo'lsa — yuqoridan bo'limni tanlang" />;
  } else {
    list = (
      <ListGroup>
        {data.rows.map((r) => (
          <ErpRowItem key={r.id} row={r} icon={ROW_ICON.kirim ?? 'hand-coins'} module={listModule('kirim')} onPress={() => go(`/erp/kirim/${idSeg(r.id)}`)} />
        ))}
      </ListGroup>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader overline="Pul kerak bo'lsa — so'rov yuboring" title={title} raised={raise.raised} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl * 3 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        <Reveal>
          {CHOICES.map((ch) => <ChoiceCard key={ch.form} choice={ch} onPress={() => go(`/erp/new/${ch.form}`)} />)}
          <FlowSteps key="flow" />
          {kpis.length ? <KpiGrid key="kpi" columns={kpis.length === 3 ? 3 : 2} items={kpis} /> : null}
          <SectionHead key="h" title="Mening so'rovlarim" count={data && !isLoading ? data.rows.length : undefined} />
          {filters?.length ? (
            <ChipGroup key="f" scroll items={filters.map((f) => ({ key: f.key, label: f.label, count: f.count }))} value={active?.key ?? filters[0]!.key} onChange={setFilter} />
          ) : null}
          <View key="list">{list}</View>
        </Reveal>
      </ScrollView>
    </View>
  );
}

/**
 * Katta tanlov kartasi: modul rangidagi 56 dp plitka, nom va izoh, o'ngda strelka; burchakda o'sha ikonka
 * xira suv belgisi bo'lib turadi — uchala karta bir qarashda farqlanadi.
 */
function ChoiceCard({ choice, onPress }: { choice: Choice; onPress: () => void }) {
  const { c } = useTheme();
  const col = moduleColors(c, choice.module);
  return (
    <PressScale onPress={onPress} scale={0.98} accessibilityRole="button" accessibilityLabel={`${choice.title}: ${choice.hint}`}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, minHeight: size.driverTouch + space.xxl, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }, elevation(c).sh1]}>
        <View pointerEvents="none" style={{ position: 'absolute', right: -space.lg, bottom: -space.xl }}>
          <Icon name={choice.icon} size={size.avatarLg * 2} color={alpha(col.ink, 0.07)} strokeWidth={1.25} />
        </View>
        <IconTile icon={choice.icon} module={choice.module} size={size.avatarLg} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt v="titleMd" numberOfLines={1}>{choice.title}</Txt>
          <Txt v="tSm" numberOfLines={2}>{choice.hint}</Txt>
        </View>
        <View style={{ width: size.iconTileSm, height: size.iconTileSm, borderRadius: radius.pill, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrow-right" size={size.iconSm} color={col.ink} strokeWidth={2} />
        </View>
      </View>
    </PressScale>
  );
}

/** Jarayon — 3 qadam bitta qatorda: plitkalar chiziq bilan ulangan. */
function FlowSteps() {
  const { c } = useTheme();
  const tile = size.iconTile;
  return (
    <View style={[{ padding: space.lg, gap: space.md, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous' }, elevation(c).sh1]}>
      <Txt v="overline" color="muted">Qanday ishlaydi</Txt>
      <View style={{ flexDirection: 'row' }}>
        {/* Ulovchi chiziq — birinchi va oxirgi plitka markazlari orasida */}
        <View pointerEvents="none" style={{ position: 'absolute', top: tile / 2 - 1, left: '16.6%', right: '16.6%', height: size.ring, backgroundColor: c.borderDefault }} />
        {STEPS.map((s) => (
          <View key={s.title} style={{ flex: 1, alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs }}>
            <View style={{ backgroundColor: c.bgSurface, paddingHorizontal: space.xs }}>
              <IconTile icon={s.icon} tone={s.tone} size={tile} />
            </View>
            <Txt v="caption" align="center" numberOfLines={3}>{s.title}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}
