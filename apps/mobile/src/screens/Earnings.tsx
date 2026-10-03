import React from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { HeroCard, KpiGrid, ListGroup, SectionHead } from '@/design/blocks';
import { EmptyState, Gap, ListItem, Screen, Txt, fmtDate, fmtNum } from '@/design/primitives';
import { fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useMyEarnings } from '@/features/eco/api';

const money = (v: number | string) => `${fmtShort(v)} so'm`;

/** Quruvchi va Haydovchi uchun umumiy "Daromad": bu oy (hero) → bugun/hafta/jami/kutilmoqda → tarix. */
export function Earnings() {
  const { c } = useTheme();
  const q = useMyEarnings();
  const e = q.data;
  const pending = Number(e?.monthPending ?? 0);
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        {e ? (
          <>
            <HeroCard
              label="Bu oy daromad" value={Number(e.month)} format={(v) => fmtNum(Math.round(v))} unit="so'm"
              delta={Number(e.monthPaid) > 0 ? { text: `${money(e.monthPaid)} to'langan`, dir: 'up', tone: 'success' } : undefined}
            />
            <Gap h={space.grid} />
            <KpiGrid items={[
              { label: 'Bugun', value: money(e.today), icon: 'calendar-days', module: 'brand' },
              { label: 'Bu hafta', value: money(e.week), icon: 'calendar-days', module: 'brand' },
              { label: 'Kutilmoqda', value: money(pending), icon: 'clock', tone: pending > 0 ? 'warning' : undefined },
              { label: 'Jami', value: money(e.total), icon: 'wallet', module: 'brand' },
            ]} />
            <Gap h={space.section} />
            <SectionHead title="Tarix" count={e.items.length || undefined} />
            {e.items.length ? (
              <ListGroup>
                {e.items.map((p) => (
                  <ListItem key={p.id} icon={p.status === 'PAID' ? 'circle-check' : 'clock'} tone={p.status === 'PAID' ? 'success' : 'warning'} title={p.description} subtitle={`${fmtDate(p.earnedAt)} · ${p.status === 'PAID' ? "to'langan" : 'kutilmoqda'}`} subtitleLines={1} right={<Txt v="bodyStrong">{money(p.amount)}</Txt>} />
                ))}
              </ListGroup>
            ) : (
              <ListGroup><EmptyState compact icon="wallet" title="Hali daromad yo'q" hint="Bajarilgan ish va yetkazilgan yuk uchun to'lovlar shu yerda ko'rinadi" /></ListGroup>
            )}
          </>
        ) : q.isError ? (
          <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
