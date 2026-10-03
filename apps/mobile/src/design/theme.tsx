import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useSession } from '@/core/session';
import { ErpRoleKey, Palette, PaletteName, RoleKey, palettes } from './tokens';
import { SchemePref, usePrefs } from './prefs';

interface Theme {
  c: Palette;
  dark: boolean;
  /** Tanlangan palitra (Chizma / Marjon). */
  paletteName: PaletteName;
  /** Foydalanuvchi tanlovi: tizim / yorug' / qorong'i. */
  scheme: SchemePref;
  /** Faol ECO roli — auth va rol tanlashda null. */
  role: RoleKey | null;
  /** ERP xodimi bo'limi; ECO sessiyasida null. */
  erpRole: ErpRoleKey | null;
}

const ThemeCtx = createContext<Theme>({ c: palettes.chizma.light, dark: false, paletteName: 'chizma', scheme: 'system', role: null, erpRole: null });

/**
 * Bitta dizayn tizimi — hamma rol uchun bir xil palitra. Palitra (Chizma/Marjon) va rejim
 * (tizim/yorug'/qorong'i) Sozlamalarda tanlanadi (`prefs.ts`). Ekranlar `useTheme().c` orqali oladi.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const scheme = usePrefs((s) => s.scheme);
  const paletteName = usePrefs((s) => s.palette);
  const role = useSession((s) => (s.kind === 'eco' ? s.active?.role ?? null : null));
  const erpRole = useSession((s) => (s.kind === 'erp' ? s.erp?.role ?? null : null));
  const value = useMemo<Theme>(() => {
    const dark = scheme === 'system' ? system === 'dark' : scheme === 'dark';
    const set = palettes[paletteName] ?? palettes.chizma;
    return { c: dark ? set.dark : set.light, dark, paletteName, scheme, role, erpRole };
  }, [system, scheme, paletteName, role, erpRole]);

  /** Android pastki tizim paneli ham mavzuga ergashsin (chrome rangi). */
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void NavigationBar.setBackgroundColorAsync(value.c.bgChrome).catch(() => {});
    void NavigationBar.setButtonStyleAsync(value.dark ? 'light' : 'dark').catch(() => {});
  }, [value.c.bgChrome, value.dark]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
