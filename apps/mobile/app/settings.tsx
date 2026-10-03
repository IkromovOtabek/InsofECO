import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Txt } from '@/design/primitives';
import { Toggle } from '@/design/blocks';
import { Avatar, Icon, SegmentTrack } from '@/design/ui';
import { Appear, haptic, stagger } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { SchemePref, usePrefs } from '@/design/prefs';
import { PALETTE_NAMES, PaletteName, elevation, palettes, radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { pinStore } from '@/core/pin';
import { kv } from '@/core/storage';
import { avatarUri } from '@/features/auth/api';
import { DeleteAccountRow } from '@/features/auth/delete-account';
import { SetGroup, SetRow } from '@/components/set-row';

/**
 * Sozlamalar — demo "Sozlamalar" (docs/redesign/shots/26): profil kartasi, Ilova (til, mavzu mini-segment),
 * Palitra, Xavfsizlik (PIN, parol), Bildirishnomalar (toggle), Yordam (+ "Hisobni o'chirish" — faqat ECO, API bor), versiya.
 * Mavzu va palitra `usePrefs` orqali butun ilovaga darhol qo'llanadi (MMKV'da saqlanadi). ECO va ERP uchun umumiy.
 * Face ID qatori yo'q: biometrik modul (expo-local-authentication) ilovada o'rnatilmagan.
 */

/** App Store'dagi "Support URL" (docs/08-app-store-matnlari.md). */
const SUPPORT_URL = 'https://insof-erp.uz';

const SCHEMES: { key: SchemePref; label: string }[] = [
  { key: 'system', label: 'Tizim' },
  { key: 'light', label: "Yorug'" },
  { key: 'dark', label: 'Tungi' },
];

const PALETTE_HINT: Record<PaletteName, string> = {
  chizma: "Ko'k brend, marjon aksent",
  marjon: 'Marjon brend, firuza aksent',
};

/** Bildirishnoma turlari — tanlov shu telefonda saqlanadi (server filtri hali yo'q, izohda aytiladi). */
const NOTIF = [
  { key: 'notif.trips', icon: 'truck', module: 'logistics', title: 'Reys xabarlari' },
  { key: 'notif.payments', icon: 'wallet', module: 'brand', title: "To'lov xabarlari" },
  { key: 'notif.chat', icon: 'message-circle', module: 'production', title: 'Chat' },
] as const;

const ROLE = { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' } as const;

/** Demo `.t-over` — guruh ustidagi katta harfli yorliq. */
const Over = ({ children }: { children: string }) => (
  <Txt v="overline" accessibilityRole="header" style={{ marginTop: space.xs, marginLeft: space.xs }}>{children}</Txt>
);

/** Palitra kartasi — shu palitraning joriy rejimdagi brend / to'q / aksent ranglaridan mini namuna. */
function PaletteCard({ name, label, selected, dark, onPress }: { name: PaletteName; label: string; selected: boolean; dark: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const p = palettes[name][dark ? 'dark' : 'light'];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} palitrasi`}
      style={({ pressed }) => [
        { flex: 1, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.md, borderWidth: size.ring, borderColor: selected ? c.brand : 'transparent' },
        elevation(c).sh1,
        pressed && { opacity: 0.85 },
      ]}
    >
      {/* Mini ekran: palitra foni ustida to'q "hero" plashka, brend tugma va aksent nuqta */}
      <View style={{ backgroundColor: p.bgApp, borderRadius: radius.sm, padding: space.sm, gap: space.sm }}>
        <View style={{ backgroundColor: p.bgInverse, borderRadius: radius.xs, height: space.x10, padding: space.sm, justifyContent: 'space-between' }}>
          <View style={{ width: space.xxl, height: space.xs, borderRadius: radius.pill, backgroundColor: p.accent }} />
          <View style={{ width: space.x10, height: space.sm, borderRadius: radius.pill, backgroundColor: p.textOnInverse }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1, height: space.lg, borderRadius: radius.pill, backgroundColor: p.brand }} />
          <View style={{ width: space.lg, height: space.lg, borderRadius: radius.pill, backgroundColor: p.accent }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong" numberOfLines={1}>{label}</Txt>
          <Txt v="caption" numberOfLines={2}>{PALETTE_HINT[name]}</Txt>
        </View>
        <View style={{ width: size.iconLg, height: size.iconLg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.brand : 'transparent', borderWidth: selected ? 0 : size.ring, borderColor: c.borderStrong }}>
          {selected ? <Icon name="check" size={size.iconSm} tone="onBrand" strokeWidth={2.5} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { c, dark } = useTheme();
  const scheme = usePrefs((s) => s.scheme);
  const palette = usePrefs((s) => s.palette);
  const setScheme = usePrefs((s) => s.setScheme);
  const setPalette = usePrefs((s) => s.setPalette);
  const { status, kind, user, active, erp } = useSession();
  // Mehmon (do'kon profilidan) — faqat ko'rinish, bildirishnoma, til va yordam; hisob/PIN/parol yo'q
  const authed = status === 'authed';

  const [hasPin, setHasPin] = useState<boolean | null>(null);
  // PIN ekranidan qaytganda holat yangilansin
  useFocusEffect(useCallback(() => { if (authed) void pinStore.has().then(setHasPin); }, [authed]));

  const [notif, setNotif] = useState<Record<string, boolean>>(() => Object.fromEntries(NOTIF.map((n) => [n.key, kv.getBoolean(n.key) ?? true])));
  const toggleNotif = (key: string, v: boolean) => { kv.set(key, v); setNotif((s) => ({ ...s, [key]: v })); };

  const name = (kind === 'erp' ? erp?.fullName : user?.fullName) ?? user?.phone ?? 'Foydalanuvchi';
  const sub = kind === 'erp'
    ? [erp?.roleLabel, erp?.login].filter(Boolean).join(' · ')
    : [active ? ROLE[active.role] : null, user?.phone].filter(Boolean).join(' · ');
  const avatar = kind === 'erp' ? null : avatarUri(user?.avatarUrl);
  const version = Constants.expoConfig?.version;

  const pickPalette = (p: PaletteName) => { if (p === palette) return; haptic.selection(); setPalette(p); };

  return (
    <>
      <Stack.Screen options={{ title: 'Sozlamalar' }} />
      <ScrollView style={{ backgroundColor: c.bgApp }} contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12, gap: space.tight }}>
        {authed ? (
          <Appear>
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md + 2, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md + 2 }, elevation(c).sh1]}>
              <Avatar name={name} uri={avatar} size={size.avatarLg} tone="brand" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt v="listTitle" numberOfLines={1}>{name}</Txt>
                {sub ? <Txt v="tSm" numberOfLines={1}>{sub}</Txt> : null}
              </View>
            </View>
          </Appear>
        ) : null}

        <Appear delay={stagger(1)} style={{ gap: space.tight }}>
          <Over>Ilova</Over>
          <SetGroup>
            {/* Hozircha ilovaning yagona tili — tanlov yo'q, shuning uchun bosilmaydi */}
            <SetRow icon="languages" module="logistics" title="Til" value="O'zbekcha" />
            {/* Tanlagich sarlavha ostida, to'liq kenglikda — yonida tursa "Mavzu" yozuvini siqib qo'yardi */}
            <View style={{ paddingBottom: space.md }}>
              <SetRow icon="moon" module="production" title="Mavzu" />
              <View style={{ paddingHorizontal: space.card }}>
                <SegmentTrack<SchemePref> items={SCHEMES} value={scheme} onChange={setScheme} compact />
              </View>
            </View>
          </SetGroup>
        </Appear>

        <Appear delay={stagger(2)} style={{ gap: space.tight }}>
          <Over>Palitra</Over>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space.md }}>
            {PALETTE_NAMES.map((p) => (
              <PaletteCard key={p.key} name={p.key} label={p.label} dark={dark} selected={palette === p.key} onPress={() => pickPalette(p.key)} />
            ))}
          </View>
        </Appear>

        {authed ? (
          <Appear delay={stagger(3)} style={{ gap: space.tight }}>
            <Over>Xavfsizlik</Over>
            <SetGroup>
              <SetRow
                icon="lock" module="warehouse" title="PIN kod"
                value={hasPin == null ? undefined : hasPin ? 'Yoqilgan' : "O'chiq"}
                chevron={false}
                onPress={() => router.push(hasPin ? '/(auth)/pin?mode=off' : '/(auth)/pin')}
              />
              <SetRow icon="key-round" module="brand" title="Parolni o'zgartirish" onPress={() => router.push('/(auth)/change-password')} />
            </SetGroup>
          </Appear>
        ) : null}

        <Appear delay={stagger(4)} style={{ gap: space.tight }}>
          <Over>Bildirishnomalar</Over>
          <SetGroup>
            {NOTIF.map((n) => (
              <SetRow
                key={n.key} icon={n.icon} module={n.module} title={n.title}
                right={<Toggle value={!!notif[n.key]} onChange={(v) => toggleNotif(n.key, v)} />}
              />
            ))}
            <SetRow icon="settings" module="logistics" title="Tizim sozlamalari" onPress={() => void Linking.openSettings()} />
          </SetGroup>
          <Txt v="caption" style={{ marginHorizontal: space.xs }}>Tanlov shu telefonda saqlanadi. Ovoz va ruxsat — telefon sozlamalarida.</Txt>
        </Appear>

        <Appear delay={stagger(5)} style={{ gap: space.tight }}>
          <Over>Yordam</Over>
          <SetGroup>
            <SetRow icon="circle-question-mark" module="brand" title="Yordam markazi" value="insof-erp.uz" onPress={() => void Linking.openURL(SUPPORT_URL)} />
            <SetRow icon="shield-check" module="brand" title="Maxfiylik siyosati" onPress={() => void Linking.openURL(`${SUPPORT_URL}/maxfiylik`)} />
            {authed && kind === 'eco' ? <DeleteAccountRow /> : null}
          </SetGroup>
        </Appear>

        {version ? <Txt v="tSm" align="center" style={{ marginTop: space.xs }}>{`Versiya ${version}`}</Txt> : null}
      </ScrollView>
    </>
  );
}
