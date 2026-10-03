import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { MapUnavailable, MapView, Marker } from '@/core/map';
import { openInNavigator } from '@/core/navigate';
import { ApiException, api, uuid } from '@/core/api';
import { confirmAtSite } from '@/features/address/site-check';
import { config } from '@/core/config';
import { DRIVER_PRIMARY_NEXT, DeliveryStatus } from '@insof/shared';
import { Badge, Button, Card, EmptyState, Gap, Input, ListItem, Panel, Row, Screen, StatusChip, Txt, fmtM3, fmtTime, STATUS_LABEL } from '@/design/primitives';
import { dialog, toast } from '@/design/ui';
import { radius, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Appear } from '@/design/motion';
import { deliveryKeys, requestAcceptOtp, useDelivery, useDriverTransition, useSignDelivery, type Delivery } from '@/features/deliveries/api';
import { useLivePosition } from '@/features/tracking/useLivePosition';
import { startTracking, stopTracking } from '@/core/location';
import { useSession } from '@/core/session';
import { Loader } from '@/design/loader';
import { AcceptDelivery } from '@/features/deliveries/accept';

/**
 * Umumiy reys ekrani. Rolga qarab pastki qism:
 *  - Haydovchi: bitta katta holat tugmasi + muammo + navigatsiya + qo'ng'iroq; imzo/OTP yakunlash
 *  - Quruvchi: jonli xarita, ETA, "Qabul qilish" (imzo) / "E'tiroz"
 *  - Tadbirkor: kuzatish + override
 */
export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const role = useSession((s) => s.active?.role);
  const userId = useSession((s) => s.user?.id);
  const q = useDelivery(id);
  const d = q.data;
  const isDriver = role === 'HAYDOVCHI' || d?.driver?.user.id === userId;
  const live = useLivePosition(d && ['LOADING', 'EN_ROUTE', 'ARRIVED', 'UNLOADING'].includes(d.status) ? d.id : null);
  useKeepAwake();

  if (!d) {
    return (
      <Screen>
        {q.isError ? <EmptyState icon="circle-alert" title="Reys yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" action="Qayta urinish" onAction={() => void q.refetch()} /> : <Loader style={{ marginTop: space.xxxl }} />}
      </Screen>
    );
  }
  // Quruvchi / tadbirkor: beton tushirilayotganda — to'liq ekranli qabul (imzo, hajm, e'tiroz)
  if (!isDriver && d.status === 'UNLOADING' && (role === 'QURUVCHI' || role === 'TADBIRKOR')) return <AcceptDelivery d={d} />;
  const dest = { latitude: d.order.lat, longitude: d.order.lng };
  const truck = live ? { latitude: live.lat, longitude: live.lng } : null;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.x10 }}>
        <Appear>
          <Row style={{ justifyContent: 'space-between', gap: space.sm }}>
            <Txt v="titleMd" style={{ flex: 1 }} numberOfLines={1}>№{d.order.number} · reys {d.sequence}</Txt>
            <StatusChip status={d.status} />
          </Row>
          <Txt color="muted">{fmtM3(d.plannedM3)} {d.order.items.map((i) => i.gradeSnapshot).join('/')} · {d.order.client.name}{d.order.needsPump ? ' · nasos' : ''}</Txt>
          <Txt v="caption">{d.order.address} · reja {fmtTime(d.plannedAt)}</Txt>
          {d.slaBreached ? <Badge tone="danger" icon="clock" label="90 daqiqa oshdi" style={{ marginTop: space.sm }} /> : null}
          <Gap />

          {/* Xarita kalitisiz build'da xarita yo'q — `core/config.ts`; joyida aniq izoh (MapUnavailable) */}
          {config.mapsEnabled ? (
          <View style={{ height: 220, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault }}>
            <MapView style={{ flex: 1 }} initialRegion={{ ...dest, latitudeDelta: 0.05, longitudeDelta: 0.05 }} showsUserLocation={isDriver}>
              <Marker coordinate={dest} tone="brand" />
              {truck ? <Marker coordinate={truck} tone="info" /> : null}
            </MapView>
          </View>
          ) : (
            <MapUnavailable compact hint={isDriver
              ? "Bu versiyaga Yandex xarita kaliti ulanmagan — telefoningizda nuqson yo'q. Yo'l uchun «Navigatsiya» tugmasini bosing."
              : "Bu versiyaga Yandex xarita kaliti ulanmagan. Mashina qachon yetib kelishi pastda yoziladi."} />
          )}
          {live?.etaMin != null && d.status === 'EN_ROUTE' ? <Txt v="titleSm" color="brand" style={{ marginTop: space.sm }}>Taxminan {live.etaMin} daqiqada yetib keladi</Txt> : null}
          <Gap />

          {isDriver ? <DriverPanel d={d} /> : <ClientPanel d={d} />}

          <Panel title="Tarix" icon="history">
            {d.events.length === 0 ? <EmptyState title="Hali voqea yo'q" hint="Reys boshlanishi bilan bu yerda ko'rinadi" icon="history" /> : null}
            {d.events.map((e, i, arr) => <ListItem key={e.id} title={STATUS_LABEL[e.to] ?? e.to} subtitle={e.note ?? undefined} right={<Txt v="caption">{fmtTime(e.at)}</Txt>} last={i === arr.length - 1} />)}
          </Panel>
        </Appear>
      </ScrollView>
    </Screen>
  );
}

function DriverPanel({ d }: { d: NonNullable<ReturnType<typeof useDelivery>['data']> }) {
  const { t } = useTranslation();
  const tr = useDriverTransition(d.id);
  const qc = useQueryClient();
  /**
   * "Yetib keldim" va "Tushirishni boshladim" — oflayn navbatsiz, to'g'ridan-to'g'ri serverga.
   * Sabab: bu holatlar joy bilan tekshiriladi. Navbat (outbox) tugmani darhol "bajarilgan"
   * qilib ko'rsatardi, server keyin rad etsa haydovchi buni bilmay qolardi.
   */
  const siteTr = useMutation({
    mutationFn: (v: { to: DeliveryStatus; location?: { lat: number; lng: number } }) =>
      api<Delivery>(`/deliveries/${d.id}/transition`, { method: 'POST', body: { ...v, at: new Date().toISOString() }, idempotencyKey: uuid() }),
    onSuccess: (u) => { qc.setQueryData(deliveryKeys.one(d.id), u); void qc.invalidateQueries({ queryKey: ['deliveries'] }); },
  });
  const [checking, setChecking] = useState(false);
  const sign = useSignDelivery(d.id);
  const [loaded, setLoaded] = useState(String(d.plannedM3));
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState<string | null>(null);
  const next = DRIVER_PRIMARY_NEXT[d.status];
  const err = (e: Error) => toast.error(e.message, 'Xato');

  // Fon GPS: ACCEPTED dan boshlab yoqiladi, yakunda o'chadi
  useEffect(() => {
    if (['ACCEPTED', 'LOADING', 'EN_ROUTE', 'ARRIVED', 'UNLOADING'].includes(d.status)) void startTracking(d.id);
    if (['COMPLETED', 'FAILED', 'CANCELLED', 'DISPUTED'].includes(d.status)) void stopTracking();
  }, [d.status, d.id]);

  const dest = d.order.lat || d.order.lng ? { lat: d.order.lat, lng: d.order.lng } : null;
  /** Obyektda bo'lishi shart bo'lgan holatlar — server ham tekshiradi (deliveries/geofence.ts). */
  const SITE_DONE: Partial<Record<DeliveryStatus, { action: string; title: string; text: string }>> = {
    ARRIVED: { action: 'Yetib keldim', title: 'Obyektga yetib keldingiz', text: 'Mijozga xabar ketdi. Tayyor bo\'lsangiz — «Tushirishni boshladim».' },
    UNLOADING: { action: 'Tushirishni boshladim', title: 'Tushirish boshlandi', text: 'Tugagach quruvchi imzolaydi yoki SMS-kodni kiritasiz.' },
  };

  const go = async (to: DeliveryStatus) => {
    const site = SITE_DONE[to];
    if (site) {
      setChecking(true);
      const here = await confirmAtSite(dest, site.action).finally(() => setChecking(false));
      if (here === null) return; // obyektda emas / GPS yo'q — sababi oynada aytildi, hech narsa yuborilmaydi
      siteTr.mutate({ to, location: here ? { lat: here.lat, lng: here.lng } : undefined }, {
        onSuccess: () => toast.success(site.text, site.title),
        // Server rad etdi — "Bajarildi" emas, aniq sabab va qayta urinish
        onError: (e) => dialog(`«${site.action}» belgilanmadi`, e instanceof ApiException ? e.message : 'Internet yo\'q — ulanib, qayta bosing', [
          { text: 'Qayta tekshirish', onPress: () => void go(to) },
          { text: 'Yopish', style: 'cancel' },
        ], { tone: 'warning', icon: 'map-pin' }),
      });
      return;
    }
    // Qolgan holatlar (qabul, yuklash, yo'lga chiqish) — oflayn navbat bilan; joy faqat iz uchun
    const location = await quickFix();
    tr.mutate({ to, location, loadedM3: to === 'EN_ROUTE' ? Number(loaded) : undefined });
  };

  const navigate = () => {
    if (!dest) { toast.warning('Zayavkada obyekt nuqtasi yo\'q — manzil: ' + d.order.address, 'Navigatsiya'); return; }
    void openInNavigator({ lat: dest.lat, lng: dest.lng, label: d.order.address });
  };

  if (d.status === 'UNLOADING') {
    return (
      <Card>
        <Txt v="titleSm">Yakunlash</Txt>
        <Txt color="muted">Quruvchi o'z telefonida imzolaydi. Ilovasi bo'lmasa — SMS-kod:</Txt>
        <Gap />
        {otpSent ? <Txt v="caption">Kod {otpSent} raqamiga yuborildi</Txt> : <Button title="Quruvchiga SMS-kod yuborish" variant="secondary" icon="send" onPress={() => requestAcceptOtp(d.id).then((r) => setOtpSent(r.sentTo)).catch(err)} />}
        <Gap />
        <Input label="Quruvchi aytgan 4 xonali kod" mono value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" />
        <Button title={t('driver.UNLOADING')} size="xl" icon="check-check" disabled={otp.length !== 4} loading={sign.isPending} onPress={() => sign.mutate({ otpCode: otp, acceptedM3: Number(d.loadedM3 ?? d.plannedM3) }, { onError: err })} />
      </Card>
    );
  }

  return (
    <View>
      {d.status === 'LOADING' ? <Input label="Yuklangan hajm (m³)" value={loaded} onChangeText={setLoaded} keyboardType="decimal-pad" /> : null}
      {next ? <Button title={t(`driver.${d.status}`, { defaultValue: STATUS_LABEL[next] })} size="xl" loading={tr.isPending || siteTr.isPending || checking} onPress={() => void go(next)} /> : null}
      <Gap />
      <Row style={{ gap: space.md }}>
        <Button title={t('driver.navigate')} variant="secondary" icon="navigation" style={{ flex: 1 }} onPress={navigate} />
        <Button title={t('driver.call')} variant="secondary" icon="phone" style={{ flex: 1 }} onPress={() => dialog('Qo\'ng\'iroq', 'Mijoz raqami tashkilot orqali olinadi (keyingi versiya)')} />
      </Row>
      <Gap />
      {['EN_ROUTE', 'ARRIVED'].includes(d.status) ? (
        <Button title={t('driver.problem')} variant="danger" size="md" icon="triangle-alert" onPress={() => dialog('Muammo', 'Sababni tanlang', [
          { text: 'Nosozlik', onPress: () => tr.mutate({ to: 'FAILED', note: 'Nosozlik' }) },
          { text: 'Yo\'l yopiq', onPress: () => tr.mutate({ to: 'FAILED', note: 'Yo\'l yopiq' }) },
          { text: 'Bekor', style: 'cancel' },
        ])} />
      ) : null}
    </View>
  );
}

/** Quruvchi / tadbirkor: haydovchi va mashina. Qabul (imzo) — `AcceptDelivery` (features/deliveries/accept.tsx). */
function ClientPanel({ d }: { d: NonNullable<ReturnType<typeof useDelivery>['data']> }) {
  return (
    <Card>
      {d.driver ? (
        <ListItem icon="truck" module="logistics" title={d.driver.user.fullName ?? d.driver.user.phone} subtitle={d.vehicle?.plateNumber ? `Mikser ${d.vehicle.plateNumber}` : 'Mashina hali biriktirilmagan'} last />
      ) : (
        <ListItem icon="user" tone="neutral" title="Haydovchi hali biriktirilmagan" subtitle="Zavod dispetcheri biriktirgach shu yerda ko'rinadi" last />
      )}
    </Card>
  );
}

/** Iz uchun joriy nuqta — ruxsat bo'lmasa so'ramaydi va kutmaydi (bu holatlar joyga bog'liq emas). */
async function quickFix(): Promise<{ lat: number; lng: number } | undefined> {
  try {
    if ((await Location.getForegroundPermissionsAsync()).status !== 'granted') return undefined;
    const l = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    return l ? { lat: l.coords.latitude, lng: l.coords.longitude } : undefined;
  } catch {
    return undefined;
  }
}
