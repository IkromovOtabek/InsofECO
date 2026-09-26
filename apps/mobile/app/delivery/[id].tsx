import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import MapView, { Marker } from 'react-native-maps';
import { config } from '@/core/config';
import { DRIVER_PRIMARY_NEXT, DeliveryStatus } from '@insof/shared';
import { Badge, Button, Card, EmptyState, Gap, Input, ListItem, Panel, Row, Screen, StatusChip, Txt, fmtM3, fmtTime, STATUS_LABEL } from '@/design/primitives';
import { toast } from '@/design/ui';
import { radius, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { requestAcceptOtp, useDelivery, useDispute, useDriverTransition, useSignDelivery } from '@/features/deliveries/api';
import { useLivePosition } from '@/features/tracking/useLivePosition';
import { startTracking, stopTracking } from '@/core/location';
import { useSession } from '@/core/session';

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
        {q.isError ? <EmptyState icon="circle-alert" title="Reys yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" action="Qayta urinish" onAction={() => void q.refetch()} /> : <ActivityIndicator color={c.brand} style={{ marginTop: space.xxxl }} />}
      </Screen>
    );
  }
  const dest = { latitude: d.order.lat, longitude: d.order.lng };
  const truck = live ? { latitude: live.lat, longitude: live.lng } : null;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.x10 }}>
        <Row style={{ justifyContent: 'space-between', gap: space.sm }}>
          <Txt v="titleMd" style={{ flex: 1 }} numberOfLines={1}>№{d.order.number} · reys {d.sequence}</Txt>
          <StatusChip status={d.status} />
        </Row>
        <Txt color="muted">{fmtM3(d.plannedM3)} {d.order.items.map((i) => i.gradeSnapshot).join('/')} · {d.order.client.name}{d.order.needsPump ? ' · nasos' : ''}</Txt>
        <Txt v="caption">{d.order.address} · reja {fmtTime(d.plannedAt)}</Txt>
        {d.slaBreached ? <Badge tone="danger" icon="clock" label="90 daqiqa oshdi" style={{ marginTop: space.sm }} /> : null}
        <Gap />

        {/* Kalitsiz Android'da Google Maps ilovani yiqitadi — `core/config.ts` ga qarang */}
        {config.mapsEnabled && (
        <View style={{ height: 220, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault }}>
          <MapView style={{ flex: 1 }} initialRegion={{ ...dest, latitudeDelta: 0.05, longitudeDelta: 0.05 }} showsUserLocation={isDriver}>
            <Marker coordinate={dest} title="Obyekt" pinColor={c.brand} />
            {truck ? <Marker coordinate={truck} title="Mashina" description={live?.etaMin != null ? `~${live.etaMin} daq` : undefined} pinColor={c.info} /> : null}
          </MapView>
        </View>
        )}
        {live?.etaMin != null && d.status === 'EN_ROUTE' ? <Txt v="titleSm" color="brand" style={{ marginTop: space.sm }}>Taxminan {live.etaMin} daqiqada yetib keladi</Txt> : null}
        <Gap />

        {isDriver ? <DriverPanel d={d} /> : <ClientPanel d={d} canSign={role === 'QURUVCHI' || role === 'TADBIRKOR'} />}

        <Panel title="Tarix" icon="history">
          {d.events.length === 0 ? <EmptyState title="Hali voqea yo'q" hint="Reys boshlanishi bilan bu yerda ko'rinadi" icon="history" /> : null}
          {d.events.map((e, i, arr) => <ListItem key={e.id} title={STATUS_LABEL[e.to] ?? e.to} subtitle={e.note ?? undefined} right={<Txt v="caption">{fmtTime(e.at)}</Txt>} last={i === arr.length - 1} />)}
        </Panel>
      </ScrollView>
    </Screen>
  );
}

function DriverPanel({ d }: { d: NonNullable<ReturnType<typeof useDelivery>['data']> }) {
  const { t } = useTranslation();
  const tr = useDriverTransition(d.id);
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

  const go = async (to: DeliveryStatus) => {
    let location: { lat: number; lng: number } | undefined;
    try { const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); location = { lat: l.coords.latitude, lng: l.coords.longitude }; } catch { /* joylashuvsiz ham o'tadi */ }
    tr.mutate({ to, location, loadedM3: to === 'EN_ROUTE' ? Number(loaded) : undefined });
  };

  const navigate = () => {
    const { lat, lng } = d.order;
    const yandex = `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`;
    const fallback = Platform.select({ ios: `maps://?daddr=${lat},${lng}`, default: `geo:${lat},${lng}?q=${lat},${lng}` })!;
    void Linking.canOpenURL(yandex).then((ok) => Linking.openURL(ok ? yandex : fallback));
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
      {next ? <Button title={t(`driver.${d.status}`, { defaultValue: STATUS_LABEL[next] })} size="xl" loading={tr.isPending} onPress={() => void go(next)} /> : null}
      <Gap />
      <Row style={{ gap: space.md }}>
        <Button title={t('driver.navigate')} variant="secondary" icon="navigation" style={{ flex: 1 }} onPress={navigate} />
        <Button title={t('driver.call')} variant="secondary" icon="phone" style={{ flex: 1 }} onPress={() => Alert.alert('Qo\'ng\'iroq', 'Mijoz raqami tashkilot orqali olinadi (keyingi versiya)')} />
      </Row>
      <Gap />
      {['EN_ROUTE', 'ARRIVED'].includes(d.status) ? (
        <Button title={t('driver.problem')} variant="danger" size="md" icon="triangle-alert" onPress={() => Alert.alert('Muammo', 'Sababni tanlang', [
          { text: 'Nosozlik', onPress: () => tr.mutate({ to: 'FAILED', note: 'Nosozlik' }) },
          { text: 'Yo\'l yopiq', onPress: () => tr.mutate({ to: 'FAILED', note: 'Yo\'l yopiq' }) },
          { text: 'Bekor', style: 'cancel' },
        ])} />
      ) : null}
    </View>
  );
}

function ClientPanel({ d, canSign }: { d: NonNullable<ReturnType<typeof useDelivery>['data']>; canSign: boolean }) {
  const sign = useSignDelivery(d.id);
  const dispute = useDispute(d.id);
  const [accepted, setAccepted] = useState(String(d.loadedM3 ?? d.plannedM3));
  const err = (e: Error) => toast.error(e.message, 'Xato');
  if (d.status !== 'UNLOADING' || !canSign) {
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
  return (
    <Card>
      <Txt v="titleSm">Qabul qilish</Txt>
      <Gap h={space.sm} />
      <Input label="Qabul qilingan hajm (m³)" value={accepted} onChangeText={setAccepted} keyboardType="decimal-pad" />
      {/* MVP: imzo — tasdiq tugmasi; keyingi bosqich: react-native-signature-canvas → S3 presign */}
      <Button title="Imzolash va qabul qilish" size="xl" icon="pencil" loading={sign.isPending} onPress={() => sign.mutate({ signatureKey: `signature/${d.id}/tap.png`, acceptedM3: Number(accepted) }, { onError: err })} />
      <Gap />
      <Button title="E'tiroz bildirish" variant="ghost" icon="circle-alert" onPress={() => Alert.alert('E\'tiroz sababi', undefined, [
        { text: 'Hajm kam', onPress: () => dispute.mutate({ reason: 'VOLUME' }) },
        { text: 'Sifat', onPress: () => dispute.mutate({ reason: 'QUALITY' }) },
        { text: 'Kech keldi', onPress: () => dispute.mutate({ reason: 'LATE' }) },
        { text: 'Bekor', style: 'cancel' },
      ])} />
    </Card>
  );
}
