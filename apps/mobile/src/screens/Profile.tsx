import React from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Gap, ListItem, Screen, Txt } from '@/design/primitives';
import { Avatar } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { authApi } from '@/features/auth/api';

const ROLE = { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' } as const;

export function Profile({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const { user, active, selectMembership, signOut } = useSession();
  const memberships = user?.memberships.filter((m) => m.isActive) ?? [];
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }}>
        <Card style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Avatar name={user?.fullName} size={size.avatarLg + space.lg} />
          <Gap h={space.md} />
          <Txt v="titleMd">{user?.fullName ?? user?.phone}</Txt>
          <Txt v="body" color="muted">{active ? `${ROLE[active.role]} · ${active.organization.name}` : ''}</Txt>
          <Txt v="caption" mono style={{ marginTop: space.xs }}>{user?.phone}</Txt>
        </Card>
        {children}
        {memberships.length > 1 ? (
          <>
            <Gap />
            <Card style={{ paddingVertical: space.xs }}>
              {memberships.map((m, i, arr) => <ListItem key={`${m.organization.id}:${m.role}`} icon="arrow-left-right" title={ROLE[m.role]} subtitle={m.organization.name} onPress={() => { selectMembership(m); router.replace('/'); }} last={i === arr.length - 1} />)}
            </Card>
          </>
        ) : null}
        <Gap />
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem icon="languages" title="Til" subtitle="O'zbek (lotin)" />
          <ListItem icon="shield-check" title="Xavfsizlik" subtitle="Parolni o'zgartirish" />
          <ListItem icon="circle-question-mark" title="Yordam" subtitle="+998 90 000 00 00" last />
        </Card>
        <Gap h={space.xl} />
        <Button title="Chiqish" variant="danger" icon="log-out" onPress={() => { void authApi.logout().catch(() => {}); void signOut(); }} />
        <Gap h={space.xxxl} />
      </ScrollView>
    </Screen>
  );
}
