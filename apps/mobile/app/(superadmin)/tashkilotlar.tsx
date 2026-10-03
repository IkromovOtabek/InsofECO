import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, ListGroup, SkeletonList } from '@/design/blocks';
import { EmptyState, ListItem, Screen, SearchField, Txt, fmtNum } from '@/design/primitives';
import { LiveItem, LiveList } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useAdminOrgs } from '@/features/admin/api';
import { useDebounced } from '@/features/admin/ui';

type Filter = 'all' | 'PLANT' | 'CONTRACTOR' | 'blocked';

/** Tashkilotlar: qidiruv (nom / INN / id) + tur/bloklangan filtri → kartochka (bloklash amali o'sha yerda). */
export default function AdminOrganizations() {
  const router = useRouter();
  const { c } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = useDebounced(search.trim());
  const list = useAdminOrgs({ q: q || undefined, type: filter === 'PLANT' || filter === 'CONTRACTOR' ? filter : undefined, blocked: filter === 'blocked' ? true : undefined });
  const rows = list.data?.rows ?? [];

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12 * 2, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={c.textMuted} />}
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Nom, INN yoki id…" autoCapitalize="none" />
        <ChipGroup<Filter>
          items={[{ key: 'all', label: 'Barchasi' }, { key: 'PLANT', label: 'Zavodlar' }, { key: 'CONTRACTOR', label: 'Mijozlar' }, { key: 'blocked', label: 'Bloklangan' }]}
          value={filter} onChange={setFilter}
        />
        {list.isLoading ? <SkeletonList rows={6} />
          : list.isError && !list.data ? <EmptyState icon="cloud-off" title="Yuklanmadi" hint={list.error instanceof Error ? list.error.message : undefined} onRetry={() => void list.refetch()} />
          : rows.length === 0 ? <ListGroup><EmptyState compact icon={q ? 'search' : 'building'} title={q ? 'Topilmadi' : "Tashkilot yo'q"} /></ListGroup>
          : (
            <LiveList stagger>
              <ListGroup>
                {rows.map((o, i) => (
                  <LiveItem key={o.id} index={i}>
                    <ListItem
                      icon={o.type === 'PLANT' ? 'factory' : 'building'} module={o.type === 'PLANT' ? 'production' : 'brand'}
                      title={o.name}
                      subtitle={`${o.type === 'PLANT' ? 'Zavod' : 'Mijoz'}${o.inn ? ` · INN ${o.inn}` : ''} · ${o.members} a'zo · ${fmtNum(o.orders)} buyurtma`}
                      badge={o.blockedAt ? { text: 'Bloklangan', tone: 'danger' } : o.externalRef ? { text: 'ERP', tone: 'info' } : undefined}
                      chevron
                      onPress={() => router.push({ pathname: '/(superadmin)/tashkilot', params: { id: o.id } } as never)}
                    />
                  </LiveItem>
                ))}
              </ListGroup>
            </LiveList>
          )}
        {list.data ? (
          <View>
            <Txt v="caption" color="muted" align="center">{list.data.total > rows.length ? `${rows.length} / ${fmtNum(list.data.total)} ta ko'rsatildi — qidiruvni aniqlashtiring` : `${fmtNum(list.data.total)} ta tashkilot`}</Txt>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
