import React from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SPECIALTY_LABEL } from '@insof/shared';
import { Button, Card, Gap, Screen, StatusChip, Txt, fmtSum } from '@/design/primitives';
import { Avatar, Kpi, Row, Section, Stars, fmtShort } from '@/design/ui';
import { useWorker } from '@/features/eco/api';

/** Quruvchi profili: mutaxassislik, tajriba, reyting, ish tarixi, ish haqi. */
export default function WorkerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useWorker(id); const w = q.data;
  if (!w) return <Screen><Txt color="secondary">Yuklanmoqda…</Txt></Screen>;
  const p = w.profile;
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Avatar name={w.fullName} size={76} /><Gap h={10} />
          <Txt v="subtitle">{w.fullName}</Txt>
          <Txt v="callout" color="secondary">{p ? `${SPECIALTY_LABEL[p.specialty as keyof typeof SPECIALTY_LABEL]} · ${p.experienceYears} yil tajriba` : ''}</Txt>
          {p ? <View style={{ marginTop: 6 }}><Stars value={p.ratingAvg} size={18} /></View> : null}
          <Gap h={14} />
          <View style={{ flexDirection: 'row', gap: 10 }}><Button title="📞 Qo'ng'iroq" variant="secondary" size="md" onPress={() => Linking.openURL(`tel:${w.phone}`)} /><Button title="💬 Xabar" variant="secondary" size="md" onPress={() => router.push('/(tadbirkor)/messages')} /></View>
        </Card>
        <Gap h={10} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Kpi label="Bajargan ishlar" value={String(w.stats.done)} tone="success" /><Kpi label="Kechikkan" value={String(w.stats.late)} tone="warning" />
          <Kpi label="Kunlik narx" value={p ? fmtShort(p.dailyRate) : '—'} /><Kpi label="Jami ish haqi" value={fmtShort(w.stats.earned)} tone="brand" />
        </View>
        {w.projects.length ? <Section title="Hozirgi loyihalar">{w.projects.map((pr, i, arr) => <Row key={pr.id} icon="business" title={pr.name} right={<StatusChip status={pr.status} />} onPress={() => router.push(`/project/${pr.id}`)} last={i === arr.length - 1} />)}</Section> : null}
        <Section title="Ish tarixi">{w.workOrders.length === 0 ? <Txt color="secondary" style={{ padding: 12 }}>Hali ish yo'q</Txt> : null}{w.workOrders.map((o, i, arr) => <Row key={o.id} icon="hammer" title={o.title} subtitle={`${o.project?.name ?? ''} · ${new Date(o.createdAt).toLocaleDateString('ru-RU')}`} right={<View style={{ alignItems: 'flex-end' }}><Txt v="bodyStrong">{fmtShort(o.price)}</Txt><StatusChip status={o.status} /></View>} onPress={() => router.push(`/work-order/${o.id}`)} last={i === arr.length - 1} />)}</Section>
        <Section title="Baholar">{w.reviews.length === 0 ? <Txt color="secondary" style={{ padding: 12 }}>Baholar yo'q</Txt> : null}{w.reviews.map((r, i, arr) => <Row key={r.id} icon="star" iconTone="warning" title={'⭐'.repeat(r.scoreOverall)} subtitle={`${r.comment ?? ''} · ${new Date(r.createdAt).toLocaleDateString('ru-RU')}`} last={i === arr.length - 1} />)}</Section>
        <Section title="Ish haqi">{w.payouts.slice(0, 10).map((pp, i, arr) => <Row key={pp.id} icon={pp.status === 'PAID' ? 'checkmark-circle' : 'time'} iconTone={pp.status === 'PAID' ? 'success' : 'warning'} title={pp.description} subtitle={new Date(pp.earnedAt).toLocaleDateString('ru-RU')} right={<Txt v="bodyStrong">{fmtSum(pp.amount)}</Txt>} last={i === arr.length - 1} />)}</Section>
      </ScrollView>
    </Screen>
  );
}
