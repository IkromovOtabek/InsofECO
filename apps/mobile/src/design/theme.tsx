import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useSession } from '@/core/session';
import { ErpRoleKey, Palette, RoleKey, palette } from './tokens';

interface Theme {
  c: Palette;
  dark: boolean;
  /** Faol ECO roli — auth va rol tanlashda null. */
  role: RoleKey | null;
  /** ERP xodimi bo'limi; ECO sessiyasida null. */
  erpRole: ErpRoleKey | null;
}

const ThemeCtx = createContext<Theme>({ c: palette.light, dark: false, role: null, erpRole: null });

/**
 * Bitta dizayn tizimi — hamma rol uchun bir xil palitra. Yorug'/qorong'i tizim sozlamasiga ergashadi.
 * Ekranlar `useTheme().c` orqali oladi — rolni bilmaydi.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const role = useSession((s) => (s.kind === 'eco' ? s.active?.role ?? null : null));
  const erpRole = useSession((s) => (s.kind === 'erp' ? s.erp?.role ?? null : null));
  const value = useMemo<Theme>(() => {
    const dark = scheme === 'dark';
    return { c: dark ? palette.dark : palette.light, dark, role, erpRole };
  }, [scheme, role, erpRole]);

  /** Android pastki tizim paneli ham mavzuga ergashsin (chrome rangi). */
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void NavigationBar.setBackgroundColorAsync(value.c.bgChrome).catch(() => {});
    void NavigationBar.setButtonStyleAsync(value.dark ? 'light' : 'dark').catch(() => {});
  }, [value.c.bgChrome, value.dark]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
