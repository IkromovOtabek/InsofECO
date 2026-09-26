import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/design/theme';
import { stackOptions } from '@/design/nav';

/**
 * Boshlang'ich ekran doim `welcome`: ro'yxat berilmasa expo-router alifbo bo'yicha
 * birinchi ekranni (otp/phone) ochib yuboradi.
 */
export const unstable_settings = { initialRouteName: 'welcome' };

const SCREENS = ['welcome', 'login', 'select-role', 'phone', 'otp', 'register', 'forgot', 'new-password', 'change-password', 'pin', 'done'];

/** Autentifikatsiya ekranlari o'z orqaga tugmasini chizadi (AuthScreen) — nav header yo'q. */
export default function AuthLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ ...stackOptions(c), headerShown: false }}>
      {SCREENS.map((n) => <Stack.Screen key={n} name={n} />)}
    </Stack>
  );
}
