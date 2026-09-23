import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Gap, Txt } from '@/design/primitives';
import { Avatar, Row } from '@/design/ui';
import { useSession } from '@/core/session';
import { useConversations, useNotifications } from '@/features/eco/api';

/** iOS "More" uslubidagi hub — 5 tabga sig'magan bo'limlar. */
export default function Menu() {
  const router = useRouter();
  const { user, active } = useSession();
  const conv = useConversations(); const notif = useNotifications();
  const unreadMsgs = (conv.data ?? []).reduce((s, x) => s + x.unread, 0);
  const unreadNotif = (notif.data ?? []).filter((n) => !n.readAt).length;
  const badge = (n: number) => (n ? <View style={{ backgroundColor: '#E60D28', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}><Txt v="caption" style={{ color: '#fff', fontWeight: '700' }}>{n}</Txt></View> : undefined);
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={user?.fullName} size={52} />
        <View style={{ marginLeft: 14, flex: 1 }}><Txt v="heading">{user?.fullName}</Txt><Txt v="caption" color="secondary">{active?.organization.name} · Tadbirkor</Txt></View>
        <Row title="" onPress={() => router.push('/(tadbirkor)/profile')} />
      </Card>
      <Gap />
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="people" title="Quruvchilar" subtitle="Profil, reyting, ish tarixi" onPress={() => router.push('/(tadbirkor)/workers')} />
        <Row icon="car" iconTone="info" title="Haydovchilar" subtitle="Transport, joriy yuk, reyting" onPress={() => router.push('/(tadbirkor)/drivers')} />
        <Row icon="cube" iconTone="warning" title="Materiallar" subtitle="Ombor, narxlar, so'rovlar" onPress={() => router.push('/(tadbirkor)/materials')} />
        <Row icon="bus" iconTone="info" title="Transport" subtitle="Mashinalar, yoqilg'i, texnik ko'rik" onPress={() => router.push('/(tadbirkor)/transport')} last />
      </Card>
      <Gap />
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="chatbubbles" iconTone="brand" title="Xabarlar" subtitle="Quruvchi, haydovchi, loyiha chatlari" right={badge(unreadMsgs)} onPress={() => router.push('/(tadbirkor)/messages')} />
        <Row icon="notifications" iconTone="danger" title="Bildirishnomalar" right={badge(unreadNotif)} onPress={() => router.push('/(tadbirkor)/notifications')} />
        <Row icon="person-add" title="Xodimlar" subtitle="Tasdiqlash, ro'yxat" onPress={() => router.push('/(tadbirkor)/members')} />
        <Row icon="person-circle" title="Profil" onPress={() => router.push('/(tadbirkor)/profile')} last />
      </Card>
    </ScrollView>
  );
}
