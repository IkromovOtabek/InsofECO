import React, { useEffect } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Card, EmptyState, Screen, Txt } from '@/design/primitives';
import { fmtRel } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useNotifications } from '@/features/eco/api';
import { api } from '@/core/api';
import { routeOf, setBadge } from '@/core/push';
import { PressScale } from '@/design/motion';

export function NotificationsList() {
  const { c } = useTheme();
  const router = useRouter();
  const q = useNotifications(); const qc = useQueryClient();

  useEffect(() => {
    const unread = (q.data ?? []).filter((n) => !n.readAt).map((n) => n.id);
    if (unread.length) void api('/notifications/read', { method: 'POST', body: { ids: unread } }).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
    // Ro'yxat ochildi — ilova ikonkasidagi raqam ham o'chadi
    setBadge(0);
  }, [q.data, qc]);

  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(n) => n.id} contentContainerStyle={{ padding: space.pageX }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Bildirishnomalar yo'q" hint="Yangi hodisalar shu yerda ko'rinadi" icon="bell" />}
        renderItem={({ item: n }) => {
          // Xabarning o'zida qaysi ekran ochilishi yozilgan (`data.screen`) — push bosilgandagi bilan bir xil yo'l
          const path = routeOf(n.data);
          return (
            <PressScale haptic={false} disabled={!path} accessibilityRole={path ? 'button' : undefined} accessibilityLabel={n.title} onPress={path ? () => router.push(path as never) : undefined}>
              <Card style={[{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }, !n.readAt && { borderColor: c.brand }]}>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">{n.title}</Txt>
                  <Txt v="body" color="muted" style={{ marginTop: space.xs }}>{n.body}</Txt>
                </View>
                <View style={{ alignItems: 'flex-end', gap: space.xs }}>
                  <Txt v="caption">{fmtRel(n.createdAt)}</Txt>
                  {!n.readAt ? <Badge label="Yangi" tone="brand" icon={null} /> : null}
                </View>
              </Card>
            </PressScale>
          );
        }} />
    </Screen>
  );
}
