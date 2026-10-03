import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChipGroup, ListGroup, SectionHead } from '@/design/blocks';
import { Badge, Button, EmptyState, Gap, IconButton, Input, ListItem, Screen, Txt } from '@/design/primitives';
import { Appear } from '@/design/motion';
import { Avatar, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { ListSkeleton } from '@/features/erp/ui';
import { api, uuid } from '@/core/api';

interface Member { id: string; role: string; isActive: boolean; user: { id: string; phone: string; fullName: string | null } }

const ROLE_NAME: Record<string, string> = { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' };
const roleName = (r: string) => ROLE_NAME[r] ?? r;
type RoleKey = 'all' | 'QURUVCHI' | 'HAYDOVCHI' | 'TADBIRKOR';

/** Xodimlar: tasdiq kutayotganlar (amallar qatorning o'zida) → qidiruv + rol chiplari → faol xodimlar ro'yxati. */
export default function MembersScreen() {
  const qc = useQueryClient();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['members'], queryFn: () => api<Member[]>('/organizations/members') });
  const act = useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'remove' }) => api(`/organizations/members/${v.id}/${v.action}`, { method: 'POST', idempotencyKey: uuid() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
    onError: (e) => toast.error(e.message, 'Xato'),
  });
  const [role, setRole] = useState<RoleKey>('all');
  const [search, setSearch] = useState('');
  const all = q.data ?? [];
  const pending = all.filter((m) => !m.isActive);
  const activeAll = all.filter((m) => m.isActive);
  const needle = search.trim().toLowerCase();
  const active = activeAll.filter((m) => (role === 'all' || m.role === role) && (!needle || `${m.user.fullName ?? ''} ${m.user.phone}`.toLowerCase().includes(needle)));
  const countOf = (r: string) => activeAll.filter((m) => m.role === r).length || undefined;
  const busyId = act.isPending ? act.variables?.id : undefined;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        {q.isLoading ? <ListSkeleton rows={6} />
          : q.isError && !q.data ? <EmptyState icon="cloud-off" title="Xodimlar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
          : (
            <>
              {pending.length ? (
                <Appear>
                  <SectionHead title="Tasdiq kutmoqda" count={pending.length} icon="user-plus" />
                  <ListGroup>
                    {pending.map((m) => (
                      <ListItem
                        key={m.id} chevron={false}
                        leading={<Avatar name={m.user.fullName ?? m.user.phone} size={size.iconTile} tone="warning" />}
                        title={m.user.fullName ?? m.user.phone}
                        subtitle={`${roleName(m.role)} · ${m.user.phone}`}
                        right={(
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 0 }}>
                            <IconButton icon="x" label="Rad etish" tone="danger" variant="secondary" disabled={!!busyId} onPress={() => act.mutate({ id: m.id, action: 'remove' })} />
                            <Button title="Tasdiqlash" icon="check" full={false} loading={busyId === m.id && act.variables?.action === 'approve'} disabled={!!busyId && busyId !== m.id} onPress={() => act.mutate({ id: m.id, action: 'approve' })} />
                          </View>
                        )}
                      />
                    ))}
                  </ListGroup>
                  <Gap h={space.section} />
                </Appear>
              ) : null}

              <SectionHead title="Xodimlar" count={activeAll.length || undefined} icon="users" />
              <View style={{ gap: space.md }}>
                <Input
                  value={search} onChangeText={setSearch} placeholder="Ism yoki telefon…" left="search" autoCorrect={false} returnKeyType="search"
                  right={search ? <IconButton icon="x" label="Tozalash" tone="muted" size={size.touch - space.sm} onPress={() => setSearch('')} /> : null}
                  containerStyle={{ marginBottom: 0 }}
                />
                <ChipGroup
                  items={[{ key: 'all' as RoleKey, label: 'Barchasi' }, { key: 'QURUVCHI' as RoleKey, label: 'Quruvchi', count: countOf('QURUVCHI') }, { key: 'HAYDOVCHI' as RoleKey, label: 'Haydovchi', count: countOf('HAYDOVCHI') }, { key: 'TADBIRKOR' as RoleKey, label: 'Tadbirkor', count: countOf('TADBIRKOR') }]}
                  value={role} onChange={setRole}
                />
                {active.length === 0 ? (
                  <ListGroup>
                    <EmptyState compact icon={needle ? 'search' : 'users'} title={needle ? 'Hech kim topilmadi' : "Hozircha xodim yo'q"} hint={needle ? "Boshqa so'z bilan qidiring" : "Tasdiqlangan xodimlar shu yerda ko'rinadi"} />
                  </ListGroup>
                ) : (
                  <ListGroup>
                    {active.map((m) => (
                      <ListItem
                        key={m.id} chevron={false}
                        leading={<Avatar name={m.user.fullName ?? m.user.phone} size={size.iconTile} />}
                        title={m.user.fullName ?? m.user.phone}
                        subtitle={m.user.phone}
                        right={<Badge label={roleName(m.role)} tone={m.role === 'HAYDOVCHI' ? 'info' : m.role === 'TADBIRKOR' ? 'brand' : 'neutral'} icon={null} />}
                      />
                    ))}
                  </ListGroup>
                )}
                {active.length ? <Txt v="caption" color="muted" align="center">{`${active.length} ta xodim`}</Txt> : null}
              </View>
            </>
          )}
      </ScrollView>
    </Screen>
  );
}
