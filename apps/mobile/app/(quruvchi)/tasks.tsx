import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { ChipGroup, ListGroup, Reveal, SkeletonList } from '@/design/blocks';
import { EmptyState, ListItem, Screen, SearchField, fmtDate, statusLabel, statusTone } from '@/design/primitives';
import { dialog, IconName, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { Tone, space } from '@/design/tokens';
import { Task, useAction, useMyTasks } from '@/features/eco/api';

const STATUS_ICON: Record<string, { icon: IconName; tone: Tone }> = {
  DONE: { icon: 'circle-check', tone: 'success' }, REVIEW: { icon: 'clock', tone: 'warning' }, IN_PROGRESS: { icon: 'circle-dot', tone: 'brand' }, TODO: { icon: 'circle', tone: 'neutral' },
};
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Past', MEDIUM: "O'rta", HIGH: 'Muhim' };

type Seg = 'now' | 'later' | 'done';
const soon = (t: Task) => !!t.dueDate && new Date(t.dueDate).getTime() < Date.now() + 86_400_000;
const FILTER: Record<Seg, (t: Task) => boolean> = {
  now: (t) => t.status !== 'DONE' && soon(t),
  later: (t) => t.status !== 'DONE' && !soon(t),
  done: (t) => t.status === 'DONE',
};
const EMPTY: Record<Seg, { title: string; hint: string; icon: IconName }> = {
  now: { title: 'Bugunga vazifa yo\'q', hint: "Muddati yaqin vazifalar shu yerda ko'rinadi", icon: 'circle-check' },
  later: { title: "Keyingi vazifa yo'q", hint: "Tadbirkor vazifa bersa shu yerda ko'rinadi", icon: 'square-check' },
  done: { title: "Bajarilgan vazifa yo'q", hint: "Tadbirkor qabul qilgan vazifalar shu yerda ko'rinadi", icon: 'square-check' },
};

/** Vazifalar: holat o'zgaradi (TODO → IN_PROGRESS → REVIEW), Tadbirkor DONE qiladi. */
export default function Tasks() {
  const { c } = useTheme();
  const q = useMyTasks();
  const [seg, setSeg] = useState<Seg>('now');
  const upd = useAction<{ id: string; status: string; comment?: string }>((v) => ({ path: `/tasks/${v.id}`, method: 'PATCH', body: { status: v.status, comment: v.comment } }), ['tasks', 'dash']);
  const next = (s: string) => ({ TODO: 'IN_PROGRESS', IN_PROGRESS: 'REVIEW', REVIEW: 'REVIEW', DONE: 'DONE' })[s] ?? 'IN_PROGRESS';
  const all = q.data ?? [];
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const list = all.filter(FILTER[seg]).filter((t) => !needle || `${t.title} ${t.project?.name ?? ''}`.toLowerCase().includes(needle));
  const count = (s: Seg) => (q.data ? all.filter(FILTER[s]).length : undefined);
  const open = (t: Task) => dialog(t.title, t.description ?? "Holatni o'zgartirish", [
    { text: t.status === 'TODO' ? 'Boshlash' : 'Tekshiruvga topshirish', onPress: () => upd.mutate({ id: t.id, status: next(t.status) }, { onError: (e) => toast.error(e.message, 'Xato') }) },
    { text: 'Bekor', style: 'cancel' },
  ]);
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.md, gap: space.md }}>
        <SearchField value={search} onChangeText={setSearch} placeholder="Vazifa yoki obyekt" />
        <ChipGroup
          items={[{ key: 'now', label: 'Bugun', count: count('now') }, { key: 'later', label: 'Keyingi', count: count('later') }, { key: 'done', label: 'Bajarilgan', count: count('done') }]}
          value={seg} onChange={setSeg}
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.pageX, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        <Reveal loading={q.isLoading} skeleton={<SkeletonList rows={5} />} replay={seg}>
          {q.isError && !q.data ? (
            <EmptyState icon="cloud-off" title="Vazifalar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
          ) : list.length === 0 ? (
            needle ? <EmptyState icon="search" title="Hech narsa topilmadi" hint="Boshqa so'z bilan qidiring" /> : <EmptyState icon={EMPTY[seg].icon} title={EMPTY[seg].title} hint={EMPTY[seg].hint} />
          ) : (
            <ListGroup>
              {list.map((t) => {
                const st = STATUS_ICON[t.status] ?? STATUS_ICON.TODO!;
                const done = t.status === 'DONE';
                const sub = [t.project?.name, t.dueDate ? `muddat ${fmtDate(t.dueDate)}` : null, t.photoKeys.length ? `${t.photoKeys.length} foto` : null].filter(Boolean).join(' · ');
                return (
                  <ListItem
                    key={t.id} icon={st.icon} tone={st.tone} title={t.title} subtitle={sub} subtitleLines={1}
                    onPress={done ? undefined : () => open(t)}
                    value={t.priority === 'HIGH' && !done ? PRIORITY_LABEL.HIGH : undefined}
                    badge={{ text: statusLabel(t.status), tone: statusTone(t.status) }}
                  />
                );
              })}
            </ListGroup>
          )}
        </Reveal>
      </ScrollView>
    </Screen>
  );
}
