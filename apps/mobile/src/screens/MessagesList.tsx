import React from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, ListItem, Screen, Txt } from '@/design/primitives';
import { Avatar, fmtRel, toast } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useAction, useContacts, useConversations } from '@/features/eco/api';

export function MessagesList() {
  const router = useRouter();
  const q = useConversations(); const contacts = useContacts();
  const create = useAction<{ participantUserIds: string[] }, { id: string }>((body) => ({ path: '/conversations', body: { type: 'DIRECT', ...body } }), ['conversations']);
  const start = () => {
    const list = (contacts.data ?? []).slice(0, 6);
    Alert.alert('Yangi suhbat', 'Kim bilan?', [...list.map((x) => ({ text: `${x.user.fullName ?? x.user.phone} · ${x.role}`, onPress: () => create.mutate({ participantUserIds: [x.user.id] }, { onSuccess: (cv) => router.push(`/chat/${cv.id}`), onError: (e) => toast.error(e.message, 'Xato') }) })), { text: 'Bekor', style: 'cancel' }]);
  };
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(x) => x.id} contentContainerStyle={{ padding: space.pageX, paddingBottom: size.buttonLg + space.x12 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Suhbatlar yo'q" hint="Quruvchi yoki haydovchi bilan yozishing" icon="messages-square" />}
        renderItem={({ item: x }) => (
          <Card style={{ marginBottom: space.sm, paddingVertical: space.xs }}>
            <ListItem
              leading={<Avatar name={x.type === 'DIRECT' ? x.others[0]?.fullName : x.title} />}
              title={x.title} subtitle={x.lastMessage ? `${x.lastMessage.sender.fullName?.split(' ')[0] ?? ''}: ${x.lastMessage.text}` : 'Xabar yo\'q'}
              onPress={() => router.push(`/chat/${x.id}`)} last
              right={
                <View style={{ alignItems: 'flex-end', gap: space.xs }}>
                  <Txt v="caption">{fmtRel(x.lastMessageAt)}</Txt>
                  {x.unread ? <Badge label={String(x.unread)} tone="brand" icon={null} /> : null}
                </View>
              }
            />
          </Card>
        )} />
      <View style={{ position: 'absolute', right: space.pageX, bottom: space.lg }}>
        <Button title="Yangi" icon="pencil" size="lg" full={false} onPress={start} />
      </View>
    </Screen>
  );
}
