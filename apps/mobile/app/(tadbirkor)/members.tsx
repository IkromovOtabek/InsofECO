import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Gap, Label, ListItem, Screen, Txt } from '@/design/primitives';
import { toast } from '@/design/ui';
import { space } from '@/design/tokens';
import { api, uuid } from '@/core/api';

interface Member { id: string; role: string; isActive: boolean; user: { id: string; phone: string; fullName: string | null } }

export default function MembersScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['members'], queryFn: () => api<Member[]>('/organizations/members') });
  const act = useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'remove' }) => api(`/organizations/members/${v.id}/${v.action}`, { method: 'POST', idempotencyKey: uuid() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
    onError: (e) => toast.error(e.message, 'Xato'),
  });
  const pending = (q.data ?? []).filter((m) => !m.isActive);
  const active = (q.data ?? []).filter((m) => m.isActive);
  const roleName = (r: string) => ({ TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' }[r] ?? r);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}>
        {pending.length ? (
          <>
            <Label>Tasdiq kutmoqda</Label>
            {pending.map((m) => (
              <Card key={m.id} style={{ marginBottom: space.md }}>
                <Txt v="titleSm">{m.user.fullName ?? m.user.phone}</Txt>
                <Txt v="caption">{roleName(m.role)} · {m.user.phone}</Txt>
                <Gap />
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button title="Rad etish" variant="ghost" style={{ flex: 1 }} onPress={() => act.mutate({ id: m.id, action: 'remove' })} />
                  <Button title="Tasdiqlash" icon="check" style={{ flex: 2 }} loading={act.isPending} onPress={() => act.mutate({ id: m.id, action: 'approve' })} />
                </View>
              </Card>
            ))}
            <Gap />
          </>
        ) : null}
        <Label>Xodimlar</Label>
        <Card style={{ paddingVertical: space.xs }}>
          {active.length === 0 ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Hozircha xodim yo&apos;q</Txt> : null}
          {active.map((m, i, arr) => <ListItem key={m.id} icon="user" title={m.user.fullName ?? m.user.phone} subtitle={`${roleName(m.role)} · ${m.user.phone}`} last={i === arr.length - 1} />)}
        </Card>
      </ScrollView>
    </Screen>
  );
}
