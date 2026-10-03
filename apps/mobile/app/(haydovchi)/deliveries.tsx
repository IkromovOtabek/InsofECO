import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, ListGroup, OfflineBanner, Reveal, SkeletonList } from '@/design/blocks';
import { EmptyState, ListItem, Screen, SearchField, fmtUnit, statusLabel, statusTone } from '@/design/primitives';
import { fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useShipments } from '@/features/eco/api';
import { outbox } from '@/core/outbox';
import { useOutboxSize } from '@/shared/hooks';

const SEG = [{ key: 'NEW,ACCEPTED,LOADING,EN_ROUTE,DELIVERED', label: 'Joriy' }, { key: 'CONFIRMED,CANCELLED', label: 'Tarix' }] as const;
type SegKey = (typeof SEG)[number]['key'];

/** Kabina: yuklar — ikki bo'lim (Joriy / Tarix), 64 pt qatorlar: yuk, obyekt, haq va holat. */
export default function Deliveries() {
  const router = useRouter();
  const { c } = useTheme();
  const [seg, setSeg] = useState<SegKey>(SEG[0].key);
  const q = useShipments(seg);
  const pending = useOutboxSize();
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const all = q.data ?? [];
  const list = all.filter((s) => !needle || `${s.number} ${s.cargo} ${s.project.name}`.toLowerCase().includes(needle));
  const current = seg === SEG[0].key;
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.md, gap: space.md }}>
        <OfflineBanner visible={pending > 0} pendingCount={pending} onRetry={() => void outbox.flush()} />
        <SearchField value={search} onChangeText={setSearch} placeholder="Yuk, raqam yoki obyekt" />
        <ChipGroup items={SEG.map((x) => ({ key: x.key, label: x.label, count: x.key === seg && q.data ? all.length || undefined : undefined }))} value={seg} onChange={setSeg} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.pageX, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        <Reveal loading={q.isLoading} skeleton={<SkeletonList rows={4} />} replay={seg}>
          {q.isError && !q.data ? (
            <EmptyState icon="cloud-off" title="Yuklar ko'rinmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} />
          ) : list.length === 0 ? (
            needle && all.length
              ? <EmptyState icon="search" title="Hech narsa topilmadi" hint="Boshqa so'z bilan qidiring" />
              : <EmptyState icon={current ? 'coffee' : 'history'} title={current ? "Hozir yuk yo'q" : "Tarix bo'sh"} hint={current ? 'Yangi yuk kelganda xabar keladi' : "Yakunlangan yuklar shu yerda"} />
          ) : (
            <ListGroup>
              {list.map((s) => (
                <ListItem
                  key={s.id} size="lg" icon={s.status === 'EN_ROUTE' ? 'navigation' : 'package'} module="logistics"
                  title={s.cargo}
                  subtitle={`№${s.number} · ${s.project.name}${s.distanceKm ? ` · ${fmtUnit(s.distanceKm, 'km')}` : ''}`} subtitleLines={1}
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
