import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '@/design/theme';
import { tabIcon } from '@/design/ui';

/**
 * Haydovchi — "Kabina" skini (doim qorong'i, yorqin yashil + sariq).
 * Faqat 3 tab — Bugun · Yuklar · Men. 14 pt qalin yorliq, 1.25× ikon, baland bar — qo'lqopda, rulda bir bosishda.
 */
export default function HaydovchiLayout() {
  const { c } = useTheme();
  const hidden = { href: null } as const;
  const ios = Platform.OS === 'ios';
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: c.brandPrimary, tabBarInactiveTintColor: c.textSecondary,
      tabBarStyle: { backgroundColor: c.bgSurface, borderTopWidth: 1, borderTopColor: c.border, height: ios ? 96 : 78, paddingBottom: ios ? 30 : 12, paddingTop: 10 },
      tabBarLabelStyle: { fontSize: 14, fontWeight: '800' }, tabBarIconStyle: { transform: [{ scale: 1.25 }] },
      headerStyle: { backgroundColor: c.bgCanvas }, headerShadowVisible: false, headerTintColor: c.textPrimary,
      headerTitleAlign: 'center', headerTitleStyle: { fontWeight: '800', fontSize: 22 },
      sceneStyle: { backgroundColor: c.bgCanvas },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Bugun', headerShown: false, tabBarIcon: tabIcon('navigate-circle-outline', 'navigate-circle') }} />
      <Tabs.Screen name="deliveries" options={{ title: 'Yuklar', tabBarIcon: tabIcon('cube-outline', 'cube') }} />
      <Tabs.Screen name="menu" options={{ title: 'Men', tabBarIcon: tabIcon('person-circle-outline', 'person-circle') }} />
      <Tabs.Screen name="transport" options={{ ...hidden, title: 'Transportim' }} />
      <Tabs.Screen name="earnings" options={{ ...hidden, title: 'Daromadim' }} />
      <Tabs.Screen name="history" options={{ ...hidden, title: 'Tarix' }} />
      <Tabs.Screen name="messages" options={{ ...hidden, title: 'Xabarlar' }} />
      <Tabs.Screen name="profile" options={{ ...hidden, title: 'Profil' }} />
    </Tabs>
  );
}
