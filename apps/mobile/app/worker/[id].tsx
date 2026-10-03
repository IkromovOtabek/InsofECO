import React from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SPECIALTY_LABEL } from '@insof/shared';
import { KpiGrid, ListGroup, SectionHead, StickyActionBar } from '@/design/blocks';
import { Badge, Card, EmptyState, Gap, ListItem, Screen, StatusChip, Txt, fmtDateFull, fmtSum } from '@/design/primitives';
import { Appear, stagger } from '@/design/motion';
import { Avatar, Stars, fmtShort } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { useWorker } from '@/features/eco/api';
import { Loader } from '@/design/loader';

/** Kalit — qiymat qatori (ListGroup ichida; birinchisidan keyin ichki chiziq). */
function KV({ k, v, first }: { k: string; v: string; first?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row, paddingVertical: space.sm, paddingHorizontal: space.card }}>
      {first ? null : <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: space.card, right: space.md, height: size.hairline, backgroundColor: c.borderSubtle }} />}
      <Txt v="bodySm" color="muted" style={{ flexShrink: 0 }}>{k}</Txt>
      <Txt v="body" color="strong" align="right" style={{ flex: 1 }}>{v}</Txt>
    </View>
  );
}

/** Quruvchi profili: sarlavha kartasi → KPI → ma'lumot (kalit/qiymat) → loyihalar, ish tarixi, baholar, ish haqi; Qo'ng'iroq/Xabar pastki panelda. */
export default function WorkerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const q = useWorker(id); const w = q.data;
  if (!w) {
    return (
      <Screen>
        {q.isError ? <EmptyState icon="circle-alert" title="Quruvchi topilmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} /> : <Loader style={{ marginTop: space.xxxl }} />}
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
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: space.xxl }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        <Appear>
          <Card style={{ padding: space.panel }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
              <Avatar name={w.fullName} size={size.avatarLg} tone="brand" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt v="overline" numberOfLines={1}>{p ? SPECIALTY_LABEL[p.specialty as keyof typeof SPECIALTY_LABEL] : 'Quruvchi'}</Txt>
                <Txt v="titleLg" numberOfLines={2}>{w.fullName ?? w.phone}</Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.md }}>
              {p ? <Stars value={p.ratingAvg} size={size.iconMd} /> : <Txt v="caption" color="muted">Profil to&apos;ldirilmagan</Txt>}
              {busy ? <Badge label="Loyihada" tone="brand" icon="hammer" /> : <Badge label="Bo'sh" tone="success" />}
            </View>
          </Card>
        </Appear>

        <Gap h={space.grid} />
        <KpiGrid items={[
          { label: 'Bajargan ishlar', value: w.stats.done, icon: 'square-check', tone: 'success' },
          { label: 'Kechikkan', value: w.stats.late, icon: 'clock', tone: w.stats.late > 0 ? 'warning' : undefined },
          { label: 'Kunlik narx', value: p ? fmtShort(p.dailyRate) : '—', icon: 'banknote' },
          { label: 'Jami ish haqi', value: fmtShort(w.stats.earned), icon: 'wallet' },
        ]} />

        <Appear delay={stagger(2)}>
          <Gap h={space.section} />
          <SectionHead title="Ma'lumot" />
          <ListGroup>
            {info.map(([k, v], i) => <KV key={k} k={k} v={v} first={i === 0} />)}
          </ListGroup>
          {p?.bio ? (
            <>
              <Gap h={space.grid} />
              <Card><Txt v="body">{p.bio}</Txt></Card>
            </>
          ) : null}
        </Appear>

        {w.projects.length ? (
          <>
            <Gap h={space.section} />
            <SectionHead title="Hozirgi loyihalar" count={w.projects.length} icon="building" />
            <ListGroup>
              {w.projects.map((pr) => <ListItem key={pr.id} icon="building" module="production" title={pr.name} right={<StatusChip status={pr.status} />} onPress={() => router.push(`/project/${pr.id}`)} />)}
            </ListGroup>
          </>
        ) : null}

        <Gap h={space.section} />
        <SectionHead title="Ish tarixi" count={w.workOrders.length || undefined} icon="hammer" />
        <ListGroup>
          {w.workOrders.length === 0 ? <EmptyState compact icon="hammer" title="Hali ish yo'q" hint="Birinchi ish buyurtmasi shu yerda ko'rinadi" /> : null}
          {w.workOrders.map((o) => (
            <ListItem
              key={o.id} icon="hammer" module="production" title={o.title}
              subtitle={`${o.project?.name ? `${o.project.name} · ` : ''}${fmtDateFull(o.createdAt)}`}
              right={<View style={{ alignItems: 'flex-end', gap: space.xs, flexShrink: 0 }}><Txt v="bodyStrong">{fmtShort(o.price)}</Txt><StatusChip status={o.status} /></View>}
              onPress={() => router.push(`/work-order/${o.id}`)}
            />
          ))}
        </ListGroup>

        <Gap h={space.section} />
        <SectionHead title="Baholar" count={w.reviews.length || undefined} icon="star" />
        <ListGroup>
          {w.reviews.length === 0 ? <EmptyState compact icon="star" title="Baholar yo'q" hint="Tadbirkor ishni qabul qilganda baho beradi" /> : null}
          {w.reviews.map((r) => <ListItem key={r.id} icon="star" tone="warning" title={r.comment || 'Izohsiz baho'} subtitle={fmtDateFull(r.createdAt)} right={<Stars value={r.scoreOverall} />} />)}
        </ListGroup>

        <Gap h={space.section} />
        <SectionHead title="Ish haqi" icon="wallet" />
        <ListGroup>
          {w.payouts.length === 0 ? <EmptyState compact icon="wallet" title="To'lovlar yo'q" /> : null}
          {w.payouts.slice(0, 10).map((pp) => <ListItem key={pp.id} icon={pp.status === 'PAID' ? 'circle-check' : 'clock'} tone={pp.status === 'PAID' ? 'success' : 'warning'} title={pp.description} subtitle={`${fmtDateFull(pp.earnedAt)} · ${pp.status === 'PAID' ? 'to\'langan' : 'kutilmoqda'}`} right={<Txt v="bodyStrong">{fmtSum(pp.amount)}</Txt>} />)}
        </ListGroup>
      </ScrollView>

      <StickyActionBar
        primary={{ title: 'Xabar yozish', icon: 'message-circle', onPress: () => router.push('/(tadbirkor)/messages') }}
        secondary={{ title: "Qo'ng'iroq", icon: 'phone', onPress: () => void Linking.openURL(`tel:${w.phone}`) }}
      />
    </Screen>
  );
}
