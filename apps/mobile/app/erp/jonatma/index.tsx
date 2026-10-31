import React, { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { ShipmentListScreen } from '@/features/erp/shipments';

/** Snabjeniye jo'natmalari — sklad kutayotganlari (tepadagi bannerdan bir nechta jo'natma bo'lsa). */
export default function ShipmentsRoute() {
  const nav = useNavigation();
  const router = useRouter();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <ShipmentListScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
