import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { EXPENSE_LABEL, INCOME_LABEL } from '@insof/shared';
import { Button, Card, Field, Gap, Screen, Txt, fmtSum } from '@/design/primitives';
import { BarChart, Breakdown, Legend, Row, Section, Segmented, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useAction, useExpenses, useFinance, useIncomes } from '@/features/eco/api';

export default function Finance() {
  const { c } = useTheme();
  const f = useFinance();
  const ex = useExpenses();
  const inc = useIncomes();
  const [seg, setSeg] = useState<'overview' | 'income' | 'expense'>('overview');
  const [amt, setAmt] = useState(''); const [desc, setDesc] = useState('');
  const addExpense = useAction<{ amount: number; description: string; category: string }>((body) => ({ path: '/finance/expenses', body }), ['finance', 'dash']);
  const d = f.data;
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Segmented value={seg} onChange={setSeg} items={[{ key: 'overview', label: 'Umumiy' }, { key: 'income', label: 'Daromad' }, { key: 'expense', label: 'Xarajat' }]} /></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }} refreshControl={<RefreshControl refreshing={f.isFetching} onRefresh={() => { void f.refetch(); void ex.refetch(); void inc.refetch(); }} />}>
        {seg === 'overview' && d ? (
          <>
            <Card>
              <Line label="Daromad" value={fmtSum(d.income)} tone="success" />
              <Line label="Xarajat" value={fmtSum(d.expense)} tone="danger" />
              <View style={{ height: 1, backgroundColor: c.border, marginVertical: 10 }} />
              <Line label="Foyda" value={fmtSum(d.profit)} tone="brand" big />
              <Txt v="caption" color="secondary" style={{ marginTop: 8 }}>Kutilayotgan daromad: {fmtSum(d.expectedIncome)}</Txt>
            </Card>
            <Section title="6 oylik dinamika">
              <View style={{ paddingVertical: 8 }}><BarChart data={d.months.map((m) => ({ label: m.label, a: Number(m.income), b: Number(m.expense) }))} height={160} /><Legend items={[{ label: 'Daromad', tone: 'brand' }, { label: 'Xarajat', tone: 'accent' }]} /></View>
            </Section>
            <Section title="Daromad manbalari"><View style={{ paddingVertical: 8 }}><Breakdown rows={d.incomeBySource.map((i) => ({ label: INCOME_LABEL[i.source as keyof typeof INCOME_LABEL], value: Number(i.amount) }))} /></View></Section>
            <Section title="Xarajat kategoriyalari"><View style={{ paddingVertical: 8 }}><Breakdown rows={d.expenseByCategory.map((e) => ({ label: EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL], value: Number(e.amount) }))} /></View></Section>
          </>
        ) : null}
        {seg === 'income' ? (
          <Section title="Daromadlar" style={{ marginTop: 4 }}>
            {(inc.data ?? []).map((i, idx, arr) => <Row key={i.id} icon={i.isExpected ? 'time-outline' : 'arrow-down-circle'} iconTone={i.isExpected ? 'warning' : 'success'} title={i.description} subtitle={`${INCOME_LABEL[i.source as keyof typeof INCOME_LABEL]}${i.project ? ' · ' + i.project.name : ''} · ${new Date(i.date).toLocaleDateString('ru-RU')}`} right={<Txt v="bodyStrong" color={i.isExpected ? 'secondary' : 'success'}>{fmtShort(i.amount)}</Txt>} last={idx === arr.length - 1} />)}
          </Section>
        ) : null}
        {seg === 'expense' ? (
          <>
            <Card>
              <Txt v="heading">Xarajat kiritish</Txt>
              <Gap h={10} />
              <Field value={amt} onChangeText={setAmt} placeholder="Summa, so'm" keyboardType="number-pad" />
              <Field value={desc} onChangeText={setDesc} placeholder="Izoh (masalan: yoqilg'i, DAF)" />
              <Button title="Qo'shish" size="md" loading={addExpense.isPending} disabled={!amt || desc.length < 2} onPress={() => addExpense.mutate({ amount: Number(amt), description: desc, category: 'OTHER' }, { onSuccess: () => { setAmt(''); setDesc(''); void ex.refetch(); }, onError: (e) => Alert.alert('Xato', e.message) })} />
            </Card>
            <Section title="Xarajatlar">
              {(ex.data ?? []).map((e, idx, arr) => <Row key={e.id} icon="arrow-up-circle" iconTone="danger" title={e.description} subtitle={`${EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL]}${e.project ? ' · ' + e.project.name : ''} · ${new Date(e.date).toLocaleDateString('ru-RU')}`} right={<Txt v="bodyStrong" color="danger">−{fmtShort(e.amount)}</Txt>} last={idx === arr.length - 1} />)}
            </Section>
          </>
        ) : null}
        <Gap h={30} />
      </ScrollView>
    </Screen>
  );
}
function Line({ label, value, tone, big }: { label: string; value: string; tone: 'success' | 'danger' | 'brand'; big?: boolean }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}><Txt v={big ? 'heading' : 'body'}>{label}</Txt><Txt v={big ? 'subtitle' : 'bodyStrong'} color={tone}>{value}</Txt></View>;
}
