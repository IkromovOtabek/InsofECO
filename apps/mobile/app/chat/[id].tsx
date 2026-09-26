import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState, IconButton, Input, Screen, Txt } from '@/design/primitives';
import { fmtRel } from '@/design/ui';
import { radius, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { useAction, useMessages } from '@/features/eco/api';
import { useSession } from '@/core/session';

/** Chat — pufakchalar, 4 s polling (WS keyingi bosqich). Mening xabarim brend fonida, boshqaniki oq kartada. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const me = useSession((s) => s.user?.id);
  const q = useMessages(id);
  const [text, setText] = useState('');
  const list = useRef<FlatList>(null);
  const send = useAction<string>((t) => ({ path: `/conversations/${id}/messages`, body: { text: t } }), ['messages', 'conversations']);
  useEffect(() => { if (q.data?.length) setTimeout(() => list.current?.scrollToEnd({ animated: false }), 50); }, [q.data?.length]);
  const submit = () => { const t = text.trim(); if (!t) return; setText(''); send.mutate(t); };
  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList ref={list} data={q.data ?? []} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
          ListEmptyComponent={q.isLoading ? <ActivityIndicator color={c.brand} style={{ marginTop: space.xxxl }} /> : <EmptyState icon="message-circle" title="Hali xabar yo'q" hint="Birinchi xabarni yozing — suhbatdosh darhol ko'radi" />}
          renderItem={({ item: m, index }) => {
            const mine = m.sender.id === me; const prev = q.data?.[index - 1]; const showName = !mine && prev?.sender.id !== m.sender.id;
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {showName ? <Txt v="caption" style={{ marginLeft: space.md, marginBottom: 2 }}>{m.sender.fullName}</Txt> : null}
                <View accessibilityLabel={`${mine ? 'Siz' : m.sender.fullName}: ${m.text}`} style={{ maxWidth: '78%', backgroundColor: mine ? c.brandSoft : c.bgSurface, borderWidth: size.hairline, borderColor: mine ? c.brandSoft : c.borderDefault, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.xl, borderBottomRightRadius: mine ? radius.xs : radius.xl, borderBottomLeftRadius: mine ? radius.xl : radius.xs }}>
                  <Txt v="body" color="strong">{m.text}</Txt>
                  <Txt v="caption" style={{ alignSelf: 'flex-end', marginTop: 2 }}>{fmtRel(m.createdAt)}</Txt>
                </View>
              </View>
            );
          }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: Platform.OS === 'ios' ? space.x7 : space.sm, backgroundColor: c.bgChrome, borderTopWidth: size.hairline, borderTopColor: c.borderDefault }}>
          <Input value={text} onChangeText={setText} placeholder="Xabar yozing…" accessibilityLabel="Xabar matni" multiline style={{ maxHeight: 120 }} containerStyle={{ marginBottom: 0, flex: 1 }} onSubmitEditing={submit} blurOnSubmit />
          <IconButton icon="send" label="Yuborish" variant="secondary" tone={text.trim() ? 'brand' : 'muted'} disabled={!text.trim() || send.isPending} onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
