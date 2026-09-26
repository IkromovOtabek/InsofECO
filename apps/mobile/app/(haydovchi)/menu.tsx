import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, Gap, IconTile, ListItem, ProgressBar, Screen, Txt, fmtSum } from '@/design/primitives';
import { Avatar, Icon } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { useConversations, useHaydovchiDashboard } from '@/features/eco/api';
import { authApi } from '@/features/auth/api';

/** "Men": Transport, Daromad, Tarix, Xabarlar, Profil, Chiqish. */
export default function HaydovchiMenu() {
  const router = useRouter();
  const { c } = useTheme();
  const { user, active, signOut } = useSession();
  const conv = useConversations(); const d = useHaydovchiDashboard();
  const unread = (conv.data ?? []).reduce((s, x) => s + x.unread, 0);
  const v = d.data?.vehicle;
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={user?.fullName} size={size.avatarLg} tone="info" />
          <View style={{ flex: 1 }}>
            <Txt v="titleMd" numberOfLines={1}>{user?.fullName}</Txt>
            <Txt v="body" color="muted" numberOfLines={1}>{active?.organization.name}</Txt>
          </View>
        </Card>
        {v ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Transportim" onPress={() => router.push('/(haydovchi)/transport')} style={{ marginTop: space.md }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <IconTile icon="bus" module="logistics" />
                <View style={{ flex: 1 }}>
                  <Txt v="titleSm">{v.brand} · {v.plateNumber}</Txt>
                  <Txt v="body" color="muted">Yoqilg&apos;i {v.fuelPercent ?? '—'}%</Txt>
                </View>
                <Icon name="chevron-right" tone="faint" />
              </View>
              <Gap h={space.md} />
              <ProgressBar value={v.fuelPercent ?? 0} tone={(v.fuelPercent ?? 0) < 25 ? 'danger' : 'info'} />
            </Card>
          </Pressable>
        ) : null}
        <Gap h={space.md} />
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem icon="banknote" tone="success" title="Daromadim" subtitle={d.data ? `Bu oy ${fmtSum(d.data.earnings.month)}` : undefined} onPress={() => router.push('/(haydovchi)/earnings')} />
          <ListItem icon="history" module="logistics" title="Tarix" subtitle="Yetkazib berishlar" onPress={() => router.push('/(haydovchi)/history')} />
          <ListItem icon="messages-square" title="Xabarlar" right={unread ? <Badge label={String(unread)} tone="danger" icon={null} /> : undefined} onPress={() => router.push('/(haydovchi)/messages')} />
          <ListItem icon="circle-user" title="Profil" onPress={() => router.push('/(haydovchi)/profile')} last />
        </Card>
        <Gap h={space.xl} />
        <Button title="Chiqish" variant="danger" size="lg" icon="log-out" onPress={() => { void authApi.logout().catch(() => {}); void signOut(); }} style={{ borderColor: c.dangerSolid }} />
      </ScrollView>
    </Screen>
  );
}
