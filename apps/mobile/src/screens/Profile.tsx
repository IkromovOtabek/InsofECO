import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Txt } from '@/design/primitives';
import { Avatar } from '@/design/ui';
import { Appear, stagger } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { elevation, radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { avatarUri } from '@/features/auth/api';
import { LogoutButton } from '@/features/auth/logout';
import { DeleteAccountRow } from '@/features/auth/delete-account';
import { SetGroup, SetRow } from '@/components/set-row';

const ROLE = { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' } as const;

/** Demo `.t-over` — guruh ustidagi katta harfli yorliq. */
const Over = ({ children }: { children: string }) => (
  <Txt v="overline" accessibilityRole="header" style={{ marginTop: space.xs, marginLeft: space.xs }}>{children}</Txt>
);

/**
 * ECO profili — Sozlamalar bilan bir xil til: profil kartasi, guruhlar (`SetGroup`), pastda "Chiqish".
 * Bir nechta a'zolik bo'lsa — rol almashtirish guruhi. "Hisobni o'chirish" — `DeleteAccountRow` (DELETE /me).
 */
export function Profile({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const { c } = useTheme();
  const { user, active, selectMembership, selectAdmin } = useSession();
  const memberships = user?.memberships.filter((m) => m.isActive) ?? [];

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12, gap: space.tight }}>
        <Appear>
          <View style={[{ alignItems: 'center', gap: space.xs, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', paddingVertical: space.xxl, paddingHorizontal: space.card }, elevation(c).sh1]}>
            <Avatar name={user?.fullName} uri={avatarUri(user?.avatarUrl)} size={size.avatarLg + space.lg} tone="brand" />
            <Txt v="titleMd" align="center" style={{ marginTop: space.sm }}>{user?.fullName ?? user?.phone}</Txt>
            {active ? <Txt v="tSm" align="center">{`${ROLE[active.role]} · ${active.organization.name}`}</Txt> : null}
            {user?.fullName && user.phone ? <Txt v="tSm" align="center">{user.phone}</Txt> : null}
          </View>
        </Appear>

        {children}

        {memberships.length > 1 ? (
          <Appear delay={stagger(1)} style={{ gap: space.tight }}>
            <Over>Rolni almashtirish</Over>
            <SetGroup>
              {memberships.map((m) => (
                <SetRow
                  key={`${m.organization.id}:${m.role}`}
                  icon="arrow-left-right" module="brand"
                  title={ROLE[m.role]} subtitle={m.organization.name}
                  onPress={() => { selectMembership(m); router.replace('/'); }}
                />
              ))}
            </SetGroup>
          </Appear>
        ) : null}

        {/* Superadmin (server tasdiqlagan /me bayrog'i) — o'z bo'limiga tezkor qaytish */}
        {user?.isSuperAdmin ? (
          <Appear delay={stagger(1)} style={{ gap: space.tight }}>
            <Over>Superadmin</Over>
            <SetGroup>
              <SetRow icon="shield-check" module="brand" title="Superadmin" subtitle="Tizim holati va boshqaruv" onPress={() => { selectAdmin(); router.replace('/(superadmin)' as never); }} />
            </SetGroup>
          </Appear>
        ) : null}

        <Appear delay={stagger(2)} style={{ gap: space.tight }}>
          <Over>Ilova</Over>
          <SetGroup>
            <SetRow icon="settings" module="logistics" title="Sozlamalar" subtitle="Mavzu, palitra, bildirishnomalar" onPress={() => router.push('/settings')} />
            <SetRow icon="shield-check" module="warehouse" title="Xavfsizlik" subtitle="PIN kod va parol" onPress={() => router.push('/settings')} />
          </SetGroup>
        </Appear>

        <Appear delay={stagger(3)} style={{ gap: space.tight }}>
          <Over>Hisob</Over>
          <SetGroup>
            <DeleteAccountRow />
          </SetGroup>
        </Appear>

        <Appear delay={stagger(4)} style={{ marginTop: space.lg }}>
          <LogoutButton textColor={c.danger} />
        </Appear>
      </ScrollView>
    </Screen>
  );
}
