import React, { useEffect } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { ErpList } from '@/features/erp/screens';
import { useErpList } from '@/features/erp/api';

/** Tezkor amaldan yoki "Barchasi" havolasidan ochiladigan ro'yxat. */
export default function ErpListScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const nav = useNavigation();
  const { data } = useErpList(key!);
  useEffect(() => { if (data?.title) nav.setOptions({ title: data.title }); }, [data?.title, nav]);
  return <ErpList listKey={key!} />;
}
