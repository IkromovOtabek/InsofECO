import React, { useEffect } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ShipmentAcceptScreen } from '@/features/erp/shipments';

/**
 * Jo'natmani qabul qilish (bannerdan, bildirishnomadan yoki push'dan — `/erp/jonatma/<id>`).
 * Umumiy `/erp/[key]/[id]` kartochkasidan ustun turadi: qatorlarni belgilab qabul qilish kerak.
 */
export default function ShipmentRoute() {
  const nav = useNavigation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <ShipmentAcceptScreen id={String(id ?? '')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
