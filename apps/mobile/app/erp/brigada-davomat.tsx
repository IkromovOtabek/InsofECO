import React, { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { BrigadeAttendanceScreen } from '@/features/erp/brigadier';

/** Brigadir — «Brigada davomati» (bosh sahifadagi Davomat kartasidan). Sarlavha ekranning o'zida. */
export default function BrigadeAttendanceRoute() {
  const nav = useNavigation();
  const router = useRouter();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <BrigadeAttendanceScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
