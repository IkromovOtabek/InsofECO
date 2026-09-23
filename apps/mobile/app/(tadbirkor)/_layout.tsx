import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '@/design/theme';
import { HeaderBack, tabIcon } from '@/design/ui';

/**
 * Tadbirkor — "Boshqaruv" skini (navy + amber, o'tkir burchaklar, zich ma'lumot).
 * Ixcham 5 tabli bar (11 pt yorliq), sirt rangli header hairline chegara bilan — ish stoli/moliya ilovasi kayfiyati.
 * Yashirin ekranlar: Quruvchilar, Haydovchilar, Materiallar, Transport, Xabarlar, Bildirishnomalar, Profil, Xodimlar.
 */
export default function TadbirkorLayout() {
  const { c } = useTheme();
  const hidden = { href: null } as const;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.brandPrimary, tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: { backgroundColor: c.bgSurface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, height: Platform.OS === 'ios' ? 82 : 62, paddingBottom: Platform.OS === 'ios' ? 26 : 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
        headerStyle: { backgroundColor: c.bgSurface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
        headerShadowVisible: false, headerTintColor: c.textPrimary,
        headerTitleAlign: Platform.OS === 'android' ? 'left' : 'center', headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        sceneStyle: { backgroundColor: c.bgCanvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Bosh', headerShown: false, tabBarIcon: tabIcon('grid-outline', 'grid') }} />
      <Tabs.Screen name="projects" options={{ title: 'Loyihalar', tabBarIcon: tabIcon('business-outline', 'business') }} />
      <Tabs.Screen name="orders" options={{ title: 'Buyurtmalar', tabBarIcon: tabIcon('clipboard-outline', 'clipboard') }} />
      <Tabs.Screen name="finance" options={{ title: 'Moliya', tabBarIcon: tabIcon('stats-chart-outline', 'stats-chart') }} />
      <Tabs.Screen name="menu" options={{ title: 'Menyu', tabBarIcon: tabIcon('menu-outline', 'menu') }} />
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
