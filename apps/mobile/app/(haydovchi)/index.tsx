import React from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHIPMENT_DRIVER_NEXT } from '@insof/shared';
import { ListGroup, OfflineBanner, PageHeader, Reveal, SectionHead } from '@/design/blocks';
import { Badge, EmptyState, ListItem, Screen, Txt, fmtUnit, statusLabel } from '@/design/primitives';
import { Animated, PressScale, haptic, useHeaderRaise, usePressScale } from '@/design/motion';
import { Icon, IconName, dialog, fmtShort, toast } from '@/design/ui';
import { BigAction } from '@/design/driver';
import { useTheme } from '@/design/theme';
import { elevation, radius, size, space } from '@/design/tokens';
import { Shipment, q, useAction, useHaydovchiDashboard, useShipmentHistory } from '@/features/eco/api';
import { avatarUri } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { outbox } from '@/core/outbox';
import { openInNavigator } from '@/core/navigate';
import { useOutboxSize } from '@/shared/hooks';
import i18n from '@/core/i18n';

/** Holatga qarab bitta asosiy tugma: Qabul qilish → Yuklashni boshladim → Yo'lga chiqdim → Yetkazdim. */
const NEXT: Record<string, { label: string; icon: IconName }> = {
  NEW: { label: 'Qabul qilish', icon: 'circle-check' }, ACCEPTED: { label: 'Yuklashni boshladim', icon: 'package' }, LOADING: { label: "Yo'lga chiqdim", icon: 'navigation' }, EN_ROUTE: { label: 'Yetkazdim', icon: 'check' },
};
const n = (y: unknown) => Number(y ?? 0);
const isToday = (d?: string | null) => { if (!d) return false; const x = new Date(d); const t = new Date(); return x.getFullYear() === t.getFullYear() && x.getMonth() === t.getMonth() && x.getDate() === t.getDate(); };

/** Demo kabina statistikasi: markazda qalin qiymat + izoh (3 ta bir qatorda). */
function StatCard({ value, label }: { value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={[{ flex: 1, alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.sm, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous' }, elevation(c).sh1]}>
      <Txt v="kpiValue" numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
      <Txt v="tSm" numberOfLines={1}>{label}</Txt>
    </View>
  );
}

/** Hero ichidagi tugma — demo `invChip`: to'q chip foni, och matn. */
function InvChip({ title, icon, onPress }: { title: string; icon: IconName; onPress: () => void }) {
  const { c } = useTheme();
  const ps = usePressScale();
  return (
    <Animated.View style={[{ flex: 1 }, ps.style]}>
      <Pressable
        onPress={() => { haptic.light(); onPress(); }} onPressIn={ps.onPressIn} onPressOut={ps.onPressOut}
        accessibilityRole="button" accessibilityLabel={title}
        style={({ pressed }) => [{ minHeight: size.buttonLg, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.bgInverseChip, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.lg }, pressed && { opacity: 0.85 }]}
      >
        <Icon name={icon} size={size.iconMd} color={c.textOnInverse} strokeWidth={2} />
        <Txt v="button" style={{ color: c.textOnInverse }} numberOfLines={1}>{title}</Txt>
      </Pressable>
    </Animated.View>
  );
}

/** Demo `.route`: chap tomonda nuqta — chiziq — nuqta, o'ngda "Olish" / "Yetkazish" manzillari (to'q karta ustida). */
function InvRoute({ from, to, toNote }: { from: string; to: string; toNote?: string }) {
  const { c } = useTheme();
  const dot = size.timelineDot;
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <View style={{ alignItems: 'center', paddingVertical: space.xs }}>
        <View style={{ width: dot, height: dot, borderRadius: radius.pill, borderWidth: 3, borderColor: c.textOnInverse }} />
        <View style={{ flex: 1, width: 2, marginVertical: space.xs, backgroundColor: c.textOnInverseMuted, opacity: 0.5 }} />
        <View style={{ width: dot, height: dot, borderRadius: radius.pill, backgroundColor: c.accent }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space.lg }}>
        <View>
          <Txt v="tSm" style={{ color: c.textOnInverseMuted }}>Olish</Txt>
          <Txt v="listTitle" numberOfLines={2} style={{ color: c.textOnInverse }}>{from}</Txt>
        </View>
        <View>
          <Txt v="tSm" style={{ color: c.textOnInverseMuted }}>{toNote ? `Yetkazish · ${toNote}` : 'Yetkazish'}</Txt>
          <Txt v="listTitle" numberOfLines={2} style={{ color: c.textOnInverse }}>{to}</Txt>
        </View>
      </View>
    </View>
  );
}

/**
 * Kabina rejimi — demo "Haydovchi · kabina" (1:1): sarlavha (avatar, "Kabina · raqam", ism, Onlayn) → oflayn plashka →
 * 3 ko'rsatkich (reys, km, so'm) → to'q "Faol yuk" kartasi (marshrut, Navigator / Mijoz) → Keyingi yuklar.
 * Asosiy amal (Yetkazdim va h.k.) — pastda yopishgan katta tugma; bosqichlar oqimi o'zgarmagan.
 */
export default function DriverToday() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const d = useHaydovchiDashboard();
  const hist = useShipmentHistory();
  const pending = useOutboxSize();
  const raise = useHeaderRaise();
  const x = d.data;
  const active = x?.active ?? null;
  // To'liq yuk (mijoz telefoni, obyekt koordinatalari) — dashboard qisqa variantni beradi.
  const full = q<Shipment>(['shipments', 'one', active?.id ?? ''], `/shipments/${active?.id ?? ''}`, { enabled: !!active?.id, refetchInterval: 15_000 });
  const det = full.data && full.data.id === active?.id ? full.data : null;
  const tr = useAction<{ id: string; to: string }>((v) => ({ path: `/shipments/${v.id}/transition`, body: { to: v.to } }), ['shipments', 'dash']);
  const next = active ? SHIPMENT_DRIVER_NEXT[active.status as keyof typeof SHIPMENT_DRIVER_NEXT] : undefined;
  const primary = () => { if (!active || !next) return; if (active.status === 'EN_ROUTE') router.push(`/shipment/${active.id}`); else tr.mutate({ id: active.id, to: next }, { onError: (e) => toast.error(e.message, 'Xato') }); };
  const accept = (s: Shipment) => {
    if (active) { haptic.warning(); toast.warning('Avval faol yukni yakunlang'); return; }
    dialog(s.cargo, `${s.warehouse.name} → ${s.project.name}\nHaq: ${fmtShort(s.driverFee)} so'm${s.distanceKm ? ` · ${fmtUnit(s.distanceKm, 'km')}` : ''}`, [
      { text: i18n.t('ui.cancel'), style: 'cancel' },
      { text: 'Qabul qilish', onPress: () => tr.mutate({ id: s.id, to: 'ACCEPTED' }, { onSuccess: () => toast.success('Yuk qabul qilindi'), onError: (e) => toast.error(e.message, 'Xato') }) },
    ]);
  };

  const plate = x?.vehicle?.plateNumber;
  const online = !!x && !d.isError && pending === 0;
  const doneToday = (hist.data ?? []).filter((s) => isToday(s.deliveredAt));
  const kmToday = doneToday.reduce((s, y) => s + n(y.distanceKm), 0);
  const lat = det?.project.lat, lng = det?.project.lng;
  const phone = det?.contact?.phone;
  const open = x?.open ?? [];

  return (
    <Screen padded={false} style={{ paddingTop: insets.top }}>
      <PageHeader
        overline={plate ? `Kabina · ${plate}` : 'Kabina'}
        title={user?.fullName ?? 'Haydovchi'}
        avatar={{ name: user?.fullName ?? undefined, uri: avatarUri(user?.avatarUrl) ?? undefined }}
        onAvatar={() => router.push('/(haydovchi)/menu')}
        right={x ? <Badge label={online ? '● Onlayn' : '● Oflayn'} tone={online ? 'success' : 'warning'} /> : null}
        raised={raise.raised}
      />
      <OfflineBanner visible={pending > 0} pendingCount={pending} onRetry={() => void outbox.flush()} style={{ marginHorizontal: space.pageX, marginBottom: space.sm }} />
      <ScrollView
        onScroll={raise.onScroll} scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={d.isFetching && !d.isLoading} onRefresh={() => { void d.refetch(); void hist.refetch(); }} tintColor={c.textMuted} />}
      >
        {!x && d.isError ? (
          <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint="Internetni tekshiring" onRetry={() => void d.refetch()} />
        ) : (
          <Reveal loading={!x}>
            {x ? (
              <View style={{ flexDirection: 'row', gap: space.tight }}>
                <StatCard value={`${x.doneToday} / ${x.todayCount}`} label="reys" />
                {hist.data ? <StatCard value={`${Math.round(kmToday)} km`} label="bugun" /> : null}
                <StatCard value={fmtShort(x.earnings.today)} label="so'm" />
              </View>
            ) : null}

            {active ? (
              <PressScale
                onPress={() => router.push(`/shipment/${active.id}`)} accessibilityRole="button" accessibilityLabel={`Faol yuk №${active.number}, ${active.cargo}`} scale={0.985}
                style={[{ borderRadius: radius.hero, borderCurve: 'continuous', backgroundColor: c.bgInverse, padding: space.lg + 2, gap: space.md + 2 }, elevation(c).hero]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1, minWidth: 0 }}>
                    <View style={{ width: size.heroAccentW, height: size.heroAccentH, borderRadius: radius.pill, backgroundColor: c.accent }} />
                    <Txt v="appbarOverline" numberOfLines={1} style={{ color: c.textOnInverseMuted, flexShrink: 1 }}>{`Faol yuk · №${active.number}`}</Txt>
                  </View>
                  <View style={{ paddingHorizontal: space.sm + 2, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: c.brand }}>
                    <Txt v="badge" style={{ color: c.textOnBrand }}>{statusLabel(active.status)}</Txt>
                  </View>
                </View>
                <Txt v="titleMd" numberOfLines={2} style={{ color: c.textOnInverse }}>{active.cargo}</Txt>
                <InvRoute from={active.warehouse.name} to={active.project.address || active.project.name} toNote={active.distanceKm ? fmtUnit(active.distanceKm, 'km') : undefined} />
                {(lat && lng) || phone ? (
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    {lat && lng ? <InvChip title="Navigator" icon="navigation" onPress={() => void openInNavigator({ lat, lng, label: `${active.project.name}${active.project.address ? `, ${active.project.address}` : ''}` })} /> : null}
                    {phone ? <InvChip title="Mijoz" icon="phone" onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
                  </View>
                ) : null}
              </PressScale>
            ) : x ? (
              <ListGroup>
                <EmptyState compact icon="coffee" title="Hozir faol yuk yo'q" hint={open.length ? 'Keyingi yuklardan birini qabul qiling' : 'Yangi yuk kelganda xabar keladi'} />
              </ListGroup>
            ) : null}

            {open.length ? [
              <SectionHead key="nh" title="Keyingi yuklar" unit={`${open.length} ta`} />,
              <ListGroup key="nl">
                {open.map((s) => (
                  <ListItem
                    key={s.id} size="lg" icon="truck" module="logistics"
                    title={s.cargo} subtitle={`${s.project.name}${s.distanceKm ? ` · ${fmtUnit(s.distanceKm, 'km')}` : ''}`} subtitleLines={1}
                    value={`${fmtShort(s.driverFee)} so'm`}
                    onPress={() => accept(s)}
                  />
                ))}
              </ListGroup>,
            ] : null}
          </Reveal>
        )}
      </ScrollView>

      {active && next ? (
        <View style={{ paddingHorizontal: space.pageX, paddingTop: space.md, paddingBottom: space.sm }}>
          <BigAction title={NEXT[active.status]?.label ?? next} icon={NEXT[active.status]?.icon} tone="brand" loading={tr.isPending} onPress={primary} />
        </View>
      ) : null}
    </Screen>
  );
}
