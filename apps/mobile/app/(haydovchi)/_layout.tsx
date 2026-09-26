import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { tabsOptions } from '@/design/nav';
import { HeaderBack, tabIcon } from '@/design/ui';

/**
 * Haydovchi — 3 tab: Bugun · Yuklar · Men. Tizim mavzusiga ergashadi; kattaroq nishonlar
 * ekran ichida (`@/design/driver`) beriladi, chrome hamma rol bilan bir xil.
 */
export default function HaydovchiLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const hidden = { href: null } as const;
  return (
    <Tabs screenOptions={tabsOptions(c, insets.bottom)}>
      <Tabs.Screen name="index" options={{ title: 'Bugun', headerShown: false, tabBarIcon: tabIcon('navigation') }} />
      <Tabs.Screen name="deliveries" options={{ title: 'Yuklar', tabBarIcon: tabIcon('package') }} />
      <Tabs.Screen name="menu" options={{ title: 'Men', tabBarIcon: tabIcon('circle-user') }} />
      <Tabs.Screen name="transport" options={{ ...hidden, title: 'Transportim', headerLeft: HeaderBack }} />
      <Tabs.Screen name="earnings" options={{ ...hidden, title: 'Daromadim', headerLeft: HeaderBack }} />
      <Tabs.Screen name="history" options={{ ...hidden, title: 'Tarix', headerLeft: HeaderBack }} />
      <Tabs.Screen name="messages" options={{ ...hidden, title: 'Xabarlar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="profile" options={{ ...hidden, title: 'Profil', headerLeft: HeaderBack }} />
    </Tabs>
  );
}
