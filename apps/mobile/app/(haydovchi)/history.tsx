import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListGroup, Reveal, SkeletonList } from '@/design/blocks';
import { EmptyState, ListItem, Screen, SearchField, fmtDate, statusLabel, statusTone } from '@/design/primitives';
import { fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useShipmentHistory } from '@/features/eco/api';

/** Kabina: yetkazilgan yuklar tarixi — 64 pt qatorlar, o'ngda haq va holat. */
export default function History() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useShipmentHistory();
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const all = q.data ?? [];
  const list = all.filter((s) => !needle || `${s.number} ${s.cargo} ${s.project.name}`.toLowerCase().includes(needle));
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.md }}>
        <SearchField value={search} onChangeText={setSearch} placeholder="Yuk, raqam yoki obyekt" />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.pageX, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        <Reveal loading={q.isLoading} skeleton={<SkeletonList rows={5} />}>
          {q.isError && !q.data ? (
            <EmptyState icon="cloud-off" title="Tarix ko'rinmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} />
          ) : list.length === 0 ? (
            needle && all.length ? <EmptyState icon="search" title="Hech narsa topilmadi" hint="Boshqa so'z bilan qidiring" /> : <EmptyState icon="history" title="Tarix bo'sh" hint="Yetkazilgan yuklar shu yerda" />
          ) : (
            <ListGroup>
              {list.map((s) => (
                <ListItem
                  key={s.id} size="lg" icon="package-check" module="logistics" tone={s.status === 'CANCELLED' ? 'danger' : undefined}
                  title={s.cargo} subtitle={`№${s.number} · ${s.project.name}${s.deliveredAt ? ` · ${fmtDate(s.deliveredAt)}` : ''}`} subtitleLines={1}
                  onPress={() => router.push(`/shipment/${s.id}`)}
                  value={`${fmtShort(s.driverFee)} so'm`}
                  badge={{ text: statusLabel(s.status), tone: statusTone(s.status) }}
                />
              ))}
            </ListGroup>
          )}
        </Reveal>
      </ScrollView>
    </Screen>
  );
}
