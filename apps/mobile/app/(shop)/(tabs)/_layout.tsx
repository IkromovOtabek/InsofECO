import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { floatingTabBar, tabsOptions } from '@/design/nav';
import { useReducedMotion } from '@/design/motion';
import { tabIcon } from '@/design/ui';
import { useCartCount } from '@/features/shop/cart';

/**
 * Do'kon tablari — demo `ctabs`: Bosh · Katalog · Savat (nishonda savat qatorlari soni) · Buyurtma · Profil.
 * Suzuvchi panel (`floatingTabBar`). Sarlavhalarni ekranlar o'zi chizadi — nav header yo'q.
 */
export default function ShopTabs() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const count = useCartCount();
  return (
    <Tabs tabBar={floatingTabBar()} screenOptions={{ ...tabsOptions(c, insets.bottom, { reduce }), headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Bosh', tabBarIcon: tabIcon('house') }} />
      <Tabs.Screen name="katalog" options={{ title: 'Katalog', tabBarIcon: tabIcon('layers') }} />
      <Tabs.Screen name="savat" options={{ title: 'Savat', tabBarIcon: tabIcon('shopping-cart'), tabBarBadge: count > 0 ? count : undefined }} />
      <Tabs.Screen name="buyurtma" options={{ title: 'Buyurtma', tabBarIcon: tabIcon('truck') }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
