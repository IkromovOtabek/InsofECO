import React, { useMemo, useRef, useState } from 'react';
import { Linking, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Callout, EmptyState, IconButton, KVList, ListGroup, ListItem, Txt, fmtUnit } from '@/design/primitives';
import { ChipGroup, PageHeader, SectionHead, SkeletonList } from '@/design/blocks';
import { Sheet, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space, toneColors, type Tone } from '@/design/tokens';
import { useHeaderRaise } from '@/design/motion';
import { MapUnavailable, MapView, Marker, type MapHandle } from '@/core/map';
import { RouteLine } from '@/core/route';
import { config } from '@/core/config';
import { openInNavigator } from '@/core/navigate';
import { FLEET_POLL_MS, useErpFleet, type ErpFleetItem } from './api';

/**
 * Jonli reyslar xaritasi — direktor (bosh sahifa → "Reyslar xaritada", menyu) va logistika uchun.
 *
 * Ma'lumot `GET /api/mobile/fleet` dan, 12 s da yangilanadi. Belgilar holat rangida: yo'lda — brend,
 * yuklangan — sariq, kutilmoqda — ko'k, muammo bor — qizil. Belgi yoki qator bosilsa pastdan oyna:
 * davlat raqami, haydovchi, zayavka, ETA, qo'ng'iroq, navigatorda ochish, reys kartochkasi.
 * Yo'ldagi mashinalardan obyektgacha — Yandex yo'li (ko'chalar bo'ylab, `core/route.tsx`),
 * xaritada tirbandlik qatlami; tanlangan mashinaning yo'li va obyekt pini ajralib turadi.
 * Xarita kaliti yo'q build'da (`config.mapsEnabled` false) — ro'yxat va administrator uchun izoh.
 */

type Filter = 'all' | 'road' | 'loaded' | 'planned' | 'issue';

/** Holat → rang. Server `tone` beradi (muammo — danger); eski javobda holatdan hisoblanadi. */
const toneOf = (t: ErpFleetItem): Tone =>
  t.openIssues ? 'danger' : t.status === 'ON_ROAD' ? 'brand' : t.status === 'LOADED' ? 'warning' : t.status === 'PLANNED' ? 'info' : (t.tone ?? 'brand');

const groupOf = (t: ErpFleetItem): Exclude<Filter, 'all'> =>
  t.openIssues ? 'issue' : t.status === 'LOADED' ? 'loaded' : t.status === 'PLANNED' ? 'planned' : 'road';

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: 'brand', label: "Yo'lda" }, { tone: 'warning', label: 'Yuklangan' }, { tone: 'info', label: 'Kutilmoqda' }, { tone: 'danger', label: 'Muammo' },
];

/** Tanlangan mashinaga yaqinlashish (~1 km). */
const FOCUS_DELTA = 0.012;
/** Shuncha mashinagacha hammasining yo'li chiziladi; ko'p bo'lsa — faqat tanlanganiniki (xarita chalkashmasin). */
const MAX_ROUTES = 6;

type Routable = ErpFleetItem & { gps: NonNullable<ErpFleetItem['gps']>; dest: NonNullable<ErpFleetItem['dest']> };
const routable = (t: ErpFleetItem | null): t is Routable => !!t?.gps && !!t.dest;

function agoLabel(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return 'hozir';
  if (m < 60) return `${m} daq oldin`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} soat oldin` : `${Math.floor(h / 24)} kun oldin`;
}

const hms = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };

export function FleetScreen({ onBack, title = 'Reyslar xaritada' }: { onBack?: () => void; title?: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raise = useHeaderRaise();
  const { height } = useWindowDimensions();
  // Ekran stekda ostda qolganda (reys kartochkasi ochilgan) 12 s so'rovlar to'xtaydi — qaytganda darhol yangilanadi
  const focused = useIsFocused();
  const { data, isLoading, error, refetch, isRefetching, dataUpdatedAt } = useErpFleet(focused);
  const mapRef = useRef<MapHandle | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo(() => data?.trucks ?? [], [data]);
  const counts = useMemo(() => {
    const n: Record<Filter, number> = { all: all.length, road: 0, loaded: 0, planned: 0, issue: 0 };
    for (const t of all) n[groupOf(t)]++;
    return n;
  }, [all]);
  const trucks = filter === 'all' ? all : all.filter((t) => groupOf(t) === filter);
  const located = trucks.filter((t): t is ErpFleetItem & { gps: NonNullable<ErpFleetItem['gps']> } => !!t.gps);
  const coords = located.map((t) => ({ latitude: t.gps.lat, longitude: t.gps.lng }));
  const sel = selected ? all.find((t) => t.tripId === selected) ?? null : null;
  const onRoad = trucks.filter(routable).filter((t) => t.status === 'ON_ROAD');
  const routed = (onRoad.length <= MAX_ROUTES ? onRoad : []).filter((t) => t.tripId !== selected);
  const selRoute = routable(sel) ? sel : null;

  // Boshlang'ich ko'rinish — birinchi yuklangan nuqtalar bo'yicha (keyingi yangilanishlar kamerani sakratmaydi)
  const initial = useRef<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  if (!initial.current && coords.length) {
    const lats = coords.map((p) => p.latitude), lngs = coords.map((p) => p.longitude);
    initial.current = {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max(0.04, (Math.max(...lats) - Math.min(...lats)) * 1.6),
      longitudeDelta: Math.max(0.04, (Math.max(...lngs) - Math.min(...lngs)) * 1.6),
    };
  }

  const fitAll = () => {
    if (coords.length > 1) mapRef.current?.fitToCoordinates(coords);
    else if (coords[0]) mapRef.current?.animateToRegion({ ...coords[0], latitudeDelta: 0.04, longitudeDelta: 0.04 }, 400);
    else toast.info("Xaritada ko'rsatadigan GPS nuqtasi yo'q");
  };

  const focus = (t: ErpFleetItem) => {
    setSelected(t.tripId);
    if (t.gps && config.mapsEnabled) mapRef.current?.animateToRegion({ latitude: t.gps.lat, longitude: t.gps.lng, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA }, 500);
  };

  const call = (phone: string) => { void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => toast.error("Qo'ng'iroq qilib bo'lmadi")); };
  const navigate = async (t: ErpFleetItem) => {
    const p = t.dest ?? (t.gps ? { lat: t.gps.lat, lng: t.gps.lng } : null);
    if (!p) { toast.warning("Na obyekt nuqtasi, na GPS bor — navigatorga yo'nalish berib bo'lmaydi"); return; }
    // "Bekor qilish" ham `false` qaytaradi, xato holatini esa `openInNavigator` o'zi aytadi — bu yerda qo'shimcha toast yo'q
    await openInNavigator({ lat: p.lat, lng: p.lng, label: t.dest ? `${t.customer}${t.address ? ` · ${t.address}` : ''}` : `${t.plate} · ${t.driver}` });
  };

  const mapH = Math.round(Math.min(420, Math.max(260, height * 0.45)));
  const updated = dataUpdatedAt ? hms(new Date(dataUpdatedAt).toISOString()) : null;

  const chips: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: 'Hammasi', count: counts.all },
    { key: 'road', label: "Yo'lda", count: counts.road },
    { key: 'loaded', label: 'Yuklangan', count: counts.loaded },
    { key: 'planned', label: 'Kutilmoqda', count: counts.planned },
    ...(counts.issue ? [{ key: 'issue' as const, label: 'Muammo', count: counts.issue }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader
        title={title}
        overline={updated ? `Jonli · ${Math.round(FLEET_POLL_MS / 1000)} s da yangilanadi · ${updated}` : 'Jonli kuzatuv'}
        onBack={onBack}
        raised={raise.raised}
        actions={[
          ...(config.mapsEnabled && coords.length ? [{ icon: 'locate-fixed' as const, label: 'Hammasini ko\'rsatish', onPress: () => { setSelected(null); fitAll(); } }] : []),
          { icon: 'refresh-cw' as const, label: 'Yangilash', onPress: () => void refetch() },
        ]}
        style={{ paddingTop: insets.top + space.sm }}
      />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl, gap: space.stack }}
        refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        {isLoading ? <SkeletonList rows={5} /> : error && !data ? (
          <EmptyState icon="cloud-off" title="Reyslar yuklanmadi" hint={(error as Error).message || "Internetni tekshirib, qayta urinib ko'ring"} onRetry={() => void refetch()} />
        ) : (
          <>
            {all.length > 1 ? <ChipGroup items={chips} value={filter} onChange={(k) => { setFilter(k); setSelected(null); }} /> : null}

            {!config.mapsEnabled ? (
              <MapUnavailable compact hint="Bu versiyaga Yandex xarita kaliti ulanmagan — telefoningizda nuqson yo'q. Reyslar quyida ro'yxatda: har birini bosib, «Navigatorda» orqali joyini ko'ring. Xaritani yoqish uchun administratorga ayting." />
            ) : initial.current ? (
              <View style={{ height: mapH, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault }}>
                <MapView
                  ref={(r) => { mapRef.current = r; }}
                  style={{ flex: 1 }}
                  initialRegion={initial.current}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  traffic
                >
                  {routed.map((t) => (
                    <RouteLine key={`r:${t.tripId}`} from={{ latitude: t.gps.lat, longitude: t.gps.lng }} to={{ latitude: t.dest.lat, longitude: t.dest.lng }} color={toneColors(c, toneOf(t)).solid} width={4} />
                  ))}
                  {selRoute ? <RouteLine key={`r:${selRoute.tripId}`} from={{ latitude: selRoute.gps.lat, longitude: selRoute.gps.lng }} to={{ latitude: selRoute.dest.lat, longitude: selRoute.dest.lng }} color={toneColors(c, toneOf(selRoute)).solid} width={6} /> : null}
                  {selRoute ? <Marker key={`d:${selRoute.tripId}`} coordinate={{ latitude: selRoute.dest.lat, longitude: selRoute.dest.lng }} tone="success" /> : null}
                  {located.map((t) => {
                    const tone = toneOf(t);
                    const active = selected === t.tripId;
                    const col = toneColors(c, tone);
                    return (
                      <Marker
                        // MapKit belgini rasmga aylantiradi — rang/tanlov o'zgarsa qayta yaratiladi
                        key={`${t.tripId}:${tone}:${active ? 1 : 0}`}
                        coordinate={{ latitude: t.gps.lat, longitude: t.gps.lng }}
                        anchor={{ x: 0.5, y: 0.5 }}
                        zIndex={active ? 3 : tone === 'danger' ? 2 : 1}
                        onPress={() => focus(t)}
                      >
                        <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: col.solid, borderWidth: active ? size.ring + 1 : size.ring, borderColor: active ? c.textStrong : c.bgSurface }}>
                          <Txt v="overline" style={{ color: tone === 'brand' ? c.textOnBrand : tone === 'neutral' ? c.bgSurface : c.textOnSolid }} numberOfLines={1}>{t.plate}</Txt>
                        </View>
                      </Marker>
                    );
                  })}
                </MapView>
                <View style={{ position: 'absolute', right: space.sm, bottom: space.sm }}>
                  <IconButton icon="locate-fixed" label="Hamma mashinani ko'rsatish" variant="secondary" onPress={() => { setSelected(null); fitAll(); }} />
                </View>
              </View>
            ) : (
              <Callout tone="neutral" icon="map-pin">
                {all.length ? "Hozircha birorta haydovchidan GPS kelmayapti — mashina yo'lga chiqib, ilovada kuzatuv yoqilsa xaritada ko'rinadi." : "Faol reys yo'q."}
              </Callout>
            )}

            {config.mapsEnabled && located.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs }}>
                {LEGEND.map((l) => (
                  <View key={l.tone} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    <View style={{ width: size.legend, height: size.legend, borderRadius: radius.legend, backgroundColor: toneColors(c, l.tone).solid }} />
                    <Txt v="legend">{l.label}</Txt>
                  </View>
                ))}
              </View>
            ) : null}

            {data?.gpsError ? <Callout tone="warning" icon="triangle-alert">{`GPS manbasi bilan aloqa yo'q: ${data.gpsError}`}</Callout> : null}

            <SectionHead title="Faol reyslar" count={trucks.length || undefined} action={trucks.length ? 'Ro\'yxat' : undefined} onAction={() => router.push('/erp/list/trips' as never)} />
            {trucks.length === 0 ? (
              <EmptyState compact icon="truck" title={all.length ? "Bu holatda reys yo'q" : "Faol reys yo'q"} hint={all.length ? undefined : 'Reys ochilib, haydovchi yo\'lga chiqqanda shu yerda ko\'rinadi'} />
            ) : (
              <ListGroup>
                {trucks.map((t) => {
                  const tone = toneOf(t);
                  const gps = t.gps;
                  const line2 = [
                    t.phase,
                    t.delay,
                    gps ? `GPS ${agoLabel(gps.at)}${gps.etaMin != null ? ` · ~${gps.etaMin} daq` : ''}` : "GPS yo'q",
                  ].filter(Boolean).join(' · ');
                  return (
                    <ListItem
                      key={t.tripId}
                      icon="truck"
                      module="logistics"
                      tone={t.openIssues ? 'danger' : undefined}
                      title={`${t.plate} · ${t.driver}`}
                      subtitle={`${t.customer}${t.address ? ` · ${t.address}` : ''}\n${line2}`}
                      subtitleLines={2}
                      badge={{ text: t.openIssues ? `${t.openIssues} muammo` : t.delay && t.delayTone ? t.delay : LEGEND.find((l) => l.tone === tone)?.label ?? t.phase, tone }}
                      style={selected === t.tripId ? { backgroundColor: c.bgMuted } : undefined}
                      onPress={() => focus(t)}
                    />
                  );
                })}
              </ListGroup>
            )}
          </>
        )}
      </ScrollView>

      <Sheet open={!!sel} onClose={() => setSelected(null)} title={sel ? `${sel.plate} · ${sel.ref}` : ''}>
        {sel ? (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <Badge label={sel.phase} tone={toneOf(sel)} />
              {sel.delay ? <Badge label={sel.delay} tone={sel.delayTone ?? 'success'} /> : null}
              {sel.openIssues ? <Badge label={`${sel.openIssues} ochiq muammo`} tone="danger" /> : null}
            </View>
            <KVList
              rows={[
                { label: 'Haydovchi', value: sel.driverPhone ? `${sel.driver} · ${sel.driverPhone}` : sel.driver },
                { label: 'Zayavka', value: `${sel.orderNo ? `${sel.orderNo} · ` : ''}${sel.customer}` },
                ...(sel.address ? [{ label: 'Manzil', value: sel.address }] : []),
                ...(sel.qty ? [{ label: 'Yuk', value: sel.qty }] : []),
                ...(sel.plannedAt ? [{ label: 'Reja', value: sel.plannedAt }] : []),
                { label: 'ETA', value: sel.gps?.etaMin != null ? `~${sel.gps.etaMin} daq` : "noma'lum", tone: sel.delayTone && sel.delayTone !== 'success' ? sel.delayTone : undefined },
                { label: 'GPS', value: sel.gps ? `${agoLabel(sel.gps.at)}${sel.gps.km != null ? ` · ${fmtUnit(sel.gps.km, 'km')} yurdi` : ''}` : "Signal yo'q", tone: sel.gps ? undefined : 'warning' },
              ]}
            />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button title="Qo'ng'iroq" icon="phone" variant="secondary" disabled={!sel.driverPhone} onPress={() => sel.driverPhone && call(sel.driverPhone)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Navigatorda" icon="navigation" variant="secondary" disabled={!sel.dest && !sel.gps} onPress={() => void navigate(sel)} />
              </View>
            </View>
            {!sel.driverPhone ? <Txt v="caption" color="muted" align="center">Haydovchi telefoni xodim kartasida yozilmagan</Txt> : null}
            {!sel.tripId.startsWith('ref:') ? <Button title="Reys kartochkasi" icon="truck" onPress={() => { setSelected(null); router.push(`/erp/trips/${sel.tripId}` as never); }} /> : null}
            {sel.orderId ? <Button title="Zayavkani ochish" icon="file-text" variant="ghost" onPress={() => { setSelected(null); router.push(`/erp/orders/${sel.orderId}` as never); }} /> : null}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
