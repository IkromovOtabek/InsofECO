import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Gap, ProgressBar, Screen, StatusChip, Txt, fmtUnit } from '@/design/primitives';
import { Icon, toast } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useAction, useMaterialRequests } from '@/features/eco/api';

const STEPS = ['PENDING', 'APPROVED', 'LOADING', 'DELIVERED', 'CONFIRMED'];
const STEP_LABEL: Record<string, string> = { PENDING: 'Kutilmoqda', APPROVED: 'Tasdiqlandi', LOADING: 'Yuklanmoqda', DELIVERED: 'Yetkazildi', CONFIRMED: 'Qabul qilindi', REJECTED: 'Rad etildi' };

/** Quruvchi: material so'rovlari va holat zanjiri; yetkazilganda "Qabul qildim". */
export default function QuruvchiMaterials() {
  const router = useRouter();
  const q = useMaterialRequests();
  const confirm = useAction<string>((shipmentId) => ({ path: `/shipments/${shipmentId}/transition`, body: { to: 'CONFIRMED' } }), ['material-requests', 'shipments', 'dash']);
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(r) => r.id} contentContainerStyle={{ padding: space.pageX, paddingBottom: size.buttonLg + space.x12 }} ItemSeparatorComponent={() => <Gap h={space.md} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="So'rovlar yo'q" hint="Kerakli materialni so'rang" icon="package" />}
        renderItem={({ item: r }) => {
          const idx = STEPS.indexOf(r.status);
          return (
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                <Txt v="caption" style={{ flex: 1 }} numberOfLines={1}>№{r.number} · {r.project.name}</Txt>
                <StatusChip status={r.status} />
              </View>
              <Txt v="titleSm" style={{ marginTop: space.xs }}>{r.material.name} — {fmtUnit(r.quantity, r.material.unit)}</Txt>
              {r.reason ? <Txt v="caption">Sabab: {r.reason}</Txt> : null}
              {r.status !== 'REJECTED' ? (
                <View style={{ marginTop: space.md }}>
                  <ProgressBar value={((idx + 1) / STEPS.length) * 100} tone={r.status === 'CONFIRMED' ? 'success' : 'brand'} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs }}>
                    <Txt v="caption">Bosqich {idx + 1} / {STEPS.length}</Txt>
                    <Txt v="caption" color={r.status === 'CONFIRMED' ? 'success' : 'brand'}>{STEP_LABEL[r.status] ?? r.status}</Txt>
                  </View>
                </View>
              ) : <Txt v="caption" color="danger" style={{ marginTop: space.sm }}>{r.rejectReason}</Txt>}
              {r.shipment?.driver ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm }}>
                  <Icon name="truck" tone="muted" />
                  <Txt v="caption">{r.shipment.driver.fullName} · {r.shipment.vehicle?.plateNumber ?? ''}</Txt>
                </View>
              ) : null}
              {r.status === 'DELIVERED' && r.shipment ? <><Gap h={space.md} /><Button title="Materialni qabul qildim" icon="package-check" loading={confirm.isPending} onPress={() => confirm.mutate(r.shipment!.id, { onError: (e) => toast.error(e.message, 'Xato') })} /></> : null}
            </Card>
          );
        }} />
      <View style={{ position: 'absolute', left: space.pageX, right: space.pageX, bottom: space.lg }}>
        <Button title="Material so'rovi" icon="plus" size="lg" onPress={() => router.push('/(quruvchi)/new-request')} />
      </View>
    </Screen>
  );
}
