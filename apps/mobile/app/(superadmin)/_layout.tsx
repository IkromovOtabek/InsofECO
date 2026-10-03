import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { floatingTabBar, tabsOptions } from '@/design/nav';
import { useReducedMotion } from '@/design/motion';
import { HeaderBack, tabIcon } from '@/design/ui';
import { queryClient } from '@/core/query';

/**
 * Superadmin (platforma boshqaruvi) — tab paneli: Holat · Tashkilotlar · Foydalanuvchilar · Sozlamalar.
 * Kirish: `app/_layout.tsx` Gate (faqat /me dagi `isSuperAdmin`). Bu faqat UX — har bir /admin/* so'rovini
 * server o'zi tekshiradi. Yashirin ekranlar: tashkilot va foydalanuvchi kartochkasi, ommaviy xabar, jurnal.
 */
export default function SuperAdminLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const hidden = { href: null } as const;
  // Bo'limdan chiqilganda admin ma'lumoti (barcha foydalanuvchilar) xotirada ham qolmasin
  useEffect(() => () => queryClient.removeQueries({ queryKey: ['admin'] }), []);
  return (
    <Tabs tabBar={floatingTabBar()} screenOptions={tabsOptions(c, insets.bottom, { reduce })}>
      <Tabs.Screen name="index" options={{ title: 'Holat', headerShown: false, tabBarIcon: tabIcon('activity') }} />
      <Tabs.Screen name="tashkilotlar" options={{ title: 'Tashkilotlar', tabBarIcon: tabIcon('building') }} />
      <Tabs.Screen name="foydalanuvchilar" options={{ title: 'Foydalanuvchilar', tabBarIcon: tabIcon('users') }} />
      <Tabs.Screen name="sozlamalar" options={{ title: 'Sozlamalar', tabBarIcon: tabIcon('settings') }} />
      <Tabs.Screen name="tashkilot" options={{ ...hidden, title: 'Tashkilot', headerLeft: HeaderBack }} />
      <Tabs.Screen name="foydalanuvchi" options={{ ...hidden, title: 'Foydalanuvchi', headerLeft: HeaderBack }} />
      <Tabs.Screen name="xabar" options={{ ...hidden, title: 'Ommaviy xabar', tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
      <Tabs.Screen name="jurnal" options={{ ...hidden, title: 'Amallar jurnali', headerLeft: HeaderBack }} />
    </Tabs>
  );
}
