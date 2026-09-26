import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/design/theme';
import { stackOptions } from '@/design/nav';

/** Autentifikatsiya ekranlari o'z orqaga tugmasini chizadi (AuthScreen) — nav header yo'q. */
export default function AuthLayout() {
  const { c } = useTheme();
  return <Stack screenOptions={{ ...stackOptions(c), headerShown: false }} />;
}
