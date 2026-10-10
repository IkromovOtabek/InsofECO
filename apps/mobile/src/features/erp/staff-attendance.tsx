import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Callout, Card, EmptyState, KVList, SearchField, Txt } from '@/design/primitives';
import { ChipGroup, KpiGrid, PageHeader, Reveal, SectionHead, SkeletonList } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useHeaderRaise } from '@/design/motion';
import { DataTable, PeriodSwitch, type Cell, type Col } from './data-table';
import {
  STATUS_TONE, curMonth, errorText, hoursNum, hoursText, lateText, todayIso, useEmployeeMonth, useStaffDay, yesterdayIso,
  type AttStatus, type EmployeeMonthDay, type StaffDayRow,
} from './pay-api';

/**
 * Davomat — barcha xodimlar (barcha bo'limlar) bir kunda: keldi, ketdi, soat, kechikish, holat, kim belgilagan.
 * Ish haqi shu jadvaldan hisoblanadi. Xodim bosilsa — uning oylik varag'i (kunlar va jami).
 * Otdel kadrning "Davomat" tabi; direktor, ishlab chiqarish va ish boshqaruvchi — Menyu orqali.
 */

type Filter = 'all' | 'in' | 'late' | 'absent' | 'none';

const tone = (s: AttStatus) => STATUS_TONE[s];
const statusCell = (s: AttStatus, label: string): Cell => {
  const t = tone(s);
  return { text: label, color: t === 'neutral' ? 'muted' : t, strong: s !== 'NONE' };
};

const DAY_COLS: Col<StaffDayRow>[] = [
  { key: 'in', title: 'Keldi', width: 60, align: 'center', cell: (r) => (r.checkIn ? { text: r.checkIn, color: r.lateMin ? 'danger' : undefined, strong: true } : null) },
  { key: 'out', title: 'Ketdi', width: 60, align: 'center', cell: (r) => (r.checkOut ? { text: r.checkOut, strong: true } : r.checkIn ? { text: 'ishda', color: 'success' } : null) },
  { key: 'h', title: 'Soat', width: 52, align: 'right', cell: (r) => (r.minutes != null ? { text: hoursNum(r.minutes), strong: true } : null) },
  { key: 'late', title: 'Kechikdi', width: 84, align: 'right', cell: (r) => (r.lateMin ? { text: lateText(r.lateMin), color: 'danger', strong: true } : null) },
  { key: 'early', title: 'Erta ketdi', width: 84, align: 'right', cell: (r) => (r.earlyMin ? { text: lateText(r.earlyMin), color: 'warning' } : null) },
  { key: 'st', title: 'Holat', width: 104, cell: (r) => statusCell(r.status, r.statusLabel) },
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
  const query = useStaffDay(date);
  const d = query.data;
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
                cols={DAY_COLS}
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
            {d ? <SectionHead key="h" title="Kunlar" count={d.days.length || undefined} /> : null}
            {d && d.days.length ? (
              <DataTable
                key="t"
                rows={d.days}
                rowKey={(r) => r.date}
                leadTitle="Sana"
                leadWidth={92}
                lead={(r) => ({ title: `${String(r.day).padStart(2, '0')} · ${r.weekday}`, sub: r.weekend ? 'dam olish' : null, color: r.status === 'ABSENT' ? 'danger' : r.weekend ? 'muted' : undefined })}
                cols={MONTH_COLS}
              />
            ) : d ? <EmptyState key="e" compact icon="calendar-days" title="Bu oyda kun yo'q" /> : null}
          </Reveal>
        )}
      </ScrollView>
    </View>
  );
}
