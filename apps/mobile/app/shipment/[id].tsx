import React, { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { config } from '@/core/config';
import { SHIPMENT_DRIVER_NEXT } from '@insof/shared';
import { Button, Card, Field, Gap, Screen, StatusChip, Txt, fmtSum } from '@/design/primitives';
import { Icon, Pill, ProgressBar, Row, Section } from '@/design/ui';
import { BigAction, BigSecondary, RouteBlock, StepDots } from '@/design/driver';
import { useKeepAwake } from 'expo-keep-awake';
import { useTheme } from '@/design/theme';
import { useAction, useShipment } from '@/features/eco/api';
import { useSession } from '@/core/session';

const FLOW = ['NEW', 'ACCEPTED', 'LOADING', 'EN_ROUTE', 'DELIVERED', 'CONFIRMED'];
const LABEL: Record<string, string> = { NEW: 'Yangi', ACCEPTED: 'Qabul qilindi', LOADING: 'Yuklanmoqda', EN_ROUTE: "Yo'lda", DELIVERED: 'Yetkazildi', CONFIRMED: 'Qabul qilindi (tasdiq)' };
const NEXT_LABEL: Record<string, string> = { NEW: 'QABUL QILISH', ACCEPTED: 'Omborda — yuklashni boshladim', LOADING: "Yukladim — yo'lga chiqdim", EN_ROUTE: 'Yetkazdim' };

/** Yuk: Warehouse → GPS → Construction site. Haydovchi bitta katta tugma; Quruvchi/Tadbirkor tasdiqlaydi. */
export default function ShipmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const role = useSession((s) => s.active?.role);
  const q = useShipment(id);
  const [receiver, setReceiver] = useState('');
  const tr = useAction<{ to: string; receiverName?: string; photoKey?: string }>((v) => ({ path: `/shipments/${id}/transition`, body: v }), ['shipments', 'dash', 'material-requests', 'materials', 'finance']);
  const err = (e: Error) => Alert.alert('Xato', e.message);
  const s = q.data;
  if (!s) return <Screen><Txt color="secondary">Yuklanmoqda…</Txt></Screen>;
  const idx = FLOW.indexOf(s.status);
  const from = s.warehouse.lat && s.warehouse.lng ? { latitude: s.warehouse.lat, longitude: s.warehouse.lng } : null;
  const to = s.project.lat && s.project.lng ? { latitude: s.project.lat, longitude: s.project.lng } : null;
  const next = SHIPMENT_DRIVER_NEXT[s.status as keyof typeof SHIPMENT_DRIVER_NEXT];
  const navigate = () => { if (!to) return; const y = `yandexnavi://build_route_on_map?lat_to=${to.latitude}&lon_to=${to.longitude}`; const f = Platform.select({ ios: `maps://?daddr=${to.latitude},${to.longitude}`, default: `geo:${to.latitude},${to.longitude}` })!; void Linking.canOpenURL(y).then((ok) => Linking.openURL(ok ? y : f)); };

  if ((role as string) === 'HAYDOVCHI') return <DriverView s={s} idx={idx} next={next} tr={tr} err={err} receiver={receiver} setReceiver={setReceiver} navigate={navigate} from={from} to={to} />;
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="caption" color="secondary">YUK №{s.number}</Txt><StatusChip status={s.status} /></View>
        <Txt v="title" style={{ marginTop: 2 }}>{s.cargo}</Txt>
        <Gap h={12} />
        {from && to && config.mapsEnabled ? (
          <View style={{ height: 200, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
            <MapView style={{ flex: 1 }} initialRegion={{ latitude: (from.latitude + to.latitude) / 2, longitude: (from.longitude + to.longitude) / 2, latitudeDelta: Math.abs(from.latitude - to.latitude) * 1.8 + 0.05, longitudeDelta: Math.abs(from.longitude - to.longitude) * 1.8 + 0.05 }}>
              <Marker coordinate={from} title="Ombor" pinColor={c.info} /><Marker coordinate={to} title="Obyekt" pinColor={c.brandPrimary} />
              <Polyline coordinates={[from, to]} strokeColor={c.brandPrimary} strokeWidth={3} lineDashPattern={[6, 6]} />
            </MapView>
          </View>
        ) : null}
        <Gap h={12} />
        <Card>
          <ProgressBar value={((idx + 1) / FLOW.length) * 100} tone={s.status === 'CONFIRMED' ? 'success' : 'brand'} height={6} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>{['Ombor', 'Yuklash', "Yo'l", 'Obyekt', 'Tasdiq'].map((l, i) => <Txt key={l} v="caption" style={{ fontSize: 10, color: i < idx ? c.brandPrimary : c.textSecondary }}>{l}</Txt>)}</View>
        </Card>
        <Section title="Marshrut">
          <Row icon="storefront" iconTone="info" title="Olish" subtitle={`${s.warehouse.name} · ${s.warehouse.address}`} />
          <Row icon="location" title="Yetkazish" subtitle={`${s.project.name} · ${s.project.address}`} />
          <Row icon="cube" iconTone="warning" title="Yuk" subtitle={`${s.cargo}${s.request ? '' : ''}`} />
          <Row icon="navigate" title="Masofa" subtitle={s.distanceKm ? `${s.distanceKm} km` : '—'} right={<Txt v="bodyStrong" color="brand">{fmtSum(s.driverFee)}</Txt>} last />
        </Section>
        {s.driver ? <Section title="Haydovchi"><Row avatarName={s.driver.fullName} title={s.driver.fullName ?? s.driver.phone} subtitle={s.vehicle ? `${s.vehicle.brand ?? ''} ${s.vehicle.plateNumber}` : s.driver.phone} last /></Section> : null}
        {s.receiverName ? <Section title="Qabul qiluvchi"><Row icon="person" iconTone="success" title={s.receiverName} subtitle={s.deliveredAt ? `Yetkazildi ${new Date(s.deliveredAt).toLocaleString('ru-RU')}` : ''} last /></Section> : null}
        <Gap h={20} />

        {role === 'HAYDOVCHI' && next ? (
          s.status === 'EN_ROUTE' ? (
            <Card>
              <Txt v="heading">Yuk yetkazildi</Txt><Gap h={10} />
              <Button title="📷 Foto" variant="secondary" size="md" onPress={() => Alert.alert('Foto', 'Kamera — keyingi versiya, demo foto biriktiriladi')} /><Gap h={8} />
              <Txt v="caption" color="secondary">📍 Joylashuv avtomatik qo'shiladi</Txt><Gap h={8} />
              <Field value={receiver} onChangeText={setReceiver} placeholder="✍️ Qabul qiluvchi ismi" />
              <Button title="YETKAZILDI" size="xl" loading={tr.isPending} onPress={() => tr.mutate({ to: 'DELIVERED', receiverName: receiver || undefined, photoKey: 'photo/demo.jpg' }, { onError: err })} />
            </Card>
          ) : (
            <><Button title={NEXT_LABEL[s.status] ?? LABEL[next] ?? next} size="xl" loading={tr.isPending} onPress={() => tr.mutate({ to: next }, { onError: err })} />
              {['ACCEPTED', 'LOADING', 'EN_ROUTE'].includes(s.status) ? <><Gap h={10} /><Button title="🗺  Navigatsiya (Yandex/Apple Maps)" variant="secondary" onPress={navigate} /></> : null}</>
          )
        ) : null}
        {(role === 'QURUVCHI' || role === 'TADBIRKOR') && s.status === 'DELIVERED' ? <Button title="Materialni qabul qildim (tasdiqlash)" size="xl" loading={tr.isPending} onPress={() => tr.mutate({ to: 'CONFIRMED' }, { onError: err })} /> : null}
        {s.status === 'CONFIRMED' ? <View style={{ alignItems: 'center' }}><Pill label="Yakunlangan · zaxira va xarajat yangilandi" tone="success" icon="checkmark-circle" /></View> : null}
        <View style={{ display: 'none' }}><Icon name="add" /></View>
      </ScrollView>
    </Screen>
  );
}

/** Shafyor ko'rinishi: katta stepper, marshrut, bitta asosiy tugma, qo'ng'iroq/navigatsiya. Ekran o'chmaydi. */
function DriverView({ s, idx, next, tr, err, receiver, setReceiver, navigate, from, to }: { s: NonNullable<ReturnType<typeof useShipment>['data']>; idx: number; next?: string; tr: ReturnType<typeof useAction<{ to: string; receiverName?: string; photoKey?: string }>>; err: (e: Error) => void; receiver: string; setReceiver: (v: string) => void; navigate: () => void; from: { latitude: number; longitude: number } | null; to: { latitude: number; longitude: number } | null }) {
  const { c } = useTheme();
  useKeepAwake();
  const step = Math.max(0, Math.min(4, idx - 1)); // NEW/ACCEPTED→0 Ombor, LOADING→1, EN_ROUTE→2, DELIVERED→3, CONFIRMED→4
  const call = () => { if (s.contact?.phone) void Linking.openURL(`tel:${s.contact.phone}`); else Alert.alert('Aloqa', 'Raqam topilmadi'); };
  const done = s.status === 'CONFIRMED' || s.status === 'CANCELLED';
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Txt v="caption" color="secondary" style={{ fontWeight: '700' }}>YUK №{s.number}</Txt><StatusChip status={s.status} /></View>
        <Txt style={{ fontSize: 28, fontWeight: '800', color: c.textPrimary, marginTop: 4 }}>{s.cargo}</Txt>
        <Gap h={16} />
        {!done ? <Card style={{ paddingVertical: 16 }}><StepDots steps={['Ombor', 'Yuklash', "Yo'l", 'Obyekt']} current={step} /></Card> : null}
        <Gap h={12} />
        <Card style={{ padding: 18 }}><RouteBlock from={`${s.warehouse.name}`} to={`${s.project.name}`} /><Txt v="callout" color="secondary" style={{ marginTop: 10 }}>{s.project.address}</Txt></Card>
        {from && to && config.mapsEnabled ? (
          <View style={{ height: 170, borderRadius: 16, overflow: 'hidden', marginTop: 12 }}>
            <MapView style={{ flex: 1 }} initialRegion={{ latitude: (from.latitude + to.latitude) / 2, longitude: (from.longitude + to.longitude) / 2, latitudeDelta: Math.abs(from.latitude - to.latitude) * 1.8 + 0.05, longitudeDelta: Math.abs(from.longitude - to.longitude) * 1.8 + 0.05 }} pointerEvents="none">
              <Marker coordinate={from} pinColor={c.info} /><Marker coordinate={to} pinColor={c.brandPrimary} /><Polyline coordinates={[from, to]} strokeColor={c.brandPrimary} strokeWidth={4} lineDashPattern={[8, 6]} />
            </MapView>
          </View>
        ) : null}
        <Gap h={12} />
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1.3 }}><Txt v="caption" color="secondary">HAQ</Txt><Txt style={{ fontSize: 20, fontWeight: '800', color: c.brandPrimary }} numberOfLines={1} adjustsFontSizeToFit>{fmtSum(s.driverFee)}</Txt></View>
          <View style={{ flex: 1 }}><Txt v="caption" color="secondary">MASOFA</Txt><Txt style={{ fontSize: 22, fontWeight: '800', color: c.textPrimary }}>{s.distanceKm ? `${s.distanceKm} km` : '—'}</Txt></View>
          {s.vehicle ? <View style={{ flex: 1 }}><Txt v="caption" color="secondary">MASHINA</Txt><Txt style={{ fontSize: 18, fontWeight: '700', color: c.textPrimary }}>{s.vehicle.plateNumber}</Txt></View> : null}
        </View>
        <Gap h={20} />

        {s.status === 'EN_ROUTE' ? (
          <Card style={{ padding: 18, borderWidth: 2, borderColor: c.brandPrimary }}>
            <Txt style={{ fontSize: 20, fontWeight: '800', color: c.textPrimary }}>Obyektga yetdim</Txt>
            <Gap h={12} />
            <Field value={receiver} onChangeText={setReceiver} placeholder="Kim qabul qildi? (ism)" style={{ height: 56, fontSize: 18 }} />
            <BigAction title="YETKAZDIM" icon="flag" loading={tr.isPending} onPress={() => tr.mutate({ to: 'DELIVERED', receiverName: receiver || undefined, photoKey: 'photo/demo.jpg' }, { onError: err })} />
            <Txt v="caption" color="secondary" style={{ textAlign: 'center', marginTop: 8 }}>📍 Joylashuv va vaqt avtomatik yoziladi</Txt>
          </Card>
        ) : next ? (
          <BigAction title={{ NEW: 'QABUL QILISH', ACCEPTED: 'YUKLASHNI BOSHLADIM', LOADING: "YUKLADIM — YO'LGA CHIQDIM" }[s.status] ?? next} icon={s.status === 'NEW' ? 'checkmark-circle' : s.status === 'ACCEPTED' ? 'cube' : 'navigate'} loading={tr.isPending} onPress={() => tr.mutate({ to: next }, { onError: err })} />
        ) : s.status === 'DELIVERED' ? (
          <Card style={{ alignItems: 'center', paddingVertical: 20 }}><Icon name="hourglass" size={36} color={c.warning} /><Txt style={{ fontSize: 19, fontWeight: '700', color: c.textPrimary, marginTop: 8 }}>Qabul qiluvchi tasdiqlashini kuting</Txt></Card>
        ) : <View style={{ alignItems: 'center' }}><Pill label={s.status === 'CONFIRMED' ? 'Yakunlangan · haq hisobingizda' : 'Bekor qilingan'} tone={s.status === 'CONFIRMED' ? 'success' : 'danger'} icon="checkmark-circle" /></View>}

        {!done ? (
          <><Gap h={12} /><View style={{ flexDirection: 'row', gap: 10 }}>
            <BigSecondary title="Yo'l" icon="navigate" onPress={navigate} />
            <BigSecondary title={s.contact?.fullName ? s.contact.fullName.split(' ')[0]! : "Qo'ng'iroq"} icon="call" onPress={call} />
          </View></>
        ) : null}
        <View style={{ display: 'none' }}><Row title="" /><Section title=""><View /></Section><ProgressBar value={0} /></View>
      </ScrollView>
    </Screen>
  );
}
