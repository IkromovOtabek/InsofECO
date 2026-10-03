import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListGroup, SectionHead } from '@/design/blocks';
import { Badge, Card, Gap, ListItem, Screen, Txt } from '@/design/primitives';
import { Appear, PressScale, stagger } from '@/design/motion';
import { Avatar, Icon } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { useConversations, useNotifications } from '@/features/eco/api';

/** iOS "More" uslubidagi hub — profil kartasi → Jamoa va resurslar → Aloqa → Hisob (Profil, Sozlamalar). */
export default function Menu() {
  const router = useRouter();
  const { user, active } = useSession();
  const conv = useConversations(); const notif = useNotifications();
  const unreadMsgs = (conv.data ?? []).reduce((s, x) => s + x.unread, 0);
  const unreadNotif = (notif.data ?? []).filter((n) => !n.readAt).length;
  const badge = (n: number) => (n ? <Badge label={String(n)} tone="danger" icon={null} /> : undefined);
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl }}>
        <Appear>
          <PressScale onPress={() => router.push('/(tadbirkor)/profile')} accessibilityRole="button" accessibilityLabel="Profil">
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
              <Avatar name={user?.fullName} size={size.avatarLg} tone="brand" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt v="overline" color="brand" numberOfLines={1}>Tadbirkor</Txt>
                <Txt v="titleMd" numberOfLines={1}>{user?.fullName ?? ''}</Txt>
                <Txt v="caption" numberOfLines={1}>{active?.organization.name ?? ''}</Txt>
              </View>
              <Icon name="chevron-right" tone="faint" />
            </Card>
          </PressScale>
        </Appear>

        <Appear delay={stagger(1)}>
          <Gap h={space.section} />
          <SectionHead title="Jamoa va resurslar" />
          <ListGroup>
            <ListItem icon="users" module="production" title="Quruvchilar" subtitle="Profil, reyting, ish tarixi" onPress={() => router.push('/(tadbirkor)/workers')} />
            <ListItem icon="car" module="logistics" title="Haydovchilar" subtitle="Transport, joriy yuk, reyting" onPress={() => router.push('/(tadbirkor)/drivers')} />
            <ListItem icon="package" module="warehouse" title="Materiallar" subtitle="Ombor, narxlar, so'rovlar" onPress={() => router.push('/(tadbirkor)/materials')} />
            <ListItem icon="bus" module="logistics" title="Transport" subtitle="Mashinalar, yoqilg'i, texnik ko'rik" onPress={() => router.push('/(tadbirkor)/transport')} />
            <ListItem icon="user-plus" module="brand" title="Xodimlar" subtitle="Tasdiqlash, ro'yxat" onPress={() => router.push('/(tadbirkor)/members')} />
          </ListGroup>
        </Appear>

        <Appear delay={stagger(2)}>
          <Gap h={space.section} />
          <SectionHead title="Aloqa" />
          <ListGroup>
            <ListItem icon="messages-square" module="brand" title="Xabarlar" subtitle="Quruvchi, haydovchi, loyiha chatlari" right={badge(unreadMsgs)} onPress={() => router.push('/(tadbirkor)/messages')} />
            <ListItem icon="bell" module="brand" title="Bildirishnomalar" right={badge(unreadNotif)} onPress={() => router.push('/(tadbirkor)/notifications')} />
          </ListGroup>
        </Appear>

        <Appear delay={stagger(3)}>
          <Gap h={space.section} />
          <SectionHead title="Hisob" />
          <ListGroup>
            <ListItem icon="circle-user" module="brand" title="Profil" onPress={() => router.push('/(tadbirkor)/profile')} />
            <ListItem icon="settings" module="brand" title="Sozlamalar" subtitle="Mavzu, palitra, bildirishnomalar" onPress={() => router.push('/settings')} />
          </ListGroup>
        </Appear>
      </ScrollView>
    </Screen>
  );
}
