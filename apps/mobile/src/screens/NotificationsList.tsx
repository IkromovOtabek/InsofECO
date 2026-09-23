import React, { useEffect } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, Screen, Txt } from '@/design/primitives';
import { fmtRel } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useNotifications } from '@/features/eco/api';
import { api } from '@/core/api';

export function NotificationsList() {
  const { c } = useTheme();
  const q = useNotifications(); const qc = useQueryClient();
  useEffect(() => {
    const unread = (q.data ?? []).filter((n) => !n.readAt).map((n) => n.id);
    if (unread.length) void api('/notifications/read', { method: 'POST', body: { ids: unread } }).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
  }, [q.data, qc]);
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(n) => n.id} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Bildirishnomalar yo'q" />}
        renderItem={({ item: n }) => (
          <View style={{ flexDirection: 'row', backgroundColor: c.bgSurface, borderRadius: 14, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: n.readAt ? c.border : c.brandPrimary }}>
            <View style={{ flex: 1 }}><Txt v="bodyStrong">{n.title}</Txt><Txt v="callout" color="secondary" style={{ marginTop: 2 }}>{n.body}</Txt></View>
            <Txt v="caption" color="secondary" style={{ marginLeft: 8 }}>{fmtRel(n.createdAt)}</Txt>
          </View>
        )} />
    </Screen>
  );
}
