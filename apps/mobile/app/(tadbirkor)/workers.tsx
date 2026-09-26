import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SPECIALTY_LABEL, Specialty } from '@insof/shared';
import { Badge, Card, EmptyState, Gap, Screen, Txt } from '@/design/primitives';
import { Avatar, Icon, Stars, Tabs } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useWorkers } from '@/features/eco/api';

export default function Workers() {
  const router = useRouter();
  const [spec, setSpec] = useState<string>('all');
  const q = useWorkers(spec === 'all' ? undefined : spec);
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm }}>
        <Tabs value={spec} onChange={setSpec} items={[{ key: 'all', label: 'Barchasi' }, ...Specialty.map((s) => ({ key: s, label: SPECIALTY_LABEL[s] }))]} />
      </View>
      <FlatList data={q.data ?? []} keyExtractor={(w) => w.userId} contentContainerStyle={{ padding: space.pageX }} ItemSeparatorComponent={() => <Gap h={space.md} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Quruvchilar yo'q" hint="Xodimlar bo'limida quruvchini tasdiqlang" icon="hard-hat" />}
        renderItem={({ item: w }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={w.fullName ?? undefined} onPress={() => router.push(`/worker/${w.userId}`)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Avatar name={w.fullName} size={size.avatar} />
              <View style={{ flex: 1 }}>
                <Txt v="titleSm">{w.fullName}</Txt>
                <Txt v="caption">{w.profile ? `${SPECIALTY_LABEL[w.profile.specialty as keyof typeof SPECIALTY_LABEL]} · ${fmtYears(w.profile.experienceYears)} · ${w.profile.completedJobs} ish` : 'Profil to\'ldirilmagan'}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs }}>
                  {w.profile ? <Stars value={w.profile.ratingAvg} /> : null}
                  {w.activeWork ? <Badge label="Ishda" tone="brand" icon="hammer" /> : <Badge label="Bo'sh" tone="success" />}
                </View>
                {w.currentProject ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }}>
                    <Icon name="map-pin" tone="muted" />
                    <Txt v="caption" numberOfLines={1} style={{ flex: 1 }}>{w.currentProject.name}</Txt>
                  </View>
                ) : null}
              </View>
              <Icon name="chevron-right" tone="faint" />
            </Card>
          </Pressable>
        )} />
    </Screen>
  );
}

const fmtYears = (n: number) => `${n} yil`;
