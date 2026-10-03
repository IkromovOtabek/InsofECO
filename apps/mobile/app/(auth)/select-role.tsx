import React, { useState } from 'react';
import { View } from 'react-native';
import { Badge, Card, IconTile, Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { ECO_ROLE_NAME, ModuleTone, RoleKey, radius, size, space } from '@/design/tokens';
import { Appear, PressScale, stagger } from '@/design/motion';
import { useSession } from '@/core/session';
import { authApi } from '@/features/auth/api';
import { ApiException } from '@/core/api';
import { AuthScreen, Callout, ErrorBox, GhostButton, InfoCard, PrimaryButton } from '@/features/auth/ui';

/**
 * Korxona va rol tanlash — bir nechta a'zolik bo'lsa yoki tasdiq kutilayotgan bo'lsa.
 * Katta rol kartasi: rangli ikonka plitkasi, rol nomi va shiori, korxona nomi — qaysi bo'limga
 * kirishi oldindan ko'rinadi. Tasdiq kutayotgan a'zolik — xira karta, "Kutilmoqda" nishoni bilan.
 */
const ROLE_ICON: Record<RoleKey, IconName> = { TADBIRKOR: 'briefcase', QURUVCHI: 'hard-hat', HAYDOVCHI: 'truck' };
const ROLE_MODULE: Record<RoleKey, ModuleTone> = { TADBIRKOR: 'brand', QURUVCHI: 'production', HAYDOVCHI: 'logistics' };

/** Rol kartasi — 56 px plitka + nom/shior + korxona; o'ngda doira ichida strelka. */
function RoleCard({ role, org, pending }: { role: RoleKey; org: string; pending?: boolean }) {
  const { c } = useTheme();
  const r = ECO_ROLE_NAME[role];
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.xl, opacity: pending ? 0.75 : 1 }}>
      <IconTile icon={ROLE_ICON[role]} module={ROLE_MODULE[role]} size={size.avatarLg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="titleMd" numberOfLines={1}>{r.name}</Txt>
        <Txt v="caption" color="muted" numberOfLines={2}>{r.tagline}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }}>
          <Icon name="building" size={size.iconSm - 2} tone="faint" />
          <Txt v="label" color="body" numberOfLines={1} style={{ flexShrink: 1 }}>{org}</Txt>
        </View>
      </View>
      {pending
        ? <Badge label="Kutilmoqda" tone="warning" icon="clock" />
        : (
          <View style={{ width: size.iconTileSm, height: size.iconTileSm, borderRadius: radius.pill, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevron-right" tone="brand" size={size.iconSm} />
          </View>
        )}
    </Card>
  );
}

export default function SelectRole() {
  const { user, selectMembership, signOut, setUser } = useSession();
  const list = user?.memberships ?? [];
  const active = list.filter((m) => m.isActive);
  const pending = list.filter((m) => !m.isActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  /** Telegram/SMS bilan kirgan yangi odam — mijoz sifatida darhol davom etadi. */
  const asCustomer = async () => {
    setBusy(true); setError(undefined);
    try {
      const u = await authApi.becomeCustomer();
      setUser(u);
      const m = u.memberships.find((x) => x.role === 'QURUVCHI' && x.isActive);
      if (m) selectMembership(m);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');
    } finally { setBusy(false); }
  };

  return (
    <AuthScreen back={false}>
      <Appear delay={40} style={{ marginTop: space.lg }}>
        <Txt v="overline" color="brand">{active.length ? `${active.length} ta hisob` : list.length ? 'Tasdiq kutilmoqda' : 'Xush kelibsiz'}</Txt>
        <Txt v="titleLg" style={{ marginTop: space.xs }}>{active.length ? 'Korxonani tanlang' : list.length ? 'Tasdiq kutilmoqda' : 'Qanday davom etasiz?'}</Txt>
        <Txt v="bodySm" color="muted" style={{ marginTop: space.sm }}>{user?.fullName ?? user?.phone}</Txt>
      </Appear>

      <View style={{ marginTop: space.xxl, gap: space.md }}>
        {active.map((m, i) => (
          <Appear key={`${m.organization.id}:${m.role}`} delay={80 + stagger(i, 60)}>
            <PressScale onPress={() => selectMembership(m)} scale={0.97} accessibilityRole="button" accessibilityLabel={`${ECO_ROLE_NAME[m.role].name}, ${m.organization.name}`}>
              <RoleCard role={m.role} org={m.organization.name} />
            </PressScale>
          </Appear>
        ))}

        {pending.map((m, i) => (
          <Appear key={`p:${m.organization.id}:${m.role}`} delay={80 + stagger(active.length + i, 60)}>
            <RoleCard role={m.role} org={m.organization.name} pending />
          </Appear>
        ))}
        {pending.length ? (
          <Appear delay={80 + stagger(list.length, 60)}>
            <Callout tone="warning" icon="clock">Tashkilot tadbirkori tasdiqlashini kuting. Tasdiqlangach shu yerda ochiladi — «Yangilash»ni bosing.</Callout>
          </Appear>
        ) : null}

        {list.length === 0 ? (
          <Appear delay={60} style={{ gap: space.md }}>
            <InfoCard icon="user-plus">
              Beton va temir-beton buyurtma qilmoqchimisiz? Mijoz sifatida davom eting. Haydovchi yoki tadbirkor bo&apos;lsangiz — tashkilotingiz sizni telefon raqamingiz orqali qo&apos;shadi.
            </InfoCard>
            <PrimaryButton title={busy ? 'Ochilmoqda…' : 'Mijoz sifatida davom etish'} onPress={() => void asCustomer()} loading={busy} />
            <ErrorBox text={error} />
          </Appear>
        ) : null}
      </View>

      <Appear delay={240} style={{ marginTop: 'auto', paddingTop: space.xxl, gap: space.md }}>
        <GhostButton title="Yangilash" icon="refresh-cw" onPress={() => authApi.me().then(setUser).catch(() => {})} />
        <GhostButton title="Chiqish" icon="log-out" onPress={() => void signOut()} />
      </Appear>
    </AuthScreen>
  );
}
