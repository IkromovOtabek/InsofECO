import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Gap, Txt } from '@/design/primitives';
import { Avatar, Row } from '@/design/ui';
import { useSession } from '@/core/session';
import { authApi } from '@/features/auth/api';

const ROLE = { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' } as const;

export function Profile({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const { user, active, selectMembership, signOut } = useSession();
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Avatar name={user?.fullName} size={72} />
        <Gap h={12} />
        <Txt v="subtitle">{user?.fullName ?? user?.phone}</Txt>
        <Txt v="callout" color="secondary">{active ? `${ROLE[active.role]} · ${active.organization.name}` : ''}</Txt>
        <Txt v="caption" color="secondary" style={{ marginTop: 4 }}>{user?.phone}</Txt>
      </Card>
      {children}
      {(user?.memberships.filter((m) => m.isActive).length ?? 0) > 1 ? (
        <><Gap /><Card style={{ paddingVertical: 4 }}>{user?.memberships.filter((m) => m.isActive).map((m, i, arr) => <Row key={`${m.organization.id}:${m.role}`} icon="swap-horizontal" title={ROLE[m.role]} subtitle={m.organization.name} onPress={() => { selectMembership(m); router.replace('/'); }} last={i === arr.length - 1} />)}</Card></>
      ) : null}
      <Gap />
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="language" title="Til" subtitle="O'zbek (lotin)" />
        <Row icon="shield-checkmark" title="Xavfsizlik" subtitle="Parolni o'zgartirish" />
        <Row icon="help-circle" title="Yordam" subtitle="+998 90 000 00 00" last />
      </Card>
      <Gap h={20} />
      <Button title="Chiqish" variant="danger" onPress={() => { void authApi.logout().catch(() => {}); void signOut(); }} />
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}
