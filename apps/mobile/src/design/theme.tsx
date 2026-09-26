import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useSession } from '@/core/session';
import { ErpRoleKey, Palette, RoleKey, Shape, Skin, defaultSkin, erpSkin, skins } from './tokens';

interface Theme {
  c: Palette;
  dark: boolean;
  /** Faol rol — null bo'lsa auth/rol tanlash (ECO yashil skin). */
  role: RoleKey | null;
  /** ERP xodimi kirgan bo'lsa uning bo'limi; ECO sessiyasida null. */
  erpRole: ErpRoleKey | null;
  shape: Shape;
  skin: Skin;
}

const ThemeCtx = createContext<Theme>({ c: defaultSkin.light, dark: false, role: null, erpRole: null, shape: defaultSkin.shape, skin: defaultSkin });

/** Rolga qarab skin: Tadbirkor (navy), Quruvchi (terrakota), Haydovchi (qorong'i kabina), ERP xodimi (bo'lim rangi). Ekranlar `useTheme().c` orqali oladi — rolni bilmaydi. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const role = useSession((s) => (s.kind === 'eco' ? s.active?.role ?? null : null));
  const erpRole = useSession((s) => (s.kind === 'erp' ? s.erp?.role ?? null : null));
  const value = useMemo<Theme>(() => {
    const skin = erpRole ? erpSkin(erpRole) : role ? skins[role] : defaultSkin;
    const dark = skin.forceDark ? true : scheme === 'dark';
    return { c: dark ? skin.dark : skin.light, dark, role, erpRole, shape: skin.shape, skin };
  }, [scheme, role, erpRole]);

  /**
   * Pastdagi tizim tugmalari paneli ham mavzuga ergashsin.
   *
   * Aks holda haydovchining qorong'i ekrani ostida oq chiziq bo'lib turadi va ilova
   * ekranga to'liq egalik qilmagandek ko'rinadi. Faqat Android'da — iOS'da bunday panel yo'q.
   */
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void NavigationBar.setBackgroundColorAsync(value.c.bgSurface).catch(() => {});
    void NavigationBar.setButtonStyleAsync(value.dark ? 'light' : 'dark').catch(() => {});
  }, [value.c.bgSurface, value.dark]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
