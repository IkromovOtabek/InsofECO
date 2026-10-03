import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, Txt, fmtDateFull, fmtTime } from '@/design/primitives';
import { Avatar, Icon, toast } from '@/design/ui';
import { Animated, ENTER_ITEM, haptic } from '@/design/motion';
import { size, space } from '@/design/tokens';
import { BubbleShell, Composer, DayChip } from '@/components/chat-ui';
import { ErrorScreen, OfflineBar, isNetworkError } from '@/components/offline';
import { useTheme } from '@/design/theme';
import { Message, useAction, useConversations, useMessages } from '@/features/eco/api';
import { useSession } from '@/core/session';
import { Loader } from '@/design/loader';

/**
 * Chat — demo "Chat" (docs/redesign/shots/29): sarlavhada avatar + ism + rol, bgSubtle fonda kun chipi,
 * pufakchalar (mening xabarim brend fonida), pastda bgChrome kompozer va dumaloq "yuborish".
 * 4 s polling (WS keyingi bosqich). Server "o'qildi", "onlayn" va "yozmoqda" holatini bermaydi — shuning uchun
 * faqat "yuborildi" (bitta belgi), yuborilayotgan xabar uchun soat; onlayn nuqta va yozmoqda nuqtalari chizilmaydi.
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

/** Demo `.appbar` chat varianti: 44 dp avatar (brandSoft), ism 12 css 800, ostida rol. */
function ChatHeader({ name, sub }: { name: string; sub?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, maxWidth: '100%' }}>
      <Avatar name={name} size={size.headerAvatar} tone="brand" />
      <View style={{ flexShrink: 1 }}>
        <Txt v="listTitle" numberOfLines={1}>{name}</Txt>
        {sub ? <Txt v="tSm" numberOfLines={1}>{sub}</Txt> : null}
      </View>
    </View>
  );
}

function Bubble({ r }: { r: Extract<Row, { kind: 'msg' }> }) {
  const { m, mine, showName, pending } = r;
  // Faqat yangi xabar (yuborilayotgan yoki hozirgina kelgan) pastdan prujina bilan chiqadi — tarix va
  // scroll paytida qayta chizilgan qatorlar harakatsiz
  const fresh = useRef(!!pending || (!mine && Date.now() - Date.parse(m.createdAt) < 15_000)).current;
  return (
    <Animated.View entering={fresh ? ENTER_ITEM : undefined} style={{ marginTop: showName ? space.sm : 0 }}>
      {showName ? <Txt v="caption" style={{ marginLeft: space.md, marginBottom: 2 }}>{m.sender.fullName ?? 'Suhbatdosh'}</Txt> : null}
      <BubbleShell
        side={mine ? 'out' : 'in'}
        label={`${mine ? 'Siz' : m.sender.fullName ?? 'Suhbatdosh'}, ${fmtTime(m.createdAt)}: ${m.text}${mine ? (pending ? '. Yuborilmoqda' : '. Yuborildi') : ''}`}
        style={pending ? { opacity: 0.7 } : undefined}
        meta={(
          <>
            <Txt v="caption" color={mine ? 'onBrand' : 'muted'}>{fmtTime(m.createdAt)}</Txt>
            {mine ? <Icon name={pending ? 'clock' : 'check'} size={size.iconSm - 2} tone="onBrand" strokeWidth={2.25} /> : null}
          </>
        )}
      >
        <Txt v="body" color={mine ? 'onBrand' : 'strong'}>{m.text}</Txt>
      </BubbleShell>
    </Animated.View>
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
    send.mutate(t, {
      onError: (e) => { haptic.error(); setText(t); toast.error(e.message, 'Xabar yuborilmadi'); },
    });
  };

  const canSend = !!text.trim() && !send.isPending;

  const empty = q.isLoading
    ? <Loader style={{ marginTop: space.xxxl }} />
    : q.isError
      ? <ErrorScreen error={q.error} title="Xabarlar yuklanmadi" onRetry={() => void q.refetch()} />
      : <EmptyState icon="message-circle" title="Hali xabar yo'q" hint="Birinchi xabarni yozing — suhbatdosh darhol ko'radi" />;

  return (
    <View ref={root} onLayout={measure} style={{ flex: 1, backgroundColor: c.bgSubtle }}>
      <Stack.Screen options={{ headerTitleAlign: 'left', headerTitle: () => <ChatHeader name={title} sub={sub} /> }} />
      <OfflineBar offline={!!q.data && isNetworkError(q.error)} onRetry={() => void q.refetch()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={top}>
        <FlatList
          ref={list}
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingHorizontal: space.pageX, paddingVertical: space.md, gap: space.tight, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={empty}
          renderItem={({ item: r }) => (r.kind === 'day' ? <DayChip label={r.label} /> : <Bubble r={r} />)}
        />
        <Composer
          value={text}
          onChangeText={setText}
          onSend={submit}
          canSend={canSend}
          bottom={kb ? space.sm : Math.max(insets.bottom, space.lg)}
          inputProps={{ accessibilityLabel: 'Xabar matni', maxLength: 2000 }}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
