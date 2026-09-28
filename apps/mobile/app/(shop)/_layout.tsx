import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/design/theme';
import { stackOptions } from '@/design/nav';
import { LoginPrompt } from '@/features/shop/login-prompt';

/**
 * E-commerce — ilova ochilganda birinchi ko'rinadigan bo'lim. Login so'ralmaydi:
 * mehmon mahsulotlarni ko'radi va buyurtma qoldiradi; 10 soniyadan keyin kirish taklifi chiqadi.
 * Kirgan foydalanuvchi ham menyudan shu yerga kira oladi.
 */
export default function ShopLayout() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <Stack screenOptions={stackOptions(c)}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="[id]" options={{ title: 'Mahsulot' }} />
      </Stack>
      <LoginPrompt />
    </View>
  );
}
