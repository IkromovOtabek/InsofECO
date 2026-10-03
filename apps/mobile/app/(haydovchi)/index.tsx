import React from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHIPMENT_DRIVER_NEXT } from '@insof/shared';
import { HeroCard, KpiGrid, KpiItem, OfflineBanner, PageHeader, SectionHead } from '@/design/blocks';
import { Card, EmptyState, Gap, Screen, StatusDot, Txt, fmtNum, fmtSum, fmtUnit } from '@/design/primitives';
import { IconName, fmtShort, toast } from '@/design/ui';
import { BigAction, BigSecondary, RouteBlock, StepDots } from '@/design/driver';
import { useTheme } from '@/design/theme';
import { shadow, space } from '@/design/tokens';
import { useAction, useHaydovchiDashboard } from '@/features/eco/api';
import { avatarUri } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { outbox } from '@/core/outbox';
import { useOutboxSize } from '@/shared/hooks';

/** Holatga qarab bitta asosiy tugma: Qabul qilish → Yuklashni boshladim → Yo'lga chiqdim → Yetkazdim. */
const NEXT: Record<string, { label: string; icon: IconName }> = {
  NEW: { label: 'Qabul qilish', icon: 'circle-check' }, ACCEPTED: { label: 'Yuklashni boshladim', icon: 'package' }, LOADING: { label: "Yo'lga chiqdim", icon: 'navigation' }, EN_ROUTE: { label: 'Yetkazdim', icon: 'flag' },
};
const STEPS = ['Qabul', 'Yuklash', "Yo'l", 'Obyekt'];
const STEP_OF: Record<string, number> = { NEW: 0, ACCEPTED: 1, LOADING: 2, EN_ROUTE: 3 };
const WEEKDAY = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const MONTH = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const today = () => { const d = new Date(); return `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`; };

/**
 * Kabina rejimi — "bitta yuk, bitta tugma". Sarlavha (sana + holat) → oflayn plashka →
 * FAOL YUK (bosqich, marshrut, Yo'l/Batafsil) → bugungi daromad → 4 ko'rsatkich → yangi yuklar.
 * Asosiy amal (64 pt) — pastda yopishgan, bosh barmoq yetadigan joyda.
 */
export default function DriverToday() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const d = useHaydovchiDashboard();
  const pending = useOutboxSize();
  const x = d.data;
  const active = x?.active ?? null;
  const tr = useAction<{ id: string; to: string }>((v) => ({ path: `/shipments/${v.id}/transition`, body: { to: v.to } }), ['shipments', 'dash']);
  const next = active ? SHIPMENT_DRIVER_NEXT[active.status as keyof typeof SHIPMENT_DRIVER_NEXT] : undefined;
  const navigate = (s: { project: { lat?: number | null; lng?: number | null } }) => { const { lat, lng } = s.project; if (!lat || !lng) return; const y = `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`; void Linking.canOpenURL(y).then((ok) => Linking.openURL(ok ? y : `maps://?daddr=${lat},${lng}`)); };
  const primary = () => { if (!active || !next) return; if (active.status === 'EN_ROUTE') router.push(`/shipment/${active.id}`); else tr.mutate({ id: active.id, to: next }, { onError: (e) => toast.error(e.message, 'Xato') }); };

  const v = x?.vehicle;
  const kpis = x ? ([
    { label: 'Bajarildi', value: `${x.doneToday} / ${x.todayCount}`, icon: 'circle-check', module: 'logistics', tone: x.doneToday && x.doneToday === x.todayCount ? 'success' : undefined, onPress: () => router.push('/(haydovchi)/deliveries') },
    { label: 'Yangi yuklar', value: x.open.length, icon: 'package', module: 'brand', delta: x.open.length ? { text: 'qabul qiling', tone: 'info' } : undefined },
    { label: 'Hafta', value: `${fmtShort(x.earnings.week)} so'm`, icon: 'wallet', module: 'logistics', onPress: () => router.push('/(haydovchi)/earnings') },
    v ? { label: 'Mashina', value: v.plateNumber, icon: 'truck', module: 'logistics', delta: v.fuelPercent != null ? { text: `yoqilg'i ${v.fuelPercent}%`, tone: v.fuelPercent < 25 ? 'danger' : 'neutral' } : undefined, onPress: () => router.push('/(haydovchi)/transport') } : null,
  ] as (KpiItem | null)[]).filter((k): k is KpiItem => !!k) : [];

  return (
    <Screen padded={false} style={{ paddingTop: insets.top }}>
      <PageHeader
        overline={today()}
        title={`Salom, ${(user?.fullName ?? '').split(' ')[0] || 'haydovchi'}`}
        actions={[{ icon: 'message-circle', label: 'Xabarlar', onPress: () => router.push('/(haydovchi)/messages') }]}
        avatar={{ name: user?.fullName ?? undefined, uri: avatarUri(user?.avatarUrl) ?? undefined }}
        onAvatar={() => router.push('/(haydovchi)/menu')}
      />
      <OfflineBanner visible={pending > 0} pendingCount={pending} onRetry={() => void outbox.flush()} style={{ marginHorizontal: space.pageX, marginBottom: space.sm }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxl }} refreshControl={<RefreshControl refreshing={d.isFetching} onRefresh={() => void d.refetch()} tintColor={c.textMuted} />}>
        <StatusDot tone={active ? 'success' : 'neutral'} label={active ? 'Reysda' : "Bo'sh · yuk kutilmoqda"} style={{ marginBottom: space.md }} />

        {active ? (
          <Card style={{ padding: space.panel, borderColor: c.brand }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Txt v="overline" color="brand">Faol yuk · №{active.number}</Txt>
              {active.distanceKm ? <Txt v="bodyStrong" color="muted">{fmtUnit(active.distanceKm, 'km')}</Txt> : null}
            </View>
            <Txt v="titleLg" style={{ marginTop: space.xs }} numberOfLines={2}>{active.cargo}</Txt>
            <Gap h={space.lg} />
            <StepDots steps={STEPS} current={STEP_OF[active.status] ?? 0} />
            <Gap h={space.lg} />
            <RouteBlock from={active.warehouse.name} to={active.project.name} />
            <Gap h={space.xl} />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <BigSecondary title="Yo'l" icon="navigation" onPress={() => navigate(active)} />
              <BigSecondary title="Batafsil" icon="list" onPress={() => router.push(`/shipment/${active.id}`)} />
            </View>
          </Card>
        ) : x ? (
          <Card>
            <EmptyState compact icon="coffee" title="Hozir faol yuk yo'q" hint={x.open.length ? 'Pastdagi yangi yuklardan birini qabul qiling' : 'Yangi yuk kelganda xabar keladi'} />
          </Card>
        ) : d.isError ? (
          <Card><EmptyState compact icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Internetni tekshiring" onRetry={() => void d.refetch()} /></Card>
        ) : null}

        {x ? (
          <>
            <Gap h={space.section} />
            <HeroCard
              label="Bugungi daromad" value={n(x.earnings.today)} format={(y) => fmtNum(Math.round(y))} unit="so'm"
              delta={x.doneToday ? { text: `${x.doneToday} yuk yetkazildi`, dir: 'up', tone: 'success' } : undefined}
            />
            <Gap h={space.grid} />
            <KpiGrid items={kpis} />
          </>
        ) : null}

        {(x?.open ?? []).length ? (
          <>
            <Gap h={space.section} />
            <SectionHead title="Yangi yuklar" count={x!.open.length} />
            {x!.open.map((s) => (
              <Card key={s.id} style={{ marginBottom: space.md, padding: space.panel }}>
                <Txt v="titleMd">{s.cargo}</Txt>
                <Txt v="body" color="muted" style={{ marginTop: space.xs }}>{s.warehouse.name} → {s.project.name}</Txt>
                <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.sm }}>
                  <Txt v="titleSm" color="brand">{fmtSum(s.driverFee)}</Txt>
                  {s.distanceKm ? <Txt v="body" color="muted">{fmtUnit(s.distanceKm, 'km')}</Txt> : null}
                </View>
                <Gap h={space.md} />
                <BigAction title={active ? 'Avval faol yukni yakunlang' : 'Qabul qilish'} icon="circle-check" tone={active ? 'dark' : 'brand'} loading={tr.isPending} disabled={!!active} onPress={() => tr.mutate({ id: s.id, to: 'ACCEPTED' }, { onError: (e) => toast.error(e.message, 'Xato') })} />
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>

      {active && next ? (
        <View style={[{ paddingHorizontal: space.pageX, paddingTop: space.md, paddingBottom: space.sm, backgroundColor: c.bgApp }, shadow.pop]}>
          <BigAction title={NEXT[active.status]?.label ?? next} icon={NEXT[active.status]?.icon} tone={active.status === 'EN_ROUTE' ? 'success' : 'brand'} loading={tr.isPending} onPress={primary} />
        </View>
      ) : null}
    </Screen>
  );
}

const n = (y: unknown) => Number(y ?? 0);
