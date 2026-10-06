import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Callout, EmptyState, ListGroup, ListItem } from '@/design/primitives';
import { KpiGrid, PageHeader, Reveal, SectionHead, SkeletonList } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useHeaderRaise } from '@/design/motion';
import { DataTable, PeriodSwitch, type Col } from './data-table';
import { curMonth, errorText, hoursNum, hoursText, lateText, useDriverMonth, useDriversMonth, type DriverDay, type DriverMonthRow } from './pay-api';

/**
 * Haydovchilar: reyslar va davomat — haydovchi ish haqining asosi (asosan yetkazilgan reyslar).
 *   · `DriversPayScreen` — direktor, otdel kadr, logistika: oy bo'yicha barcha haydovchilar jadvali;
 *   · `DriverMonthScreen` — bitta haydovchi kunlari (reyslar, hajm, km, kelgan/ketgan); `id="me"` — "Mening reyslarim".
 * Km — taxminan (zavod → obyekt → zavod). Ish kuni — davomatda "Keldi" yoki shu kuni reys qilgan kun.
 */

const COLS: Col<DriverMonthRow>[] = [
  { key: 'trips', title: 'Reys', width: 52, align: 'right', cell: (r) => ({ text: String(r.trips), strong: true, color: r.trips ? undefined : 'faint' }) },
  { key: 'qty', title: 'Hajm', width: 108, align: 'right', cell: (r) => (r.trips ? { text: r.qtyText, strong: true } : null) },
  { key: 'km', title: 'Km', width: 60, align: 'right', cell: (r) => (r.km ? String(r.km) : null) },
  { key: 'days', title: 'Ish kuni', width: 68, align: 'right', cell: (r) => ({ text: String(r.workedDays), strong: true }) },
  { key: 'att', title: 'Davomat', width: 72, align: 'right', cell: (r) => (r.attDays ? `${r.attDays} kun` : { text: '—', color: 'faint' }) },
  { key: 'h', title: 'Soat', width: 56, align: 'right', cell: (r) => (r.minutes ? hoursNum(r.minutes) : null) },
  { key: 'late', title: 'Kechikdi', width: 72, align: 'right', cell: (r) => (r.lateDays ? { text: `${r.lateDays} marta`, color: 'danger' } : null) },
];

export function DriversPayScreen({ onBack }: { onBack: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const raise = useHeaderRaise();
  const router = useRouter();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const q = useDriversMonth(month);
  const d = q.data;
  const t = d?.totals;
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title="Haydovchilar" overline="Reyslar va davomat" onBack={onBack} raised={raise.raised} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl * 3, gap: space.stack }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.brand} />}
      >
        <PeriodSwitch
          title={d?.title ?? '…'}
          sub={t ? `${t.drivers} haydovchi` : undefined}
          onPrev={() => d && setMonth(d.prev)}
          onNext={d?.next ? () => setMonth(d.next === curMonth() ? undefined : d.next!) : null}
        />
        {q.error && !d ? (
          <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint={errorText(q.error)} onRetry={() => void q.refetch()} />
        ) : (
          <Reveal loading={q.isLoading || !d} skeleton={<SkeletonList rows={6} />} replay={month}>
            {t ? (
              <KpiGrid
                key="kpi"
                items={[
                  { label: 'Yetkazilgan reys', value: t.trips, icon: 'truck', module: 'logistics' },
                  { label: 'Hajm', value: t.qtyText, icon: 'package', module: 'logistics' },
                  { label: "Yo'l (taxminan)", value: `${t.km} km`, icon: 'route', module: 'logistics' },
                  { label: 'Ish kunlari (jami)', value: t.workedDays, icon: 'calendar-days', module: 'logistics' },
                ]}
              />
            ) : null}
            {d && d.rows.length ? (
              <DataTable
                key="t"
                rows={d.rows}
                rowKey={(r) => r.id}
                leadTitle="Haydovchi"
                lead={(r) => ({ title: r.fullName, sub: r.plate })}
                cols={COLS}
                onRow={(r) => router.push(`/erp/reyslarim?id=${encodeURIComponent(r.id)}${d.month !== curMonth() ? `&month=${d.month}` : ''}` as never)}
              />
            ) : d ? <EmptyState key="e" compact icon="truck" title="Bu oyda haydovchi yo'q" /> : null}
            {d && d.rows.length ? (
              <Callout key="n" tone="info" icon="info">Reys — yetkazilgan kuni bo'yicha. Ish kuni — davomatda «Keldi» yoki reys qilgan kun. Haydovchini bosing — kunlar.</Callout>
            ) : null}
          </Reveal>
        )}
      </ScrollView>
    </View>
  );
}

/** Kun qatori: "06 · Dush · 3 reys", ostida davomat va reys vaqtlari, o'ngda hajm. */
function DayBlock({ d }: { d: DriverDay }) {
  const att = d.checkIn
    ? `Keldi ${d.checkIn}${d.checkOut ? ` – ketdi ${d.checkOut}` : ''}${d.minutes != null ? ` · ${hoursText(d.minutes)}` : ''}${d.lateMin ? ` · ${lateText(d.lateMin)} kechikdi` : ''}`
    : d.status && d.status !== 'PRESENT' ? 'Davomat: ishda emas' : null;
  const road = d.firstAt && d.lastAt ? `Reyslar ${d.firstAt}–${d.lastAt}` : null;
  return (
    <View style={{ gap: space.sm }}>
      <SectionHead title={`${String(d.day).padStart(2, '0')} · ${d.weekday}`} unit={d.tripCount ? `${d.tripCount} reys${d.km ? ` · ${d.km} km` : ''}` : 'reys yo\'q'} />
      <ListGroup>
        {att || road ? (
          <ListItem
            icon={d.checkIn ? 'log-in' : 'clock'} module="logistics" tone={d.lateMin ? 'danger' : undefined}
            title={att ?? 'Davomat belgilanmagan'} subtitle={road ?? undefined}
            value={d.qtyText ?? undefined}
          />
        ) : null}
        {d.trips.map((t) => (
          <ListItem
            key={t.id} icon="truck" module="logistics"
            title={`${t.time} · ${t.customer}`}
            subtitle={`№${t.no}${t.product ? ` · ${t.product}` : ''} · ${t.plate}${t.km ? ` · ${t.km} km` : ''}`}
            value={t.qtyText}
          />
        ))}
      </ListGroup>
    </View>
  );
}

export function DriverMonthScreen({ id, month: initial, onBack }: { id: string; month?: string; onBack: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const raise = useHeaderRaise();
  const [month, setMonth] = useState<string | undefined>(initial && initial < curMonth() ? initial : undefined);
  const q = useDriverMonth(id, month);
  const d = q.data;
  const t = d?.totals;
  const own = id === 'me';
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title={own ? 'Mening reyslarim' : d?.driver.fullName ?? 'Haydovchi'} overline={own ? 'Oy bo\'yicha' : d?.driver.plate ?? 'Reyslar va davomat'} onBack={onBack} raised={raise.raised} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl * 3, gap: space.stack }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.brand} />}
      >
        <PeriodSwitch
          title={d?.title ?? '…'}
          sub={d ? `${d.driver.fullName}${d.driver.plate ? ` · ${d.driver.plate}` : ''}` : undefined}
          onPrev={() => d && setMonth(d.prev)}
          onNext={d?.next ? () => setMonth(d.next === curMonth() ? undefined : d.next!) : null}
        />
        {q.error && !d ? (
          <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint={errorText(q.error)} onRetry={() => void q.refetch()} />
        ) : (
          <Reveal loading={q.isLoading || !d} skeleton={<SkeletonList rows={6} />} replay={month}>
            {t ? (
              <KpiGrid
                key="kpi"
                items={[
                  { label: 'Yetkazilgan reys', value: t.trips, icon: 'truck', module: 'logistics' },
                  { label: 'Hajm', value: t.qtyText, icon: 'package', module: 'logistics' },
                  { label: "Yo'l (taxminan)", value: `${t.km} km`, icon: 'route', module: 'logistics' },
                  {
                    label: 'Ish kunlari', value: `${t.workedDays} kun`, icon: 'calendar-days', module: 'logistics',
                    delta: { text: `davomat ${t.attDays} · reys ${t.tripDays}`, tone: 'neutral' },
                  },
                ]}
              />
            ) : null}
            {t && (t.minutes || t.lateDays) ? (
              <Callout key="att" tone={t.lateDays ? 'warning' : 'info'} icon="clock">
                {`Davomat bo'yicha ${hoursText(t.minutes)}${t.lateDays ? ` · ${t.lateDays} marta kechikkan (jami ${lateText(t.lateMinutes)})` : ''}`}
              </Callout>
            ) : null}
            {d && d.days.length ? d.days.map((x) => <DayBlock key={x.date} d={x} />) : d ? (
              <EmptyState key="e" compact icon="truck" title="Bu oyda reys yo'q" />
            ) : null}
          </Reveal>
        )}
      </ScrollView>
    </View>
  );
}
