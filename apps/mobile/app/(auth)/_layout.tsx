import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/design/theme';
import { authStackOptions } from '@/design/nav';
import { useReducedMotion } from '@/design/motion';

/**
 * Boshlang'ich ekran `login`: ro'yxat berilmasa expo-router alifbo bo'yicha birinchi
 * ekranni (change-password) ochib yuboradi. Ilova endi do'kon (`(shop)`) bilan ochiladi,
 * shuning uchun `welcome` boshlang'ich emas — do'kondan "Kirish" bosilganda orqaga
 * tugmasi to'g'ridan-to'g'ri do'konga qaytaradi.
 */
export const unstable_settings = { initialRouteName: 'login' };

const SCREENS = ['welcome', 'login', 'select-role', 'phone', 'otp', 'register', 'forgot', 'new-password', 'change-password', 'pin', 'done'];

/** Autentifikatsiya ekranlari o'z orqaga tugmasini chizadi (AuthScreen) — nav header yo'q; qadamlar orasida yumshoq fade. */
export default function AuthLayout() {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  return (
    <Stack screenOptions={authStackOptions(c, { reduce })}>
      {SCREENS.map((n) => <Stack.Screen key={n} name={n} />)}
    </Stack>
  );
}
