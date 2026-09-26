import React from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHIPMENT_DRIVER_NEXT } from '@insof/shared';
import { Card, EmptyState, Gap, IconButton, Screen, StatusDot, Txt, fmtSum, fmtUnit } from '@/design/primitives';
import { Icon, IconName, fmtShort } from '@/design/ui';
import { BigAction, BigSecondary, BigStat, RouteBlock } from '@/design/driver';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { useAction, useHaydovchiDashboard } from '@/features/eco/api';
import { useSession } from '@/core/session';
import { useOutboxSize } from '@/shared/hooks';

const NEXT: Record<string, { label: string; icon: IconName }> = {
  NEW: { label: 'Qabul qilish', icon: 'circle-check' }, ACCEPTED: { label: 'Yuklashni boshladim', icon: 'package' }, LOADING: { label: "Yo'lga chiqdim", icon: 'navigation' }, EN_ROUTE: { label: 'Yetkazdim', icon: 'flag' },
};

/**
 * Bugun: salom + holat → katta raqamlar → bitta faol yuk kartasi + bitta katta tugma.
 * Boshqa hamma narsa — ikkinchi darajali. Ranglar tizimdan, faqat nishonlar kattaroq.
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

  return (
    <Screen padded={false}>
      {pending > 0 ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: c.warningBg, paddingHorizontal: space.lg, paddingBottom: space.sm, paddingTop: insets.top + space.sm }}>
          <Icon name="triangle-alert" tone="warning" />
          <Txt v="bodySm" color="warning">Internet yo&apos;q · {pending} ta o&apos;zgarish saqlandi</Txt>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: pending ? space.md : insets.top + space.md, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={d.isFetching} onRefresh={() => void d.refetch()} tintColor={c.textMuted} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt v="titleLg" numberOfLines={1}>Salom, {(user?.fullName ?? '').split(' ')[0]}</Txt>
            <StatusDot tone={active ? 'success' : 'neutral'} label={active ? 'Reysda' : "Bo'sh · yuk kutilmoqda"} style={{ marginTop: space.xs }} />
          </View>
          <IconButton icon="message-circle" label="Xabarlar" variant="secondary" size={size.buttonLg} onPress={() => router.push('/(haydovchi)/messages')} />
        </View>
        <Gap h={space.lg} />

        {/* Bugun — bitta qator, katta raqamlar */}
        <Card style={{ flexDirection: 'row', paddingVertical: space.md }}>
          <BigStat value={String(x?.todayCount ?? 0)} label="bugun yuk" />
          <BigStat value={String(x?.doneToday ?? 0)} label="bajarildi" tone="success" />
          <BigStat value={`${fmtShort(x?.earnings.today ?? 0)} so'm`} label="daromad" tone="brand" />
        </Card>
        <Gap h={space.lg} />

        {active ? (
          <Card style={{ padding: space.panel, borderColor: c.brand }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Txt v="overline" color="brand">Faol yuk · №{active.number}</Txt>
              <Txt v="caption">{active.distanceKm ? fmtUnit(active.distanceKm, 'km') : ''}</Txt>
            </View>
            <Txt v="titleMd" style={{ marginTop: space.xs }}>{active.cargo}</Txt>
            <Gap h={space.lg} />
            <RouteBlock from={active.warehouse.name} to={active.project.name} />
            <Gap h={space.xl} />
            {next ? <BigAction title={NEXT[active.status]?.label ?? next} icon={NEXT[active.status]?.icon} loading={tr.isPending} onPress={() => (active.status === 'EN_ROUTE' ? router.push(`/shipment/${active.id}`) : tr.mutate({ id: active.id, to: next }))} /> : null}
            <Gap h={space.md} />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <BigSecondary title="Yo'l" icon="navigation" onPress={() => navigate(active)} />
              <BigSecondary title="Batafsil" icon="list" onPress={() => router.push(`/shipment/${active.id}`)} />
            </View>
          </Card>
        ) : (
          <Card>
            <EmptyState icon="coffee" title="Hozir faol yuk yo'q" hint="Yangi yuk kelganda xabar keladi" style={{ paddingVertical: space.md }} />
          </Card>
        )}

        {(x?.open ?? []).length ? (
          <>
            <Gap h={space.section} />
            <Txt v="titleMd" style={{ marginBottom: space.md }}>Yangi yuklar · {x!.open.length}</Txt>
            {x!.open.map((s) => (
              <Card key={s.id} style={{ marginBottom: space.md, padding: space.panel }}>
                <Txt v="titleMd">{s.cargo}</Txt>
                <Txt v="body" color="muted" style={{ marginTop: space.xs }}>{s.warehouse.name} → {s.project.name}</Txt>
                <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.sm }}>
                  <Txt v="bodyStrong" color="brand">{fmtSum(s.driverFee)}</Txt>
                  {s.distanceKm ? <Txt v="body" color="muted">{fmtUnit(s.distanceKm, 'km')}</Txt> : null}
                </View>
                <Gap h={space.md} />
                <BigAction title="Qabul qilish" icon="circle-check" loading={tr.isPending} disabled={!!active} onPress={() => tr.mutate({ id: s.id, to: 'ACCEPTED' })} />
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
