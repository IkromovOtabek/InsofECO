import React from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Card, Gap, ListItem, Screen } from '@/design/primitives';
import { Avatar, Stars } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { useConversations, useQuruvchiDashboard } from '@/features/eco/api';

export default function QuruvchiMenu() {
  const router = useRouter();
  const { user, active } = useSession();
  const conv = useConversations(); const d = useQuruvchiDashboard();
  const unread = (conv.data ?? []).reduce((s, x) => s + x.unread, 0);
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }}>
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem leading={<Avatar name={user?.fullName} size={size.avatarLg} />} title={user?.fullName ?? ''} subtitle={`${active?.organization.name ?? ''} · Quruvchi`} right={d.data?.profile ? <Stars value={d.data.profile.ratingAvg} /> : undefined} onPress={() => router.push('/(quruvchi)/profile')} last />
        </Card>
        <Gap />
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem icon="banknote" tone="success" title="Daromad" subtitle="Bugun, hafta, oy · to'langan/kutilayotgan" onPress={() => router.push('/(quruvchi)/earnings')} />
          <ListItem icon="briefcase" module="production" title="Ishlarim" subtitle="Tarix va reyting" onPress={() => router.push('/(quruvchi)/my-jobs')} />
          <ListItem icon="messages-square" title="Xabarlar" right={unread ? <Badge label={String(unread)} tone="danger" icon={null} /> : undefined} onPress={() => router.push('/(quruvchi)/messages')} />
          <ListItem icon="circle-user" title="Profil" onPress={() => router.push('/(quruvchi)/profile')} last />
        </Card>
      </ScrollView>
    </Screen>
  );
}
