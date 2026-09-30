import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, EmptyState, Gap, IconButton, IconTile, Input, ListItem, Txt, fmtUnit, typeScale } from '@/design/primitives';
import { Avatar, Confirm, tabIcon, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { ERP_ROLE_MODULE, LIST_MODULE, ModuleTone, radius, size, space, textRoom } from '@/design/tokens';
import { tabsOptions } from '@/design/nav';
import { Appear, stagger } from '@/design/motion';
import { useSession } from '@/core/session';
import MapView, { Marker } from 'react-native-maps';
import { config } from '@/core/config';
import { erpAuth, type ErpFleetTruck, type ErpLiveTruck, type ErpRole } from '@/core/erp';
import { erpRoleConfig } from './roles';
import { useErpHome, useErpList, useErpNotifications } from './api';
import { CardFilters, FilterChips, HeroCard, ListRow, ROW_ICON, SectionHead, StatTile, listModule } from './ui';
import { RangeCalendar } from './range-calendar';
import { BarsChart, ColumnsChart, DonutChart, ProgressChart } from './charts';
import { pinStore } from '@/core/pin';
import { kv } from '@/core/storage';
import { Icon } from '@/design/icons';
import { setBadge } from '@/core/push';
import { Loader } from '@/design/loader';

/**
 * ERP bo'limlarining ekranlari — Insof ERP dizayn tizimi ustida.
 *
 * Tuzilma: sarlavha (bo'lim · ism) → bosh ko'rsatkich → yonma-yon kichik kartochkalar →
 * tezkor amallar to'ri → ro'yxat bo'limlari → pastki tab paneli.
 * Nima ko'rsatilishini server hal qiladi (`/api/mobile/home`), bu yerda faqat chizish.
 */

/** Rol → ikonka plitkalarining modul toni. */
const roleModule = (role: ErpRole): ModuleTone => ERP_ROLE_MODULE[role] ?? 'brand';

// ───────────────────────── Tablar ─────────────────────────

export function ErpTabs({ role }: { role: ErpRole }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cfg = erpRoleConfig(role);
  const create = useErpHome().data?.create ?? null;
  return (
    <Tabs screenOptions={tabsOptions(c, insets.bottom)}>
      <Tabs.Screen name="index" options={{ title: cfg.homeTitle, headerShown: false, tabBarIcon: tabIcon(cfg.homeIcon) }} />
      <Tabs.Screen
        name="work"
        options={{
          title: cfg.workTitle,
          tabBarIcon: tabIcon(cfg.workIcon),
          headerRight: create
            ? () => <IconButton icon="plus" label="Yangi" tone="brand" onPress={() => router.push(`/erp/new/${create.key}` as never)} style={{ marginRight: space.sm }} />
            : undefined,
        }}
      />
      {cfg.ai ? <Tabs.Screen name="ai" options={{ title: 'AI yordamchi', tabBarIcon: tabIcon('sparkles') }} /> : null}
      <Tabs.Screen name="menu" options={{ title: 'Profil', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}

// ───────────────────────── Bosh ekran ─────────────────────────

export function ErpHome() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const erp = useSession((s) => s.erp);
  // Karta filtrlari (Tushum: bugun / hafta / oy / yil) — server hisoblaydi, ilova faqat parametrni yuboradi
  const [params, setParams] = useState<Record<string, string>>({});
  const { data, isLoading, refetch, isRefetching, error, isPlaceholderData } = useErpHome(params);
  const [calOpen, setCalOpen] = useState(false);

  if (isLoading) return <Loader fill />;
  if (error || !data) return <Center><EmptyState title="Ma'lumot kelmadi" hint="Internetni tekshirib, pastga torting" /></Center>;

  const [hero, ...tiles] = data.cards;
  // Filtrli karta (direktorda — Tushum): filtr qatori ekranning eng tepasida
  const filtered = data.cards.find((x) => x.filters?.length && x.filterParam);
  const setFilter = (key: string) => {
    if (!filtered?.filterParam) return;
    const p = filtered.filterParam;
    setCalOpen(false);
    setParams((prev) => { const n = { ...prev, [p]: key }; delete n.from; delete n.to; return n; });
  };
  const applyRange = (from: string, to: string) => {
    if (!filtered?.filterParam) return;
    setCalOpen(false);
    setParams((prev) => ({ ...prev, [filtered.filterParam!]: 'custom', from, to }));
  };
  const role = data.role;
  const module = roleModule(role);
  /** Bo'lim qatorlari — ro'yxat kaliti o'z moduliga ega bo'lsa o'shaniki, bo'lmasa rolniki. */
  const rowModule = (target?: string): ModuleTone => (target && LIST_MODULE[target]) || module;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      {/* Sarlavha: bo'lim nomi, xodim ismi, o'ngda qo'ng'iroq va profil belgisi */}
      <View style={{ backgroundColor: c.bgChrome, borderBottomWidth: size.hairline, borderBottomColor: c.borderDefault, paddingTop: insets.top + space.md, paddingBottom: space.lg, paddingHorizontal: space.pageX, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Txt v="overline" color="brand">{data.roleLabel}</Txt>
          <Txt v="titleLg" numberOfLines={1}>{data.fullName}</Txt>
        </View>
        <NotificationsBell />
        <Pressable
          onPress={() => router.push(`/${erpRoleConfig(role).group}/menu` as never)}
          accessibilityRole="button" accessibilityLabel="Profil" hitSlop={space.xs}
          style={{ minWidth: size.touch, minHeight: size.touch, alignItems: 'center', justifyContent: 'center' }}
        >
          <Avatar name={data.fullName} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        {filtered ? (
          <View style={{ paddingTop: space.lg, gap: space.md }}>
            <View style={{ paddingHorizontal: space.pageX }}>
              <CardFilters card={filtered} onFilter={setFilter} onCalendar={() => setCalOpen((v) => !v)} calendarOpen={calOpen} />
            </View>
            {calOpen ? (
              <View style={{ paddingHorizontal: space.pageX }}>
                <RangeCalendar from={filtered.range?.from} to={filtered.range?.to} onApply={applyRange} onClose={() => setCalOpen(false)} />
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={{ paddingHorizontal: space.pageX, paddingTop: space.lg, gap: space.md }}>
          {hero ? <HeroCard card={hero} note={erp ? `Insof ERP · ${erp.login}` : undefined} module={module} busy={isPlaceholderData} /> : null}
          {tiles.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {tiles.map((t, i) => <StatTile key={t.key} card={t} index={i} module={module} />)}
            </View>
          ) : null}
        </View>

        {/* "Tezkor amallar" bosh ekrandan olib tashlandi — bo'limlar endi faqat Profil
            tabidagi "Bo'limlar" ro'yxatida turadi, bosh ekran esa faqat ko'rsatkichlarga bag'ishlangan. */}

        {/* Logistika: faol reyslar xaritada + mashinalar ro'yxati (qator bosilsa xarita shu mashinaga boradi).
            Boshqa rollar: faqat GPS'i bor mashinalar — kichik xarita. */}
        {data.fleet ? <FleetMap fleet={data.fleet} /> : data.live?.length ? <LiveTrucks trucks={data.live} /> : null}

        {data.sections.map((s) => (
          <View key={s.title} style={{ paddingHorizontal: space.pageX, paddingTop: space.xl }}>
            <SectionHead
              title={s.title}
              action={s.target && s.rows.length ? 'Barchasi' : undefined}
              onAction={() => s.target && router.push(`/erp/list/${s.target}` as never)}
            />
            {/* Diagrammali bo'lim (plan/fakt, oylar, davr savatlari, ulushlar) — qatorlar o'rniga grafik va raqamlar */}
            {s.chart?.kind === 'progress' ? <ProgressChart chart={s.chart} onOpen={(k) => router.push(`/erp/list/${k}` as never)} />
              : s.chart?.kind === 'columns' ? <ColumnsChart chart={s.chart} />
              : s.chart?.kind === 'bars' ? <BarsChart chart={s.chart} />
              : s.chart?.kind === 'donut' ? <DonutChart chart={s.chart} />
              : s.rows.length === 0 ? <SectionEmpty text={s.empty} /> : s.rows.map((r, i) => (
              <ListRow
                key={r.id}
                row={r}
                index={i}
                module={rowModule(s.target)}
                icon={s.icon ?? ROW_ICON[s.target ?? ''] ?? 'circle'}
                onPress={s.target ? () => router.push(`/erp/${s.target}/${r.id}` as never)
                  : r.open ? () => router.push(`/erp/list/${r.open}` as never) : undefined}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Bo'limda hujjat yo'q — ayblamaydigan qisqa matn, oq karta ichida. */
export function SectionEmpty({ text }: { text: string }) {
  return (
    <Card style={{ paddingVertical: space.xxl, alignItems: 'center' }}>
      <Txt v="bodySm" color="muted" align="center">{text}</Txt>
    </Card>
  );
}

/**
 * Qo'ng'iroq — o'qilmagan xabarlar soni bilan.
 *
 * Nega tab emas: 13 ta rol bo'limida 13 ta qo'shimcha tab kerak bo'lardi, holbuki
 * bildirishnoma kun bo'yi ochib turiladigan bo'lim emas — kelganda bosiladi.
 * Ilova ikonkasidagi raqam ham shu yerda tizim bilan moslanadi.
 */
function NotificationsBell() {
  const router = useRouter();
  const unread = useErpNotifications().data?.unread ?? 0;

  useEffect(() => { setBadge(unread); }, [unread]);

  return (
    <IconButton
      icon={unread > 0 ? 'bell-ring' : 'bell'}
      label="Bildirishnomalar"
      tone={unread > 0 ? 'brand' : 'muted'}
      badge={unread}
      onPress={() => router.push('/erp/bildirishnomalar' as never)}
    />
  );
}

// ───────────────────────── Yo'ldagi mashinalar ─────────────────────────

/**
 * Bosh ekrandagi jonli xarita: haydovchi qayerda va reys boshidan beri necha km yurdi.
 * Ma'lumot ERP'dan keladi (`/api/mobile/home` → `live`), ruxsat ham o'sha yerda hal bo'ladi —
 * sotuvchiga faqat o'zi ochgan zayavkalarning mashinalari ko'rinadi.
 */
function LiveTrucks({ trucks }: { trucks: ErpLiveTruck[] }) {
  const { c } = useTheme();
  const router = useRouter();

  // Barcha mashinani qamrab oladigan ko'rinish; bittada ham chetda qolmasin deb chekka + zaxira
  const lats = trucks.map((t) => t.lat), lngs = trucks.map((t) => t.lng);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(0.04, (Math.max(...lats) - Math.min(...lats)) * 1.6),
    longitudeDelta: Math.max(0.04, (Math.max(...lngs) - Math.min(...lngs)) * 1.6),
  };

  return (
    <View style={{ paddingHorizontal: space.pageX, paddingTop: space.xl }}>
      <SectionHead title={`Yo'lda · ${trucks.length} ta`} />
      {/* Kalitsiz Android'da xarita ilovani yiqitadi — bunday holda pastdagi ro'yxat qoladi,
          ya'ni ma'lumot yo'qolmaydi, faqat ko'rinish soddalashadi (`core/config.ts`). */}
      {config.mapsEnabled && (
      <View style={{ height: 190, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault, marginBottom: space.sm }}>
        {/* Scroll bilan urishmasin deb xarita ichida siljimaydi — tafsilot pastdagi qatordan ochiladi */}
        <MapView style={{ flex: 1 }} initialRegion={region} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}>
          {trucks.map((t) => (
            <Marker
              key={t.ref}
              coordinate={{ latitude: t.lat, longitude: t.lng }}
              title={`${t.plate} · ${t.km} km`}
              description={`${t.driver} → ${t.customer}`}
              pinColor={c.infoSolid}
            />
          ))}
        </MapView>
      </View>
      )}
      <Card style={{ paddingVertical: 0 }}>
        {trucks.map((t, i) => {
          const km = fmtUnit(t.km, 'km');
          return (
            <ListItem
              key={t.ref}
              icon="truck"
              module="logistics"
              title={`${t.plate} · ${t.driver}`}
              subtitle={`${t.customer} · ${t.status}${t.etaMin != null ? ` · ~${t.etaMin} daq` : ''}`}
              right={<Txt v="bodyStrong" numberOfLines={1} style={{ flexShrink: 0, minWidth: textRoom(km, typeScale.bodyStrong.fontSize) }}>{km}</Txt>}
              last={i === trucks.length - 1}
              onPress={t.tripId ? () => router.push(`/erp/trips/${t.tripId}` as never) : undefined}
            />
          );
        })}
      </Card>
    </View>
  );
}

// ───────────────────────── Logistika: faol reyslar xaritasi ─────────────────────────

const FLEET_MAP_HEIGHT = 300;
/** Tanlangan mashinaga yaqinlashish masshtabi (~1 km) */
const FOCUS_DELTA = 0.012;

/** "12 daq oldin" — GPS nuqtasining yoshi. */
function agoLabel(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return 'hozir';
  if (m < 60) return `${m} daq oldin`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} soat oldin` : `${Math.floor(h / 24)} kun oldin`;
}

/**
 * Logistika bosh ekrani: faol reyslar xaritada, ostida reysdagi mashinalar ro'yxati.
 * Qator bosilsa xarita o'sha mashinaga yaqinlashadi va belgisi ajratiladi; yana bosilsa
 * hamma mashina qaytadan ko'rinadi. GPS'siz reys ro'yxatda turadi ("GPS yo'q"), xaritada emas.
 * Ro'yxat ERP'dan keladi (`/api/mobile/home` → `fleet`, 30 s da bir yangilanadi).
 * Vebdagi logistika panelidagi blokning aynan o'zi — telefonda "o'ng tomon" pastga tushadi.
 */
function FleetMap({ fleet }: { fleet: ErpFleetTruck[] }) {
  const { c } = useTheme();
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const located = fleet.filter((t): t is ErpFleetTruck & { gps: NonNullable<ErpFleetTruck['gps']> } => !!t.gps);
  const coords = located.map((t) => ({ latitude: t.gps.lat, longitude: t.gps.lng }));

  const region = coords.length
    ? {
      latitude: (Math.min(...coords.map((p) => p.latitude)) + Math.max(...coords.map((p) => p.latitude))) / 2,
      longitude: (Math.min(...coords.map((p) => p.longitude)) + Math.max(...coords.map((p) => p.longitude))) / 2,
      latitudeDelta: Math.max(0.04, (Math.max(...coords.map((p) => p.latitude)) - Math.min(...coords.map((p) => p.latitude))) * 1.6),
      longitudeDelta: Math.max(0.04, (Math.max(...coords.map((p) => p.longitude)) - Math.min(...coords.map((p) => p.longitude))) * 1.6),
    }
    : null;

  const showAll = () => {
    if (coords.length > 1) mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: true });
    else if (coords[0]) mapRef.current?.animateToRegion({ latitude: coords[0].latitude, longitude: coords[0].longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 400);
  };

  const pick = (t: ErpFleetTruck) => {
    if (selected === t.ref) { setSelected(null); showAll(); return; }
    setSelected(t.ref);
    if (!t.gps) { toast.show(`${t.plate}: GPS yo'q — xaritada ko'rsatib bo'lmaydi`, 'warning'); return; }
    if (!config.mapsEnabled) { toast.show('Bu qurilmada xarita yo\'q', 'warning'); return; }
    mapRef.current?.animateToRegion({ latitude: t.gps.lat, longitude: t.gps.lng, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA }, 500);
  };

  const sel = selected ? fleet.find((t) => t.ref === selected) : null;

  return (
    <View style={{ paddingHorizontal: space.pageX, paddingTop: space.xl }}>
      <SectionHead
        title={`Faol reyslar · ${fleet.length} ta`}
        action={fleet.length ? 'Barchasi' : undefined}
        onAction={() => router.push('/erp/list/trips' as never)}
      />
      {/* Kalitsiz Android'da xarita ilovani yiqitadi — bunday holda ro'yxat qoladi (`core/config.ts`). */}
      {config.mapsEnabled && region ? (
        <View style={{ height: FLEET_MAP_HEIGHT, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault, marginBottom: space.sm }}>
          <MapView
            ref={(r) => { mapRef.current = r; }}
            style={{ flex: 1 }}
            initialRegion={region}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            onPress={() => { if (selected) { setSelected(null); showAll(); } }}
          >
            {located.map((t) => {
              const active = selected === t.ref;
              return (
                <Marker
                  key={t.ref}
                  coordinate={{ latitude: t.gps.lat, longitude: t.gps.lng }}
                  title={`${t.plate} · ${t.driver}`}
                  description={`${t.customer} · ${t.phase}${t.gps.etaMin != null ? ` · ~${t.gps.etaMin} daq` : ''}`}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => { setSelected(t.ref); mapRef.current?.animateToRegion({ latitude: t.gps.lat, longitude: t.gps.lng, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA }, 500); }}
                  zIndex={active ? 2 : 1}
                >
                  {/* Davlat raqami yozilgan plitka — vebdagi belgining o'zi; tanlangani brend rangda */}
                  <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: active ? c.brand : c.textStrong, borderWidth: size.ring, borderColor: c.bgSurface }}>
                    <Txt v="overline" style={{ color: active ? c.textOnBrand : c.bgSurface }} numberOfLines={1}>{t.plate}</Txt>
                  </View>
                </Marker>
              );
            })}
          </MapView>
          {/* Hamma mashinani qaytadan ko'rsatish — tanlov bor yoki xarita surilgan bo'lsa */}
          <View style={{ position: 'absolute', right: space.sm, bottom: space.sm }}>
            <IconButton icon="locate-fixed" label="Hamma mashinani ko'rsatish" variant="secondary" onPress={() => { setSelected(null); showAll(); }} />
          </View>
        </View>
      ) : (
        <Card style={{ marginBottom: space.sm, paddingVertical: space.xl, alignItems: 'center' }}>
          <Txt v="bodySm" color="muted" align="center">
            {fleet.length === 0 ? 'Faol reys yo\'q' : config.mapsEnabled ? 'Hozircha birorta haydovchidan GPS kelmayapti — haydovchi yo\'lga chiqsa mashina shu yerda ko\'rinadi' : 'Bu qurilmada xarita yo\'q — ro\'yxat pastda'}
          </Txt>
        </Card>
      )}

      {fleet.length ? (
        <Card style={{ paddingVertical: 0 }}>
          {fleet.map((t, i) => {
            const active = selected === t.ref;
            const gps = t.gps;
            const line2 = [
              t.phase,
              t.plannedAt ? `reja ${t.plannedAt}` : null,
              t.delay,
              gps ? `GPS ${agoLabel(gps.at)}${gps.etaMin != null ? ` · ~${gps.etaMin} daq` : ''}${gps.km != null ? ` · ${fmtUnit(gps.km, 'km')}` : ''}` : 'GPS yo\'q',
            ].filter(Boolean).join(' · ');
            return (
              <ListItem
                key={t.tripId}
                icon="truck"
                module="logistics"
                tone={t.openIssues ? 'danger' : undefined}
                title={`${t.plate} · ${t.driver}`}
                subtitle={`${t.customer} · ${t.address}\n${line2}`}
                subtitleLines={2}
                last={i === fleet.length - 1}
                onPress={() => pick(t)}
                chevron={false}
                style={active ? { backgroundColor: c.bgMuted } : undefined}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 0 }}>
                    <Badge label={t.delay && t.delayTone ? t.delay : gps ? 'GPS' : 'GPS yo\'q'} tone={t.delayTone ?? (gps ? 'success' : 'neutral')} icon={null} />
                    <IconButton icon="chevron-right" label={`${t.ref} kartochkasi`} tone="muted" onPress={() => router.push(`/erp/trips/${t.tripId}` as never)} />
                  </View>
                }
              />
            );
          })}
        </Card>
      ) : null}

      {sel ? (
        <Txt v="caption" color="muted" style={{ marginTop: space.sm }}>
          {sel.gps ? `Xaritada: ${sel.plate} · ${sel.ref}` : `${sel.plate} — GPS yo'q${sel.driverPhone ? ` · ${sel.driverPhone}` : ''}`}
        </Txt>
      ) : null}
    </View>
  );
}

// ───────────────────────── Ishchi ro'yxat ─────────────────────────

export function ErpList({ listKey }: { listKey: string }) {
  const { c } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  // Filtrlar bo'lsa (ishlab chiqarish "Zayavkalar"i) — tanlangani serverga yuboriladi
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data, isLoading, refetch, isRefetching, error } = useErpList(listKey, q.trim() || undefined, filter);
  const filters = data?.filters;
  const active = filters?.find((f) => f.active);
  const module = listModule(listKey);

  return (
    <ScrollView
      style={{ backgroundColor: c.bgApp }}
      contentContainerStyle={{ padding: space.pageX, paddingTop: space.lg, paddingBottom: space.xxxl }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
    >
      <Input
        value={q}
        onChangeText={setQ}
        placeholder="Qidirish…"
        left="search"
        right={q ? <IconButton icon="x" label="Tozalash" tone="muted" size={size.touch - space.sm} onPress={() => setQ('')} /> : null}
        autoCorrect={false}
        returnKeyType="search"
        containerStyle={{ marginBottom: 0 }}
      />
      {filters?.length ? (
        <>
          <Gap h={space.md} />
          <FilterChips filters={filters} onPick={setFilter} />
        </>
      ) : null}
      <Gap h={space.lg} />
      {isLoading ? <Loader />
        : error ? <EmptyState title="Ma'lumot kelmadi" hint="Pastga torting" />
        : !data || data.rows.length === 0 ? <EmptyState title="Hech narsa topilmadi" hint={q ? 'Boshqa so\'z bilan qidiring' : active ? `"${active.label}" bo\'yicha hujjat yo\'q` : undefined} />
        : data.rows.map((r, i) => (
          <ListRow key={r.id} row={r} index={i} module={module} icon={ROW_ICON[listKey] ?? 'circle'} onPress={() => router.push(`/erp/${listKey}/${r.id}` as never)} />
        ))}
    </ScrollView>
  );
}

// ───────────────────────── Profil ─────────────────────────

export function ErpMenu() {
  const { c } = useTheme();
  const router = useRouter();
  const { erp, signOut } = useSession();
  const cfg = erp ? erpRoleConfig(erp.role) : null;
  const module = roleModule(erp?.role ?? 'DIRECTOR');
  const [hasPin, setHasPin] = React.useState(false);
  // "Bo'limlar" ro'yxati standart yig'iq — ochiq/yopiqligi eslab qolinadi
  const [sectionsOpen, setSectionsOpenRaw] = useState(() => kv.getBoolean('erp.menu.sectionsOpen') ?? false);
  const setSectionsOpen = (f: (v: boolean) => boolean) => setSectionsOpenRaw((v) => { const n = f(v); kv.set('erp.menu.sectionsOpen', n); return n; });
  React.useEffect(() => { void pinStore.has().then(setHasPin); }, []);
  // Bo'limlar ro'yxati — bosh ekrandagi "Tezkor amallar" bilan bir manba (`/api/mobile/home`):
  // kompyuterdagi ERP menyusida ko'ringan har bir bo'lim shu yerda ham turadi.
  const quick = useErpHome().data?.quick ?? [];
  const lists = quick.filter((q) => q.kind === 'list');
  const forms = quick.filter((q) => q.kind === 'new');
  // Hisobni o'chirish (do'kon talabi): xodim hisobini direktor bergan — darhol o'chirilmaydi,
  // so'rov direktorga tushadi (Sozlamalar → Hisob so'rovlari), tasdiqlansa login yopiladi.
  const [delAsk, setDelAsk] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delPending, setDelPending] = useState<boolean | null>(null);
  useEffect(() => { erpAuth.deletionStatus().then((r) => setDelPending(r.pending)).catch(() => setDelPending(false)); }, []);
  const requestDeletion = async () => {
    setDelBusy(true);
    try {
      await erpAuth.requestDeletion();
      setDelAsk(false); setDelPending(true);
      toast.info("Direktor tasdiqlagach hisobingiz yopiladi.", "So'rov yuborildi");
    } catch (e) { toast.error((e as Error).message, 'Xato'); } finally { setDelBusy(false); }
  };
  const cancelDeletion = async () => {
    try { await erpAuth.cancelDeletion(); setDelPending(false); toast.success("So'rov qaytarib olindi"); }
    catch (e) { toast.error((e as Error).message, 'Xato'); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
    <ScrollView style={{ backgroundColor: c.bgApp }} contentContainerStyle={{ padding: space.pageX, paddingBottom: space.xxxl }}>
      <Appear>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Avatar name={erp?.fullName} size={size.avatarLg} />
          <View style={{ flex: 1 }}>
            <Txt v="overline" color="brand">{erp?.roleLabel}</Txt>
            <Txt v="titleMd" numberOfLines={1}>{erp?.fullName}</Txt>
            <Txt v="caption">{erp?.login}</Txt>
          </View>
        </Card>
      </Appear>

      <Appear delay={stagger(1)} style={{ marginTop: space.md }}>
        <Card style={{ flexDirection: 'row', gap: space.md }}>
          <IconTile icon="refresh-cw" module={module} size={size.iconTileSm} />
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong">{cfg?.label} bo&apos;limi</Txt>
            <Txt v="caption" style={{ marginTop: space.xs }}>
              Ekrandagi raqamlar kompyuterdagi ERP bilan bir xil — bevosita bog&apos;langan.
            </Txt>
          </View>
        </Card>
      </Appear>

      {lists.length || forms.length ? (
        <Appear delay={stagger(2)} style={{ marginTop: space.xl }}>
          {/* Bo'limlar — sarlavhadagi strelka bosilsa ochiladi, yana bosilsa yig'iladi */}
          <Pressable
            onPress={() => setSectionsOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: sectionsOpen }}
            accessibilityLabel={sectionsOpen ? "Bo'limlarni yashirish" : "Bo'limlarni ko'rsatish"} hitSlop={space.xs}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: size.touch, opacity: pressed ? 0.6 : 1 })}
          >
            <Txt v="titleSm">{`Bo'limlar · ${lists.length + forms.length}`}</Txt>
            <Icon name={sectionsOpen ? 'chevron-up' : 'chevron-down'} tone="brand" size={size.iconLg} />
          </Pressable>
          {sectionsOpen ? (
          <Card style={{ paddingVertical: 0 }}>
            {forms.map((q, i) => (
              <ListItem
                key={`new-${q.key}`} icon="plus" module={module}
                title={q.label} subtitle="Yangi hujjat"
                onPress={() => router.push(`/erp/new/${q.key}` as never)}
                last={i === forms.length - 1 && lists.length === 0}
              />
            ))}
            {lists.map((q, i) => (
              <ListItem
                key={`list-${q.key}`} icon={q.icon} module={listModule(q.key)}
                title={q.label}
                onPress={() => router.push(`/erp/list/${q.key}` as never)}
                last={i === lists.length - 1}
              />
            ))}
          </Card>
          ) : null}
        </Appear>
      ) : null}

      <Appear delay={stagger(3)} style={{ marginTop: space.xl }}>
        <SectionHead title="Xavfsizlik" />
        <Card style={{ paddingVertical: 0 }}>
          <ListItem
            icon="grid-3x3" module={module}
            title="PIN kod"
            subtitle={hasPin ? "Yoqilgan — o'chirish uchun bosing" : 'Ilovani ochishda tez kirish'}
            onPress={() => router.push(hasPin ? '/(auth)/pin?mode=off' : '/(auth)/pin')}
          />
          <ListItem
            icon="lock" module={module}
            title="Parolni o'zgartirish"
            subtitle="Boshqa qurilmalardagi seanslar yopiladi"
            onPress={() => router.push('/(auth)/change-password')}
            last
          />
        </Card>
      </Appear>

      <Appear delay={stagger(4)} style={{ marginTop: space.xl }}>
        <SectionHead title="Hisob" />
        <Card style={{ paddingVertical: 0 }}>
          {delPending ? (
            <ListItem icon="hourglass" tone="warning" title="Hisobni o'chirish so'ralgan" subtitle="Direktor tasdig'i kutilmoqda. Fikringiz o'zgarsa — bosing" onPress={() => void cancelDeletion()} last />
          ) : (
            <ListItem icon="user-x" tone="danger" title="Hisobni o'chirish" subtitle="So'rov direktorga boradi; tasdiqlansa login yopiladi" onPress={() => setDelAsk(true)} last />
          )}
        </Card>
      </Appear>

      <Appear delay={stagger(5)} style={{ marginTop: space.xl }}>
        <Button variant="secondary" icon="log-out" title="Chiqish" onPress={() => void signOut()} />
      </Appear>
    </ScrollView>
    <Confirm
      open={delAsk}
      onClose={() => setDelAsk(false)}
      onConfirm={() => void requestDeletion()}
      danger
      loading={delBusy}
      title="Hisobni o'chirish"
      confirmLabel="So'rov yuborish"
      message="Hisobingizni direktor bergan, shuning uchun so'rov unga boradi. Tasdiqlangach login yopiladi, ilova va kompyuterdagi seanslar tugaydi. Xodim kartangiz (HR) saqlanib qoladi."
    />
    </View>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
);

export { ListRow as RowItem };
