import React from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Badge, EmptyState, Gap, Panel, Screen, StatusChip, Txt, fmtDate } from '@/design/primitives';
import { Icon, IconName, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { Tone, size, space } from '@/design/tokens';
import { useAction, useMyTasks } from '@/features/eco/api';

const STATUS_ICON: Record<string, { icon: IconName; tone: Tone }> = {
  DONE: { icon: 'circle-check', tone: 'success' }, REVIEW: { icon: 'clock', tone: 'warning' }, IN_PROGRESS: { icon: 'circle-dot', tone: 'brand' }, TODO: { icon: 'circle', tone: 'neutral' },
};
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Past', MEDIUM: "O'rta", HIGH: 'Muhim' };

/** Vazifalar: holat o'zgaradi (TODO → IN_PROGRESS → REVIEW), Tadbirkor DONE qiladi. */
export default function Tasks() {
  const { c } = useTheme();
  const q = useMyTasks();
  const upd = useAction<{ id: string; status: string; comment?: string }>((v) => ({ path: `/tasks/${v.id}`, method: 'PATCH', body: { status: v.status, comment: v.comment } }), ['tasks', 'dash']);
  const groups = [['Bugun / muddati o\'tgan', (t: { dueDate?: string | null; status: string }) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate).getTime() < Date.now() + 86_400_000], ['Keyingi', (t: { dueDate?: string | null; status: string }) => t.status !== 'DONE' && !(t.dueDate && new Date(t.dueDate).getTime() < Date.now() + 86_400_000)], ['Bajarilgan', (t: { status: string }) => t.status === 'DONE']] as const;
  const next = (s: string) => ({ TODO: 'IN_PROGRESS', IN_PROGRESS: 'REVIEW', REVIEW: 'REVIEW', DONE: 'DONE' })[s] ?? 'IN_PROGRESS';
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}>
        {(q.data ?? []).length === 0 && !q.isLoading ? <EmptyState title="Vazifalar yo'q" hint="Tadbirkor vazifa bersa shu yerda ko'rinadi" icon="square-check" /> : null}
        {groups.map(([title, f]) => {
          const list = (q.data ?? []).filter(f as never);
          if (!list.length) return null;
          return (
            <Panel key={title} title={title} style={{ marginTop: space.sm }}>
              {list.map((t, i) => {
                const st = STATUS_ICON[t.status] ?? STATUS_ICON.TODO!;
                const done = t.status === 'DONE';
                return (
                  <Pressable
                    key={t.id} accessibilityRole="button" accessibilityLabel={t.title} accessibilityState={{ checked: done }} disabled={done} android_ripple={{ color: c.bgMuted }}
                    onPress={() => Alert.alert(t.title, t.description ?? 'Holatni o\'zgartirish', [{ text: t.status === 'TODO' ? 'Boshlash' : 'Tekshiruvga topshirish', onPress: () => upd.mutate({ id: t.id, status: next(t.status) }, { onError: (e) => toast.error(e.message, 'Xato') }) }, { text: 'Bekor', style: 'cancel' }])}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row, paddingVertical: space.md, borderBottomWidth: i === list.length - 1 ? 0 : size.hairline, borderBottomColor: c.borderSubtle }, pressed && { backgroundColor: c.bgMuted }]}
                  >
                    <Icon name={st.icon} size={size.iconLg} tone={st.tone === 'neutral' ? 'muted' : st.tone} />
                    <View style={{ flex: 1 }}>
                      <Txt v="bodyStrong" color={done ? 'muted' : 'strong'} style={done ? { textDecorationLine: 'line-through' } : undefined}>{t.title}</Txt>
                      <Txt v="caption">{t.project?.name}{t.dueDate ? ` · ${fmtDate(t.dueDate)}` : ''}</Txt>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs }}>
                        <Badge label={PRIORITY_LABEL[t.priority] ?? t.priority} tone={t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'neutral'} icon={t.priority === 'HIGH' ? 'triangle-alert' : null} />
                        {t.photoKeys.length ? <Badge label={String(t.photoKeys.length)} tone="info" icon="camera" /> : null}
                        <StatusChip status={t.status} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </Panel>
          );
        })}
        <Gap h={space.xxxl} />
      </ScrollView>
    </Screen>
  );
}
