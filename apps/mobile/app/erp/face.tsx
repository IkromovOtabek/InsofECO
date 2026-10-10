import React, { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { FaceKioskScreen } from '@/features/erp/face-kiosk';

/** Davomat — Face ID skaneri (kiosk), jadval va yuzlarni ro'yxatga olish (bosh sahifadagi «Davomat» tugmasidan). */
export default function FaceKioskRoute() {
  const nav = useNavigation();
  const router = useRouter();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <FaceKioskScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
