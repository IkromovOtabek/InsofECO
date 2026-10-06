import React, { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { DriversPayScreen } from '@/features/erp/driver-pay';

/** Haydovchilar: reyslar va davomat (direktor, otdel kadr, logistika — Menyudan). */
export default function DriversPayRoute() {
  const nav = useNavigation();
  const router = useRouter();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <DriversPayScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
