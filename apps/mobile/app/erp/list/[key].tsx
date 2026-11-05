import React, { useEffect } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ErpList } from '@/features/erp/screens';

/**
 * Tezkor amaldan yoki "Barchasi" havolasidan ochiladigan ro'yxat — demo "ERP ro'yxat":
 * sarlavha (orqaga · nom · "+") ekranning o'zida, navigator sarlavhasi yashiriladi.
 */
export default function ErpListScreen() {
  const { key, f } = useLocalSearchParams<{ key: string; f?: string }>();
  const nav = useNavigation();
  const router = useRouter();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  return <ErpList listKey={key!} initialFilter={f} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
