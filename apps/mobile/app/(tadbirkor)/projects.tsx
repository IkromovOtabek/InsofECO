import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Gap, Screen, StatusChip, Txt } from '@/design/primitives';
import { Icon, ProgressBar, Segmented, daysLeft, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useProjects } from '@/features/eco/api';

const SEG = [{ key: 'all', label: 'Barchasi' }, { key: 'ACTIVE', label: 'Faol' }, { key: 'DELAYED', label: 'Kechikmoqda' }, { key: 'PLANNING', label: 'Reja' }, { key: 'COMPLETED', label: 'Tugallangan' }] as const;

export default function Projects() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useProjects();
  const [seg, setSeg] = useState<(typeof SEG)[number]['key']>('all');
  const list = (q.data ?? []).filter((p) => seg === 'all' || p.status === seg);
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Segmented value={seg} onChange={setSeg} items={SEG as never} /></View>
      <FlatList
        data={list} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} ItemSeparatorComponent={() => <Gap h={10} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Loyihalar yo'q" hint="+ Yangi loyiha tugmasini bosing" />}
        renderItem={({ item: p }) => {
          const dl = daysLeft(p.deadline); const done = p.tasks?.filter((t) => t.status === 'DONE').length ?? 0;
          return (
            <Pressable onPress={() => router.push(`/project/${p.id}`)}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}><Txt v="heading">{p.name}</Txt><Txt v="caption" color="secondary" numberOfLines={1}>{p.address}</Txt></View>
                  <StatusChip status={p.status} />
                </View>
                <Gap h={12} />
                <ProgressBar value={p.progress} tone={p.status === 'DELAYED' ? 'warning' : p.status === 'COMPLETED' ? 'success' : 'brand'} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Txt v="caption" color="secondary">Progress {p.progress}%</Txt>
                  <Txt v="caption" color={dl !== null && dl < 0 ? 'danger' : 'secondary'}>{dl === null ? '' : dl < 0 ? `${-dl} kun kechikdi` : `${dl} kun qoldi`}</Txt>
                </View>
                <Gap h={10} />
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <Meta icon="wallet-outline" text={`Byudjet ${fmtShort(p.budget)}`} />
                  <Meta icon="trending-down-outline" text={`Sarf ${fmtShort(p.spent)}`} />
                  <Meta icon="people-outline" text={`${p._count?.members ?? 0}`} />
                  <Meta icon="checkbox-outline" text={`${done}/${p.tasks?.length ?? 0}`} />
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
        <Button title="+ Yangi loyiha" onPress={() => router.push('/(tadbirkor)/new-project')} style={{ shadowColor: c.brandPrimary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }} />
      </View>
    </Screen>
  );
}
function Meta({ icon, text }: { icon: React.ComponentProps<typeof Icon>['name']; text: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name={icon} size={14} /><Txt v="caption" color="secondary">{text}</Txt></View>;
}
