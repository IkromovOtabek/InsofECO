import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, EmptyState, Gap, IconButton, IconTile, Input, ListItem, Txt, fmtUnit, typeScale } from '@/design/primitives';
import { Avatar, tabIcon } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { ERP_ROLE_MODULE, LIST_MODULE, ModuleTone, radius, size, space, textRoom } from '@/design/tokens';
import { tabsOptions } from '@/design/nav';
import { Appear, stagger } from '@/design/motion';
import { useSession } from '@/core/session';
import MapView, { Marker } from 'react-native-maps';
import { config } from '@/core/config';
import type { ErpLiveTruck, ErpRole } from '@/core/erp';
import { erpRoleConfig } from './roles';
import { useErpHome, useErpList, useErpNotifications } from './api';
import { FilterChips, HeroCard, ListRow, QuickTile, ROW_ICON, SectionHead, StatTile, listModule } from './ui';
import { pinStore } from '@/core/pin';
import { setBadge } from '@/core/push';

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
  const { data, isLoading, refetch, isRefetching, error } = useErpHome();

  if (isLoading) return <Center><ActivityIndicator color={c.brand} /></Center>;
  if (error || !data) return <Center><EmptyState title="Ma'lumot kelmadi" hint="Internetni tekshirib, pastga torting" /></Center>;

  const [hero, ...tiles] = data.cards;
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
        <View style={{ paddingHorizontal: space.pageX, paddingTop: space.lg, gap: space.md }}>
          {hero ? <HeroCard card={hero} note={erp ? `Insof ERP · ${erp.login}` : undefined} module={module} /> : null}
          {tiles.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {tiles.map((t, i) => <StatTile key={t.key} card={t} index={i} module={module} />)}
            </View>
          ) : null}
        </View>

        {data.quick.length ? (
          <View style={{ paddingHorizontal: space.pageX, paddingTop: space.xl }}>
            <SectionHead title="Tezkor amallar" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {data.quick.map((q, i) => (
                <QuickTile
                  key={`${q.kind}-${q.key}`}
                  label={q.label}
                  icon={q.icon}
                  module={module}
                  index={i}
                  onPress={() => router.push((q.kind === 'new' ? `/erp/new/${q.key}` : `/erp/list/${q.key}`) as never)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {data.live?.length ? <LiveTrucks trucks={data.live} /> : null}

        {data.sections.map((s) => (
          <View key={s.title} style={{ paddingHorizontal: space.pageX, paddingTop: space.xl }}>
            <SectionHead
              title={s.title}
              action={s.target && s.rows.length ? 'Barchasi' : undefined}
              onAction={() => s.target && router.push(`/erp/list/${s.target}` as never)}
            />
            {s.rows.length === 0 ? <SectionEmpty text={s.empty} /> : s.rows.map((r, i) => (
              <ListRow
                key={r.id}
                row={r}
                index={i}
                module={rowModule(s.target)}
                icon={ROW_ICON[s.target ?? ''] ?? 'circle'}
                onPress={s.target ? () => router.push(`/erp/${s.target}/${r.id}` as never) : undefined}
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
      {isLoading ? <ActivityIndicator color={c.brand} />
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
  React.useEffect(() => { void pinStore.has().then(setHasPin); }, []);
  return (
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

      <Appear delay={stagger(2)} style={{ marginTop: space.xl }}>
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

      <Appear delay={stagger(3)} style={{ marginTop: space.xl }}>
        <Button variant="secondary" icon="log-out" title="Chiqish" onPress={() => void signOut()} />
      </Appear>
    </ScrollView>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
);

export { ListRow as RowItem };
