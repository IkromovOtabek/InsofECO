import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, ListGroup, StickyActionBar } from '@/design/blocks';
import { EmptyState, IconButton, Input, ListItem, Screen, StatusChip, Txt } from '@/design/primitives';
import { Appear } from '@/design/motion';
import { daysLeft, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { ListSkeleton } from '@/features/erp/ui';
import { useProjects } from '@/features/eco/api';

const SEG = [{ key: 'all', label: 'Barchasi' }, { key: 'ACTIVE', label: 'Faol' }, { key: 'DELAYED', label: 'Kechikmoqda' }, { key: 'PLANNING', label: 'Reja' }, { key: 'COMPLETED', label: 'Tugallangan' }] as const;
type SegKey = (typeof SEG)[number]['key'];

/** Loyihalar: qidiruv → holat chiplari → ListGroup (holat nishoni + o'ngda progress); "Yangi loyiha" pastki panelda. */
export default function Projects() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useProjects();
  const [seg, setSeg] = useState<SegKey>('all');
  const [search, setSearch] = useState('');
  const all = useMemo(() => q.data ?? [], [q.data]);
  const counts = useMemo(() => all.reduce<Record<string, number>>((a, p) => ((a[p.status] = (a[p.status] ?? 0) + 1), a), {}), [all]);
  const needle = search.trim().toLowerCase();
  const list = all.filter((p) => (seg === 'all' || p.status === seg) && (!needle || `${p.name} ${p.address} ${p.clientName ?? ''}`.toLowerCase().includes(needle)));
  const active = SEG.find((s) => s.key === seg);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        <Input
          value={search} onChangeText={setSearch} placeholder="Loyiha yoki manzil…" left="search" autoCorrect={false} returnKeyType="search"
          right={search ? <IconButton icon="x" label="Tozalash" tone="muted" size={size.touch - space.sm} onPress={() => setSearch('')} /> : null}
          containerStyle={{ marginBottom: 0 }}
        />
        <ChipGroup items={SEG.map((s) => ({ key: s.key, label: s.label, count: s.key === 'all' ? all.length || undefined : counts[s.key] || undefined }))} value={seg} onChange={setSeg} />
        {q.isLoading ? <ListSkeleton rows={5} />
          : q.isError && !q.data ? <EmptyState icon="cloud-off" title="Loyihalar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
          : list.length === 0 ? (
            all.length === 0
              ? <EmptyState icon="building" title="Loyihalar yo'q" hint="Pastdagi Yangi loyiha tugmasi bilan boshlang" />
              : <EmptyState icon="search" title="Hech narsa topilmadi" hint={needle ? "Boshqa so'z bilan qidiring" : `"${active?.label ?? ''}" holatida loyiha yo'q`} />
          ) : (
            <Appear>
              <Txt v="caption" color="muted" style={{ marginBottom: space.sm }}>{`${list.length} ta loyiha`}</Txt>
              <ListGroup>
                {list.map((p) => {
                  const dl = daysLeft(p.deadline);
                  const done = p.tasks?.filter((t) => t.status === 'DONE').length ?? 0;
                  const late = dl !== null && dl < 0 && p.status !== 'COMPLETED';
                  const meta = [
                    dl === null || p.status === 'COMPLETED' ? null : dl < 0 ? `${-dl} kun kechikdi` : `${dl} kun qoldi`,
                    `${fmtShort(p.spent)} / ${fmtShort(p.budget)} so'm`,
                    `${done}/${p.tasks?.length ?? 0} vazifa`,
                    `${p._count?.members ?? 0} kishi`,
                  ].filter(Boolean).join(' · ');
                  return (
                    <ListItem
                      key={p.id} icon="building" module="production" tone={late ? 'danger' : undefined}
                      title={p.name} subtitle={`${p.address}\n${meta}`} subtitleLines={2}
                      onPress={() => router.push(`/project/${p.id}`)}
                      right={(
                        <View style={{ alignItems: 'flex-end', gap: space.xs, flexShrink: 0 }}>
                          <Txt v="bodyStrong" color={late ? 'danger' : 'strong'}>{`${p.progress}%`}</Txt>
                          <StatusChip status={p.status} />
                        </View>
                      )}
                    />
                  );
                })}
              </ListGroup>
            </Appear>
          )}
      </ScrollView>
      <StickyActionBar primary={{ title: 'Yangi loyiha', icon: 'plus', onPress: () => router.push('/(tadbirkor)/new-project') }} style={{ paddingBottom: space.md }} />
    </Screen>
  );
}
