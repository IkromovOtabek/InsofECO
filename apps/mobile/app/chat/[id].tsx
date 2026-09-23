import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, Txt } from '@/design/primitives';
import { Icon, fmtRel } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useAction, useMessages } from '@/features/eco/api';
import { useSession } from '@/core/session';

/** Chat — iMessage uslubidagi pufakchalar, 4 s polling (WS keyingi bosqich). */
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
        <FlatList ref={list} data={q.data ?? []} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 16, gap: 6 }}
          renderItem={({ item: m, index }) => {
            const mine = m.sender.id === me; const prev = q.data?.[index - 1]; const showName = !mine && prev?.sender.id !== m.sender.id;
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {showName ? <Txt v="caption" color="secondary" style={{ marginLeft: 12, marginBottom: 2 }}>{m.sender.fullName}</Txt> : null}
                <View style={{ maxWidth: '78%', backgroundColor: mine ? c.brandPrimary : c.bgSurface, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4 }}>
                  <Txt v="body" style={{ color: mine ? '#fff' : c.textPrimary }}>{m.text}</Txt>
                  <Txt v="caption" style={{ color: mine ? 'rgba(255,255,255,0.7)' : c.textSecondary, alignSelf: 'flex-end', marginTop: 2, fontSize: 11 }}>{fmtRel(m.createdAt)}</Txt>
                </View>
              </View>
            );
          }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 10, backgroundColor: c.bgSurface, borderTopWidth: 0.5, borderTopColor: c.border, gap: 8 }}>
          <TextInput value={text} onChangeText={setText} placeholder="Xabar yozing…" placeholderTextColor={c.textSecondary} multiline style={{ flex: 1, maxHeight: 120, minHeight: 40, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: c.bgCanvas, color: c.textPrimary, fontSize: 16 }} onSubmitEditing={submit} blurOnSubmit />
          <Pressable onPress={submit} disabled={!text.trim()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() ? c.brandPrimary : c.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow-up" color="#fff" size={22} /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
