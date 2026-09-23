import React from 'react';
import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '@/design/theme';
import { elevation } from '@/design/tokens';
import { HeaderBack, tabIcon } from '@/design/ui';

/**
 * Quruvchi — "Qurilish" skini (terrakota + qum, yumaloq shakllar).
 * Tab bar — kanvas ustida suzuvchi "pill" (tabBarBackground orqali; absolute emas, shuning uchun ro'yxatlar ostida yashirinmaydi).
 * Yashirin ekranlar: Daromad, Ishlarim, Xabarlar, Profil, wizard'lar (tab bar yashiriladi).
 */
export default function QuruvchiLayout() {
  const { c } = useTheme();
  const hidden = { href: null } as const;
  const ios = Platform.OS === 'ios';
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: c.brandPrimary, tabBarInactiveTintColor: c.textSecondary,
      tabBarStyle: { backgroundColor: c.bgCanvas, borderTopWidth: 0, elevation: 0, height: ios ? 98 : 80, paddingBottom: ios ? 34 : 18, paddingTop: 12, paddingHorizontal: 20 },
      tabBarBackground: () => <View style={[{ flex: 1, marginHorizontal: 14, marginBottom: ios ? 22 : 10, borderRadius: 30, backgroundColor: c.bgSurface, borderWidth: ios ? 0 : 1, borderColor: c.border }, elevation.card]} />,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      headerStyle: { backgroundColor: c.bgCanvas }, headerShadowVisible: false, headerTintColor: c.textPrimary,
      headerTitleAlign: ios ? 'center' : 'left', headerTitleStyle: { fontWeight: '800', fontSize: 18 },
      sceneStyle: { backgroundColor: c.bgCanvas },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Bosh', headerShown: false, tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="orders" options={{ title: 'Buyurtmalar', tabBarIcon: tabIcon('receipt-outline', 'receipt') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Vazifalar', tabBarIcon: tabIcon('checkmark-circle-outline', 'checkmark-circle') }} />
      <Tabs.Screen name="materials" options={{ title: 'Materiallar', tabBarIcon: tabIcon('cube-outline', 'cube') }} />
      <Tabs.Screen name="menu" options={{ title: 'Menyu', tabBarIcon: tabIcon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }} />
      <Tabs.Screen name="earnings" options={{ ...hidden, title: 'Daromad', headerLeft: HeaderBack }} />
      <Tabs.Screen name="my-jobs" options={{ ...hidden, title: 'Ishlarim', headerLeft: HeaderBack }} />
      <Tabs.Screen name="messages" options={{ ...hidden, title: 'Xabarlar', headerLeft: HeaderBack }} />
      <Tabs.Screen name="profile" options={{ ...hidden, title: 'Profil', headerLeft: HeaderBack }} />
      <Tabs.Screen name="new-order" options={{ ...hidden, title: 'Beton buyurtma', tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
      <Tabs.Screen name="new-request" options={{ ...hidden, title: "Material so'rovi", tabBarStyle: { display: 'none' }, headerLeft: HeaderBack }} />
    </Tabs>
  );
}
