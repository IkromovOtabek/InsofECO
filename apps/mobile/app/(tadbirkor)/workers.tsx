import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SPECIALTY_LABEL, Specialty } from '@insof/shared';
import { Card, EmptyState, Gap, Screen, Txt } from '@/design/primitives';
import { Avatar, Pill, Segmented, Stars } from '@/design/ui';
import { useWorkers } from '@/features/eco/api';

export default function Workers() {
  const router = useRouter();
  const [spec, setSpec] = useState<string>('all');
  const q = useWorkers(spec === 'all' ? undefined : spec);
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Segmented value={spec} onChange={setSpec} items={[{ key: 'all', label: 'Barchasi' }, ...Specialty.map((s) => ({ key: s, label: SPECIALTY_LABEL[s] }))]} /></View>
      <FlatList data={q.data ?? []} keyExtractor={(w) => w.userId} contentContainerStyle={{ padding: 16 }} ItemSeparatorComponent={() => <Gap h={10} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="Quruvchilar yo'q" />}
        renderItem={({ item: w }) => (
          <Pressable onPress={() => router.push(`/worker/${w.userId}`)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={w.fullName} size={48} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Txt v="heading">{w.fullName}</Txt>
                <Txt v="caption" color="secondary">{w.profile ? `${SPECIALTY_LABEL[w.profile.specialty as keyof typeof SPECIALTY_LABEL]} · ${w.profile.experienceYears} yil · ${w.profile.completedJobs} ish` : 'Profil to\'ldirilmagan'}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {w.profile ? <Stars value={w.profile.ratingAvg} /> : null}
                  {w.activeWork ? <Pill label="Ishda" tone="brand" icon="hammer" /> : <Pill label="Bo'sh" tone="success" />}
                </View>
                {w.currentProject ? <Txt v="caption" color="secondary" style={{ marginTop: 2 }}>📍 {w.currentProject.name}</Txt> : null}
              </View>
            </Card>
          </Pressable>
        )} />
    </Screen>
  );
}
