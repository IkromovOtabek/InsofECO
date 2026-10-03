import React from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ListGroup, SectionHead } from '@/design/blocks';
import { Badge, Gap, ListItem, Screen } from '@/design/primitives';
import { Avatar, Stars, fmtShort } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { avatarUri } from '@/features/auth/api';
import { useConversations, useQuruvchiDashboard } from '@/features/eco/api';

/** Quruvchi menyusi: profil kartasi → ish va pul → aloqa va hisob. */
export default function QuruvchiMenu() {
  const router = useRouter();
  const { user, active } = useSession();
  const conv = useConversations(); const d = useQuruvchiDashboard();
  const unread = (conv.data ?? []).reduce((s, x) => s + x.unread, 0);
  const e = d.data?.earnings;
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl }}>
        <ListGroup>
          <ListItem
            leading={<Avatar name={user?.fullName} uri={avatarUri(user?.avatarUrl)} size={size.avatarLg} tone="brand" />}
            title={user?.fullName ?? ''} subtitle={`${active?.organization.name ?? ''} · Quruvchi`}
            right={d.data?.profile ? <Stars value={d.data.profile.ratingAvg} /> : undefined}
            onPress={() => router.push('/(quruvchi)/profile')}
          />
        </ListGroup>

        <Gap h={space.section} />
        <SectionHead title="Ish va daromad" />
        <ListGroup>
          <ListItem icon="banknote" tone="success" title="Daromad" subtitle={e ? `Bu oy ${fmtShort(e.month)} so'm · kutilmoqda ${fmtShort(e.monthPending)}` : "To'langan va kutilayotgan"} onPress={() => router.push('/(quruvchi)/earnings')} />
          <ListItem icon="briefcase" module="production" title="Ishlarim" subtitle="Tarix va reyting" onPress={() => router.push('/(quruvchi)/my-jobs')} />
          <ListItem icon="store" module="brand" title="Do'kon" subtitle="Zavod mahsulotlari va narxlar" onPress={() => router.push('/(shop)')} />
        </ListGroup>

        <Gap h={space.section} />
        <SectionHead title="Aloqa va hisob" />
        <ListGroup>
          <ListItem icon="messages-square" title="Xabarlar" right={unread ? <Badge label={String(unread)} tone="danger" icon={null} /> : undefined} onPress={() => router.push('/(quruvchi)/messages')} />
          <ListItem icon="circle-user" title="Profil" onPress={() => router.push('/(quruvchi)/profile')} />
        </ListGroup>
      </ScrollView>
    </Screen>
  );
}
