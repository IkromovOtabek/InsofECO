import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListGroup, OfflineBanner } from '@/design/blocks';
import { Badge, Card, Gap, ListItem, ProgressBar, Screen, Txt } from '@/design/primitives';
import { Avatar, fmtShort } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { outbox } from '@/core/outbox';
import { useOutboxSize } from '@/shared/hooks';
import { useConversations, useHaydovchiDashboard } from '@/features/eco/api';
import { avatarUri } from '@/features/auth/api';
import { LogoutButton } from '@/features/auth/logout';

/** Kabina "Men": haydovchi → mashina (yoqilg'i) → Daromad, Tarix, Xabarlar, Profil (64 pt qatorlar) → Chiqish. */
export default function HaydovchiMenu() {
  const router = useRouter();
  const { user, active } = useSession();
  const conv = useConversations(); const d = useHaydovchiDashboard();
  const pending = useOutboxSize();
  const unread = (conv.data ?? []).reduce((s, x) => s + x.unread, 0);
  const v = d.data?.vehicle;
  const low = (v?.fuelPercent ?? 100) < 25;
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl }}>
        <OfflineBanner visible={pending > 0} pendingCount={pending} onRetry={() => void outbox.flush()} style={{ marginBottom: space.md }} />
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.panel }}>
          <Avatar name={user?.fullName} uri={avatarUri(user?.avatarUrl)} size={size.avatarLg} tone="info" />
          <View style={{ flex: 1 }}>
            <Txt v="titleMd" numberOfLines={1}>{user?.fullName}</Txt>
            <Txt v="body" color="muted" numberOfLines={1}>{active?.organization.name}</Txt>
          </View>
        </Card>

        {v ? (
          <>
            <Gap h={space.grid} />
            <ListGroup>
              <ListItem size="lg" icon="truck" module="logistics" title={`${v.brand ?? v.type} · ${v.plateNumber}`} subtitle={v.fuelPercent != null ? `Yoqilg'i ${v.fuelPercent}%` : undefined} onPress={() => router.push('/(haydovchi)/transport')} />
              {v.fuelPercent != null ? (
                <View style={{ paddingHorizontal: space.card, paddingBottom: space.md }}>
                  <ProgressBar value={v.fuelPercent} tone={low ? 'danger' : 'info'} />
                </View>
              ) : null}
            </ListGroup>
          </>
        ) : null}

        <Gap h={space.grid} />
        <ListGroup>
          <ListItem size="lg" icon="banknote" tone="success" title="Daromadim" subtitle={d.data ? `Bu oy ${fmtShort(d.data.earnings.month)} so'm` : undefined} onPress={() => router.push('/(haydovchi)/earnings')} />
          <ListItem size="lg" icon="history" module="logistics" title="Tarix" subtitle="Yetkazilgan yuklar" onPress={() => router.push('/(haydovchi)/history')} />
          <ListItem size="lg" icon="messages-square" title="Xabarlar" right={unread ? <Badge label={String(unread)} tone="danger" icon={null} /> : undefined} onPress={() => router.push('/(haydovchi)/messages')} />
          <ListItem size="lg" icon="circle-user" title="Profil" onPress={() => router.push('/(haydovchi)/profile')} />
        </ListGroup>

        <Gap h={space.section} />
        <LogoutButton variant="danger" size="xl" />
      </ScrollView>
    </Screen>
  );
}
