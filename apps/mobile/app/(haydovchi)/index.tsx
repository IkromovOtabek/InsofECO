import React from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHIPMENT_DRIVER_NEXT } from '@insof/shared';
import { Card, Gap, Screen, Txt, fmtSum } from '@/design/primitives';
import { Icon, fmtShort } from '@/design/ui';
import { BigAction, BigSecondary, BigStat, RouteBlock } from '@/design/driver';
import { useTheme } from '@/design/theme';
import { onColor } from '@/design/tokens';
import { useAction, useHaydovchiDashboard } from '@/features/eco/api';
import { useSession } from '@/core/session';
import { useOutboxSize } from '@/shared/hooks';

const NEXT: Record<string, { label: string; icon: 'checkmark-circle' | 'cube' | 'navigate' | 'flag' }> = {
  NEW: { label: 'QABUL QILISH', icon: 'checkmark-circle' }, ACCEPTED: { label: 'YUKLASHNI BOSHLADIM', icon: 'cube' }, LOADING: { label: "YO'LGA CHIQDIM", icon: 'navigate' }, EN_ROUTE: { label: 'YETKAZDIM', icon: 'flag' },
};

/**
 * Bugun — "Kabina" skini (doim qorong'i, yorqin yashil): salom + holat chirog'i → katta raqamlar →
 * bitta faol yuk kartasi (yashil nur) + bitta katta tugma. Boshqa hamma narsa — ikkinchi darajali.
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
      {pending > 0 ? <Txt style={{ backgroundColor: c.warning, color: onColor(c.warning), padding: 10, paddingTop: insets.top + 6, textAlign: 'center', fontSize: 16, fontWeight: '700' }}>Internet yo'q · {pending} ta o'zgarish saqlandi</Txt> : null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: pending ? 12 : insets.top + 8, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={d.isFetching} onRefresh={() => void d.refetch()} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontSize: 26, fontWeight: '800', color: c.textPrimary }}>Salom, {(user?.fullName ?? '').split(' ')[0]} 👋</Txt>
            {/* Holat chirog'i: reysda — yashil, bo'sh — kulrang */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: active ? c.brandPrimary : c.textSecondary }} />
              <Txt style={{ fontSize: 16, fontWeight: '700', color: active ? c.brandPrimary : c.textSecondary }}>{active ? 'Reysda' : "Bo'sh · yuk kutilmoqda"}</Txt>
            </View>
          </View>
          <Pressable onPress={() => router.push('/(haydovchi)/messages')} hitSlop={10} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="chatbubble-ellipses" size={26} color={c.brandPrimary} /></Pressable>
        </View>
        <Gap h={14} />

        {/* Bugun — bitta qator, katta raqamlar */}
        <Card style={{ flexDirection: 'row', paddingVertical: 14 }}>
          <BigStat value={String(x?.todayCount ?? 0)} label="bugun yuk" />
          <BigStat value={String(x?.doneToday ?? 0)} label="bajarildi" tone="success" />
          <BigStat value={fmtShort(x?.earnings.today ?? 0)} label="daromad" tone="brand" />
        </Card>
        <Gap h={16} />

        {active ? (
          <Card style={{ padding: 20, borderWidth: 2, borderColor: c.brandPrimary, shadowColor: c.brandPrimary, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt v="caption" color="brand" style={{ fontWeight: '800', letterSpacing: 1 }}>FAOL YUK · №{active.number}</Txt>
              <Txt v="caption" color="secondary">{active.distanceKm ? `${active.distanceKm} km` : ''}</Txt>
            </View>
            <Txt style={{ fontSize: 26, fontWeight: '800', color: c.textPrimary, marginTop: 6 }}>{active.cargo}</Txt>
            <Gap h={16} />
            <RouteBlock from={active.warehouse.name} to={active.project.name} />
            <Gap h={20} />
            {next ? <BigAction title={NEXT[active.status]?.label ?? next} icon={NEXT[active.status]?.icon} loading={tr.isPending} onPress={() => (active.status === 'EN_ROUTE' ? router.push(`/shipment/${active.id}`) : tr.mutate({ id: active.id, to: next }))} /> : null}
            <Gap h={12} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <BigSecondary title="Yo'l" icon="navigate" onPress={() => navigate(active)} />
              <BigSecondary title="Batafsil" icon="list" onPress={() => router.push(`/shipment/${active.id}`)} />
            </View>
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Icon name="cafe-outline" size={44} color={c.textSecondary} />
            <Txt style={{ fontSize: 20, fontWeight: '700', color: c.textPrimary, marginTop: 10 }}>Hozir faol yuk yo'q</Txt>
            <Txt v="callout" color="secondary" style={{ marginTop: 4, textAlign: 'center' }}>Yangi yuk kelganda xabar keladi</Txt>
          </Card>
        )}

        {(x?.open ?? []).length ? (
          <>
            <Gap h={24} />
            <Txt style={{ fontSize: 20, fontWeight: '800', color: c.textPrimary, marginBottom: 10 }}>Yangi yuklar · {x!.open.length}</Txt>
            {x!.open.map((s) => (
              <Card key={s.id} style={{ marginBottom: 12, padding: 18 }}>
                <Txt style={{ fontSize: 22, fontWeight: '800', color: c.textPrimary }}>{s.cargo}</Txt>
                <Txt style={{ fontSize: 17, color: c.textSecondary, marginTop: 4 }}>{s.warehouse.name} → {s.project.name}</Txt>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                  <Txt style={{ fontSize: 17, fontWeight: '700', color: c.brandPrimary }}>{fmtSum(s.driverFee)}</Txt>
                  {s.distanceKm ? <Txt style={{ fontSize: 17, color: c.textSecondary }}>{s.distanceKm} km</Txt> : null}
                </View>
                <Gap h={14} />
                <BigAction title="QABUL QILISH" icon="checkmark-circle" loading={tr.isPending} disabled={!!active} onPress={() => tr.mutate({ id: s.id, to: 'ACCEPTED' })} />
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
