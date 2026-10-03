import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { floatingTabBar, tabsOptions } from '@/design/nav';
import { useReducedMotion } from '@/design/motion';
import { HeaderBack, tabIcon } from '@/design/ui';

/**
 * Quruvchi — roles/QURUVCHI.json tablari: Bosh · Obyektlar · Buyurtma (ish buyurtmalari) · Yetkazish
 * (material so'rovlari va yuk holati) · Menyu. Beton buyurtmalari — bosh sahifada va /order/[id].
 * Yashirin ekranlar: Vazifalar, Daromad, Ishlarim, Xabarlar, Profil, wizard'lar (tab bar yashiriladi).
 */
export default function QuruvchiLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const hidden = { href: null } as const;
  return (
    <Tabs tabBar={floatingTabBar()} screenOptions={tabsOptions(c, insets.bottom, { reduce })}>
      <Tabs.Screen name="index" options={{ title: 'Bosh', headerShown: false, tabBarIcon: tabIcon('house') }} />
      <Tabs.Screen name="sites" options={{ title: 'Obyektlar', tabBarIcon: tabIcon('hard-hat') }} />
      <Tabs.Screen name="orders" options={{ title: 'Buyurtma', tabBarIcon: tabIcon('receipt') }} />
      <Tabs.Screen name="materials" options={{ title: 'Yetkazish', tabBarIcon: tabIcon('truck') }} />
      <Tabs.Screen name="menu" options={{ title: 'Menyu', tabBarIcon: tabIcon('list') }} />
      <Tabs.Screen name="tasks" options={{ ...hidden, title: 'Vazifalar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="earnings" options={{ ...hidden, title: 'Daromad', headerLeft: HeaderBack }} />
      <Tabs.Screen name="my-jobs" options={{ ...hidden, title: 'Ishlarim', headerLeft: HeaderBack }} />
      <Tabs.Screen name="messages" options={{ ...hidden, title: 'Xabarlar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="profile" options={{ ...hidden, title: 'Profil', headerLeft: HeaderBack }} />
      <Tabs.Screen name="notifications" options={{ ...hidden, title: 'Bildirishnomalar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="new-order" options={{ ...hidden, title: 'Beton buyurtma', tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
      <Tabs.Screen name="new-request" options={{ ...hidden, title: "Material so'rovi", tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
    </Tabs>
  );
}
