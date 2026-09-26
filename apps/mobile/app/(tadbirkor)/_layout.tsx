import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { tabsOptions } from '@/design/nav';
import { HeaderBack, tabIcon } from '@/design/ui';

/**
 * Tadbirkor — 5 tab: Bosh · Loyihalar · Buyurtmalar · Moliya · Menyu.
 * Yashirin ekranlar: Quruvchilar, Haydovchilar, Materiallar, Transport, Xabarlar, Bildirishnomalar, Profil, Xodimlar.
 */
export default function TadbirkorLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const hidden = { href: null } as const;
  return (
    <Tabs screenOptions={tabsOptions(c, insets.bottom)}>
      <Tabs.Screen name="index" options={{ title: 'Bosh', headerShown: false, tabBarIcon: tabIcon('house') }} />
      <Tabs.Screen name="projects" options={{ title: 'Loyihalar', tabBarIcon: tabIcon('building') }} />
      <Tabs.Screen name="orders" options={{ title: 'Buyurtmalar', tabBarIcon: tabIcon('clipboard-list') }} />
      <Tabs.Screen name="finance" options={{ title: 'Moliya', tabBarIcon: tabIcon('chart-column') }} />
      <Tabs.Screen name="menu" options={{ title: 'Menyu', tabBarIcon: tabIcon('menu') }} />
      <Tabs.Screen name="workers" options={{ ...hidden, title: 'Quruvchilar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="drivers" options={{ ...hidden, title: 'Haydovchilar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="materials" options={{ ...hidden, title: 'Materiallar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="transport" options={{ ...hidden, title: 'Transport', headerLeft: HeaderBack }} />
      <Tabs.Screen name="messages" options={{ ...hidden, title: 'Xabarlar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="notifications" options={{ ...hidden, title: 'Bildirishnomalar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="profile" options={{ ...hidden, title: 'Profil', headerLeft: HeaderBack }} />
      <Tabs.Screen name="members" options={{ ...hidden, title: 'Xodimlar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="new-project" options={{ ...hidden, title: 'Yangi loyiha', tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
      <Tabs.Screen name="new-order" options={{ ...hidden, title: 'Yangi buyurtma', tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
    </Tabs>
  );
}
