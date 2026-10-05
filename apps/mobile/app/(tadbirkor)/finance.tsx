import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { EXPENSE_LABEL, INCOME_LABEL } from '@insof/shared';
import { BarChartCard, BreakdownCard, ChipGroup, HeroCard, KpiGrid, ListGroup, Reveal, SkeletonList } from '@/design/blocks';
import { Button, Card, EmptyState, Gap, Input, ListItem, Screen, Txt, fmtDateFull, fmtNum } from '@/design/primitives';
import { fmtShort, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useAction, useExpenses, useFinance, useIncomes } from '@/features/eco/api';

/** Moliya: chiplar (Umumiy / Daromad / Xarajat) → hero foyda, KPI, dinamika, taqsimotlar; ro'yxatlar ListGroup qatorlarida. */
export default function Finance() {
  const { c } = useTheme();
  const f = useFinance();
  const ex = useExpenses();
  const inc = useIncomes();
  const params = useLocalSearchParams<{ seg?: string }>();
  const [seg, setSeg] = useState<'overview' | 'income' | 'expense'>('overview');
  // Bosh sahifadagi "Xarajat" tezkor amali — to'g'ridan-to'g'ri kiritish bo'limiga.
  useEffect(() => { if (params.seg === 'expense' || params.seg === 'income' || params.seg === 'overview') setSeg(params.seg); }, [params.seg]);
  const [amt, setAmt] = useState(''); const [desc, setDesc] = useState('');
  const addExpense = useAction<{ amount: number; description: string; category: string }>((body) => ({ path: '/finance/expenses', body }), ['finance', 'dash']);
  const d = f.data;
  const n = (x: unknown) => Number(x ?? 0);
  const incomes = inc.data ?? [];
  const expenses = ex.data ?? [];
  const incSrc = (d?.incomeBySource ?? []).map((i) => ({ label: INCOME_LABEL[i.source as keyof typeof INCOME_LABEL] ?? i.source, value: n(i.amount) })).filter((i) => i.value > 0);
  const expCat = (d?.expenseByCategory ?? []).map((e) => ({ label: EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL] ?? e.category, value: n(e.amount) })).filter((e) => e.value > 0);
  const hasMonths = (d?.months ?? []).some((m) => n(m.income) > 0 || n(m.expense) > 0);
  const refresh = () => { void f.refetch(); void ex.refetch(); void inc.refetch(); };
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>
        <ChipGroup value={seg} onChange={setSeg} items={[{ key: 'overview', label: 'Umumiy' }, { key: 'income', label: 'Daromad', count: incomes.length || undefined }, { key: 'expense', label: 'Xarajat', count: expenses.length || undefined }]} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingTop: space.md, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={f.isRefetching || ex.isRefetching || inc.isRefetching} onRefresh={refresh} tintColor={c.textMuted} />}>
        {seg === 'overview' ? (
          f.isError && !d ? <EmptyState icon="cloud-off" title="Moliya yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={refresh} /> : (
            <Reveal key="o" loading={!d}>
              {d ? <HeroCard label="Sof foyda · jami" value={n(d.profit)} format={(v) => fmtNum(Math.round(v))} unit="so'm" /> : null}
              {d ? (
                <KpiGrid items={[
                  { label: 'Daromad', value: fmtShort(d.income), icon: 'wallet', module: 'brand', onPress: () => setSeg('income') },
                  { label: 'Xarajat', value: fmtShort(d.expense), icon: 'arrow-down', module: 'warehouse', onPress: () => setSeg('expense') },
                  { label: 'Kutilgan tushum', value: fmtShort(d.expectedIncome), icon: 'clock', module: 'brand' },
                  { label: 'Bugungi xarajat', value: fmtShort(d.todayExpense), icon: 'receipt', module: 'warehouse' },
                ]} />
              ) : null}
              {d && hasMonths ? <BarChartCard title="6 oylik dinamika" unit="so'm" labels={d.months.map((m) => m.label)} series={[{ name: 'Daromad', data: d.months.map((m) => n(m.income)) }, { name: 'Xarajat', data: d.months.map((m) => n(m.expense)) }]} /> : null}
              {incSrc.length ? <BreakdownCard title="Daromad manbalari" unit="so'm" items={incSrc} /> : null}
              {expCat.length ? <BreakdownCard title="Xarajat tarkibi" unit="so'm" items={expCat} /> : null}
            </Reveal>
          )
        ) : null}
        {seg === 'income' ? (
          <Reveal key="i" loading={inc.isLoading} skeleton={<SkeletonList rows={5} />}>
            {incomes.length ? [
              <Txt key="h" v="overline">{`${incomes.length} ta daromad`}</Txt>,
              <ListGroup key="l">
                {incomes.map((i) => (
                  <ListItem
                    key={i.id} icon={i.isExpected ? 'clock' : 'circle-arrow-down'} tone={i.isExpected ? 'warning' : 'success'} title={i.description}
                    subtitle={`${INCOME_LABEL[i.source as keyof typeof INCOME_LABEL] ?? i.source}${i.project ? ' · ' + i.project.name : ''} · ${fmtDateFull(i.date)}`}
                    value={`+${fmtShort(i.amount)} so'm`}
                    badge={i.isExpected ? { text: 'Kutilmoqda', tone: 'warning' } : { text: 'Tushdi', tone: 'success' }}
                  />
                ))}
              </ListGroup>,
            ] : inc.isError ? <EmptyState icon="cloud-off" title="Daromadlar yuklanmadi" onRetry={() => void inc.refetch()} /> : <EmptyState icon="wallet" title="Hali daromad yo'q" hint="Kiritilgan tushumlar shu yerda ko'rinadi" />}
          </Reveal>
        ) : null}
        {seg === 'expense' ? (
          <Reveal key="e">
            <Card>
              <Txt v="titleSm">Xarajat kiritish</Txt>
              <Gap h={space.md} />
              <Input label="Summa" value={amt} onChangeText={(v) => setAmt(v.replace(/\D/g, ''))} placeholder="so'm" keyboardType="number-pad" mono />
              <Input label="Izoh" value={desc} onChangeText={setDesc} placeholder="Masalan: yoqilg'i, DAF" />
              {!Number(amt) || desc.trim().length < 2 ? <Txt v="caption" color="muted" style={{ marginBottom: space.sm }}>{!Number(amt) ? 'Summani kiriting' : 'Izoh kamida 2 belgi'}</Txt> : null}
              <Button title="Qo'shish" icon="plus" loading={addExpense.isPending} disabled={!Number(amt) || desc.trim().length < 2} onPress={() => addExpense.mutate({ amount: Number(amt), description: desc, category: 'OTHER' }, { onSuccess: () => { setAmt(''); setDesc(''); void ex.refetch(); toast.success('Xarajat qo\'shildi'); }, onError: (e) => toast.error(e.message, 'Xato') })} />
            </Card>
            {ex.isLoading ? <SkeletonList rows={4} /> : expenses.length ? [
              <Txt key="h" v="overline">{`${expenses.length} ta xarajat`}</Txt>,
              <ListGroup key="l">
                {expenses.map((e) => (
                  <ListItem
                    key={e.id} icon="circle-arrow-up" tone="danger" title={e.description}
                    subtitle={`${EXPENSE_LABEL[e.category as keyof typeof EXPENSE_LABEL] ?? e.category}${e.project ? ' · ' + e.project.name : ''} · ${fmtDateFull(e.date)}`}
                    value={`−${fmtShort(e.amount)} so'm`}
                  />
                ))}
              </ListGroup>,
            ] : ex.isError ? <EmptyState icon="cloud-off" title="Xarajatlar yuklanmadi" onRetry={() => void ex.refetch()} /> : <ListGroup><EmptyState compact icon="receipt" title="Hali xarajat yo'q" hint="Yuqoridagi forma bilan kiriting" /></ListGroup>}
          </Reveal>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
