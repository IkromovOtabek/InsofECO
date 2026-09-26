import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Card, Gap, KPICard, ListItem, Panel, Screen, Txt, fmtDate, fmtSum } from '@/design/primitives';
import { fmtShort } from '@/design/ui';
import { space } from '@/design/tokens';
import { useMyEarnings } from '@/features/eco/api';

const money = (v: number | string) => `${fmtShort(v)} so'm`;

/** Quruvchi va Haydovchi uchun umumiy "Daromad" ekrani. */
export function Earnings() {
  const q = useMyEarnings();
  const e = q.data;
  const grid = { flexBasis: '48%' as const, flexGrow: 1 };
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}>
        <Card>
          <Txt v="overline">Bu oy</Txt>
          <Txt v="metricHero" color="brand" numberOfLines={1} adjustsFontSizeToFit>{fmtSum(e?.month ?? 0)}</Txt>
          <View style={{ flexDirection: 'row', gap: space.xl, marginTop: space.sm }}>
            <View><Txt v="caption">To&apos;langan</Txt><Txt v="bodyStrong" color="success">{money(e?.monthPaid ?? 0)}</Txt></View>
            <View><Txt v="caption">Kutilmoqda</Txt><Txt v="bodyStrong" color="warning">{money(e?.monthPending ?? 0)}</Txt></View>
          </View>
        </Card>
        <Gap h={space.grid} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.grid }}>
          <KPICard label="Bugun" value={money(e?.today ?? 0)} icon="calendar-days" style={grid} />
          <KPICard label="Bu hafta" value={money(e?.week ?? 0)} icon="calendar-days" style={grid} />
          <KPICard label="Jami" value={money(e?.total ?? 0)} icon="wallet" style={grid} />
        </View>
        <Panel title="Tarix">
          {(e?.items ?? []).length === 0 ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Hali daromad yo&apos;q</Txt> : null}
          {(e?.items ?? []).map((p, i, arr) => (
            <ListItem key={p.id} icon={p.status === 'PAID' ? 'circle-check' : 'clock'} tone={p.status === 'PAID' ? 'success' : 'warning'} title={p.description} subtitle={`${fmtDate(p.earnedAt)} · ${p.status === 'PAID' ? "to'langan" : 'kutilmoqda'}`} right={<Txt v="bodyStrong">{money(p.amount)}</Txt>} last={i === arr.length - 1} />
          ))}
        </Panel>
        <Gap h={space.xxxl} />
      </ScrollView>
    </Screen>
  );
}
