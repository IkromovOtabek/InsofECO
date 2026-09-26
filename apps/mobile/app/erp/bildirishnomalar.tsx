import React, { useEffect } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, IconTile, StatusDot, Txt } from '@/design/primitives';
import { Icon, IconName, fmtRel } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
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
  TRIP_ASSIGNED: 'truck',
  TRIP_DELIVERED: 'flag',
  ORDER_CONFIRMED: 'file-text',
  ORDER_DELIVERED: 'check-check',
  ORDER_BLOCKED: 'lock',
  ORDER_UNBLOCKED: 'lock-open',
  TASK_ASSIGNED: 'hammer',
  TASK_DONE: 'square-check',
  PAYMENT_RECEIVED: 'banknote',
  LEAD_NEW: 'phone',
  SUPPLY_NEW: 'shopping-cart',
  SUPPLY_PRICED: 'tag',
  SUPPLY_APPROVED: 'circle-check',
  SUPPLY_FUNDED: 'wallet',
  SUPPLY_REJECTED: 'circle-x',
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

  if (isLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.brand} /></View>;

  return (
    <FlatList
      data={rows}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ padding: space.pageX, paddingBottom: space.xxxl, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      ListEmptyComponent={<EmptyState icon="bell" title="Bildirishnoma yo'q" hint="Yangi xabar kelganda shu yerda chiqadi" />}
      renderItem={({ item: n }) => (
        <PressScale
          haptic={false}
          disabled={!n.link}
          accessibilityRole="button"
          accessibilityLabel={n.title}
          onPress={n.link ? () => router.push(`/erp/${n.link!.key}/${n.link!.id}` as never) : undefined}
          style={{ marginBottom: space.sm }}
        >
          {/* O'qilmagan xabar — brend chegara va "Yangi" nuqtasi bilan ajralib turadi */}
          <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md, borderColor: n.readAt ? c.borderDefault : c.brand }}>
            <IconTile icon={ICON[n.type] ?? 'bell'} />
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong" numberOfLines={2}>{n.title}</Txt>
              <Txt v="bodySm" color="muted" numberOfLines={3} style={{ marginTop: space.xs }}>{n.body}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs }}>
                <Txt v="caption" style={{ flex: 1 }}>{fmtRel(n.createdAt)}</Txt>
                {!n.readAt ? <StatusDot tone="brand" label="Yangi" /> : null}
              </View>
            </View>
            {n.link ? <Icon name="chevron-right" tone="faint" /> : null}
          </Card>
        </PressScale>
      )}
    />
  );
}
