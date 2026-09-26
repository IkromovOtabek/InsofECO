import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Field, Gap, Txt } from '@/design/primitives';
import { Avatar, Icon, IconName, tabIcon } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { erpText, erpTint } from '@/design/tokens';
import { Appear, PressScale, stagger } from '@/design/motion';
import { useSession } from '@/core/session';
import MapView, { Marker } from 'react-native-maps';
import { config } from '@/core/config';
import type { ErpLiveTruck, ErpRole } from '@/core/erp';
import { erpRoleConfig } from './roles';
import { useErpHome, useErpList, useErpNotifications } from './api';
import { FilterChips, HeroCard, ListRow, ROW_ICON, SectionHead, StatTile } from './ui';
import { pinStore } from '@/core/pin';
import { setBadge } from '@/core/push';

/**
 * ERP bo'limlarining ekranlari — "ERP Mobil" maketi bo'yicha.
 *
 * Tuzilma: oq sarlavha (bo'lim · ism) → qora siyoh bosh ko'rsatkich → yonma-yon
 * kichik kartochkalar → tezkor amallar to'ri → ro'yxat bo'limlari → pastki tab paneli.
 * Nima ko'rsatilishini server hal qiladi (`/api/mobile/home`), bu yerda faqat chizish.
 */

// ───────────────────────── Tablar ─────────────────────────

export function ErpTabs({ role }: { role: ErpRole }) {
  const { c } = useTheme();
  const router = useRouter();
  const cfg = erpRoleConfig(role);
  const ios = Platform.OS === 'ios';
  const create = useErpHome().data?.create ?? null;
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: c.brandPrimary, tabBarInactiveTintColor: '#98A2AF',
      tabBarStyle: { backgroundColor: c.bgSurface, borderTopWidth: 1, borderTopColor: c.border, height: ios ? 84 : 66, paddingBottom: ios ? 24 : 10, paddingTop: 9 },
      // 384 dp li telefonda uchta tab yonma-yon sig'maydi: yozuv kichikroq va
      // tizim shrift kattalashtirishiga ergashmaydi, aks holda "Reyslarim" qirqiladi
      tabBarLabelStyle: { ...erpText.tab, fontSize: 9.5 },
      tabBarAllowFontScaling: false,
      tabBarItemStyle: { paddingHorizontal: 2 },
      headerStyle: { backgroundColor: c.bgSurface }, headerShadowVisible: false, headerTintColor: c.textPrimary,
      headerTitleAlign: 'center', headerTitleStyle: { fontFamily: erpText.title.fontFamily, fontSize: 17 },
      sceneStyle: { backgroundColor: c.bgCanvas },
    }}>
      <Tabs.Screen name="index" options={{ title: cfg.homeTitle, headerShown: false, tabBarIcon: tabIcon(cfg.homeIcon, cfg.homeIconActive) }} />
      <Tabs.Screen
        name="work"
        options={{
          title: cfg.workTitle,
          tabBarIcon: tabIcon(cfg.workIcon, cfg.workIconActive),
          headerRight: create
            ? () => (
              <Pressable onPress={() => router.push(`/erp/new/${create.key}` as never)} hitSlop={12} style={{ paddingHorizontal: 16 }}>
                <Icon name="add" size={24} color={c.brandPrimary} />
              </Pressable>
            )
            : undefined,
        }}
      />
      <Tabs.Screen name="menu" options={{ title: 'Profil', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
  );
}

// ───────────────────────── Bosh ekran ─────────────────────────

export function ErpHome() {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const erp = useSession((s) => s.erp);
  const { data, isLoading, refetch, isRefetching, error } = useErpHome();

  if (isLoading) return <Center><ActivityIndicator color={c.brandPrimary} /></Center>;
  if (error || !data) return <Center><EmptyState title="Ma'lumot kelmadi" hint="Internetni tekshirib, pastga torting" /></Center>;

  const [hero, ...tiles] = data.cards;
  const role = data.role;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgCanvas }}>
      {/* Sarlavha: bo'lim nomi, xodim ismi, o'ngda profil belgisi */}
      <View style={{ backgroundColor: c.bgSurface, borderBottomWidth: 1, borderBottomColor: c.border, paddingTop: insets.top + 12, paddingBottom: 15, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt style={{ ...erpText.eyebrow, color: c.brandPrimary }}>{data.roleLabel}</Txt>
          <Txt style={{ ...erpText.title, color: c.textPrimary, marginTop: 2 }} numberOfLines={1}>{data.fullName}</Txt>
        </View>
        <NotificationsBell />
        <Pressable onPress={() => router.push(`/${erpRoleConfig(role).group}/menu` as never)} hitSlop={8}>
          <Avatar name={data.fullName} size={44} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 26 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brandPrimary} />}
      >
        <View style={{ paddingHorizontal: 18, paddingTop: 16, gap: 10 }}>
          {hero ? <HeroCard card={hero} note={erp ? `Insof ERP · ${erp.login}` : undefined} /> : null}
          {tiles.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {tiles.map((t, i) => <StatTile key={t.key} card={t} index={i} />)}
            </View>
          ) : null}
        </View>

        {data.quick.length ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>
            <SectionHead title="Tezkor amallar" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
              {data.quick.map((q, i) => (
                <Appear key={`${q.kind}-${q.key}`} delay={stagger(i, 50)} style={{ flexGrow: 0, flexBasis: '31.5%' }}>
                  <PressScale
                    haptic={false}
                    onPress={() => router.push((q.kind === 'new' ? `/erp/new/${q.key}` : `/erp/list/${q.key}`) as never)}
                  >
                    <View style={{ minHeight: 88, backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 10, paddingTop: 11, paddingBottom: 12, justifyContent: 'space-between' }}>
                      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: erpTint(role, dark), alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={q.icon as IconName} size={16} color={c.brandPrimary} />
                      </View>
                      <Txt style={{ ...erpText.label, color: c.textPrimary, lineHeight: 15 }} numberOfLines={2}>{q.label}</Txt>
                    </View>
                  </PressScale>
                </Appear>
              ))}
            </View>
          </View>
        ) : null}

        {data.live?.length ? <LiveTrucks trucks={data.live} /> : null}

        {data.sections.map((s) => (
          <View key={s.title} style={{ paddingHorizontal: 18, paddingTop: 20 }}>
            <SectionHead
              title={s.title}
              action={s.target && s.rows.length ? 'Barchasi' : undefined}
              onAction={() => s.target && router.push(`/erp/list/${s.target}` as never)}
            />
            {s.rows.length === 0 ? (
              <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 24, alignItems: 'center' }}>
                <Txt style={{ fontSize: 13, color: c.textSecondary }}>{s.empty}</Txt>
              </View>
            ) : s.rows.map((r, i) => (
              <ListRow
                key={r.id}
                row={r}
                index={i}
                role={role}
                icon={ROW_ICON[s.target ?? ''] ?? 'ellipse-outline'}
                onPress={s.target ? () => router.push(`/erp/${s.target}/${r.id}` as never) : undefined}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
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
  const { c } = useTheme();
  const router = useRouter();
  const unread = useErpNotifications().data?.unread ?? 0;

  useEffect(() => { setBadge(unread); }, [unread]);

  return (
    <Pressable onPress={() => router.push('/erp/bildirishnomalar' as never)} hitSlop={10} style={{ paddingHorizontal: 4 }}>
      <Icon name={unread > 0 ? 'notifications' : 'notifications-outline'} size={24} color={unread > 0 ? c.brandPrimary : c.textSecondary} />
      {unread > 0 ? (
        <View style={{
          position: 'absolute', top: -5, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
          backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bgSurface,
        }}>
          <Txt style={{ ...erpText.chip, color: '#FFFFFF' }}>{unread > 99 ? '99+' : unread}</Txt>
        </View>
      ) : null}
    </Pressable>
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
    <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>
      <SectionHead title={`Yo'lda · ${trucks.length} ta`} />
      {/* Kalitsiz Android'da xarita ilovani yiqitadi — bunday holda pastdagi ro'yxat qoladi,
          ya'ni ma'lumot yo'qolmaydi, faqat ko'rinish soddalashadi (`core/config.ts`). */}
      {config.mapsEnabled && (
      <View style={{ height: 190, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
        {/* Scroll bilan urishmasin deb xarita ichida siljimaydi — tafsilot pastdagi qatordan ochiladi */}
        <MapView style={{ flex: 1 }} initialRegion={region} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}>
          {trucks.map((t) => (
            <Marker
              key={t.ref}
              coordinate={{ latitude: t.lat, longitude: t.lng }}
              title={`${t.plate} · ${t.km} km`}
              description={`${t.driver} → ${t.customer}`}
              pinColor={c.info}
            />
          ))}
        </MapView>
      </View>
      )}
      {trucks.map((t) => (
        <PressScale key={t.ref} haptic={false} onPress={t.tripId ? () => router.push(`/erp/trips/${t.tripId}` as never) : undefined}>
          <View style={{ marginTop: 8, backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="bus" size={16} color={c.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Txt style={{ ...erpText.label, color: c.textPrimary }} numberOfLines={1}>{t.plate} · {t.driver}</Txt>
              <Txt style={{ fontSize: 12, color: c.textSecondary }} numberOfLines={1}>
                {t.customer} · {t.status}{t.etaMin != null ? ` · ~${t.etaMin} daq` : ''}
              </Txt>
            </View>
            <Txt style={{ ...erpText.label, color: c.textPrimary }}>{t.km} km</Txt>
          </View>
        </PressScale>
      ))}
    </View>
  );
}

// ───────────────────────── Ishchi ro'yxat ─────────────────────────

export function ErpList({ listKey }: { listKey: string }) {
  const { c } = useTheme();
  const router = useRouter();
  const role = useSession((s) => s.erp?.role ?? 'DIRECTOR');
  const [q, setQ] = useState('');
  // Filtrlar bo'lsa (ishlab chiqarish "Zayavkalar"i) — tanlangani serverga yuboriladi
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data, isLoading, refetch, isRefetching, error } = useErpList(listKey, q.trim() || undefined, filter);
  const filters = data?.filters;
  const active = filters?.find((f) => f.active);

  return (
    <ScrollView
      style={{ backgroundColor: c.bgCanvas }}
      contentContainerStyle={{ padding: 18, paddingTop: 14, paddingBottom: 30 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brandPrimary} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 13 }}>
        <Icon name="search" size={17} color={c.textSecondary} />
        <Field value={q} onChangeText={setQ} placeholder="Qidirish…" autoCorrect={false} returnKeyType="search" style={{ flex: 1, borderWidth: 0, height: 44, backgroundColor: 'transparent', paddingHorizontal: 0 }} />
        {q ? <Pressable onPress={() => setQ('')} hitSlop={10}><Icon name="close-circle" size={17} color={c.textSecondary} /></Pressable> : null}
      </View>
      {filters?.length ? (
        <>
          <Gap h={12} />
          <FilterChips filters={filters} onPick={setFilter} />
        </>
      ) : null}
      <Gap h={14} />
      {isLoading ? <ActivityIndicator color={c.brandPrimary} />
        : error ? <EmptyState title="Ma'lumot kelmadi" hint="Pastga torting" />
        : !data || data.rows.length === 0 ? <EmptyState title="Hech narsa topilmadi" hint={q ? 'Boshqa so\'z bilan qidiring' : active ? `"${active.label}" bo\'yicha hujjat yo\'q` : undefined} />
        : data.rows.map((r, i) => (
          <ListRow key={r.id} row={r} index={i} role={role} icon={ROW_ICON[listKey] ?? 'ellipse-outline'} onPress={() => router.push(`/erp/${listKey}/${r.id}` as never)} />
        ))}
    </ScrollView>
  );
}

// ───────────────────────── Profil ─────────────────────────

export function ErpMenu() {
  const { c, dark } = useTheme();
  const router = useRouter();
  const { erp, signOut } = useSession();
  const cfg = erp ? erpRoleConfig(erp.role) : null;
  const [hasPin, setHasPin] = React.useState(false);
  React.useEffect(() => { void pinStore.has().then(setHasPin); }, []);
  return (
    <ScrollView style={{ backgroundColor: c.bgCanvas }} contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
      <Appear>
        <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={erp?.fullName} size={54} />
          <View style={{ flex: 1 }}>
            <Txt style={{ ...erpText.eyebrow, color: c.brandPrimary }}>{erp?.roleLabel}</Txt>
            <Txt style={{ ...erpText.title, color: c.textPrimary, marginTop: 2 }} numberOfLines={1}>{erp?.fullName}</Txt>
            <Txt style={{ ...erpText.meta, color: c.textSecondary, marginTop: 3 }}>{erp?.login}</Txt>
          </View>
        </View>
      </Appear>

      <Appear delay={70} style={{ marginTop: 12 }}>
        <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 11 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: erpTint(erp?.role ?? 'DIRECTOR', dark), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sync" size={16} color={c.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt style={{ ...erpText.rowTitle, color: c.textPrimary }}>{cfg?.label} bo&apos;limi</Txt>
            <Txt style={{ fontSize: 12, lineHeight: 17, color: c.textSecondary, marginTop: 4 }}>
              Ekrandagi raqamlar kompyuterdagi ERP bilan bir xil — bevosita bog&apos;langan.
            </Txt>
          </View>
        </View>
      </Appear>

      <Appear delay={110} style={{ marginTop: 20 }}>
        <SectionHead title="Xavfsizlik" />
        <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, overflow: 'hidden' }}>
          <PressScale haptic={false} onPress={() => router.push(hasPin ? '/(auth)/pin?mode=off' : '/(auth)/pin')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: erpTint(erp?.role ?? 'DIRECTOR', dark), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="keypad-outline" size={17} color={c.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={{ ...erpText.rowTitle, color: c.textPrimary }}>PIN kod</Txt>
                <Txt style={{ fontSize: 11.5, color: c.textSecondary, marginTop: 2 }}>
                  {hasPin ? "Yoqilgan — o'chirish uchun bosing" : 'Ilovani ochishda tez kirish'}
                </Txt>
              </View>
              <Icon name="chevron-forward" size={17} color={c.textSecondary} />
            </View>
          </PressScale>
          <PressScale haptic={false} onPress={() => router.push('/(auth)/change-password')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: erpTint(erp?.role ?? 'DIRECTOR', dark), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="lock-closed-outline" size={17} color={c.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={{ ...erpText.rowTitle, color: c.textPrimary }}>Parolni o&apos;zgartirish</Txt>
                <Txt style={{ fontSize: 11.5, color: c.textSecondary, marginTop: 2 }}>Boshqa qurilmalardagi seanslar yopiladi</Txt>
              </View>
              <Icon name="chevron-forward" size={17} color={c.textSecondary} />
            </View>
          </PressScale>
        </View>
      </Appear>

      <Appear delay={180} style={{ marginTop: 20 }}>
        <PressScale onPress={() => void signOut()}>
          <View style={{ height: 52, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgSurface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <Icon name="log-out-outline" size={18} color={c.danger} />
            <Txt style={{ ...erpText.rowTitle, color: c.danger }}>Chiqish</Txt>
          </View>
        </PressScale>
      </Appear>
    </ScrollView>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
);

export { ListRow as RowItem };
