import React from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Gap, Screen, StatusChip, Txt } from '@/design/primitives';
import { ProgressBar } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useAction, useMaterialRequests } from '@/features/eco/api';

const STEPS = ['PENDING', 'APPROVED', 'LOADING', 'DELIVERED', 'CONFIRMED'];
const STEP_LABEL: Record<string, string> = { PENDING: 'Kutilmoqda', APPROVED: 'Tasdiqlandi', LOADING: 'Yuklanmoqda', DELIVERED: 'Yetkazildi', CONFIRMED: 'Qabul qilindi', REJECTED: 'Rad etildi' };

/** Quruvchi: material so'rovlari va holat zanjiri; yetkazilganda "Qabul qildim". */
export default function QuruvchiMaterials() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useMaterialRequests();
  const confirm = useAction<string>((shipmentId) => ({ path: `/shipments/${shipmentId}/transition`, body: { to: 'CONFIRMED' } }), ['material-requests', 'shipments', 'dash']);
  return (
    <Screen padded={false}>
      <FlatList data={q.data ?? []} keyExtractor={(r) => r.id} contentContainerStyle={{ padding: 16, paddingBottom: 90 }} ItemSeparatorComponent={() => <Gap h={10} />}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={q.isLoading ? null : <EmptyState title="So'rovlar yo'q" hint="Kerakli materialni so'rang" />}
        renderItem={({ item: r }) => {
          const idx = STEPS.indexOf(r.status);
          return (
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="caption" color="secondary">#{r.number} · {r.project.name}</Txt><StatusChip status={r.status} /></View>
              <Txt v="heading" style={{ marginTop: 2 }}>{r.material.name} — {r.quantity} {r.material.unit}</Txt>
              {r.reason ? <Txt v="caption" color="secondary">Sabab: {r.reason}</Txt> : null}
              {r.status !== 'REJECTED' ? (
                <View style={{ marginTop: 10 }}>
                  <ProgressBar value={((idx + 1) / STEPS.length) * 100} tone={r.status === 'CONFIRMED' ? 'success' : 'brand'} height={6} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>{STEPS.map((s, i) => <Txt key={s} v="caption" style={{ fontSize: 10, color: i <= idx ? c.brandPrimary : c.textSecondary }}>{STEP_LABEL[s]}</Txt>)}</View>
                </View>
              ) : <Txt v="caption" color="danger" style={{ marginTop: 6 }}>{r.rejectReason}</Txt>}
              {r.shipment?.driver ? <Txt v="caption" color="secondary" style={{ marginTop: 8 }}>🚚 {r.shipment.driver.fullName} · {r.shipment.vehicle?.plateNumber ?? ''}</Txt> : null}
              {r.status === 'DELIVERED' && r.shipment ? <><Gap h={10} /><Button title="Materialni qabul qildim" size="md" loading={confirm.isPending} onPress={() => confirm.mutate(r.shipment!.id, { onError: (e) => Alert.alert('Xato', e.message) })} /></> : null}
            </Card>
          );
        }} />
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}><Button title="+ Material so'rovi" onPress={() => router.push('/(quruvchi)/new-request')} /></View>
    </Screen>
  );
}
