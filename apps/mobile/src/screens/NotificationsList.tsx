import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, IconTile, ListGroup, Txt, fmtDate, fmtTime } from '@/design/primitives';
import { ErrorScreen, OfflineBar, isNetworkError } from '@/components/offline';
import { ChipGroup, SkeletonList } from '@/design/blocks';
import { IconName, toast } from '@/design/ui';
import { Animated, Appear, ENTER_FADE, EXIT_FADE, LiveItem, LiveList, haptic, stagger, usePressScale } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { ModuleTone, Tone, radius, size, space } from '@/design/tokens';
import { useNotifications } from '@/features/eco/api';
import { api } from '@/core/api';
import { routeOf, setBadge } from '@/core/push';

/**
 * Bildirishnomalar lentasi — ECO va ERP uchun umumiy ko'rinish.
 *
 * Ochilganda hech narsa "o'qildi" bo'lmaydi: xabar bosilganda yoki sarlavhadagi
 * "Hammasi o'qildi" bilan belgilanadi. O'qilmagan holat serverdagi `readAt` dan olinadi,
 * bosilgan zahoti esa nuqta mahalliy holatda o'chadi (server javobini kutmaydi).
 */

export interface FeedItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  icon: IconName;
  module?: ModuleTone;
  tone?: Tone;
  /** Bosilganda ochiladigan ekran (bo'lmasa faqat o'qildi bo'ladi). */
  onOpen?: () => void;
  /** Filtr guruhi (xabar turidan) — chip faqat shu guruhdagi xabar bo'lsa chiqadi. */
  group?: FeedGroup;
}

export type FeedGroup = 'trips' | 'payments';
const GROUP_LABEL: Record<FeedGroup, string> = { trips: 'Reyslar', payments: "To'lovlar" };
type Filter = 'all' | 'unread' | FeedGroup;
type Bucket = 'today' | 'yesterday' | 'older';
const BUCKET_LABEL: Record<Bucket, string> = { today: 'Bugun', yesterday: 'Kecha', older: 'Oldinroq' };

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function bucketOf(iso: string, now: Date): Bucket {
  const t = dayStart(new Date(iso));
  const today = dayStart(now);
  if (t >= today) return 'today';
  if (t >= today - 86_400_000) return 'yesterday';
  return 'older';
}

/** Sarlavhadagi matnli amal ("Hammasi o'qildi"). */
function HeaderLink({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={() => { haptic.light(); onPress(); }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={space.sm}
      style={({ pressed }) => [{ minHeight: size.touch, justifyContent: 'center', paddingHorizontal: space.sm }, pressed && { opacity: 0.6 }]}
    >
      <Txt v="bodyStrong" color={disabled ? 'faint' : 'brand'}>{title}</Txt>
    </Pressable>
  );
}

/** Demo bildirishnoma qatori: plitka, sarlavha (o'raladi) + 2 qator izoh, o'ngda vaqt va o'qilmagan nuqtasi (`.udot`). */
function NoticeRow({ n, unread, first, onPress }: { n: FeedItem; unread: boolean; first: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const time = bucketOf(n.createdAt, new Date()) === 'older' ? fmtDate(n.createdAt) : fmtTime(n.createdAt);
  const ps = usePressScale(0.98);
  return (
    <Pressable
      onPress={() => { haptic.light(); onPress(); }}
      onPressIn={ps.onPressIn} onPressOut={ps.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Yangi. ' : ''}${n.title}. ${n.body}`}
      android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [{ paddingHorizontal: space.card, paddingVertical: space.lg }, pressed && { backgroundColor: c.bgSubtle }]}
    >
      {!first ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: space.card + size.tile + space.md, right: space.card, height: size.hairline, backgroundColor: c.borderSubtle }} /> : null}
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }, ps.style]}>
      <IconTile icon={n.icon} module={n.module} tone={n.tone} size={size.tile} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt v="listTitle" numberOfLines={2}>{n.title}</Txt>
        {n.body ? <Txt v="tSm" numberOfLines={2}>{n.body}</Txt> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: space.sm }}>
        <Txt v="tSm">{time}</Txt>
        {/* O'qildi deb belgilanganda nuqta yumshoq so'nadi */}
        {unread ? <Animated.View entering={ENTER_FADE} exiting={EXIT_FADE} accessibilityElementsHidden style={{ width: size.dot + 2, height: size.dot + 2, borderRadius: radius.pill, backgroundColor: c.brand }} /> : null}
      </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Lenta: filtr (Hammasi / O'qilmagan), kun guruhlari, sarlavhada "Hammasi o'qildi".
 * `markRead(ids)` — bitta yoki bir nechta xabarni serverda o'qilgan deb belgilaydi.
 */
export function NotificationFeed({ items, loading, error, errorObj, refreshing, onRefresh, markRead }: {
  items: FeedItem[] | undefined;
  loading: boolean;
  /** Yuklashda xato va ko'rsatadigan ma'lumot yo'q. */ error: boolean;
  /** So'rov xatosi (tarmoq / server) — oflayn tasma va xato ekrani matni uchun. */ errorObj?: unknown;
  refreshing: boolean;
  onRefresh: () => void;
  markRead: (ids: string[]) => Promise<unknown>;
}) {
  const { c } = useTheme();
  const navigation = useNavigation();
  const [filter, setFilter] = useState<Filter>('all');
  /** Bosilgan, lekin server hali yangilanmagan xabarlar — nuqta darhol o'chsin. */
  const [localRead, setLocalRead] = useState<Set<string>>(() => new Set());

  const isUnread = (n: FeedItem) => !n.readAt && !localRead.has(n.id);
  const unreadIds = useMemo(() => (items ?? []).filter((n) => !n.readAt && !localRead.has(n.id)).map((n) => n.id), [items, localRead]);

  // Ilova ikonkasidagi raqam — haqiqiy o'qilmaganlar soni
  useEffect(() => { if (items) void setBadge(unreadIds.length); }, [items, unreadIds.length]);

  const markLocal = (ids: string[]) => setLocalRead((s) => { const next = new Set(s); ids.forEach((id) => next.add(id)); return next; });
  const unmarkLocal = (ids: string[]) => setLocalRead((s) => { const next = new Set(s); ids.forEach((id) => next.delete(id)); return next; });

  const readAll = () => {
    const ids = unreadIds;
    if (!ids.length) return;
    markLocal(ids);
    markRead(ids).then(() => haptic.success()).catch((e: Error) => { unmarkLocal(ids); toast.error(e.message, "Belgilab bo'lmadi"); });
  };

  // Sarlavha tugmasi har doim joriy ro'yxat bilan ishlasin — funksiya ref orqali
  const readAllRef = useRef(readAll);
  readAllRef.current = readAll;
  const hasUnread = unreadIds.length > 0;
  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <HeaderLink title="Hammasi o'qildi" onPress={() => readAllRef.current()} disabled={!hasUnread} /> });
  }, [navigation, hasUnread]);

  const open = (n: FeedItem) => {
    if (isUnread(n)) {
      markLocal([n.id]);
      markRead([n.id]).catch(() => unmarkLocal([n.id]));
    }
    n.onOpen?.();
  };

  const sections = useMemo(() => {
    const now = new Date();
    const list = (items ?? []).filter((n) => filter === 'all' || (filter === 'unread' ? !n.readAt && !localRead.has(n.id) : n.group === filter));
    const map: Record<Bucket, FeedItem[]> = { today: [], yesterday: [], older: [] };
    list.forEach((n) => map[bucketOf(n.createdAt, now)].push(n));
    return (Object.keys(map) as Bucket[]).filter((b) => map[b].length).map((b) => ({ key: b, rows: map[b] }));
  }, [items, filter, localRead]);

  // Faqat ro'yxatda haqiqatan bor guruhlar chip bo'ladi
  const groups = useMemo(() => (Object.keys(GROUP_LABEL) as FeedGroup[]).filter((g) => (items ?? []).some((n) => n.group === g)), [items]);

  if (loading && !items) return <View style={{ flex: 1, backgroundColor: c.bgApp, paddingHorizontal: space.pageX, paddingTop: space.lg }}><SkeletonList rows={6} /></View>;
  if (error && !items?.length) return <View style={{ flex: 1, backgroundColor: c.bgApp }}><ErrorScreen error={errorObj} onRetry={onRefresh} /></View>;

  const empty = filter === 'unread'
    ? <EmptyState icon="check-check" title="Hammasi o'qilgan" hint="Yangi xabar kelganda shu yerda chiqadi" />
    : <EmptyState icon="bell" title="Bildirishnoma yo'q" hint="Yangi hodisalar shu yerda ko'rinadi" />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
    <OfflineBar offline={isNetworkError(errorObj)} onRetry={onRefresh} />
    <FlatList
      data={sections}
      keyExtractor={(s) => s.key}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
      ListHeaderComponent={
        <ChipGroup<Filter>
          items={[{ key: 'all', label: 'Hammasi' }, { key: 'unread', label: "O'qilmagan", count: unreadIds.length || undefined }, ...groups.map((g) => ({ key: g, label: GROUP_LABEL[g] }))]}
          value={filter}
          onChange={setFilter}
          scroll={groups.length > 0}
        />
      }
      ListEmptyComponent={empty}
      renderItem={({ item: s, index }) => (
        <Appear delay={stagger(index)} style={{ marginTop: space.lg }}>
          <Txt v="overline" accessibilityRole="header" style={{ marginBottom: space.tight, marginLeft: space.xs }}>{BUCKET_LABEL[s.key]}</Txt>
          {/* Filtr almashganda (O'qilmagan) chiqib ketgan xabar so'nadi, qolganlari joyiga suriladi */}
          <LiveList>
            <ListGroup>
              {s.rows.map((n, i) => <LiveItem key={n.id}><NoticeRow n={n} unread={isUnread(n)} first={i === 0} onPress={() => open(n)} /></LiveItem>)}
            </ListGroup>
          </LiveList>
        </Appear>
      )}
    />
    </View>
  );
}

/** ECO xabar turi → ikonka va modul toni. */
function ecoVisual(type: string): Pick<FeedItem, 'icon' | 'module' | 'tone' | 'group'> {
  if (type === 'SLA_BREACH' || type.endsWith('PROBLEM') || type.endsWith('REJECTED') || type.endsWith('DISPUTED')) return { icon: 'triangle-alert', tone: 'danger' };
  if (type === 'MESSAGE') return { icon: 'message-circle', module: 'brand' };
  if (type.endsWith('PAID')) return { icon: 'wallet', module: 'brand', group: 'payments' };
  if (type.startsWith('DELIVERY') || type.startsWith('SHIPMENT')) return { icon: 'truck', module: 'logistics', group: 'trips' };
  if (type.startsWith('MATERIAL')) return { icon: 'package', module: 'warehouse' };
  if (type.startsWith('WORK_ORDER') || type.startsWith('TASK')) return { icon: 'hammer', module: 'production' };
  if (type.startsWith('ORDER')) return { icon: 'file-text', module: 'brand' };
  return { icon: 'bell', module: 'brand' };
}

/** ECO bildirishnomalari (tadbirkor / quruvchi / haydovchi). */
export function NotificationsList() {
  const router = useRouter();
  const q = useNotifications();
  const qc = useQueryClient();

  const items = useMemo<FeedItem[] | undefined>(() => q.data?.map((n) => {
    // Xabarning o'zida qaysi ekran ochilishi yozilgan (`data.screen`) — push bosilgandagi bilan bir xil yo'l
    const path = routeOf(n.data);
    return { id: n.id, title: n.title, body: n.body, createdAt: n.createdAt, readAt: n.readAt, ...ecoVisual(n.type), onOpen: path ? () => router.push(path as never) : undefined };
  }), [q.data, router]);

  const markRead = async (ids: string[]) => {
    // Server bir so'rovda ko'pi bilan 100 ta id qabul qiladi
    for (let i = 0; i < ids.length; i += 100) await api('/notifications/read', { method: 'POST', body: { ids: ids.slice(i, i + 100) } });
    await qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <NotificationFeed
      items={items}
      loading={q.isLoading}
      error={q.isError && !q.data?.length}
      errorObj={q.error}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      markRead={markRead}
    />
  );
}
