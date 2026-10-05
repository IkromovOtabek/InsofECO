import React, { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { MyAttendanceScreen } from '@/features/erp/attendance';

/**
 * "Mening davomatim" — xodimning o'z oylik davomati (bosh sahifadagi davomat kartasi va Menyudan).
 * Sarlavha ekranning o'zida, navigator sarlavhasi yashiriladi.
 */
export default function MyAttendanceRoute() {
  const nav = useNavigation();
  const router = useRouter();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <MyAttendanceScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
