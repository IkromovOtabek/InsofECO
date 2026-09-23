import React from 'react';
import { Alert, RefreshControl, ScrollView } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Gap, ListItem, Row, SectionLabel, Txt } from '@/design/primitives';
import { api, uuid } from '@/core/api';

interface Member { id: string; role: string; isActive: boolean; user: { id: string; phone: string; fullName: string | null } }

export default function MembersScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['members'], queryFn: () => api<Member[]>('/organizations/members') });
  const act = useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'remove' }) => api(`/organizations/members/${v.id}/${v.action}`, { method: 'POST', idempotencyKey: uuid() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
    onError: (e) => Alert.alert('Xato', e.message),
  });
  const pending = (q.data ?? []).filter((m) => !m.isActive);
  const active = (q.data ?? []).filter((m) => m.isActive);
  const roleName = (r: string) => ({ TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' }[r] ?? r);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}>
      {pending.length ? (
        <>
          <SectionLabel>Tasdiq kutmoqda</SectionLabel>
          {pending.map((m) => (
            <Card key={m.id} style={{ marginBottom: 10 }}>
              <Txt v="heading">{m.user.fullName ?? m.user.phone}</Txt>
              <Txt v="caption" color="secondary">{roleName(m.role)} · {m.user.phone}</Txt>
              <Gap />
              <Row style={{ gap: 10 }}>
                <Button title="Rad etish" variant="ghost" size="md" style={{ flex: 1 }} onPress={() => act.mutate({ id: m.id, action: 'remove' })} />
                <Button title="Tasdiqlash" size="md" style={{ flex: 2 }} loading={act.isPending} onPress={() => act.mutate({ id: m.id, action: 'approve' })} />
              </Row>
            </Card>
          ))}
          <Gap />
        </>
      ) : null}
      <SectionLabel>Xodimlar</SectionLabel>
      <Card>
        {active.length === 0 ? <Txt color="secondary">Hozircha xodim yo'q</Txt> : null}
        {active.map((m) => <ListItem key={m.id} title={m.user.fullName ?? m.user.phone} subtitle={`${roleName(m.role)} · ${m.user.phone}`} />)}
      </Card>
    </ScrollView>
  );
}
