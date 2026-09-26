import React from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Card, Gap, ListItem, Screen } from '@/design/primitives';
import { Avatar } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { useConversations, useNotifications } from '@/features/eco/api';

/** iOS "More" uslubidagi hub — 5 tabga sig'magan bo'limlar. */
export default function Menu() {
  const router = useRouter();
  const { user, active } = useSession();
  const conv = useConversations(); const notif = useNotifications();
  const unreadMsgs = (conv.data ?? []).reduce((s, x) => s + x.unread, 0);
  const unreadNotif = (notif.data ?? []).filter((n) => !n.readAt).length;
  const badge = (n: number) => (n ? <Badge label={String(n)} tone="danger" icon={null} /> : undefined);
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }}>
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem leading={<Avatar name={user?.fullName} size={size.avatarLg} />} title={user?.fullName ?? ''} subtitle={`${active?.organization.name ?? ''} · Tadbirkor`} onPress={() => router.push('/(tadbirkor)/profile')} last />
        </Card>
        <Gap />
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem icon="users" module="production" title="Quruvchilar" subtitle="Profil, reyting, ish tarixi" onPress={() => router.push('/(tadbirkor)/workers')} />
          <ListItem icon="car" module="logistics" title="Haydovchilar" subtitle="Transport, joriy yuk, reyting" onPress={() => router.push('/(tadbirkor)/drivers')} />
          <ListItem icon="package" module="warehouse" title="Materiallar" subtitle="Ombor, narxlar, so'rovlar" onPress={() => router.push('/(tadbirkor)/materials')} />
          <ListItem icon="bus" module="logistics" title="Transport" subtitle="Mashinalar, yoqilg'i, texnik ko'rik" onPress={() => router.push('/(tadbirkor)/transport')} last />
        </Card>
        <Gap />
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem icon="messages-square" title="Xabarlar" subtitle="Quruvchi, haydovchi, loyiha chatlari" right={badge(unreadMsgs)} onPress={() => router.push('/(tadbirkor)/messages')} />
          <ListItem icon="bell" title="Bildirishnomalar" right={badge(unreadNotif)} onPress={() => router.push('/(tadbirkor)/notifications')} />
          <ListItem icon="user-plus" title="Xodimlar" subtitle="Tasdiqlash, ro'yxat" onPress={() => router.push('/(tadbirkor)/members')} />
          <ListItem icon="circle-user" title="Profil" onPress={() => router.push('/(tadbirkor)/profile')} last />
        </Card>
      </ScrollView>
    </Screen>
  );
}
