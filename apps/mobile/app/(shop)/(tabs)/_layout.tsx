import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { tabsOptions } from '@/design/nav';
import { tabIcon } from '@/design/ui';

/** Do'kon tablari. Sarlavhalarni ekranlar o'zi chizadi (logotip bilan) — nav header yo'q. */
export default function ShopTabs() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{ ...tabsOptions(c, insets.bottom), headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Bosh sahifa', tabBarIcon: tabIcon('house') }} />
      <Tabs.Screen name="katalog" options={{ title: 'Katalog', tabBarIcon: tabIcon('layout-grid') }} />
      <Tabs.Screen name="aloqa" options={{ title: 'Aloqa', tabBarIcon: tabIcon('phone') }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
