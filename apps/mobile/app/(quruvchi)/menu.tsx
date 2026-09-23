import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Gap, Txt } from '@/design/primitives';
import { Avatar, Row, Stars } from '@/design/ui';
import { useSession } from '@/core/session';
import { useConversations, useQuruvchiDashboard } from '@/features/eco/api';

export default function QuruvchiMenu() {
  const router = useRouter();
  const { user, active } = useSession();
  const conv = useConversations(); const d = useQuruvchiDashboard();
  const unread = (conv.data ?? []).reduce((s, x) => s + x.unread, 0);
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}><Avatar name={user?.fullName} size={52} /><View style={{ marginLeft: 14, flex: 1 }}><Txt v="heading">{user?.fullName}</Txt><Txt v="caption" color="secondary">{active?.organization.name} · Quruvchi</Txt>{d.data?.profile ? <Stars value={d.data.profile.ratingAvg} /> : null}</View></Card>
      <Gap />
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="cash" iconTone="success" title="Daromad" subtitle="Bugun, hafta, oy · to'langan/kutilayotgan" onPress={() => router.push('/(quruvchi)/earnings')} />
        <Row icon="briefcase" title="Ishlarim" subtitle="Tarix va reyting" onPress={() => router.push('/(quruvchi)/my-jobs')} />
        <Row icon="chatbubbles" iconTone="info" title="Xabarlar" right={unread ? <View style={{ backgroundColor: '#E60D28', borderRadius: 10, paddingHorizontal: 7 }}><Txt v="caption" style={{ color: '#fff', fontWeight: '700' }}>{unread}</Txt></View> : undefined} onPress={() => router.push('/(quruvchi)/messages')} />
        <Row icon="person-circle" title="Profil" onPress={() => router.push('/(quruvchi)/profile')} last />
      </Card>
    </ScrollView>
  );
}
