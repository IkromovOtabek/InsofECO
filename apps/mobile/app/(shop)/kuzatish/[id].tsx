import React from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Badge, Button, Card, EmptyState, Skeleton, Timeline, Txt, fmtM3, fmtTime, statusLabel, statusTone } from '@/design/primitives';
import { Reveal } from '@/design/blocks';
import { Icon } from '@/design/icons';
import { PressScale } from '@/design/motion';
import { Avatar } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { elevation, radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { useDelivery } from '@/features/deliveries/api';
import { useLivePosition } from '@/features/tracking/useLivePosition';
import { LIVE_STATUSES } from '@/features/shop/orders';
import { FloatingButton } from '@/features/shop/ui';

/** Demo `.trackmap` — 250 css; telefonda 300 dp. */
const MAP_H = 300;
const VB = { w: 280, h: 230 };
const DEST = { x: 140, y: 112 };
/** Mashina belgisi obyekt atrofida shu radiusgacha (yo'nalish haqiqiy, masofa sxematik). */
const R = 92;

/**
 * Sxematik xarita — demo `.trackmap` (fon ko'chalari — faqat bezak). Markazda obyekt; jonli joylashuv
 * kelsa mashina HAQIQIY yo'nalishda (shimol — tepada) chiziladi, masofa sxematik. Joylashuv bo'lmasa — faqat obyekt.
 */
function TrackMap({ dest, truck, height }: { dest: { lat: number; lng: number }; truck: { lat: number; lng: number } | null; height: number }) {
  const { c } = useTheme();
  let t: { x: number; y: number } | null = null;
  if (truck) {
    const dx = (truck.lng - dest.lng) * Math.cos((dest.lat * Math.PI) / 180);
    const dy = truck.lat - dest.lat;
    const d = Math.hypot(dx, dy);
    // ~50 m dan yaqin — obyekt ustida
    t = d < 0.0005 ? { x: DEST.x, y: DEST.y } : { x: DEST.x + (dx / d) * R, y: DEST.y - (dy / d) * R };
  }
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMid slice" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect width={VB.w} height={VB.h} fill={c.bgSubtle} />
      <Path d="M0 150 Q80 120 140 150 T280 130" stroke={c.borderDefault} strokeWidth={12} fill="none" />
      <Path d="M90 0 L120 230 M210 0 L180 230" stroke={c.borderDefault} strokeWidth={8} />
      <Rect x={18} y={20} width={56} height={40} rx={6} fill={c.bgMuted} />
      <Rect x={220} y={170} width={50} height={40} rx={6} fill={c.bgMuted} />
      {t ? <Line x1={t.x} y1={t.y} x2={DEST.x} y2={DEST.y} stroke={c.brand} strokeWidth={4} strokeLinecap="round" /> : null}
      <Circle cx={DEST.x} cy={DEST.y} r={8} fill={c.brand} />
      {t ? <Circle cx={t.x} cy={t.y} r={10} fill={c.bgSurface} stroke={c.brand} strokeWidth={3} /> : null}
    </Svg>
  );
}

/**
 * Buyurtmani kuzatish — demo CLIENT[5]: xarita, ustiga chiqqan varaq: kelish vaqti + holat, haydovchi
 * kartasi (qo'ng'iroq), reys bosqichlari. Faqat kirgan mijozning HAQIQIY reysi (`/deliveries/:id` + WS joylashuv).
 * Qabul qilish (imzo) — mavjud umumiy reys ekranida.
 */
export default function TrackDelivery() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const canSign = useSession((s) => s.kind === 'eco' && (s.active?.role === 'QURUVCHI' || s.active?.role === 'TADBIRKOR'));
  const q = useDelivery(id);
  const d = q.data;
  const pos = useLivePosition(d && LIVE_STATUSES.includes(d.status) ? d.id : null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(shop)/(tabs)/buyurtma' as never));

  const openMaps = () => {
    if (!d) return;
    const { lat, lng } = d.order;
    void Linking.openURL(Platform.OS === 'ios' ? `maps:0,0?q=${lat},${lng}` : `geo:${lat},${lng}?q=${lat},${lng}`);
  };

  const eta = pos?.etaMin != null && d?.status === 'EN_ROUTE' ? `${pos.etaMin} daqiqa` : d?.arrivedAt ? 'Yetib keldi' : d ? `Reja ${fmtTime(d.plannedAt)}` : '';
  const driverName = d?.driver?.user.fullName ?? d?.driver?.user.phone ?? null;
  const phone = d?.driver?.user.phone ?? null;
  const steps = d ? [
    ...d.events.map((e, i, arr) => ({ title: statusLabel(e.to), sub: [fmtTime(e.at), e.note].filter(Boolean).join(' · '), state: (i === arr.length - 1 && d.status !== 'COMPLETED' ? 'now' : 'done') as 'now' | 'done' })),
    ...(d.status === 'COMPLETED' || d.status === 'CANCELLED' || d.status === 'FAILED' ? [] : [{ title: 'Qabul qilish va imzo', state: 'todo' as const }]),
  ] : [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
        <View style={{ height: MAP_H + insets.top, backgroundColor: c.bgSubtle }}>
          {d ? <TrackMap dest={d.order} truck={pos} height={MAP_H + insets.top} /> : null}
        </View>

        <View style={[{ marginTop: -space.xxxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderCurve: 'continuous', backgroundColor: c.bgApp, paddingTop: space.md, paddingHorizontal: space.pageX }, elevation(c).raised]}>
          <View style={{ alignSelf: 'center', width: space.x12, height: space.xs + 1, borderRadius: radius.pill, backgroundColor: c.borderStrong, marginBottom: space.md }} />
          {!d && !q.isLoading ? (
            <EmptyState icon="circle-alert" title="Reys yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
          ) : (
            <Reveal loading={!d} skeleton={<View style={{ gap: space.md }}><Skeleton width="50%" height={space.xxxl} /><Skeleton height={size.driverTouch + space.xl} radius={radius.card} /><Skeleton height={size.driverTouch * 2} radius={radius.card} /></View>} gap={space.md + 2}>
              {d ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="tSm">{pos?.etaMin != null && d.status === 'EN_ROUTE' ? 'Kelish vaqti' : `№${d.order.number} · ${d.sequence}-reys`}</Txt>
                    <Txt v="titleLg" accessibilityLiveRegion="polite">{eta}</Txt>
                  </View>
                  <Badge label={statusLabel(d.status)} tone={statusTone(d.status)} />
                </View>
              ) : null}

              {d ? (
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 2 }}>
                  <Avatar name={driverName ?? '?'} size={size.avatarLg - space.xs} tone="brand" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt v="listTitle" numberOfLines={1}>{driverName ? [driverName, d.vehicle?.plateNumber].filter(Boolean).join(' · ') : 'Haydovchi hali biriktirilmagan'}</Txt>
                    <Txt v="tSm" numberOfLines={2}>{`Mikser · ${d.order.items.map((i) => i.gradeSnapshot).join('/')}, ${fmtM3(d.plannedM3)}`}</Txt>
                  </View>
                  {phone ? (
                    <PressScale
                      onPress={() => void Linking.openURL(`tel:${phone}`)} accessibilityRole="button" accessibilityLabel="Haydovchiga qo'ng'iroq"
                    >
                      <View style={{ width: size.touch + space.sm, height: size.touch + space.sm, borderRadius: radius.pill, backgroundColor: c.successSolid, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="phone" size={size.iconMd} color={c.textOnSolid} />
                      </View>
                    </PressScale>
                  ) : null}
                </Card>
              ) : null}

              {steps.length ? <Card><Timeline steps={steps} /></Card> : null}

              {d && d.status === 'UNLOADING' && canSign ? (
                <Button title="Qabul qilish va imzolash" icon="pencil" size="lg" onPress={() => router.push(`/delivery/${d.id}` as never)} />
              ) : null}
              {d ? <Txt v="caption" align="center">{pos ? "Mashina yo'nalishi — jonli, masofa sxematik" : 'Mashina joylashuvi yo\'lga chiqqanda ko\'rinadi'} · {d.order.address}</Txt> : null}
            </Reveal>
          )}
        </View>
      </ScrollView>
      <FloatingButton icon="chevron-left" label="Orqaga" onPress={back} style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg }} />
      {d ? <FloatingButton icon="map" label="Xaritada ochish" onPress={openMaps} style={{ position: 'absolute', top: insets.top + space.sm, right: space.lg }} /> : null}
    </View>
  );
}
