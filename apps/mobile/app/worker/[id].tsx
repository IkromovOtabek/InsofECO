import React from 'react';
import { ActivityIndicator, Linking, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SPECIALTY_LABEL } from '@insof/shared';
import { Button, Card, EmptyState, Gap, KPICard, ListItem, Panel, Screen, StatusChip, Txt, fmtDateFull, fmtSum } from '@/design/primitives';
import { Avatar, Stars, fmtShort } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { useWorker } from '@/features/eco/api';

/** Quruvchi profili: mutaxassislik, tajriba, reyting, ish tarixi, ish haqi. */
export default function WorkerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const q = useWorker(id); const w = q.data;
  if (!w) {
    return (
      <Screen>
        {q.isError ? <EmptyState icon="circle-alert" title="Quruvchi topilmadi" hint="Internetni tekshirib, qayta urinib ko'ring" action="Qayta urinish" onAction={() => void q.refetch()} /> : <ActivityIndicator color={c.brand} style={{ marginTop: space.xxxl }} />}
      </Screen>
    );
  }
  const p = w.profile;
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.x10 }}>
        <Card style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Avatar name={w.fullName} size={size.avatarLg} /><Gap h={space.sm} />
          <Txt v="titleMd" align="center">{w.fullName}</Txt>
          {p ? <Txt v="body" color="muted" align="center">{SPECIALTY_LABEL[p.specialty as keyof typeof SPECIALTY_LABEL]} · {p.experienceYears} yil tajriba</Txt> : null}
          {p ? <View style={{ marginTop: space.sm }}><Stars value={p.ratingAvg} size={size.iconMd} /></View> : null}
          <Gap h={space.lg} />
          <View style={{ flexDirection: 'row', gap: space.md, alignSelf: 'stretch' }}>
            <Button title="Qo'ng'iroq" icon="phone" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${w.phone}`)} />
            <Button title="Xabar" icon="message-circle" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push('/(tadbirkor)/messages')} />
          </View>
        </Card>
        <Gap h={space.md} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          <KPICard label="Bajargan ishlar" value={String(w.stats.done)} icon="square-check" tone="success" style={{ flex: 1, minWidth: '46%' }} />
          <KPICard label="Kechikkan" value={String(w.stats.late)} icon="clock" tone={w.stats.late > 0 ? 'warning' : undefined} style={{ flex: 1, minWidth: '46%' }} />
          <KPICard label="Kunlik narx" value={p ? fmtShort(p.dailyRate) : '—'} icon="banknote" style={{ flex: 1, minWidth: '46%' }} />
          <KPICard label="Jami ish haqi" value={fmtShort(w.stats.earned)} icon="wallet" style={{ flex: 1, minWidth: '46%' }} />
        </View>
        {w.projects.length ? (
          <Panel title="Hozirgi loyihalar" icon="building">
            {w.projects.map((pr, i, arr) => <ListItem key={pr.id} icon="building" title={pr.name} right={<StatusChip status={pr.status} />} onPress={() => router.push(`/project/${pr.id}`)} last={i === arr.length - 1} />)}
          </Panel>
        ) : null}
        <Panel title="Ish tarixi" icon="hammer">
          {w.workOrders.length === 0 ? <EmptyState icon="hammer" title="Hali ish yo'q" hint="Birinchi ish buyurtmasi shu yerda ko'rinadi" /> : null}
          {w.workOrders.map((o, i, arr) => <ListItem key={o.id} icon="hammer" module="production" title={o.title} subtitle={`${o.project?.name ?? ''} · ${fmtDateFull(o.createdAt)}`} right={<View style={{ alignItems: 'flex-end', gap: space.xs }}><Txt v="bodyStrong">{fmtShort(o.price)}</Txt><StatusChip status={o.status} /></View>} onPress={() => router.push(`/work-order/${o.id}`)} last={i === arr.length - 1} />)}
        </Panel>
        <Panel title="Baholar" icon="star">
          {w.reviews.length === 0 ? <EmptyState icon="star" title="Baholar yo'q" hint="Tadbirkor ishni qabul qilganda baho beradi" /> : null}
          {w.reviews.map((r, i, arr) => <ListItem key={r.id} icon="star" tone="warning" title={r.comment || 'Izohsiz baho'} subtitle={fmtDateFull(r.createdAt)} right={<Stars value={r.scoreOverall} />} last={i === arr.length - 1} />)}
        </Panel>
        <Panel title="Ish haqi" icon="wallet">
          {w.payouts.length === 0 ? <EmptyState icon="wallet" title="To'lovlar yo'q" /> : null}
          {w.payouts.slice(0, 10).map((pp, i, arr) => <ListItem key={pp.id} icon={pp.status === 'PAID' ? 'circle-check' : 'clock'} tone={pp.status === 'PAID' ? 'success' : 'warning'} title={pp.description} subtitle={`${fmtDateFull(pp.earnedAt)} · ${pp.status === 'PAID' ? 'to\'langan' : 'kutilmoqda'}`} right={<Txt v="bodyStrong">{fmtSum(pp.amount)}</Txt>} last={i === arr.length - 1} />)}
        </Panel>
      </ScrollView>
    </Screen>
  );
}
