import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Txt, fmtDateFull, fmtTime } from '@/design/primitives';
import { Avatar, Icon, toast } from '@/design/ui';
import { haptic } from '@/design/motion';
import { radius, shadow, size, space, type } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Message, useAction, useConversations, useMessages } from '@/features/eco/api';
import { useSession } from '@/core/session';
import { Loader } from '@/design/loader';

/**
 * Chat — kun ajratgichlari, HH:mm vaqt, pufakchalar (mening xabarim brend fonida), pastda pill
 * kompozer. 4 s polling (WS keyingi bosqich). Server "o'qildi" holatini bermaydi — shuning uchun
 * faqat "yuborildi" (bitta belgi) va yuborilayotgan xabar uchun soat ko'rsatiladi.
 */

const ROLE: Record<string, string> = { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' };

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; m: Message; mine: boolean; showName: boolean; pending?: boolean };

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return 'Bugun';
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86_400_000))) return 'Kecha';
  return fmtDateFull(d);
}

function ChatHeader({ name, sub }: { name: string; sub?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, maxWidth: '100%' }}>
      <Avatar name={name} size={size.iconTileSm} tone="brand" />
      <View style={{ flexShrink: 1 }}>
        <Txt v="bodyStrong" numberOfLines={1}>{name}</Txt>
        {sub ? <Txt v="caption" numberOfLines={1}>{sub}</Txt> : null}
      </View>
    </View>
  );
}

function DayChip({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignSelf: 'center', marginVertical: space.sm, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: c.bgMuted }}>
      <Txt v="caption" color="body">{label}</Txt>
    </View>
  );
}

function Bubble({ r }: { r: Extract<Row, { kind: 'msg' }> }) {
  const { c } = useTheme();
  const { m, mine, showName, pending } = r;
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginTop: showName ? space.sm : 0 }}>
      {showName ? <Txt v="caption" style={{ marginLeft: space.md, marginBottom: 2 }}>{m.sender.fullName ?? 'Suhbatdosh'}</Txt> : null}
      <View
        accessible
        accessibilityLabel={`${mine ? 'Siz' : m.sender.fullName ?? 'Suhbatdosh'}, ${fmtTime(m.createdAt)}: ${m.text}${mine ? (pending ? '. Yuborilmoqda' : '. Yuborildi') : ''}`}
        style={[
          { maxWidth: '80%', paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs + 2, borderRadius: radius.xl, borderCurve: 'continuous' },
          mine ? { backgroundColor: c.brand, borderBottomRightRadius: radius.xs } : [{ backgroundColor: c.bgSurface, borderBottomLeftRadius: radius.xs }, shadow.card],
          pending && { opacity: 0.7 },
        ]}
      >
        <Txt v="body" color={mine ? 'onBrand' : 'strong'}>{m.text}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: space.xs, marginTop: 2 }}>
          <Txt v="caption" color={mine ? 'onBrand' : 'faint'} style={mine ? { opacity: 0.8 } : undefined}>{fmtTime(m.createdAt)}</Txt>
          {mine ? <Icon name={pending ? 'clock' : 'check'} size={size.iconSm - 4} tone="onBrand" strokeWidth={2.25} /> : null}
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.user?.id);
  const q = useMessages(id);
  const conv = useConversations().data?.find((x) => x.id === id);
  const [text, setText] = useState('');
  const list = useRef<FlatList<Row>>(null);
  const root = useRef<View>(null);
  const send = useAction<string>((t) => ({ path: `/conversations/${id}/messages`, body: { text: t } }), ['messages', 'conversations']);

  // Klaviatura ochiq bo'lsa pastki xavfsiz hudud kerak emas
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKb(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // KeyboardAvoidingView ofseti — ekranning oynadagi haqiqiy tepasi (sarlavha balandligi qo'lda yozilmaydi)
  const [top, setTop] = useState(0);
  const measure = () => root.current?.measureInWindow((_x, y) => { if (Number.isFinite(y)) setTop(y); });

  const other = conv?.type === 'DIRECT' ? conv.others[0] : null;
  const title = (other?.fullName ?? conv?.title) || 'Suhbat';
  const sub = other ? (other.role ? ROLE[other.role] ?? other.role : null) : conv ? `${conv.others.length + 1} ishtirokchi` : null;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const msgs = q.data ?? [];
    let lastDay = '';
    const push = (m: Message, pending?: boolean) => {
      const dk = dayKey(new Date(m.createdAt));
      if (dk !== lastDay) { out.push({ kind: 'day', key: `d-${dk}`, label: dayLabel(m.createdAt) }); lastDay = dk; }
      const prev = out[out.length - 1];
      const mine = m.sender.id === me;
      const showName = !mine && conv?.type !== 'DIRECT' && !(prev?.kind === 'msg' && prev.m.sender.id === m.sender.id);
      out.push({ kind: 'msg', key: m.id, m, mine, showName, pending });
    };
    msgs.forEach((m) => push(m));
    // Yuborilayotgan xabar — server javobigacha soat belgisi bilan
    if (send.isPending && typeof send.variables === 'string' && me) {
      push({ id: 'pending', text: send.variables, createdAt: new Date().toISOString(), sender: { id: me, fullName: null } }, true);
    }
    return out;
  }, [q.data, me, conv?.type, send.isPending, send.variables]);

  useEffect(() => { if (rows.length) setTimeout(() => list.current?.scrollToEnd({ animated: false }), 50); }, [rows.length]);

  const submit = () => {
    const t = text.trim();
    if (!t || send.isPending) return;
    setText('');
    haptic.light();
    send.mutate(t, {
      onError: (e) => { haptic.error(); setText(t); toast.error(e.message, 'Xabar yuborilmadi'); },
    });
  };

  const canSend = !!text.trim() && !send.isPending;

  const empty = q.isLoading
    ? <Loader style={{ marginTop: space.xxxl }} />
    : q.isError
      ? <EmptyState icon="cloud-off" title="Xabarlar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
      : <EmptyState icon="message-circle" title="Hali xabar yo'q" hint="Birinchi xabarni yozing — suhbatdosh darhol ko'radi" />;

  return (
    <View ref={root} onLayout={measure} style={{ flex: 1, backgroundColor: c.bgApp }}>
      <Stack.Screen options={{ headerTitleAlign: 'left', headerTitle: () => <ChatHeader name={title} sub={sub} /> }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={top}>
        <FlatList
          ref={list}
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.xs + 2, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={empty}
          renderItem={({ item: r }) => (r.kind === 'day' ? <DayChip label={r.label} /> : <Bubble r={r} />)}
        />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: kb ? space.sm : Math.max(insets.bottom, space.sm), backgroundColor: c.bgApp }}>
          <View style={[{ flex: 1, minHeight: size.touch, borderRadius: radius.xl, borderCurve: 'continuous', backgroundColor: c.bgSurface, paddingHorizontal: space.lg, justifyContent: 'center' }, shadow.card]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Xabar yozing…"
              placeholderTextColor={c.textFaint}
              accessibilityLabel="Xabar matni"
              multiline
              maxLength={2000}
              style={[type.body, { color: c.textStrong, maxHeight: size.touch * 3, paddingTop: space.md - 2, paddingBottom: space.md - 2 }]}
            />
          </View>
          <Pressable
            onPress={submit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Yuborish"
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => [{ width: size.touch, height: size.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? c.brand : c.bgMuted }, pressed && { opacity: 0.85 }]}
          >
            <Icon name="send" size={size.iconMd} tone={canSend ? 'onBrand' : 'faint'} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
