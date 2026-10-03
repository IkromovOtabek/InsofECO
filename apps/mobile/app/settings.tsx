import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Callout, Gap, ListGroup, ListItem, Txt } from '@/design/primitives';
import { SectionHead, SegmentedControl, Toggle } from '@/design/blocks';
import { Avatar, Icon } from '@/design/ui';
import { Appear, haptic, stagger } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { SchemePref, usePrefs } from '@/design/prefs';
import { PALETTE_NAMES, PaletteName, palettes, radius, shadow, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { pinStore } from '@/core/pin';
import { kv } from '@/core/storage';
import { avatarUri } from '@/features/auth/api';

/**
 * Sozlamalar — ko'rinish (mavzu + palitra), xavfsizlik, bildirishnomalar, til va yordam.
 * Mavzu va palitra `usePrefs` orqali butun ilovaga darhol qo'llanadi (MMKV'da saqlanadi).
 * Ekran ECO va ERP hisoblari uchun umumiy.
 */

/** App Store'dagi "Support URL" (docs/08-app-store-matnlari.md). */
const SUPPORT_URL = 'https://insof-erp.uz';

const SCHEMES: { key: SchemePref; label: string; icon: 'monitor' | 'sun' | 'moon' }[] = [
  { key: 'system', label: 'Tizim', icon: 'monitor' },
  { key: 'light', label: "Yorug'", icon: 'sun' },
  { key: 'dark', label: "Qorong'i", icon: 'moon' },
];

const PALETTE_HINT: Record<PaletteName, string> = {
  chizma: "Ko'k brend, marjon aksent",
  marjon: 'Marjon brend, firuza aksent',
};

/** Bildirishnoma turlari — tanlov shu telefonda saqlanadi (server filtri hali yo'q, matnda aytiladi). */
const NOTIF = [
  { key: 'notif.trips', icon: 'truck', title: 'Reys va yetkazish', hint: 'Reys biriktirildi, yuk yetib keldi' },
  { key: 'notif.payments', icon: 'wallet', title: "To'lovlar", hint: "To'lov qabul qilindi, qarzdorlik" },
  { key: 'notif.chat', icon: 'message-circle', title: 'Chat xabarlari', hint: 'Yangi xabar kelganda' },
] as const;

const ROLE = { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' } as const;

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
        shadow.card,
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
  const { dark } = useTheme();
  const scheme = usePrefs((s) => s.scheme);
  const palette = usePrefs((s) => s.palette);
  const setScheme = usePrefs((s) => s.setScheme);
  const setPalette = usePrefs((s) => s.setPalette);
  const { kind, user, active, erp } = useSession();

  const [hasPin, setHasPin] = useState<boolean | null>(null);
  // PIN ekranidan qaytganda holat yangilansin
  useFocusEffect(useCallback(() => { void pinStore.has().then(setHasPin); }, []));

  const [notif, setNotif] = useState<Record<string, boolean>>(() => Object.fromEntries(NOTIF.map((n) => [n.key, kv.getBoolean(n.key) ?? true])));
  const toggleNotif = (key: string, v: boolean) => { kv.set(key, v); setNotif((s) => ({ ...s, [key]: v })); };

  const name = (kind === 'erp' ? erp?.fullName : user?.fullName) ?? user?.phone ?? 'Foydalanuvchi';
  const sub = kind === 'erp'
    ? [erp?.roleLabel, erp?.login].filter(Boolean).join(' · ')
    : [active ? ROLE[active.role] : null, user?.phone].filter(Boolean).join(' · ');
  const avatar = kind === 'erp' ? null : avatarUri(user?.avatarUrl);
  const version = Constants.expoConfig?.version ?? '—';

  const pickPalette = (p: PaletteName) => { if (p === palette) return; haptic.selection(); setPalette(p); };

  return (
    <>
      <Stack.Screen options={{ title: 'Sozlamalar' }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12 }}>
        <Appear>
          <ListGroup>
            <ListItem
              leading={<Avatar name={name} uri={avatar} size={size.avatarLg} tone="brand" />}
              title={name}
              subtitle={sub || undefined}
              chevron={false}
            />
          </ListGroup>
        </Appear>

        <Appear delay={stagger(1)} style={{ marginTop: space.section }}>
          <SectionHead title="Ko'rinish" icon="sun-moon" />
          <Txt v="label" style={{ marginBottom: space.sm }}>Mavzu</Txt>
          <SegmentedControl items={SCHEMES} value={scheme} onChange={setScheme} />
          <Txt v="label" style={{ marginTop: space.lg, marginBottom: space.sm }}>Palitra</Txt>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space.md }}>
            {PALETTE_NAMES.map((p) => (
              <PaletteCard key={p.key} name={p.key} label={p.label} dark={dark} selected={palette === p.key} onPress={() => pickPalette(p.key)} />
            ))}
          </View>
        </Appear>

        <Appear delay={stagger(2)} style={{ marginTop: space.section }}>
          <SectionHead title="Xavfsizlik" icon="shield-check" />
          <ListGroup>
            <ListItem
              icon="grid-3x3" module="warehouse"
              title="PIN kod"
              subtitle={hasPin == null ? 'Tekshirilmoqda…' : hasPin ? "Yoqilgan — o'chirish uchun bosing" : 'Ilovani ochishda tez kirish'}
              right={hasPin == null ? null : <Txt v="label" color={hasPin ? 'success' : 'muted'}>{hasPin ? 'Yoqilgan' : "O'chiq"}</Txt>}
              onPress={() => router.push(hasPin ? '/(auth)/pin?mode=off' : '/(auth)/pin')}
            />
            <ListItem
              icon="lock" module="warehouse"
              title="Parolni o'zgartirish"
              subtitle="Boshqa qurilmalardagi seanslar yopiladi"
              onPress={() => router.push('/(auth)/change-password')}
            />
          </ListGroup>
        </Appear>

        <Appear delay={stagger(3)} style={{ marginTop: space.section }}>
          <SectionHead title="Bildirishnomalar" icon="bell" />
          <ListGroup>
            {NOTIF.map((n) => (
              <View key={n.key} style={{ paddingHorizontal: space.card }}>
                <Toggle label={n.title} hint={n.hint} value={!!notif[n.key]} onChange={(v) => toggleNotif(n.key, v)} />
              </View>
            ))}
            <ListItem icon="settings" module="logistics" title="Tizim sozlamalari" subtitle="Ovoz va ruxsatni telefon sozlamalarida o'zgartiring" onPress={() => void Linking.openSettings()} />
          </ListGroup>
          <Callout tone="neutral" icon="info" style={{ marginTop: space.md }}>
            Bu tanlov shu telefonda saqlanadi. Xabarlarni butunlay o&apos;chirish uchun tizim sozlamalaridan foydalaning.
          </Callout>
        </Appear>

        <Appear delay={stagger(4)} style={{ marginTop: space.section }}>
          <SectionHead title="Til" icon="languages" />
          <ListGroup>
            <ListItem
              icon="languages" module="logistics"
              title="O'zbekcha (lotin)"
              subtitle="Hozircha ilovaning yagona tili"
              right={<Icon name="check" size={size.iconMd} tone="brand" strokeWidth={2.25} />}
              chevron={false}
            />
          </ListGroup>
        </Appear>

        <Appear delay={stagger(5)} style={{ marginTop: space.section }}>
          <SectionHead title="Yordam" icon="circle-question-mark" />
          <ListGroup>
            <ListItem icon="circle-question-mark" title="Yordam markazi" subtitle="insof-erp.uz" onPress={() => void Linking.openURL(SUPPORT_URL)} />
            <ListItem icon="shield-check" title="Maxfiylik siyosati" subtitle="Ma'lumotlaringiz qanday saqlanadi" onPress={() => void Linking.openURL(`${SUPPORT_URL}/maxfiylik`)} />
          </ListGroup>
        </Appear>

        <Gap h={space.xl} />
        <Txt v="caption" color="faint" align="center">{`Insof · versiya ${version}`}</Txt>
      </ScrollView>
    </>
  );
}
