import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { EXPENSE_LABEL, INCOME_LABEL } from '@insof/shared';
import { Button, Card, Divider, Gap, Input, ListItem, Panel, Screen, Txt, TxtColor, fmtDateFull, fmtSum } from '@/design/primitives';
import { BarChart, Breakdown, Legend, Tabs, toast } from '@/design/ui';
import { space } from '@/design/tokens';
import { useAction, useExpenses, useFinance, useIncomes } from '@/features/eco/api';

export default function Finance() {
  const f = useFinance();
  const ex = useExpenses();
  const inc = useIncomes();
  const [seg, setSeg] = useState<'overview' | 'income' | 'expense'>('overview');
  const [amt, setAmt] = useState(''); const [desc, setDesc] = useState('');
  const addExpense = useAction<{ amount: number; description: string; category: string }>((body) => ({ path: '/finance/expenses', body }), ['finance', 'dash']);
  const d = f.data;
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>
        <Tabs value={seg} onChange={setSeg} items={[{ key: 'overview', label: 'Umumiy' }, { key: 'income', label: 'Daromad' }, { key: 'expense', label: 'Xarajat' }]} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingTop: space.md }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={f.isFetching} onRefresh={() => { void f.refetch(); void ex.refetch(); void inc.refetch(); }} />}>
        {seg === 'overview' && d ? (
          <>
            <Card>
              <Line label="Daromad" value={fmtSum(d.income)} tone="success" />
              <Line label="Xarajat" value={fmtSum(d.expense)} tone="danger" />
              <Divider style={{ marginVertical: space.sm }} />
              <Line label="Foyda" value={fmtSum(d.profit)} tone="brand" big />
              <Txt v="caption" style={{ marginTop: space.sm }}>Kutilayotgan daromad: {fmtSum(d.expectedIncome)}</Txt>
            </Card>
            <Panel title="6 oylik dinamika">
              <View style={{ paddingVertical: space.sm }}>
                <BarChart data={d.months.map((m) => ({ label: m.label, a: Number(m.income), b: Number(m.expense) }))} height={160} />
                <Legend items={[{ label: 'Daromad', tone: 'chart1' }, { label: 'Xarajat', tone: 'chart2' }]} />
              </View>
            </Panel>
            <Panel title="Daromad manbalari"><View style={{ paddingVertical: space.sm }}><Breakdown rows={d.incomeBySource.map((i) => ({ label: INCOME_LABEL[i.source as keyof typeof INCOME_LABEL], value: Number(i.amount) }))} /></View></Panel>
            <Panel title="Xarajat kategoriyalari"><View style={{ paddingVertical: space.sm }}><Breakdown rows={d.expenseByCategory.map((e) => ({ label: EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL], value: Number(e.amount) }))} /></View></Panel>
          </>
        ) : null}
        {seg === 'income' ? (
          <Panel title="Daromadlar" style={{ marginTop: 0 }}>
            {(inc.data ?? []).length === 0 ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Hali daromad yo&apos;q</Txt> : null}
            {(inc.data ?? []).map((i, idx, arr) => (
              <ListItem
                key={i.id} icon={i.isExpected ? 'clock' : 'circle-arrow-down'} tone={i.isExpected ? 'warning' : 'success'} title={i.description}
                subtitle={`${INCOME_LABEL[i.source as keyof typeof INCOME_LABEL]}${i.project ? ' · ' + i.project.name : ''} · ${fmtDateFull(i.date)}`}
                right={<Txt v="bodyStrong" color={i.isExpected ? 'warning' : 'success'}>{fmtSum(i.amount)}</Txt>} last={idx === arr.length - 1}
              />
            ))}
          </Panel>
        ) : null}
        {seg === 'expense' ? (
          <>
            <Card>
              <Txt v="titleSm">Xarajat kiritish</Txt>
              <Gap h={space.md} />
              <Input label="Summa" value={amt} onChangeText={setAmt} placeholder="so'm" keyboardType="number-pad" mono />
              <Input label="Izoh" value={desc} onChangeText={setDesc} placeholder="Masalan: yoqilg'i, DAF" />
              <Button title="Qo'shish" icon="plus" loading={addExpense.isPending} disabled={!amt || desc.length < 2} onPress={() => addExpense.mutate({ amount: Number(amt), description: desc, category: 'OTHER' }, { onSuccess: () => { setAmt(''); setDesc(''); void ex.refetch(); toast.success('Xarajat qo\'shildi'); }, onError: (e) => toast.error(e.message, 'Xato') })} />
            </Card>
            <Panel title="Xarajatlar">
              {(ex.data ?? []).length === 0 ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Hali xarajat yo&apos;q</Txt> : null}
              {(ex.data ?? []).map((e, idx, arr) => (
                <ListItem
                  key={e.id} icon="circle-arrow-up" tone="danger" title={e.description}
                  subtitle={`${EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL]}${e.project ? ' · ' + e.project.name : ''} · ${fmtDateFull(e.date)}`}
                  right={<Txt v="bodyStrong" color="danger">−{fmtSum(e.amount)}</Txt>} last={idx === arr.length - 1}
                />
              ))}
            </Panel>
          </>
        ) : null}
        <Gap h={space.xxxl} />
      </ScrollView>
    </Screen>
  );
}

function Line({ label, value, tone, big }: { label: string; value: string; tone: TxtColor; big?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.xs, gap: space.sm }}>
      <Txt v={big ? 'titleSm' : 'body'}>{label}</Txt>
      <Txt v={big ? 'titleMd' : 'bodyStrong'} color={tone}>{value}</Txt>
    </View>
  );
}
