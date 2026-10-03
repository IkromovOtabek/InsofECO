import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, ListGroup, Reveal, SkeletonList } from '@/design/blocks';
import { EmptyState, ListItem, Screen, SearchField, statusLabel, statusTone } from '@/design/primitives';
import { daysLeft } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useProjects } from '@/features/eco/api';

const SEG = [{ key: 'active', label: 'Faol' }, { key: 'all', label: 'Hammasi' }, { key: 'done', label: 'Tugallangan' }] as const;
type SegKey = (typeof SEG)[number]['key'];
const isActive = (s: string) => s === 'ACTIVE' || s === 'DELAYED';

/** Quruvchi "Obyektlar" — demo ro'yxat: qidiruv → chiplar (soni bilan) → ListGroup (bajarilish % va holat o'ngda). */
export default function QuruvchiSites() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useProjects();
  const [seg, setSeg] = useState<SegKey>('active');
  const [search, setSearch] = useState('');
  const all = useMemo(() => q.data ?? [], [q.data]);
  const counts: Record<SegKey, number> = {
    active: all.filter((p) => isActive(p.status)).length,
    all: all.length,
    done: all.filter((p) => p.status === 'COMPLETED').length,
  };
  const needle = search.trim().toLowerCase();
  const list = all.filter((p) => (seg === 'all' || (seg === 'active' ? isActive(p.status) : p.status === 'COMPLETED'))
    && (!needle || `${p.name} ${p.address}`.toLowerCase().includes(needle)));

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        <Reveal loading={q.isLoading} skeleton={<SkeletonList rows={4} />} replay={seg}>
          <SearchField value={search} onChangeText={setSearch} placeholder="Obyekt nomi yoki manzil" />
          <ChipGroup items={SEG.map((s) => ({ key: s.key, label: s.label, count: counts[s.key] || undefined }))} value={seg} onChange={setSeg} />
          {q.isError && !q.data ? (
            <EmptyState icon="cloud-off" title="Obyektlar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState icon={needle ? 'search' : 'hard-hat'} title={needle ? 'Hech narsa topilmadi' : "Obyekt yo'q"} hint={needle ? "Boshqa so'z bilan qidiring" : "Tadbirkor sizni loyihaga qo'shganda shu yerda ko'rinadi"} />
          ) : (
            <ListGroup>
              {list.map((p) => {
                const dl = daysLeft(p.deadline);
                const late = dl !== null && dl < 0 && p.status !== 'COMPLETED';
                const meta = [p.address, dl === null || p.status === 'COMPLETED' ? null : dl < 0 ? `${-dl} kun kechikdi` : `${dl} kun qoldi`].filter(Boolean).join(' · ');
                return (
                  <ListItem
                    key={p.id} icon="hard-hat" module="production" tone={late ? 'danger' : undefined}
                    title={p.name} subtitle={meta} subtitleLines={1}
                    value={`${Math.round(Number(p.progress ?? 0))}%`}
                    badge={{ text: statusLabel(p.status), tone: statusTone(p.status) }}
                    onPress={() => router.push(`/project/${p.id}`)}
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
