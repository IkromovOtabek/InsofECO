import React from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, Gap, Screen, Txt } from '@/design/primitives';
import { Avatar, Icon, Row, fmtRel } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useAction, useContacts, useConversations } from '@/features/eco/api';

export function MessagesList() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useConversations(); const contacts = useContacts();
  const create = useAction<{ participantUserIds: string[] }, { id: string }>((body) => ({ path: '/conversations', body: { type: 'DIRECT', ...body } }), ['conversations']);
  const start = () => {
    const list = (contacts.data ?? []).slice(0, 6);
    Alert.alert('Yangi suhbat', 'Kim bilan?', [...list.map((x) => ({ text: `${x.user.fullName ?? x.user.phone} · ${x.role}`, onPress: () => create.mutate({ participantUserIds: [x.user.id] }, { onSuccess: (cv) => router.push(`/chat/${cv.id}`) }) })), { text: 'Bekor', style: 'cancel' }]);
  };
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(x) => x.id} contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Suhbatlar yo'q" hint="Quruvchi yoki haydovchi bilan yozishing" />}
        renderItem={({ item: x, index }) => (
          <View style={{ backgroundColor: c.bgSurface, paddingHorizontal: 14, borderTopLeftRadius: index === 0 ? 14 : 0, borderTopRightRadius: index === 0 ? 14 : 0, borderBottomLeftRadius: index === (q.data?.length ?? 1) - 1 ? 14 : 0, borderBottomRightRadius: index === (q.data?.length ?? 1) - 1 ? 14 : 0 }}>
            <Row avatarName={x.type === 'DIRECT' ? x.others[0]?.fullName : x.title} title={x.title} subtitle={x.lastMessage ? `${x.lastMessage.sender.fullName?.split(' ')[0] ?? ''}: ${x.lastMessage.text}` : 'Xabar yo\'q'} onPress={() => router.push(`/chat/${x.id}`)}
              right={<View style={{ alignItems: 'flex-end', gap: 4 }}><Txt v="caption" color="secondary">{fmtRel(x.lastMessageAt)}</Txt>{x.unread ? <View style={{ backgroundColor: c.brandPrimary, borderRadius: 10, minWidth: 20, paddingHorizontal: 6, alignItems: 'center' }}><Txt v="caption" style={{ color: '#fff', fontWeight: '700' }}>{x.unread}</Txt></View> : null}</View>} last={index === (q.data?.length ?? 1) - 1} />
          </View>
        )} />
      <View style={{ position: 'absolute', right: 16, bottom: 16 }}>
        <Button title="✎  Yangi" size="md" onPress={start} />
      </View>
      <Gap h={0} />{/* keep imports */}<View style={{ display: 'none' }}><Avatar name="x" /><Icon name="add" /></View>
    </Screen>
  );
}
