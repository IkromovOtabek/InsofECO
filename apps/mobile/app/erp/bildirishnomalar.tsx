import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { IconName } from '@/design/ui';
import { ModuleTone, Tone } from '@/design/tokens';
import { useErpNotifications, useErpReadNotifications } from '@/features/erp/api';
import { FeedGroup, FeedItem, NotificationFeed } from '@/screens/NotificationsList';

/**
 * Insof ERP bildirishnomalari.
 *
 * Push — "darhol xabar berish" vositasi, manba esa shu ro'yxat: telefon o'chiq bo'lsa,
 * ruxsat berilmagan bo'lsa yoki Expo xabarni yetkaza olmasa ham xabar shu yerda qoladi.
 * Ochilganda hammasi o'qilmaydi — bosilgan xabar yoki "Hammasi o'qildi" (umumiy lenta).
 */

/** Xabar turi bo'yicha ikonka va ton — bir qarashda nima bo'lganini ko'rsatadi. */
const VISUAL: Record<string, { icon: IconName; module?: ModuleTone; tone?: Tone; group?: FeedGroup }> = {
  TRIP_ASSIGNED: { icon: 'truck', module: 'logistics', group: 'trips' },
  TRIP_DELIVERED: { icon: 'flag', module: 'logistics', group: 'trips' },
  // GPS kuzatuvi (ERP `lib/mobile/track.ts` → obyektdan 300 m ichida; `lib/gps-watch.ts` → `TRIP_${kind}`)
  TRIP_ARRIVED: { icon: 'map-pin', tone: 'success', group: 'trips' },
  TRIP_SILENT: { icon: 'wifi-off', tone: 'danger', group: 'trips' },
  TRIP_STOP: { icon: 'hourglass', tone: 'warning', group: 'trips' },
  TRIP_OFF_ROUTE: { icon: 'route', tone: 'danger', group: 'trips' },
  ORDER_CONFIRMED: { icon: 'file-text' },
  ORDER_DELIVERED: { icon: 'check-check', tone: 'success' },
  ORDER_BLOCKED: { icon: 'lock', tone: 'danger' },
  ORDER_UNBLOCKED: { icon: 'lock-open', tone: 'success' },
  TASK_ASSIGNED: { icon: 'hammer', module: 'production' },
  TASK_DONE: { icon: 'square-check', module: 'production' },
  PAYMENT_RECEIVED: { icon: 'wallet', module: 'brand', group: 'payments' },
  LEAD_NEW: { icon: 'phone' },
  SUPPLY_NEW: { icon: 'shopping-cart', module: 'warehouse' },
  SUPPLY_PRICED: { icon: 'tag', module: 'warehouse' },
  SUPPLY_APPROVED: { icon: 'circle-check', tone: 'success' },
  SUPPLY_FUNDED: { icon: 'wallet', module: 'warehouse' },
  SUPPLY_REJECTED: { icon: 'circle-x', tone: 'danger' },
};

export default function ErpNotifications() {
  const router = useRouter();
  const q = useErpNotifications();
  const read = useErpReadNotifications();

  const items = useMemo<FeedItem[] | undefined>(() => q.data?.rows.map((n) => ({
    id: n.id, title: n.title, body: n.body, createdAt: n.createdAt, readAt: n.readAt,
    ...(VISUAL[n.type] ?? { icon: 'bell' as IconName }),
    onOpen: n.link ? () => router.push(`/erp/${n.link!.key}/${n.link!.id}` as never) : undefined,
  })), [q.data, router]);

  return (
    <NotificationFeed
      items={items}
      loading={q.isLoading}
      error={q.isError && !q.data?.rows.length}
      errorObj={q.error}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      // `ids` aniq beriladi: bo'sh qolsa server hammasini o'qilgan deb belgilaydi
      markRead={(ids) => read.mutateAsync(ids)}
    />
  );
}
