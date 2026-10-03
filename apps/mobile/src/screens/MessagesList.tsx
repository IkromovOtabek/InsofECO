import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, ListGroup, ListItem, Txt, fmtDate, fmtTime } from '@/design/primitives';
import { dialog, Avatar, toast } from '@/design/ui';
import { Appear } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { Loader } from '@/design/loader';
import { ErrorScreen, OfflineBar, isNetworkError } from '@/components/offline';
import { Conversation, useAction, useContacts, useConversations } from '@/features/eco/api';

const ROLE: Record<string, string> = { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' };

/** Bugungi xabar — HH:mm, kechagi — "Kecha", eskisi — sana. */
function when(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= start) return fmtTime(d);
  if (d.getTime() >= start - 86_400_000) return 'Kecha';
  return fmtDate(d);
}

function ConvRow({ x, onPress }: { x: Conversation; onPress: () => void }) {
  const { c } = useTheme();
  const name = (x.type === 'DIRECT' ? x.others[0]?.fullName : x.title) || x.title || 'Suhbat';
  const last = x.lastMessage ? `${x.lastMessage.sender.fullName?.split(' ')[0] ?? ''}: ${x.lastMessage.text}` : "Xabar yo'q";
  const unread = x.unread > 0;
  return (
    <ListItem
      leading={<Avatar name={name} size={size.avatar + space.xs} tone={unread ? 'brand' : 'neutral'} />}
      title={name}
      subtitle={last}
      subtitleLines={1}
      onPress={onPress}
      chevron={false}
      right={
        <View style={{ alignItems: 'flex-end', gap: space.xs }}>
          <Txt v="tSm" color={unread ? 'brand' : 'muted'}>{when(x.lastMessageAt)}</Txt>
          {unread ? (
            <View accessibilityLabel={`${x.unread} ta yangi xabar`} style={{ minWidth: space.xl, height: space.xl, paddingHorizontal: space.xs + 2, borderRadius: radius.pill, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Txt v="badge" color="onBrand">{x.unread > 99 ? '99+' : x.unread}</Txt>
            </View>
          ) : null}
        </View>
      }
    />
  );
}

export function MessagesList() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useConversations(); const contacts = useContacts();
  const create = useAction<{ participantUserIds: string[] }, { id: string }>((body) => ({ path: '/conversations', body: { type: 'DIRECT', ...body } }), ['conversations']);
  const start = () => {
    const list = (contacts.data ?? []).slice(0, 6);
    if (!list.length) { toast.info(contacts.isError ? "Kontaktlar yuklanmadi — qayta urinib ko'ring" : "Tashkilotda boshqa a'zo yo'q", 'Yangi suhbat'); return; }
    dialog('Yangi suhbat', 'Kim bilan?', [...list.map((x) => ({ text: `${x.user.fullName ?? x.user.phone} · ${ROLE[x.role] ?? x.role}`, onPress: () => create.mutate({ participantUserIds: [x.user.id] }, { onSuccess: (cv) => router.push(`/chat/${cv.id}`), onError: (e) => toast.error(e.message, 'Xato') }) })), { text: 'Bekor', style: 'cancel' }]);
  };
  const data = q.data ?? [];

  if (q.isLoading) return <Loader fill />;
  if (q.isError && !data.length) return <View style={{ flex: 1, backgroundColor: c.bgApp }}><ErrorScreen error={q.error} title="Suhbatlar yuklanmadi" onRetry={() => void q.refetch()} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <OfflineBar offline={isNetworkError(q.error)} onRetry={() => void q.refetch()} />
      <FlatList
        data={data.length ? [data] : []}
        keyExtractor={() => 'all'}
        contentContainerStyle={{ padding: space.pageX, paddingBottom: size.buttonLg + space.x12, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.brand} />}
        ListEmptyComponent={<EmptyState icon="messages-square" title="Suhbatlar yo'q" hint="Quruvchi yoki haydovchi bilan yozishing" action="Yangi suhbat" onAction={start} />}
        renderItem={({ item }) => (
          <Appear>
            <ListGroup>
              {item.map((x) => <ConvRow key={x.id} x={x} onPress={() => router.push(`/chat/${x.id}`)} />)}
            </ListGroup>
          </Appear>
        )}
      />
      <View style={{ position: 'absolute', right: space.pageX, bottom: space.lg }}>
        <Button title="Yangi" icon="pencil" size="lg" full={false} onPress={start} loading={create.isPending} />
      </View>
    </View>
  );
}
