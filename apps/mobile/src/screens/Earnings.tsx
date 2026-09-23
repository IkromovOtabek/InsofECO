import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Card, Gap, Screen, Txt, fmtSum } from '@/design/primitives';
import { Kpi, Row, Section, fmtShort } from '@/design/ui';
import { useMyEarnings } from '@/features/eco/api';

/** Quruvchi va Haydovchi uchun umumiy "Daromad" ekrani. */
export function Earnings() {
  const q = useMyEarnings();
  const e = q.data;
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}>
        <Card>
          <Txt v="caption" color="secondary">BU OY</Txt>
          <Txt v="display" color="brand">{fmtSum(e?.month ?? 0)}</Txt>
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
            <View><Txt v="caption" color="secondary">To'langan</Txt><Txt v="bodyStrong" color="success">{fmtShort(e?.monthPaid ?? 0)}</Txt></View>
            <View><Txt v="caption" color="secondary">Kutilmoqda</Txt><Txt v="bodyStrong" color="warning">{fmtShort(e?.monthPending ?? 0)}</Txt></View>
          </View>
        </Card>
        <Gap h={10} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Kpi label="Bugun" value={fmtShort(e?.today ?? 0)} />
          <Kpi label="Bu hafta" value={fmtShort(e?.week ?? 0)} />
          <Kpi label="Jami" value={fmtShort(e?.total ?? 0)} tone="brand" />
        </View>
        <Section title="Tarix">
          {(e?.items ?? []).length === 0 ? <Txt color="secondary" style={{ padding: 12 }}>Hali daromad yo'q</Txt> : null}
          {(e?.items ?? []).map((p, i, arr) => <Row key={p.id} icon={p.status === 'PAID' ? 'checkmark-circle' : 'time'} iconTone={p.status === 'PAID' ? 'success' : 'warning'} title={p.description} subtitle={`${new Date(p.earnedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · ${p.status === 'PAID' ? "to'langan" : 'kutilmoqda'}`} right={<Txt v="bodyStrong">{fmtShort(p.amount)}</Txt>} last={i === arr.length - 1} />)}
        </Section>
      </ScrollView>
    </Screen>
  );
}
