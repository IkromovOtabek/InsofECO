import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StatusBar, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Callout, Card, EmptyState, IconButton, KVList, SearchField, Txt } from '@/design/primitives';
import { ChipGroup, KpiGrid, PageHeader, Reveal, SectionHead, SkeletonList } from '@/design/blocks';
import { Icon } from '@/design/icons';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useHeaderRaise } from '@/design/motion';
import { erpPhotoData } from '@/core/erp';
import { DataTable, PeriodSwitch, type Cell, type Col } from './data-table';
import {
  STATUS_TONE, curMonth, distText, errorText, hoursNum, hoursText, lateText, todayIso, useEmployeeMonth, useStaffDay, yesterdayIso,
  type AttStatus, type EmployeeMonthDay, type OutsideMark, type StaffDayRow,
} from './pay-api';

/**
 * Davomat — barcha xodimlar (barcha bo'limlar) bir kunda: keldi, ketdi, soat, kechikish, holat, kim belgilagan.
 * Ish haqi shu jadvaldan hisoblanadi. Xodim bosilsa — uning oylik varag'i (kunlar va jami).
 * Otdel kadrning "Davomat" tabi; boshqalar — bosh sahifadagi «Davomat» → Jadval va Menyu orqali. Faqat ko'rish (belgilash yo'q).
 * Oddiy xodimga server "Manba" (kim belgilagan) va "Izoh" ni bermaydi — bo'sh ustun chizilmaydi (`withoutEmpty`).
 */

/** Hamma qatorda bo'sh ustunlarni (manba, izoh) olib tashlaydi — server yashirgan ma'lumot uchun bo'sh ustun chiqmasin. */
function withoutEmpty<T extends { source: string | null; note?: string | null; outsideIn?: OutsideMark | null; outsideOut?: OutsideMark | null; anywhere?: boolean }>(cols: Col<T>[], rows: readonly T[]): Col<T>[] {
  const hasSrc = rows.some((r) => r.source);
  const hasNote = rows.some((r) => r.note);
  // «Hudud» — faqat kimdir tashqarida belgilagan yoki ruxsati bo'lsa (eski ERP'da ustun yo'q)
  const zone = hasZone(rows);
  return cols.filter((c) => (c.key !== 'src' || hasSrc) && (c.key !== 'note' || hasNote) && (c.key !== 'zone' || zone));
}

type Filter = 'all' | 'in' | 'late' | 'absent' | 'none';

const tone = (s: AttStatus) => STATUS_TONE[s];
const statusCell = (s: AttStatus, label: string): Cell => {
  const t = tone(s);
  return { text: label, color: t === 'neutral' ? 'muted' : t, strong: s !== 'NONE' };
};

// ───────────────────────── Hududdan tashqarida ─────────────────────────

/** "Hududdan tashqarida · 2,4 km" (masofa noma'lum bo'lsa — faqat birinchi qismi). */
const outsideLabel = (m: OutsideMark) => (m.distanceM != null ? `Hududdan tashqarida · ${distText(m.distanceM)}` : 'Hududdan tashqarida');

/** Jadvaldagi «Hudud» ustuni: tashqarida qo'yilgan belgi (eng uzoq masofa) yoki ruxsat. */
function zoneCell(r: { outsideIn?: OutsideMark | null; outsideOut?: OutsideMark | null; anywhere?: boolean }): Cell | null {
  const marks = [r.outsideIn, r.outsideOut].filter((m): m is OutsideMark => !!m);
  if (marks.length) {
    const far = Math.max(...marks.map((m) => m.distanceM ?? 0));
    return { text: far ? `tashqarida · ${distText(far)}` : 'tashqarida', color: 'warning', strong: true };
  }
  return r.anywhere ? { text: 'istalgan joydan', color: 'muted' } : null;
}
const hasZone = (rows: readonly { outsideIn?: OutsideMark | null; outsideOut?: OutsideMark | null; anywhere?: boolean }[]) =>
  rows.some((r) => r.outsideIn || r.outsideOut || r.anywhere);

/** Xaritada ochish — Yandex xaritalar (ilova o'rnatilgan bo'lsa o'sha ochadi). */
function openMap(m: OutsideMark) {
  Linking.openURL(`https://yandex.uz/maps/?pt=${m.lng},${m.lat}&z=16&l=map`).catch(() => toast.error("Xaritani ochib bo'lmadi"));
}

/** Turgan joy surati — Bearer bilan (`erpPhotoData`), keshda 10 daqiqa. */
const usePlacePhoto = (url: string | null) =>
  useQuery({
    queryKey: ['erp', 'place-photo', url ?? ''],
    queryFn: () => erpPhotoData(url!),
    enabled: !!url,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

interface OutsideItem { key: string; title: string; sub: string; mark: OutsideMark }
type PhotoView = { url: string; title: string; sub: string };

/** Kunlik jadval qatorlaridan: har bir tashqaridagi belgi (keldi / ketdi) alohida. */
function outsideOfDay(rows: StaffDayRow[]): OutsideItem[] {
  const out: OutsideItem[] = [];
  for (const r of rows) {
    if (r.outsideIn) out.push({ key: `${r.id}-in`, title: r.fullName, sub: `Keldi ${r.checkIn ?? '—'} · ${r.position}`, mark: r.outsideIn });
    if (r.outsideOut) out.push({ key: `${r.id}-out`, title: r.fullName, sub: `Ketdi ${r.checkOut ?? '—'} · ${r.position}`, mark: r.outsideOut });
  }
  return out;
}

/** Oylik varaqdagi kunlardan. */
function outsideOfMonth(days: EmployeeMonthDay[]): OutsideItem[] {
  const out: OutsideItem[] = [];
  for (const d of days) {
    const day = `${String(d.day).padStart(2, '0')} · ${d.weekday}`;
    if (d.outsideIn) out.push({ key: `${d.date}-in`, title: day, sub: `Keldi ${d.checkIn ?? '—'}`, mark: d.outsideIn });
    if (d.outsideOut) out.push({ key: `${d.date}-out`, title: day, sub: `Ketdi ${d.checkOut ?? '—'}`, mark: d.outsideOut });
  }
  return out;
}

/** Kichik surat — bosilsa to'liq ekranda. Yuklanmasa — kulrang plitka va rasm belgisi. */
function PlaceThumb({ url, label, onPress }: { url: string; label: string; onPress: () => void }) {
  const { c } = useTheme();
  const p = usePlacePhoto(url);
  const s = size.avatarLg;
  return (
    <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={`${label} — joy suratini ochish`} hitSlop={space.xs}>
      {p.data
        ? <Image source={{ uri: p.data }} style={{ width: s, height: s, borderRadius: radius.md, backgroundColor: c.bgMuted }} accessibilityIgnoresInvertColors />
        : (
          <View style={{ width: s, height: s, borderRadius: radius.md, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
            {p.isLoading ? <ActivityIndicator color={c.textMuted} /> : <Icon name="image" tone="faint" size={size.iconMd} />}
          </View>
        )}
    </Pressable>
  );
}

/** Tashqaridagi bitta belgi: surat, ism (yoki kun), vaqt, masofa nishoni; pastda «Surat» va «Xaritada». */
function OutsideCard({ item, onPhoto }: { item: OutsideItem; onPhoto: (v: PhotoView) => void }) {
  const view = () => onPhoto({ url: item.mark.photoUrl, title: item.title, sub: item.sub });
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <PlaceThumb url={item.mark.photoUrl} label={item.title} onPress={view} />
        <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
          <Txt v="listTitle" numberOfLines={1}>{item.title}</Txt>
          <Txt v="tSm" numberOfLines={1}>{item.sub}</Txt>
          <Badge icon="map-pin" tone="warning" label={outsideLabel(item.mark)} style={{ alignSelf: 'flex-start' }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button size="md" variant="secondary" icon="image" title="Surat" onPress={view} /></View>
        <View style={{ flex: 1 }}><Button size="md" variant="secondary" icon="map" title="Xaritada" onPress={() => openMap(item.mark)} /></View>
      </View>
    </Card>
  );
}

/** Ko'pi bilan shuncha karta, qolgani "Barchasi" bilan. */
const OUTSIDE_ROWS = 3;

/** "Hududdan tashqaridagilar" bo'limi — sarlavha va kartalar (3 tadan ko'p bo'lsa yig'iladi). */
function OutsideSection({ title, items, onPhoto }: { title: string; items: OutsideItem[]; onPhoto: (v: PhotoView) => void }) {
  const [all, setAll] = useState(false);
  const extra = items.length > OUTSIDE_ROWS;
  return (
    <View style={{ gap: space.sm }}>
      <SectionHead title={title} count={items.length} icon="map-pin" action={extra ? (all ? 'Yashirish' : `Barchasi (${items.length})`) : undefined} onAction={extra ? () => setAll((v) => !v) : undefined} />
      {(all ? items : items.slice(0, OUTSIDE_ROWS)).map((it) => <OutsideCard key={it.key} item={it} onPhoto={onPhoto} />)}
    </View>
  );
}

/** To'liq ekranli joy surati — qora fon, pastda ism va vaqt. */
function PlacePhotoViewer({ view, onClose }: { view: PhotoView | null; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const p = usePlacePhoto(view?.url ?? null);
  return (
    <Modal visible={!!view} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: c.bgInverse }}>
        {p.data ? (
          <Image source={{ uri: p.data }} resizeMode="contain" style={{ flex: 1, width: '100%' }} accessibilityLabel={view?.title} accessibilityIgnoresInvertColors />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.pageX }}>
            {p.error ? <Txt v="body" color="onSolid" align="center">{errorText(p.error)}</Txt> : <ActivityIndicator color={c.textOnInverse} size="large" />}
          </View>
        )}
        <View style={{ position: 'absolute', top: insets.top + space.sm, right: space.pageX }}>
          <IconButton icon="x" label="Yopish" onPress={onClose} variant="secondary" />
        </View>
        {view ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.pageX, paddingTop: space.lg, paddingBottom: insets.bottom + space.lg, backgroundColor: c.scrim, gap: space.xs }}>
            <Txt v="titleMd" color="onSolid" numberOfLines={1}>{view.title}</Txt>
            <Badge label={view.sub} tone="neutral" style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const DAY_COLS: Col<StaffDayRow>[] = [
  { key: 'in', title: 'Keldi', width: 60, align: 'center', cell: (r) => (r.checkIn ? { text: r.checkIn, color: r.lateMin ? 'danger' : undefined, strong: true } : null) },
  { key: 'out', title: 'Ketdi', width: 60, align: 'center', cell: (r) => (r.checkOut ? { text: r.checkOut, strong: true } : r.checkIn ? { text: 'ishda', color: 'success' } : null) },
  { key: 'h', title: 'Soat', width: 52, align: 'right', cell: (r) => (r.minutes != null ? { text: hoursNum(r.minutes), strong: true } : null) },
  { key: 'late', title: 'Kechikdi', width: 84, align: 'right', cell: (r) => (r.lateMin ? { text: lateText(r.lateMin), color: 'danger', strong: true } : null) },
  { key: 'early', title: 'Erta ketdi', width: 84, align: 'right', cell: (r) => (r.earlyMin ? { text: lateText(r.earlyMin), color: 'warning' } : null) },
  { key: 'st', title: 'Holat', width: 104, cell: (r) => statusCell(r.status, r.statusLabel) },
  { key: 'zone', title: 'Hudud', width: 140, cell: zoneCell },
  { key: 'src', title: 'Manba', width: 100, cell: (r) => (r.source ? { text: r.source, color: 'muted' } : null) },
  { key: 'shift', title: 'Smena', width: 100, cell: (r) => ({ text: `${r.shift.start}–${r.shift.end}`, color: 'muted' }) },
];

/** `top` — jadval ustidagi qo'shimcha blok (Davomat ekranidagi Skaner / Jadval / Yuzlar almashtirgichi). */
export function StaffAttendanceScreen({ onBack, title = 'Davomat', overline = 'Ish haqi asosi', top }: { onBack?: () => void; title?: string; overline?: string; top?: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const raise = useHeaderRaise();
  const router = useRouter();
  const [date, setDate] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [photo, setPhoto] = useState<PhotoView | null>(null);
  const query = useStaffDay(date);
  const d = query.data;
  const outside = useMemo(() => outsideOfDay(d?.rows ?? []), [d]);
  const iso = d?.date ?? date ?? todayIso();
  const dayKey = iso === todayIso() ? 'today' : iso === yesterdayIso() ? 'yesterday' : 'other';

  const rows = useMemo(() => {
    const all = d?.rows ?? [];
    const s = q.trim().toLowerCase();
    return all.filter((r) => {
      if (s && !`${r.fullName} ${r.position} ${r.dept ?? ''}`.toLowerCase().includes(s)) return false;
      switch (filter) {
        case 'in': return r.status === 'PRESENT';
        case 'late': return !!r.lateMin;
        case 'absent': return r.status === 'ABSENT';
        case 'none': return r.status === 'NONE';
        default: return true;
      }
    });
  }, [d, filter, q]);

  const t = d?.totals;
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title={title} overline={overline} onBack={onBack} raised={raise.raised} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl * 3, gap: space.stack }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.brand} />}
      >
        {top}
        <ChipGroup
          items={[{ key: 'today', label: 'Bugun' }, { key: 'yesterday', label: 'Kecha' }, ...(dayKey === 'other' ? [{ key: 'other' as const, label: iso.slice(8, 10) + '.' + iso.slice(5, 7) }] : [])]}
          value={dayKey}
          onChange={(k) => { if (k === 'today') setDate(undefined); else if (k === 'yesterday') setDate(yesterdayIso()); }}
        />
        <PeriodSwitch
          title={d?.title ?? '…'}
          sub={t ? `${t.total} xodim · jami ${hoursText(t.minutes)}` : undefined}
          onPrev={() => d && setDate(d.prev)}
          onNext={d?.next ? () => setDate(d.next === todayIso() ? undefined : d.next!) : null}
        />
        {query.error && !d ? (
          <EmptyState icon="cloud-off" title="Davomat yuklanmadi" hint={errorText(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <Reveal loading={query.isLoading || !d} skeleton={<SkeletonList rows={6} />} replay={iso}>
            {outside.length ? <OutsideSection key="out" title="Hududdan tashqaridagilar" items={outside} onPhoto={setPhoto} /> : null}
            {t ? (
              <KpiGrid
                key="kpi"
                items={[
                  { label: 'Keldi', value: t.present, icon: 'user-check', tone: 'success', delta: t.inside ? { text: `${t.inside} ishda`, tone: 'success' } : undefined, onPress: () => setFilter('in') },
                  { label: 'Kelmadi', value: t.absent, icon: 'user-x', tone: t.absent ? 'danger' : undefined, delta: t.sick + t.leave ? { text: `kasal/ta'til ${t.sick + t.leave}`, tone: 'info' } : undefined, onPress: () => setFilter('absent') },
                  { label: 'Kechikdi', value: t.late, icon: 'alarm-clock', tone: t.late ? 'danger' : undefined, delta: t.lateMinutes ? { text: `jami ${lateText(t.lateMinutes)}`, tone: 'danger' } : undefined, onPress: () => setFilter('late') },
                  { label: 'Belgilanmagan', value: t.notMarked, icon: 'clock', tone: t.notMarked ? 'warning' : undefined, onPress: () => setFilter('none') },
                ]}
              />
            ) : null}
            {t ? (
              <ChipGroup
                key="f"
                scroll
                items={[
                  { key: 'all', label: 'Hammasi', count: t.total },
                  { key: 'in', label: 'Keldi', count: t.present },
                  { key: 'late', label: 'Kechikdi', count: t.late },
                  { key: 'absent', label: 'Kelmadi', count: t.absent },
                  { key: 'none', label: 'Belgilanmagan', count: t.notMarked },
                ]}
                value={filter}
                onChange={setFilter}
              />
            ) : null}
            {d && d.rows.length > 8 ? <SearchField key="s" value={q} onChangeText={setQ} placeholder="Ism yoki lavozim" /> : null}
            {d && rows.length ? (
              <DataTable
                key="t"
                rows={rows}
                rowKey={(r) => r.id}
                leadTitle="Xodim"
                lead={(r) => ({ title: r.fullName, sub: r.dept && r.dept !== r.position ? `${r.position} · ${r.dept}` : r.position, color: r.status === 'ABSENT' ? 'danger' : undefined })}
                cols={withoutEmpty(DAY_COLS, d.rows)}
                onRow={(r) => router.push(`/erp/davomat-xodim?id=${encodeURIComponent(r.id)}&month=${iso.slice(0, 7)}` as never)}
              />
            ) : d ? (
              <EmptyState key="e" compact icon="users" title={d.rows.length ? "Bu filtrda xodim yo'q" : "Bu kunga xodim yo'q"} />
            ) : null}
            {d && rows.length ? (
              <Txt key="hint" v="caption" align="center">Jadvalni yon tomonga suring · xodimni bosing — oylik varaq</Txt>
            ) : null}
          </Reveal>
        )}
      </ScrollView>
      <PlacePhotoViewer view={photo} onClose={() => setPhoto(null)} />
    </View>
  );
}

// ───────────────────────── Xodimning oylik varag'i ─────────────────────────

const MONTH_COLS: Col<EmployeeMonthDay>[] = [
  { key: 'in', title: 'Keldi', width: 60, align: 'center', cell: (r) => (r.checkIn ? { text: r.checkIn, color: r.lateMin ? 'danger' : undefined, strong: true } : null) },
  { key: 'out', title: 'Ketdi', width: 60, align: 'center', cell: (r) => (r.checkOut ? { text: r.checkOut, strong: true } : r.checkIn ? { text: '…', color: 'warning' } : null) },
  { key: 'h', title: 'Soat', width: 52, align: 'right', cell: (r) => (r.minutes != null ? { text: hoursNum(r.minutes), strong: true } : null) },
  { key: 'late', title: 'Kechikdi', width: 84, align: 'right', cell: (r) => (r.lateMin ? { text: lateText(r.lateMin), color: 'danger', strong: true } : null) },
  { key: 'early', title: 'Erta ketdi', width: 84, align: 'right', cell: (r) => (r.earlyMin ? { text: lateText(r.earlyMin), color: 'warning' } : null) },
  { key: 'st', title: 'Holat', width: 104, cell: (r) => (r.statusLabel ? statusCell(r.status, r.statusLabel) : { text: r.weekend ? 'Dam olish' : '—', color: 'faint' }) },
  { key: 'zone', title: 'Hudud', width: 140, cell: zoneCell },
  { key: 'src', title: 'Manba', width: 100, cell: (r) => (r.source ? { text: r.source, color: 'muted' } : null) },
  { key: 'note', title: 'Izoh', width: 160, cell: (r) => (r.note ? { text: r.note, color: 'muted' } : null) },
];

export function EmployeeAttendanceScreen({ id, month: initial, onBack }: { id: string; month?: string; onBack: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const raise = useHeaderRaise();
  const [month, setMonth] = useState<string | undefined>(initial && initial < curMonth() ? initial : undefined);
  const query = useEmployeeMonth(id, month);
  const d = query.data;
  const t = d?.totals;
  const [photo, setPhoto] = useState<PhotoView | null>(null);
  const outside = useMemo(() => outsideOfMonth(d?.days ?? []), [d]);
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title={d?.employee.fullName ?? 'Xodim davomati'} overline="Oylik davomat" onBack={onBack} raised={raise.raised} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl * 3, gap: space.stack }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.brand} />}
      >
        <PeriodSwitch
          title={d?.title ?? '…'}
          sub={d ? `${d.employee.position} · smena ${d.shift.start}–${d.shift.end}` : undefined}
          onPrev={() => d && setMonth(d.prev)}
          onNext={d?.next ? () => setMonth(d.next === curMonth() ? undefined : d.next!) : null}
        />
        {query.error && !d ? (
          <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint={errorText(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <Reveal loading={query.isLoading || !d} skeleton={<SkeletonList rows={6} />} replay={month}>
            {t ? (
              <KpiGrid
                key="kpi"
                items={[
                  { label: 'Ish kunlari', value: `${t.present} kun`, icon: 'calendar-days' },
                  { label: 'Jami ish vaqti', value: hoursText(t.minutes), icon: 'clock' },
                  { label: 'Kechikish', value: `${t.lateDays} marta`, icon: 'alarm-clock', tone: t.lateDays ? 'danger' : undefined, delta: t.lateMinutes ? { text: `jami ${lateText(t.lateMinutes)}`, tone: 'danger' } : undefined },
                  { label: 'Kelmagan', value: `${t.absent} kun`, icon: 'user-x', tone: t.absent ? 'danger' : undefined, delta: t.sick + t.leave ? { text: `kasal/ta'til ${t.sick + t.leave}`, tone: 'info' } : undefined },
                ]}
              />
            ) : null}
            {t ? (
              <Card key="kv" style={{ paddingVertical: space.sm }}>
                <KVList
                  flat
                  rows={[
                    { label: 'Erta ketish', value: t.earlyDays ? `${t.earlyDays} marta · ${lateText(t.earlyMinutes)}` : "yo'q", tone: t.earlyDays ? 'warning' : undefined },
                    { label: '«Ketdi» yozilmagan', value: t.openDays ? `${t.openDays} kun` : "yo'q", tone: t.openDays ? 'warning' : undefined },
                    { label: 'Dam olish', value: `${t.dayoff} kun` },
                    { label: 'Belgilanmagan ish kuni', value: `${t.notMarked} kun`, tone: t.notMarked ? 'warning' : undefined },
                  ]}
                />
              </Card>
            ) : null}
            {t && t.openDays ? (
              <Callout key="warn" tone="warning" icon="triangle-alert">«Ketdi» vaqti yozilmagan kunlar soatga qo'shilmaydi — tabelda to'ldiring.</Callout>
            ) : null}
            {d?.employee.anywhere ? (
              <Callout key="any" tone="info" icon="map-pin">Hududdan tashqarida ham belgilash mumkin — bunday belgi turgan joy surati bilan saqlanadi.</Callout>
            ) : null}
            {outside.length ? <OutsideSection key="out" title="Hududdan tashqarida" items={outside} onPhoto={setPhoto} /> : null}
            {d ? <SectionHead key="h" title="Kunlar" count={d.days.length || undefined} /> : null}
            {d && d.days.length ? (
              <DataTable
                key="t"
                rows={d.days}
                rowKey={(r) => r.date}
                leadTitle="Sana"
                leadWidth={92}
                lead={(r) => ({ title: `${String(r.day).padStart(2, '0')} · ${r.weekday}`, sub: r.weekend ? 'dam olish' : null, color: r.status === 'ABSENT' ? 'danger' : r.weekend ? 'muted' : undefined })}
                cols={withoutEmpty(MONTH_COLS, d.days)}
              />
            ) : d ? <EmptyState key="e" compact icon="calendar-days" title="Bu oyda kun yo'q" /> : null}
          </Reveal>
        )}
      </ScrollView>
      <PlacePhotoViewer view={photo} onClose={() => setPhoto(null)} />
    </View>
  );
}
