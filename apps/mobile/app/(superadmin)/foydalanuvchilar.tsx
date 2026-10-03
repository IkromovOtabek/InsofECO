import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, ListGroup, SkeletonList } from '@/design/blocks';
import { EmptyState, ListItem, Screen, SearchField, Txt, fmtNum } from '@/design/primitives';
import { Avatar, fmtRel } from '@/design/ui';
import { LiveItem, LiveList } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { EcoRole, ROLE_LABEL, useAdminUsers } from '@/features/admin/api';
import { useDebounced } from '@/features/admin/ui';

type Filter = 'all' | EcoRole | 'blocked';

/** Foydalanuvchilar: qidiruv (ism / telefon / id) + rol/bloklangan filtri → kartochka (amallar o'sha yerda). */
export default function AdminUsers() {
  const router = useRouter();
  const { c } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = useDebounced(search.trim());
  const list = useAdminUsers({ q: q || undefined, role: filter !== 'all' && filter !== 'blocked' ? filter : undefined, blocked: filter === 'blocked' ? true : undefined });
  const rows = list.data?.rows ?? [];

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12 * 2, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={c.textMuted} />}
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Ism, telefon yoki id…" autoCapitalize="none" />
        <ChipGroup<Filter>
          items={[{ key: 'all', label: 'Barchasi' }, { key: 'TADBIRKOR', label: 'Tadbirkor' }, { key: 'QURUVCHI', label: 'Mijoz' }, { key: 'HAYDOVCHI', label: 'Haydovchi' }, { key: 'blocked', label: 'Bloklangan' }]}
          value={filter} onChange={setFilter}
        />
        {list.isLoading ? <SkeletonList rows={6} />
          : list.isError && !list.data ? <EmptyState icon="cloud-off" title="Yuklanmadi" hint={list.error instanceof Error ? list.error.message : undefined} onRetry={() => void list.refetch()} />
          : rows.length === 0 ? <ListGroup><EmptyState compact icon={q ? 'search' : 'users'} title={q ? 'Topilmadi' : "Foydalanuvchi yo'q"} /></ListGroup>
          : (
            <LiveList stagger>
              <ListGroup>
                {rows.map((u, i) => {
                  const roles = Array.from(new Set(u.memberships.filter((m) => m.isActive).map((m) => ROLE_LABEL[m.role])));
                  const org = u.memberships[0]?.organization.name;
                  return (
                    <LiveItem key={u.id} index={i}>
                      <ListItem
                        leading={<Avatar name={u.fullName ?? u.phone} size={size.iconTile} tone={u.blockedAt ? 'danger' : u.isSuperAdmin ? 'brand' : 'neutral'} />}
                        title={u.fullName ?? u.phone}
                        subtitle={[u.phone, roles.join(', ') || "rolsiz", org].filter(Boolean).join(' · ')}
                        badge={u.isSuperAdmin ? { text: 'Superadmin', tone: 'brand' } : u.blockedAt ? { text: 'Bloklangan', tone: 'danger' } : undefined}
                        value={u.lastSeenAt && !u.isSuperAdmin && !u.blockedAt ? fmtRel(u.lastSeenAt) : undefined}
                        chevron
                        onPress={() => router.push({ pathname: '/(superadmin)/foydalanuvchi', params: { id: u.id } } as never)}
                      />
                    </LiveItem>
                  );
                })}
              </ListGroup>
            </LiveList>
          )}
        {list.data ? (
          <View>
            <Txt v="caption" color="muted" align="center">{list.data.total > rows.length ? `${rows.length} / ${fmtNum(list.data.total)} ta ko'rsatildi — qidiruvni aniqlashtiring` : `${fmtNum(list.data.total)} ta foydalanuvchi`}</Txt>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
