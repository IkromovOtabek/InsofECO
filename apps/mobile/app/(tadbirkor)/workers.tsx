import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SPECIALTY_LABEL, Specialty } from '@insof/shared';
import { ChipGroup, ListGroup, Reveal, SkeletonList } from '@/design/blocks';
import { Badge, EmptyState, ListItem, Screen, SearchField, Txt } from '@/design/primitives';
import { Avatar, Stars } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { useWorkers } from '@/features/eco/api';

/** Quruvchilar: qidiruv → mutaxassislik chiplari → ListGroup (avatar, reyting, Ishda/Bo'sh nishoni). */
export default function Workers() {
  const router = useRouter();
  const { c } = useTheme();
  const [spec, setSpec] = useState<string>('all');
  const [search, setSearch] = useState('');
  const q = useWorkers(spec === 'all' ? undefined : spec);
  const needle = search.trim().toLowerCase();
  const list = (q.data ?? []).filter((w) => !needle || `${w.fullName ?? ''} ${w.phone} ${w.currentProject?.name ?? ''}`.toLowerCase().includes(needle));
  const busy = list.filter((w) => w.activeWork).length;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxxl, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Ism, telefon yoki loyiha…" />
        <ChipGroup items={[{ key: 'all', label: 'Barchasi' }, ...Specialty.map((s) => ({ key: s as string, label: SPECIALTY_LABEL[s] }))]} value={spec} onChange={setSpec} />
        {q.isLoading ? <SkeletonList rows={5} />
          : q.isError && !q.data ? <EmptyState icon="cloud-off" title="Quruvchilar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
          : list.length === 0 ? (
            needle ? <EmptyState icon="search" title="Hech kim topilmadi" hint="Boshqa so'z bilan qidiring" />
              : <EmptyState icon="hard-hat" title="Quruvchilar yo'q" hint="Xodimlar bo'limida quruvchini tasdiqlang" action="Xodimlar" onAction={() => router.push('/(tadbirkor)/members')} />
          ) : (
            <Reveal key={spec} gap={space.sm}>
              <Txt v="overline">{`${list.length} ta · ${busy} ta ishda`}</Txt>
              <ListGroup>
                {list.map((w) => {
                  const sub = w.profile
                    ? `${SPECIALTY_LABEL[w.profile.specialty as keyof typeof SPECIALTY_LABEL]} · ${w.profile.experienceYears} yil · ${w.profile.completedJobs} ish`
                    : "Profil to'ldirilmagan";
                  return (
                    <ListItem
                      key={w.userId}
                      leading={<Avatar name={w.fullName} size={size.iconTile} />}
                      title={w.fullName ?? w.phone}
                      subtitle={w.currentProject ? `${sub}\n${w.currentProject.name}` : sub}
                      onPress={() => router.push(`/worker/${w.userId}`)}
                      right={(
                        <View style={{ alignItems: 'flex-end', gap: space.xs, flexShrink: 0 }}>
                          {w.profile ? <Stars value={w.profile.ratingAvg} /> : null}
                          {w.activeWork ? <Badge label="Ishda" tone="brand" icon="hammer" /> : <Badge label="Bo'sh" tone="success" />}
                        </View>
                      )}
                    />
                  );
                })}
              </ListGroup>
            </Reveal>
          )}
      </ScrollView>
    </Screen>
  );
}
