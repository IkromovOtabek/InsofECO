import React from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Card, EmptyState, Gap, Screen, StatusChip, Txt } from '@/design/primitives';
import { Icon, Pill, Section } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useAction, useMyTasks } from '@/features/eco/api';

/** Vazifalar: checkbox bilan holat o'zgaradi (TODO → IN_PROGRESS → REVIEW), Tadbirkor DONE qiladi. */
export default function Tasks() {
  const { c } = useTheme();
  const q = useMyTasks();
  const upd = useAction<{ id: string; status: string; comment?: string }>((v) => ({ path: `/tasks/${v.id}`, method: 'PATCH', body: { status: v.status, comment: v.comment } }), ['tasks', 'dash']);
  const groups = [['Bugun / muddati o\'tgan', (t: { dueDate?: string | null; status: string }) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate).getTime() < Date.now() + 86_400_000], ['Keyingi', (t: { dueDate?: string | null; status: string }) => t.status !== 'DONE' && !(t.dueDate && new Date(t.dueDate).getTime() < Date.now() + 86_400_000)], ['Bajarilgan', (t: { status: string }) => t.status === 'DONE']] as const;
  const next = (s: string) => ({ TODO: 'IN_PROGRESS', IN_PROGRESS: 'REVIEW', REVIEW: 'REVIEW', DONE: 'DONE' })[s] ?? 'IN_PROGRESS';
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}>
        {(q.data ?? []).length === 0 && !q.isLoading ? <EmptyState title="Vazifalar yo'q" /> : null}
        {groups.map(([title, f]) => {
          const list = (q.data ?? []).filter(f as never);
          if (!list.length) return null;
          return (
            <Section key={title} title={title} style={{ marginTop: 8 }}>
              {list.map((t, i) => (
                <Pressable key={t.id} onPress={() => t.status === 'DONE' ? null : Alert.alert(t.title, t.description ?? 'Holatni o\'zgartirish', [{ text: t.status === 'TODO' ? 'Boshlash' : 'Tekshiruvga topshirish', onPress: () => upd.mutate({ id: t.id, status: next(t.status) }) }, { text: 'Bekor', style: 'cancel' }])} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i === list.length - 1 ? 0 : 0.5, borderBottomColor: c.border }}>
                  <Icon name={t.status === 'DONE' ? 'checkbox' : t.status === 'REVIEW' ? 'time' : t.status === 'IN_PROGRESS' ? 'ellipse-outline' : 'square-outline'} size={24} color={t.status === 'DONE' ? c.success : t.status === 'REVIEW' ? c.warning : c.brandPrimary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Txt v="bodyStrong" style={t.status === 'DONE' ? { textDecorationLine: 'line-through', color: c.textSecondary } : undefined}>{t.title}</Txt>
                    <Txt v="caption" color="secondary">{t.project?.name}{t.dueDate ? ` · ${new Date(t.dueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}` : ''}</Txt>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}><Pill label={({ LOW: 'Past', MEDIUM: "O'rta", HIGH: 'Muhim' })[t.priority]} tone={t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'neutral'} />{t.photoKeys.length ? <Pill label={`📷 ${t.photoKeys.length}`} tone="info" /> : null}<StatusChip status={t.status} /></View>
                  </View>
                </Pressable>
              ))}
            </Section>
          );
        })}
        <Gap h={30} /><Card style={{ display: 'none' }} />
      </ScrollView>
    </Screen>
  );
}
