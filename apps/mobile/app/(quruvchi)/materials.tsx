import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AttentionList, ChipGroup, ListGroup, Reveal, SectionHead, SkeletonList, StickyActionBar } from '@/design/blocks';
import { EmptyState, ListItem, Screen, SearchField, fmtUnit, statusLabel, statusTone } from '@/design/primitives';
import { dialog, fmtShort, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { MaterialRequest, useAction, useMaterialRequests } from '@/features/eco/api';
import i18n from '@/core/i18n';

const STEPS = ['PENDING', 'APPROVED', 'LOADING', 'DELIVERED', 'CONFIRMED'];
const STEP_LABEL: Record<string, string> = { PENDING: 'Kutilmoqda', APPROVED: 'Tasdiqlandi', LOADING: 'Yuklanmoqda', DELIVERED: 'Yetkazildi', CONFIRMED: 'Qabul qilindi', REJECTED: 'Rad etildi' };
type Seg = 'active' | 'history';
const isActive = (r: MaterialRequest) => !['CONFIRMED', 'REJECTED'].includes(r.status);

/** Quruvchi: material so'rovlari va holat bosqichi; yetkazilganda "Qabul qildim". */
export default function QuruvchiMaterials() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useMaterialRequests();
  const [seg, setSeg] = useState<Seg>('active');
  const confirm = useAction<string>((shipmentId) => ({ path: `/shipments/${shipmentId}/transition`, body: { to: 'CONFIRMED' } }), ['material-requests', 'shipments', 'dash']);
  const all = q.data ?? [];
  const arrived = all.filter((r) => r.status === 'DELIVERED' && r.shipment);
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const hit = (r: MaterialRequest) => !needle || `${r.number} ${r.material.name} ${r.project.name}`.toLowerCase().includes(needle);
  const list = all.filter((r) => (seg === 'active' ? isActive(r) && !(r.status === 'DELIVERED' && r.shipment) : !isActive(r))).filter(hit);
  const accept = (r: MaterialRequest) => dialog(
    'Materialni qabul qildingizmi?',
    `${r.material.name} — ${fmtUnit(r.quantity, r.material.unit)}`,
    [{ text: i18n.t('ui.cancel'), style: 'cancel' }, { text: 'Qabul qildim', onPress: () => confirm.mutate(r.shipment!.id, { onSuccess: () => toast.success('Material qabul qilindi'), onError: (e) => toast.error(e.message, 'Xato') }) }],
    { tone: 'success', icon: 'package-check' },
  );
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.md, gap: space.md }}>
        <SearchField value={search} onChangeText={setSearch} placeholder="Material, raqam yoki obyekt" />
        <ChipGroup
          items={[{ key: 'active', label: 'Faol', count: q.data ? all.filter(isActive).length : undefined }, { key: 'history', label: 'Tarix', count: q.data ? all.filter((r) => !isActive(r)).length : undefined }]}
          value={seg} onChange={setSeg}
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.pageX, paddingBottom: space.xl }} refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}>
        <Reveal loading={q.isLoading} skeleton={<SkeletonList rows={5} />} replay={seg}>
          {q.isError && !q.data ? (
            <EmptyState icon="cloud-off" title="So'rovlar yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void q.refetch()} />
          ) : null}
          {q.data && seg === 'active' && arrived.length ? [
            <SectionHead key="ah" title="Yetib keldi · qabul qiling" count={arrived.length} />,
            <AttentionList
              key="al"
              items={arrived.map((r) => ({
                title: `${r.material.name} — ${fmtUnit(r.quantity, r.material.unit)}`,
                sub: `№${r.number} · ${r.project.name}${r.shipment?.driver ? ` · ${r.shipment.driver.fullName ?? ''}` : ''}`,
                icon: 'package-check', module: 'logistics',
                badge: { text: 'Qabul qiling', tone: 'warning' },
                onPress: () => accept(r),
              }))}
            />,
          ] : null}
          {q.data && list.length ? [
            seg === 'active' && arrived.length ? <SectionHead key="ph" title="Jarayonda" count={list.length} /> : null,
            <ListGroup key="pl">
              {list.map((r) => {
                const idx = STEPS.indexOf(r.status);
                const rejected = r.status === 'REJECTED';
                const step = rejected ? (r.rejectReason ? `Sabab: ${r.rejectReason}` : 'Rad etildi') : `Bosqich ${idx + 1}/${STEPS.length} · ${STEP_LABEL[r.status] ?? r.status}`;
                const truck = r.shipment?.driver ? ` · ${r.shipment.driver.fullName ?? ''} ${r.shipment.vehicle?.plateNumber ?? ''}`.trimEnd() : '';
                const sum = Number(r.material.price) * Number(r.quantity);
                return (
                  <ListItem
                    key={r.id} icon={rejected ? 'circle-x' : 'package'} module="warehouse" tone={rejected ? 'danger' : undefined}
                    title={`${r.material.name} — ${fmtUnit(r.quantity, r.material.unit)}`}
                    subtitle={`№${r.number} · ${r.project.name}${truck}\n${step}${r.reason && !rejected ? `\nSabab: ${r.reason}` : ''}`} subtitleLines={3}
                    value={sum > 0 ? `${fmtShort(sum)} so'm` : undefined}
                    badge={{ text: statusLabel(r.status), tone: statusTone(r.status) }}
                  />
                );
              })}
            </ListGroup>,
          ] : null}
          {q.data && !list.length && !(seg === 'active' && arrived.length) ? (
            needle ? <EmptyState icon="search" title="Hech narsa topilmadi" hint="Boshqa so'z bilan qidiring" /> : (
              <EmptyState
                icon="package"
                title={seg === 'active' ? "Faol so'rov yo'q" : "Tarix bo'sh"}
                hint={seg === 'active' ? "Kerakli materialni so'rang — tadbirkor ko'rib chiqadi" : "Qabul qilingan va rad etilgan so'rovlar shu yerda"}
              />
            )
          ) : null}
        </Reveal>
      </ScrollView>
      <StickyActionBar primary={{ title: "Material so'rovi", icon: 'plus', onPress: () => router.push('/(quruvchi)/new-request') }} style={{ paddingBottom: space.md }} />
    </Screen>
  );
}
