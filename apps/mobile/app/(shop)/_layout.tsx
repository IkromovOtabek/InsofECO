import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/design/theme';
import { sheetScreen, stackOptions } from '@/design/nav';
import { useReducedMotion } from '@/design/motion';
import { LoginPrompt } from '@/features/shop/login-prompt';

/**
 * E-commerce — ilova ochilganda birinchi ko'rinadigan bo'lim. Login so'ralmaydi:
 * mehmon mahsulotlarni ko'radi va buyurtma qoldiradi; 10 soniyadan keyin kirish taklifi chiqadi.
 * Tuzilma: pastki tablar `(tabs)` (Bosh · Katalog · Savat · Buyurtma · Profil); mahsulot `[id]`, zavod,
 * kalkulyator, rasmiylashtirish (`checkout`), kuzatish va aloqa tablar ustidan ochiladi.
 * Kirgan foydalanuvchi ham menyudan shu yerga kira oladi.
 */
export default function ShopLayout() {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <Stack screenOptions={stackOptions(c, { reduce })}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Mahsulot va zavod — surat/muqova ekran tepasigacha, orqaga tugmasi suzib turadi */}
        <Stack.Screen name="[id]" options={{ title: 'Mahsulot', headerShown: false }} />
        <Stack.Screen name="zavod" options={{ title: 'Zavod', headerShown: false }} />
        <Stack.Screen name="kalkulyator" options={{ title: 'Kalkulyator' }} />
        <Stack.Screen name="checkout" options={{ title: 'Buyurtma', headerShown: false, ...sheetScreen({ reduce }) }} />
        <Stack.Screen name="kuzatish/[id]" options={{ title: 'Kuzatish', headerShown: false }} />
        <Stack.Screen name="aloqa" options={{ title: 'Aloqa', headerShown: false, ...sheetScreen({ reduce }) }} />
      </Stack>
      <LoginPrompt />
    </View>
  );
}
