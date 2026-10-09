import React, { useRef, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DriverMarker, MapUnavailable, MapView, Marker, Polyline, useMapScrollLock } from '@/core/map';
import { RouteLine } from '@/core/route';
import { openInNavigator } from '@/core/navigate';
import { ApiException } from '@/core/api';
import { confirmAtSite } from '@/features/address/site-check';
import { SITE_RADIUS_M } from '@/core/location';
import { config } from '@/core/config';
import { SHIPMENT_DRIVER_NEXT } from '@insof/shared';
import { Badge, Button, Card, EmptyState, FitTxt, Gap, Input, ListItem, Panel, Screen, StatusChip, Txt, fmtDateFull, fmtSum, fmtTime, fmtUnit } from '@/design/primitives';
import { dialog, Avatar, Icon, StatusLine, toast } from '@/design/ui';
import { BigAction, BigSecondary, RouteBlock, StepDots } from '@/design/driver';
import { mapDriver, radius, size, space } from '@/design/tokens';
import { useKeepAwake } from 'expo-keep-awake';
import { useTheme } from '@/design/theme';
import { Appear } from '@/design/motion';
import { useAction, useShipment } from '@/features/eco/api';
import { SHIPMENT_HAS_TRACK, SHIPMENT_TRACKED, useShipmentGps, useShipmentTrail } from '@/features/eco/shipment-track';
import { useSession } from '@/core/session';
import { Loader } from '@/design/loader';
import { PhotoAttachments, usePhotoAttachments, withUploadedPhotos } from '@/features/files/photos';

const FLOW = ['NEW', 'ACCEPTED', 'LOADING', 'EN_ROUTE', 'DELIVERED', 'CONFIRMED'];
const LABEL: Record<string, string> = { NEW: 'Yangi', ACCEPTED: 'Qabul qilindi', LOADING: 'Yuklanmoqda', EN_ROUTE: "Yo'lda", DELIVERED: 'Yetkazildi', CONFIRMED: 'Qabul qilindi (tasdiq)' };
const NEXT_LABEL: Record<string, string> = { NEW: 'Qabul qilish', ACCEPTED: 'Yuklashni boshladim', LOADING: "Yo'lga chiqdim", EN_ROUTE: 'Yetkazdim' };
const STEPS = ['Ombor', 'Yuklash', "Yo'l", 'Obyekt'];

/** "Mashina: 2 daq oldin · 34 km/soat" — xarita ostida (dispetcher, quruvchi). */
function liveLine(p: { at: string; speedKmh: number | null }) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(p.at)) / 60_000));
  const ago = m < 1 ? 'hozir' : m < 60 ? `${m} daq oldin` : `${Math.floor(m / 60)} soat oldin`;
  const speed = p.speedKmh != null && m < 10 ? ` · ${p.speedKmh < 3 ? 'turibdi' : `${Math.round(p.speedKmh)} km/soat`}` : '';
  return `Mashina joylashuvi: ${ago}${speed}${m >= 10 ? ' · GPS eskirgan' : ''}`;
}

/** Yuk: Warehouse → GPS → Construction site. Haydovchi bitta katta tugma; Quruvchi/Tadbirkor tasdiqlaydi. */
export default function ShipmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const role = useSession((s) => s.active?.role);
  const q = useShipment(id);
  const router = useRouter();
  const [receiver, setReceiver] = useState('');
  const [checking, setChecking] = useState(false);
  /** GPS tekshiruvi + so'rov davomida ikkinchi bosish bo'lmasin (ikki oyna / ikki so'rov). */
  const busy = useRef(false);
  const mapLock = useMapScrollLock();
  const tr = useAction<TrVars>((v) => ({ path: `/shipments/${id}/transition`, body: v }), ['shipments', 'dash', 'material-requests', 'materials', 'finance']);
  /** Yetkazish fotosi (ixtiyoriy): orqa kamera, presign orqali yuklanadi, kaliti "Yetkazdim" bilan ketadi. */
  const photo = usePhotoAttachments('waybill', 1);
  const err = (e: Error) => toast.error(e.message, 'Xato');
  const s = q.data;
  // Haydovchining fon GPS'i: yuklash/yo'lda — yoqiq (bosib o'tilgan yo'l yoziladi), yetkazilgach — to'xtaydi
  useShipmentGps(s);
  // Dispetcher / quruvchi: yo'ldagi mashina va ortidagi oxirgi 15 daqiqalik iz (haydovchi o'zi xaritada ko'radi)
  const watching = !!s && (role as string) !== 'HAYDOVCHI' && SHIPMENT_TRACKED.includes(s.status);
  const trail = useShipmentTrail(id, watching).data;
  if (!s) {
    return (
      <Screen>
        {q.isError ? <EmptyState icon="cloud-off" title="Yuk yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} /> : <Loader style={{ marginTop: space.xxxl }} />}
      </Screen>
    );
  }
  const idx = FLOW.indexOf(s.status);
  const from = s.warehouse.lat && s.warehouse.lng ? { latitude: s.warehouse.lat, longitude: s.warehouse.lng } : null;
  const to = s.project.lat && s.project.lng ? { latitude: s.project.lat, longitude: s.project.lng } : null;
  const next = SHIPMENT_DRIVER_NEXT[s.status as keyof typeof SHIPMENT_DRIVER_NEXT];
  const navigate = () => {
    if (!to) { toast.warning(`Obyekt nuqtasi belgilanmagan — manzil: ${s.project.address}`, 'Navigatsiya'); return; }
    void openInNavigator({ lat: to.latitude, lng: to.longitude, label: `${s.project.name}, ${s.project.address}` });
  };
  /**
   * "Yetkazdim" — faqat obyekt yonida (300 m). Avval yangi GPS nuqta tekshiriladi, keyin
   * shu nuqta serverga ketadi va server ham tekshiradi (shipments.service → assertAtSite).
   * Muvaffaqiyat xabari aniq: "Yetkazildi", rad etilsa — sababi va "Qayta tekshirish".
   */
  const deliver = async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    const here = await confirmAtSite(to ? { lat: to.latitude, lng: to.longitude } : null, 'Yetkazdim').finally(() => setChecking(false));
    if (here === null) { busy.current = false; return; }
    setChecking(true);
    // Foto olingan bo'lsa — avval yuklanadi; olinmagan bo'lsa (server ruxsat beradi) fotosiz ketadi
    await withUploadedPhotos(photo, ([photoKey]) => send(here, photoKey), () => { busy.current = false; });
    setChecking(false);
  };
  const send = (here: { lat: number; lng: number } | undefined, photoKey: string | undefined) => {
    busy.current = true;
    tr.mutate({ to: 'DELIVERED', receiverName: receiver.trim() || undefined, photoKey, location: here ? { lat: here.lat, lng: here.lng } : undefined }, {
      onSettled: () => { busy.current = false; },
      onSuccess: () => toast.success('Qabul qiluvchi tasdiqlagach haq hisobingizga tushadi', 'Yetkazildi'),
      onError: (e) => dialog('«Yetkazdim» belgilanmadi', e instanceof ApiException ? e.message : "Internet yo'q — ulanib, qayta bosing", [
        { text: 'Qayta tekshirish', onPress: () => void deliver() },
        { text: 'Yopish', style: 'cancel' },
      ], { tone: 'warning', icon: 'map-pin' }),
    });
  };
  const openMap = () => router.push(`/shipment/xarita/${s.id}` as never);
  // NEW/ACCEPTED→0 Ombor, LOADING→1, EN_ROUTE→2, DELIVERED→3, CONFIRMED→4
  const step = Math.max(0, Math.min(STEPS.length, idx - 1));

  const refreshing = q.isRefetching;
  const onRefresh = () => void q.refetch();
  if ((role as string) === 'HAYDOVCHI') return <DriverView refreshing={refreshing} onRefresh={onRefresh} s={s} step={step} next={next} tr={tr} err={err} receiver={receiver} setReceiver={setReceiver} navigate={navigate} openMap={openMap} deliver={() => void deliver()} delivering={checking || photo.busy || tr.isPending} from={from} to={to} photo={photo} />;
  return (
    <Screen padded={false}>
      <ScrollView scrollEnabled={mapLock.scrollEnabled} contentContainerStyle={{ padding: space.lg, paddingBottom: space.x10 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textMuted} />}>
        <Appear>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}><Txt v="overline">Yuk №{s.number}</Txt><StatusChip status={s.status} /></View>
          <Txt v="titleMd" style={{ marginTop: 2 }}>{s.cargo}</Txt>
          <Gap h={space.md} />
          {from && to && config.mapsEnabled ? (
            <View style={{ height: 200, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault }}>
              <MapView style={{ flex: 1 }} initialRegion={{ latitude: (from.latitude + to.latitude) / 2, longitude: (from.longitude + to.longitude) / 2, latitudeDelta: Math.abs(from.latitude - to.latitude) * 1.8 + 0.05, longitudeDelta: Math.abs(from.longitude - to.longitude) * 1.8 + 0.05 }} zoomControls onTouchLock={mapLock.onTouchLock}>
                <Marker coordinate={from} tone="info" /><Marker coordinate={to} tone="brand" />
                <RouteLine from={from} to={to} width={4} />
                {watching && trail ? <Polyline coordinates={trail.points.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={mapDriver.moving + '66'} strokeWidth={4} /> : null}
                {watching && trail?.last ? (
                  <DriverMarker
                    coordinate={{ latitude: trail.last.lat, longitude: trail.last.lng }}
                    heading={trail.last.heading != null && (trail.last.speedKmh ?? 0) >= 3 ? trail.last.heading : null}
                    status={Date.now() - Date.parse(trail.last.at) > 10 * 60_000 ? 'offline' : s.status === 'LOADING' ? 'loaded' : 'moving'}
                  />
                ) : null}
              </MapView>
            </View>
          ) : null}
          {watching && trail?.last ? <Txt v="caption" color="muted" style={{ marginTop: space.xs }}>{liveLine(trail.last)}</Txt> : null}
          {to && SHIPMENT_HAS_TRACK.includes(s.status) ? (
            <Button variant="secondary" icon="route" title="Bosib o'tilgan yo'l" onPress={openMap} style={{ marginTop: space.sm }} />
          ) : null}
          <Gap h={space.md} />
          {s.status === 'CANCELLED' ? null : <Card style={{ paddingVertical: space.lg }}><StepDots steps={STEPS} current={step} /></Card>}
          <Panel title="Marshrut" icon="route">
            <ListItem icon="store" tone="info" title="Olish" subtitle={`${s.warehouse.name} · ${s.warehouse.address}`} />
            <ListItem icon="map-pin" tone="brand" title="Yetkazish" subtitle={`${s.project.name} · ${s.project.address}`} />
            <ListItem icon="package" tone="warning" title="Yuk" subtitle={s.cargo} />
            <ListItem icon="navigation" tone="neutral" title="Masofa" subtitle={s.distanceKm ? fmtUnit(s.distanceKm, 'km') : '—'} right={<Txt v="bodyStrong" color="brand">{fmtSum(s.driverFee)}</Txt>} last />
          </Panel>
          {s.driver ? <Panel title="Haydovchi" icon="user"><ListItem leading={<Avatar name={s.driver.fullName} />} title={s.driver.fullName ?? s.driver.phone} subtitle={s.vehicle ? `${s.vehicle.brand ?? ''} ${s.vehicle.plateNumber}`.trim() : s.driver.phone} last /></Panel> : null}
          {s.receiverName ? <Panel title="Qabul qiluvchi" icon="user"><ListItem icon="user" tone="success" title={s.receiverName} subtitle={s.deliveredAt ? `Yetkazildi ${fmtDateFull(s.deliveredAt)} ${fmtTime(s.deliveredAt)}` : undefined} last /></Panel> : null}
          <Gap h={space.xl} />

          {role === 'HAYDOVCHI' && next ? (
            s.status === 'EN_ROUTE' ? (
              <Card>
                <Txt v="titleSm">Yuk yetkazildi</Txt><Gap h={space.sm} />
                <PhotoAttachments att={photo} label="Yetkazish fotosi" hint="Ixtiyoriy: yuk va qabul joyini suratga oling" /><Gap h={space.sm} />
                <StatusLine icon="map-pin" tone="info" text="Joylashuv avtomatik qo'shiladi" />
                <Input value={receiver} onChangeText={setReceiver} placeholder="Qabul qiluvchi ismi" accessibilityLabel="Qabul qiluvchi ismi" autoCapitalize="words" />
                <Button title="Yetkazdim" size="xl" icon="flag" loading={tr.isPending || checking || photo.busy} onPress={() => void deliver()} />
              </Card>
            ) : (
              <><Button title={NEXT_LABEL[s.status] ?? LABEL[next] ?? next} size="xl" loading={tr.isPending} onPress={() => tr.mutate({ to: next }, { onError: err })} />
                {['ACCEPTED', 'LOADING', 'EN_ROUTE'].includes(s.status) ? <><Gap h={space.sm} /><Button title="Navigatorda ochish" icon="navigation" variant="secondary" onPress={navigate} /></> : null}</>
            )
          ) : null}
          {(role === 'QURUVCHI' || role === 'TADBIRKOR') && s.status === 'DELIVERED' ? <Button title="Qabul qildim" size="xl" icon="package-check" loading={tr.isPending} onPress={() => tr.mutate({ to: 'CONFIRMED' }, { onError: err })} /> : null}
          {s.status === 'CONFIRMED' ? <View style={{ alignItems: 'center' }}><Badge label="Yakunlangan · zaxira va xarajat yangilandi" tone="success" icon="circle-check" /></View> : null}
          {s.status === 'CANCELLED' ? <View style={{ alignItems: 'center' }}><Badge label="Bekor qilingan" tone="danger" icon="circle-x" /></View> : null}
        </Appear>
      </ScrollView>
    </Screen>
  );
}

/** Shafyor ko'rinishi: katta stepper, marshrut, bitta asosiy tugma, qo'ng'iroq/navigatsiya. Ekran o'chmaydi. */
type TrVars = { to: string; receiverName?: string; photoKey?: string; location?: { lat: number; lng: number } };

function DriverView({ refreshing, onRefresh, s, step, next, tr, err, receiver, setReceiver, navigate, openMap, deliver, delivering, from, to, photo }: { photo: ReturnType<typeof usePhotoAttachments>; refreshing: boolean; onRefresh: () => void; s: NonNullable<ReturnType<typeof useShipment>['data']>; step: number; next?: string; tr: ReturnType<typeof useAction<TrVars>>; err: (e: Error) => void; receiver: string; setReceiver: (v: string) => void; navigate: () => void; openMap: () => void; deliver: () => void; delivering: boolean; from: { latitude: number; longitude: number } | null; to: { latitude: number; longitude: number } | null }) {
  const { c } = useTheme();
  useKeepAwake();
  const mapLock = useMapScrollLock();
  const call = () => { if (s.contact?.phone) void Linking.openURL(`tel:${s.contact.phone}`); else toast.warning('Buyurtmachi raqami ko\'rsatilmagan — dispetcher bilan bog\'laning', 'Aloqa'); };
  const done = s.status === 'CONFIRMED' || s.status === 'CANCELLED';
  return (
    <Screen padded={false}>
      <ScrollView scrollEnabled={mapLock.scrollEnabled} contentContainerStyle={{ padding: space.lg, paddingBottom: space.x10 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textMuted} />}>
        <Appear>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}><Txt v="overline">Yuk №{s.number}</Txt><StatusChip status={s.status} /></View>
          <Txt v="titleMd" style={{ marginTop: space.xs }}>{s.cargo}</Txt>
          <Gap h={space.lg} />
          {!done ? <Card style={{ paddingVertical: space.lg }}><StepDots steps={STEPS} current={step} /></Card> : null}
          <Gap h={space.md} />
          <Card style={{ padding: space.xl }}><RouteBlock from={s.warehouse.name} to={s.project.name} /><Txt v="body" color="muted" style={{ marginTop: space.sm }}>{s.project.address}</Txt></Card>
          {to && config.mapsEnabled ? (
            // Surish / yaqinlashtirish ishlaydi; bir marta bosish yoki tugma — to'liq ekranli xarita
            // (mashina, obyekt, masofa, ETA va kuzatish rejimi)
            <View style={{ height: 170, borderRadius: radius.card, overflow: 'hidden', marginTop: space.md, borderWidth: size.hairline, borderColor: c.borderDefault }}>
              <MapView style={{ flex: 1 }} onPress={openMap} onTouchLock={mapLock.onTouchLock} rotateEnabled={false} pitchEnabled={false} initialRegion={from ? { latitude: (from.latitude + to.latitude) / 2, longitude: (from.longitude + to.longitude) / 2, latitudeDelta: Math.abs(from.latitude - to.latitude) * 1.8 + 0.05, longitudeDelta: Math.abs(from.longitude - to.longitude) * 1.8 + 0.05 } : { ...to, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
                {from ? <Marker coordinate={from} tone="info" /> : null}<Marker coordinate={to} tone="brand" /><RouteLine from={from} to={to} />
              </MapView>
              <Pressable onPress={openMap} accessibilityRole="button" accessibilityLabel="Xaritani to'liq ekranda ochish" hitSlop={space.sm} style={{ position: 'absolute', right: space.sm, bottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: c.bgSurface, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs }}>
                <Icon name={SHIPMENT_HAS_TRACK.includes(s.status) ? 'route' : 'map'} size={size.iconSm} tone="brand" /><Txt v="label" color="brand">{s.status === 'DELIVERED' || s.status === 'CONFIRMED' ? "Bosib o'tilgan yo'l" : 'Xaritada ochish'}</Txt>
              </Pressable>
            </View>
          ) : to && s.status !== 'CONFIRMED' && s.status !== 'CANCELLED' ? (
            <MapUnavailable compact style={{ marginTop: space.md }} />
          ) : null}
          <Gap h={space.md} />
          <Card style={{ flexDirection: 'row', gap: space.lg }}>
            <View style={{ flex: 1.3 }}><Txt v="overline">Haq</Txt><FitTxt v="metric" color="brand" min={0.7}>{fmtSum(s.driverFee)}</FitTxt></View>
            <View style={{ flex: 1 }}><Txt v="overline">Masofa</Txt><Txt v="metric" numberOfLines={1}>{s.distanceKm ? fmtUnit(s.distanceKm, 'km') : '—'}</Txt></View>
            {s.vehicle ? <View style={{ flex: 1 }}><Txt v="overline">Mashina</Txt><Txt v="titleMd" mono numberOfLines={1}>{s.vehicle.plateNumber}</Txt></View> : null}
          </Card>
          <Gap h={space.xl} />

          {s.status === 'EN_ROUTE' ? (
            <Card style={{ padding: space.xl, borderWidth: size.ring, borderColor: c.brand }}>
              <Txt v="titleMd">Obyektga yetdim</Txt>
              <Gap h={space.md} />
              <Input value={receiver} onChangeText={setReceiver} placeholder="Kim qabul qildi? (ism)" left="user" accessibilityLabel="Qabul qiluvchi ismi" autoCapitalize="words" />
              <PhotoAttachments att={photo} label="Yetkazish fotosi" hint="Ixtiyoriy: yuk va qabul joyini suratga oling" />
              <Gap h={space.md} />
              <BigAction title="Yetkazdim" icon="flag" loading={delivering} onPress={deliver} />
              <View style={{ marginTop: space.sm }}><StatusLine icon="map-pin" tone="info" text={`Obyektdan ${SITE_RADIUS_M} m ichida bosiladi — joylashuv va vaqt yoziladi`} /></View>
            </Card>
          ) : next ? (
            <BigAction title={{ NEW: 'Qabul qilish', ACCEPTED: 'Yuklashni boshladim', LOADING: "Yo'lga chiqdim" }[s.status] ?? next} icon={s.status === 'NEW' ? 'circle-check' : s.status === 'ACCEPTED' ? 'package' : 'navigation'} loading={tr.isPending} onPress={() => tr.mutate({ to: next }, { onError: err })} />
          ) : s.status === 'DELIVERED' ? (
            <Card style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.sm }}><Icon name="hourglass" size={size.iconXl} tone="warning" /><Txt v="titleSm" align="center">Qabul qiluvchi tasdiqlashini kuting</Txt></Card>
          ) : <View style={{ alignItems: 'center' }}><Badge label={s.status === 'CONFIRMED' ? 'Yakunlangan · haq hisobingizda' : 'Bekor qilingan'} tone={s.status === 'CONFIRMED' ? 'success' : 'danger'} icon={s.status === 'CONFIRMED' ? 'circle-check' : 'circle-x'} /></View>}

          {!done ? (
            <><Gap h={space.md} /><View style={{ flexDirection: 'row', gap: space.md }}>
              <BigSecondary title="Yo'l" icon="navigation" onPress={navigate} />
              <BigSecondary title={s.contact?.fullName ? s.contact.fullName.split(' ')[0]! : "Qo'ng'iroq"} icon="phone" onPress={call} />
            </View></>
          ) : null}
        </Appear>
      </ScrollView>
    </Screen>
  );
}
