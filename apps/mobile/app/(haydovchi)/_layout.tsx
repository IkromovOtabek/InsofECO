import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { floatingTabBar, tabsOptions } from '@/design/nav';
import { useReducedMotion } from '@/design/motion';
import { HeaderBack, tabIcon } from '@/design/ui';

/**
 * Haydovchi (kabina rejimi) — 4 tab: Bugun · Yuklar · Daromad · Men. Tab paneli `driver` o'lchamida
 * (har nishon ≥ 64 pt, kattaroq ikonka va yorliq); ekran ichidagi katta tugmalar — `@/design/driver`.
 */
export default function HaydovchiLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const hidden = { href: null } as const;
  return (
    <Tabs tabBar={floatingTabBar({ driver: true })} screenOptions={tabsOptions(c, insets.bottom, { driver: true, reduce })}>
      <Tabs.Screen name="index" options={{ title: 'Bugun', headerShown: false, tabBarIcon: tabIcon('house', { driver: true }) }} />
      <Tabs.Screen name="deliveries" options={{ title: 'Yuklar', tabBarIcon: tabIcon('package', { driver: true }) }} />
      <Tabs.Screen name="earnings" options={{ title: 'Daromad', tabBarIcon: tabIcon('wallet', { driver: true }) }} />
      <Tabs.Screen name="menu" options={{ title: 'Men', tabBarIcon: tabIcon('user', { driver: true }) }} />
      <Tabs.Screen name="transport" options={{ ...hidden, title: 'Transportim', headerLeft: HeaderBack }} />
      <Tabs.Screen name="history" options={{ ...hidden, title: 'Tarix', headerLeft: HeaderBack }} />
      <Tabs.Screen name="messages" options={{ ...hidden, title: 'Xabarlar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="profile" options={{ ...hidden, title: 'Profil', headerLeft: HeaderBack }} />
      <Tabs.Screen name="notifications" options={{ ...hidden, title: 'Bildirishnomalar', headerLeft: HeaderBack }} />
    </Tabs>
  );
}
