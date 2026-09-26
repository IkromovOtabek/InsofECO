import React from 'react';
import { View } from 'react-native';
import { Card, IconTile, Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/icons';
import { ECO_ROLE_NAME, RoleKey, space } from '@/design/tokens';
import { Appear, PressScale, stagger } from '@/design/motion';
import { useSession } from '@/core/session';
import { authApi } from '@/features/auth/api';
import { AuthScreen, Callout, GhostButton, InfoCard } from '@/features/auth/ui';

/**
 * Korxona va rol tanlash — bir nechta a'zolik bo'lsa yoki tasdiq kutilayotgan bo'lsa.
 * Har karta rol ikonkasi bilan: qaysi bo'limga kirishi oldindan ko'rinadi.
 */
const ROLE_ICON: Record<RoleKey, IconName> = { TADBIRKOR: 'briefcase', QURUVCHI: 'hard-hat', HAYDOVCHI: 'truck' };

export default function SelectRole() {
  const { user, selectMembership, signOut, setUser } = useSession();
  const list = user?.memberships ?? [];
  const active = list.filter((m) => m.isActive);
  const pending = list.filter((m) => !m.isActive);

  return (
    <AuthScreen back={false}>
      <Appear delay={40} style={{ marginTop: space.lg }}>
        <Txt v="overline" color="brand">{active.length ? `${active.length} ta hisob` : 'Tasdiq kutilmoqda'}</Txt>
        <Txt v="titleLg" style={{ marginTop: space.xs }}>{active.length ? 'Korxonani tanlang' : 'Tasdiq kutilmoqda'}</Txt>
        <Txt v="bodySm" color="muted" style={{ marginTop: space.sm }}>{user?.fullName ?? user?.phone}</Txt>
      </Appear>

      <View style={{ marginTop: space.xxl, gap: space.md }}>
        {active.map((m, i) => {
          const role = ECO_ROLE_NAME[m.role];
          return (
            <Appear key={`${m.organization.id}:${m.role}`} delay={stagger(i, 60)}>
              <PressScale onPress={() => selectMembership(m)} haptic={false} accessibilityRole="button" accessibilityLabel={`${role.name}, ${m.organization.name}`}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <IconTile icon={ROLE_ICON[m.role]} module="brand" />
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong">{role.name}</Txt>
                    <Txt v="caption" numberOfLines={1}>{m.organization.name}</Txt>
                  </View>
                  <Icon name="chevron-right" tone="faint" />
                </Card>
              </PressScale>
            </Appear>
          );
        })}

        {pending.map((m, i) => (
          <Appear key={`p:${m.organization.id}:${m.role}`} delay={stagger(active.length + i, 60)}>
            <Callout tone="warning" icon="clock">
              {`${ECO_ROLE_NAME[m.role].name} · ${m.organization.name} — tashkilot tadbirkori tasdiqlashini kuting. Tasdiqlangach shu yerda ochiladi.`}
            </Callout>
          </Appear>
        ))}

        {list.length === 0 ? (
          <Appear delay={60}>
            <InfoCard icon="user-plus">
              Sizga hali rol biriktirilmagan. Tadbirkor sizni telefon raqamingiz orqali qo&apos;shishi kerak.
            </InfoCard>
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
