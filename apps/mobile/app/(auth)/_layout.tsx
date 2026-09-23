import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/design/theme';

export default function AuthLayout() {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bgCanvas }, headerShadowVisible: false, headerTintColor: c.brandPrimary,
        headerTitle: '', headerBackTitle: 'Orqaga', contentStyle: { backgroundColor: c.bgCanvas },
        headerTitleAlign: Platform.OS === 'android' ? 'left' : 'center',
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="select-role" options={{ headerShown: false }} />
      {/* Kirish ekrani o'z qorong'i fonini chizadi */}
      {/* Autentifikatsiya ekranlari maketdagi qorong'i uslubda — o'z orqaga tugmasi bilan */}
      {['login', 'phone', 'otp', 'register', 'forgot', 'new-password', 'change-password', 'pin', 'done'].map((n) => (
        <Stack.Screen key={n} name={n} options={{ headerShown: false, contentStyle: { backgroundColor: '#12151B' } }} />
      ))}
    </Stack>
  );
}
