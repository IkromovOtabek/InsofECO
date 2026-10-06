import React, { useEffect } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { EmployeeAttendanceScreen } from '@/features/erp/staff-attendance';

/** Xodimning oylik davomati (`?id=&month=`) — Davomat jadvalidan ochiladi. */
export default function EmployeeAttendanceRoute() {
  const nav = useNavigation();
  const router = useRouter();
  const { id, month } = useLocalSearchParams<{ id: string; month?: string }>();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <EmployeeAttendanceScreen id={String(id ?? '')} month={month ? String(month) : undefined} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
