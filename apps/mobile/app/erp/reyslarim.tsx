import React, { useEffect } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { DriverMonthScreen } from '@/features/erp/driver-pay';

/** "Mening reyslarim" (haydovchi, `id` siz) yoki bitta haydovchining oyi (`?id=&month=`, Haydovchilar jadvalidan). */
export default function DriverMonthRoute() {
  const nav = useNavigation();
  const router = useRouter();
  const { id, month } = useLocalSearchParams<{ id?: string; month?: string }>();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <DriverMonthScreen id={id ? String(id) : 'me'} month={month ? String(month) : undefined} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
