import React, { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { FleetScreen } from '@/features/erp/fleet';

/**
 * Reyslar xaritada — jonli kuzatuv (direktor bosh sahifasi va menyusidan, logistika "Barchasi"dan).
 * Sarlavha ekranning o'zida (orqaga · nom · "hammasini ko'rsatish"), navigator sarlavhasi yashiriladi.
 */
export default function ErpFleetScreen() {
  const nav = useNavigation();
  const router = useRouter();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <FleetScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
