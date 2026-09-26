import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Gap, ProgressBar, Screen, StatusChip, Txt } from '@/design/primitives';
import { Icon, IconName, Tabs, daysLeft, fmtShort } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useProjects } from '@/features/eco/api';

const SEG = [{ key: 'all', label: 'Barchasi' }, { key: 'ACTIVE', label: 'Faol' }, { key: 'DELAYED', label: 'Kechikmoqda' }, { key: 'PLANNING', label: 'Reja' }, { key: 'COMPLETED', label: 'Tugallangan' }] as const;
type SegKey = (typeof SEG)[number]['key'];

export default function Projects() {
  const router = useRouter();
  const q = useProjects();
  const [seg, setSeg] = useState<SegKey>('all');
  const list = (q.data ?? []).filter((p) => seg === 'all' || p.status === seg);
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>
        <Tabs value={seg} onChange={setSeg} items={[...SEG]} />
      </View>
      <FlatList
        data={list} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: space.pageX, paddingBottom: size.buttonLg + space.x12 }} ItemSeparatorComponent={() => <Gap h={space.md} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Loyihalar yo'q" hint="Yangi loyiha tugmasi bilan boshlang" icon="building" />}
        renderItem={({ item: p }) => {
          const dl = daysLeft(p.deadline); const done = p.tasks?.filter((t) => t.status === 'DONE').length ?? 0;
          return (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/project/${p.id}`)}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="titleSm">{p.name}</Txt>
                    <Txt v="caption" numberOfLines={1}>{p.address}</Txt>
                  </View>
                  <StatusChip status={p.status} />
                </View>
                <Gap h={space.md} />
                <ProgressBar value={p.progress} tone={p.status === 'DELAYED' ? 'warning' : p.status === 'COMPLETED' ? 'success' : 'brand'} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs }}>
                  <Txt v="caption">Progress {p.progress}%</Txt>
                  <Txt v="caption" color={dl !== null && dl < 0 ? 'danger' : 'muted'}>{dl === null ? '' : dl < 0 ? `${-dl} kun kechikdi` : `${dl} kun qoldi`}</Txt>
                </View>
                <Gap h={space.md} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
                  <Meta icon="wallet" text={`Byudjet ${fmtShort(p.budget)} so'm`} />
                  <Meta icon="trending-down" text={`Sarf ${fmtShort(p.spent)} so'm`} />
                  <Meta icon="users" text={`${p._count?.members ?? 0}`} />
                  <Meta icon="square-check" text={`${done}/${p.tasks?.length ?? 0}`} />
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
      <View style={{ position: 'absolute', left: space.pageX, right: space.pageX, bottom: space.lg }}>
        <Button title="Yangi loyiha" icon="plus" size="lg" onPress={() => router.push('/(tadbirkor)/new-project')} />
      </View>
    </Screen>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <Icon name={icon} tone="muted" />
      <Txt v="caption">{text}</Txt>
    </View>
  );
}
