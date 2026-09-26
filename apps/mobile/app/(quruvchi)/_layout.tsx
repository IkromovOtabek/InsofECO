import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { tabsOptions } from '@/design/nav';
import { HeaderBack, tabIcon } from '@/design/ui';

/**
 * Quruvchi — 5 tab: Bosh · Buyurtmalar · Vazifalar · Materiallar · Menyu.
 * Yashirin ekranlar: Daromad, Ishlarim, Xabarlar, Profil, wizard'lar (tab bar yashiriladi).
 */
export default function QuruvchiLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const hidden = { href: null } as const;
  return (
    <Tabs screenOptions={tabsOptions(c, insets.bottom)}>
      <Tabs.Screen name="index" options={{ title: 'Bosh', headerShown: false, tabBarIcon: tabIcon('house') }} />
      <Tabs.Screen name="orders" options={{ title: 'Buyurtmalar', tabBarIcon: tabIcon('receipt') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Vazifalar', tabBarIcon: tabIcon('square-check') }} />
      <Tabs.Screen name="materials" options={{ title: 'Materiallar', tabBarIcon: tabIcon('package') }} />
      <Tabs.Screen name="menu" options={{ title: 'Menyu', tabBarIcon: tabIcon('menu') }} />
      <Tabs.Screen name="earnings" options={{ ...hidden, title: 'Daromad', headerLeft: HeaderBack }} />
      <Tabs.Screen name="my-jobs" options={{ ...hidden, title: 'Ishlarim', headerLeft: HeaderBack }} />
      <Tabs.Screen name="messages" options={{ ...hidden, title: 'Xabarlar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="profile" options={{ ...hidden, title: 'Profil', headerLeft: HeaderBack }} />
      <Tabs.Screen name="new-order" options={{ ...hidden, title: 'Beton buyurtma', tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
      <Tabs.Screen name="new-request" options={{ ...hidden, title: "Material so'rovi", tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
    </Tabs>
  );
}
