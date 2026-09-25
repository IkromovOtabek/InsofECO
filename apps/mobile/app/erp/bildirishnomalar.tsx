import React, { useEffect } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, Txt } from '@/design/primitives';
import { Icon, IconName, fmtRel } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { erpText } from '@/design/tokens';
import { PressScale } from '@/design/motion';
import { setBadge } from '@/core/push';
import { useErpNotifications, useErpReadNotifications } from '@/features/erp/api';

/**
 * Insof ERP bildirishnomalari.
 *
 * Push — "darhol xabar berish" vositasi, manba esa shu ro'yxat: telefon o'chiq bo'lsa,
 * ruxsat berilmagan bo'lsa yoki Expo xabarni yetkaza olmasa ham xabar shu yerda qoladi.
 */

/** Xabar turi bo'yicha ikonka — bir qarashda nima bo'lganini ko'rsatadi. */
const ICON: Record<string, IconName> = {
  TRIP_ASSIGNED: 'bus',
  TRIP_DELIVERED: 'flag',
  ORDER_CONFIRMED: 'document-text',
  ORDER_DELIVERED: 'checkmark-done',
  ORDER_BLOCKED: 'lock-closed',
  ORDER_UNBLOCKED: 'lock-open',
  TASK_ASSIGNED: 'hammer',
  TASK_DONE: 'checkbox',
  PAYMENT_RECEIVED: 'cash',
  LEAD_NEW: 'call',
  SUPPLY_NEW: 'cart',
  SUPPLY_PRICED: 'pricetag',
  SUPPLY_APPROVED: 'checkmark-circle',
  SUPPLY_FUNDED: 'wallet',
  SUPPLY_REJECTED: 'close-circle',
};

export default function ErpNotifications() {
  const { c } = useTheme();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useErpNotifications();
  const read = useErpReadNotifications();
  const rows = data?.rows ?? [];

  // Ro'yxat ochildi — hammasi o'qilgan. Ikonkadagi raqam ham shu zahoti o'chadi.
  useEffect(() => {
    if (!data || data.unread === 0) return;
    read.mutate(undefined, { onSuccess: () => setBadge(0) });
    // `read` har renderda yangi obyekt — faqat o'qilmaganlar soniga qarab ishlaydi
  }, [data?.unread]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.brandPrimary} /></View>;

  return (
    <FlatList
      data={rows}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brandPrimary} />}
      ListEmptyComponent={<EmptyState title="Bildirishnoma yo'q" hint="Yangi xabar kelganda shu yerda chiqadi" />}
      renderItem={({ item: n }) => (
        <PressScale
          haptic={false}
          disabled={!n.link}
          onPress={n.link ? () => router.push(`/erp/${n.link!.key}/${n.link!.id}` as never) : undefined}
          style={{ marginBottom: 8 }}
        >
          <View style={{
            flexDirection: 'row', gap: 11, backgroundColor: c.bgSurface, borderRadius: 14, padding: 13,
            borderWidth: 1, borderColor: n.readAt ? c.border : c.brandPrimary + '55',
          }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.brandPrimary + '14', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ICON[n.type] ?? 'notifications'} size={17} color={c.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {/* O'qilmagan xabar nuqta bilan ajralib turadi */}
                {!n.readAt ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.brandPrimary }} /> : null}
                <Txt style={{ ...erpText.rowTitle, color: c.textPrimary, flex: 1 }} numberOfLines={2}>{n.title}</Txt>
              </View>
              <Txt style={{ fontSize: 12.5, color: c.textSecondary, marginTop: 3 }} numberOfLines={3}>{n.body}</Txt>
              <Txt style={{ ...erpText.meta, color: c.textSecondary, marginTop: 5 }}>{fmtRel(n.createdAt)}</Txt>
            </View>
            {n.link ? <Icon name="chevron-forward" size={16} color={c.textSecondary} /> : null}
          </View>
        </PressScale>
      )}
    />
  );
}
