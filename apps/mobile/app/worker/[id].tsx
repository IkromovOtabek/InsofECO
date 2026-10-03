import React from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SPECIALTY_LABEL } from '@insof/shared';
import { KpiGrid, ListGroup, Reveal, SectionHead, SkeletonList, StickyActionBar } from '@/design/blocks';
import { Badge, Card, EmptyState, KVList, ListItem, Screen, Txt, fmtDateFull, fmtSum, statusLabel, statusTone } from '@/design/primitives';
import { Avatar, Stars, fmtShort } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { useWorker } from '@/features/eco/api';

/** Quruvchi profili: sarlavha kartasi → KPI → ma'lumot (kalit/qiymat) → loyihalar, ish tarixi, baholar, ish haqi; Qo'ng'iroq/Xabar pastki panelda. */
export default function WorkerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const q = useWorker(id); const w = q.data;
  if (!w) {
    return (
      <Screen padded={false}>
        {q.isError ? <EmptyState icon="circle-alert" title="Quruvchi topilmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} /> : (
          <Reveal loading skeleton={<SkeletonList rows={4} />} style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>{null}</Reveal>
        )}
      </Screen>
    );
  }
  const p = w.profile;
  const busy = w.projects.length > 0;
  const info: [string, string][] = [
    ['Telefon', w.phone],
    ...(p ? [
      ['Mutaxassislik', SPECIALTY_LABEL[p.specialty as keyof typeof SPECIALTY_LABEL] ?? p.specialty] as [string, string],
      ['Tajriba', `${p.experienceYears} yil`] as [string, string],
      ['Kunlik narx', fmtSum(p.dailyRate)] as [string, string],
      ['Bajarilgan ishlar', `${p.completedJobs} ta`] as [string, string],
      ['Baholar', `${p.ratingAvg} · ${p.ratingCount} ta`] as [string, string],
    ] : []),
    ['Jami buyurtmalar', `${w.stats.total} ta`],
    ...(w.stats.cancelled ? [['Bekor qilingan', `${w.stats.cancelled} ta`] as [string, string]] : []),
  ];

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxl }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        <Reveal>
          <Card style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Txt v="overline" numberOfLines={1} style={{ flex: 1 }}>{p ? SPECIALTY_LABEL[p.specialty as keyof typeof SPECIALTY_LABEL] ?? p.specialty : 'Quruvchi'}</Txt>
              {busy ? <Badge label="Loyihada" tone="brand" /> : <Badge label="Bo'sh" tone="success" />}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Avatar name={w.fullName} size={size.avatarLg} tone="brand" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt v="titleLg" numberOfLines={2}>{w.fullName ?? w.phone}</Txt>
                {p ? <Stars value={p.ratingAvg} size={size.iconMd} /> : <Txt v="tSm">Profil to&apos;ldirilmagan</Txt>}
              </View>
            </View>
            {p ? <Txt v="tSm">{`${p.experienceYears} yil tajriba · ${p.completedJobs} ta ish · ${p.ratingCount} ta baho`}</Txt> : null}
          </Card>

          <KpiGrid items={[
            { label: 'Bajargan ishlar', value: w.stats.done, icon: 'square-check', tone: 'success' },
            { label: 'Kechikkan', value: w.stats.late, icon: 'clock', tone: w.stats.late > 0 ? 'warning' : undefined },
            ...(p ? [{ label: 'Kunlik narx', value: fmtShort(p.dailyRate), icon: 'banknote' as const }] : []),
            { label: 'Jami ish haqi', value: fmtShort(w.stats.earned), icon: 'wallet' },
          ]} />

          <KVList rows={info.map(([label, value]) => ({ label, value, tone: label === 'Bekor qilingan' ? ('warning' as const) : undefined }))} />
          {p?.bio ? <Card><Txt v="body">{p.bio}</Txt></Card> : null}

          {w.projects.length ? [
            <SectionHead key="ph" title="Hozirgi loyihalar" count={w.projects.length} />,
            <ListGroup key="pl">
              {w.projects.map((pr) => <ListItem key={pr.id} icon="building" module="production" title={pr.name} badge={{ text: statusLabel(pr.status), tone: statusTone(pr.status) }} onPress={() => router.push(`/project/${pr.id}`)} />)}
            </ListGroup>,
          ] : null}

          <SectionHead title="Ish tarixi" count={w.workOrders.length || undefined} />
          <ListGroup>
            {w.workOrders.length === 0 ? <EmptyState compact icon="hammer" title="Hali ish yo'q" hint="Birinchi ish buyurtmasi shu yerda ko'rinadi" /> : null}
            {w.workOrders.map((o) => (
              <ListItem
                key={o.id} icon="hammer" module="production" title={o.title}
                subtitle={`${o.project?.name ? `${o.project.name} · ` : ''}${fmtDateFull(o.createdAt)}`}
                value={fmtShort(o.price)} badge={{ text: statusLabel(o.status), tone: statusTone(o.status) }}
                onPress={() => router.push(`/work-order/${o.id}`)}
              />
            ))}
          </ListGroup>

          <SectionHead title="Baholar" count={w.reviews.length || undefined} />
          <ListGroup>
            {w.reviews.length === 0 ? <EmptyState compact icon="star" title="Baholar yo'q" hint="Tadbirkor ishni qabul qilganda baho beradi" /> : null}
            {w.reviews.map((r) => <ListItem key={r.id} icon="star" tone="warning" title={r.comment || 'Izohsiz baho'} subtitle={fmtDateFull(r.createdAt)} right={<Stars value={r.scoreOverall} />} />)}
          </ListGroup>

          <SectionHead title="Ish haqi" />
          <ListGroup>
            {w.payouts.length === 0 ? <EmptyState compact icon="wallet" title="To'lovlar yo'q" /> : null}
            {w.payouts.slice(0, 10).map((pp) => <ListItem key={pp.id} icon={pp.status === 'PAID' ? 'circle-check' : 'clock'} tone={pp.status === 'PAID' ? 'success' : 'warning'} title={pp.description} subtitle={fmtDateFull(pp.earnedAt)} value={fmtSum(pp.amount)} badge={pp.status === 'PAID' ? { text: "To'langan", tone: 'success' } : { text: 'Kutilmoqda', tone: 'warning' }} />)}
          </ListGroup>
        </Reveal>
      </ScrollView>

      <StickyActionBar
        primary={{ title: 'Xabar yozish', icon: 'message-circle', onPress: () => router.push('/(tadbirkor)/messages') }}
        secondary={{ title: "Qo'ng'iroq", icon: 'phone', onPress: () => void Linking.openURL(`tel:${w.phone}`) }}
      />
    </Screen>
  );
}
