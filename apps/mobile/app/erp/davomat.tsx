import React, { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { StaffAttendanceScreen } from '@/features/erp/staff-attendance';

/** Davomat — barcha xodimlar jadvali (direktor, ishlab chiqarish, ish boshqaruvchi — Menyudan). Sarlavha ekranning o'zida. */
export default function StaffAttendanceRoute() {
  const nav = useNavigation();
  const router = useRouter();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <StaffAttendanceScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
