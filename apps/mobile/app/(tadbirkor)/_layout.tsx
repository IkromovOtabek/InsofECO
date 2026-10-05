import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { floatingTabBar, tabsOptions } from '@/design/nav';
import { useReducedMotion } from '@/design/motion';
import { HeaderBack, tabIcon } from '@/design/ui';

/**
 * Tadbirkor — demo 01 tab paneli: Asosiy · Buyurtma · Xabarlar · Profil (Profil — hisob va menyu hubi).
 * Loyihalar va Moliya — bosh sahifadan (Loyihalar "Barchasi", Daromad/Xarajat KPI) va menyudan ochiladi.
 * Yashirin ekranlar: Quruvchilar, Haydovchilar, Materiallar, Transport, Bildirishnomalar, Profil, Xodimlar.
 */
export default function TadbirkorLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const hidden = { href: null } as const;
  // `history` — yashirin ekranlardan (Menyu → Xodimlar, Daromad, Tarix) «Orqaga» ochilgan joyiga qaytadi, birinchi tabga emas
  return (
    <Tabs backBehavior="history" tabBar={floatingTabBar()} screenOptions={tabsOptions(c, insets.bottom, { reduce })}>
      <Tabs.Screen name="index" options={{ title: 'Asosiy', headerShown: false, tabBarIcon: tabIcon('house') }} />
      <Tabs.Screen name="orders" options={{ title: 'Buyurtma', tabBarIcon: tabIcon('list') }} />
      <Tabs.Screen name="messages" options={{ title: 'Xabarlar', tabBarIcon: tabIcon('message-circle') }} />
      <Tabs.Screen name="menu" options={{ title: 'Profil', tabBarIcon: tabIcon('user') }} />
      <Tabs.Screen name="projects" options={{ ...hidden, title: 'Loyihalar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="finance" options={{ ...hidden, title: 'Moliya', headerLeft: HeaderBack }} />
      <Tabs.Screen name="workers" options={{ ...hidden, title: 'Quruvchilar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="drivers" options={{ ...hidden, title: 'Haydovchilar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="materials" options={{ ...hidden, title: 'Materiallar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="transport" options={{ ...hidden, title: 'Transport', headerLeft: HeaderBack }} />
      <Tabs.Screen name="notifications" options={{ ...hidden, title: 'Bildirishnomalar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="profile" options={{ ...hidden, title: 'Profil', headerLeft: HeaderBack }} />
      <Tabs.Screen name="members" options={{ ...hidden, title: 'Xodimlar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="new-project" options={{ ...hidden, title: 'Yangi loyiha', tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
      <Tabs.Screen name="new-order" options={{ ...hidden, title: 'Yangi buyurtma', tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
    </Tabs>
  );
}
