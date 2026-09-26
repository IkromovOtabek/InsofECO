import React from 'react';
import { Platform } from 'react-native';
import type { Stack, Tabs } from 'expo-router';
import { FONT, Palette, size, space, type } from './tokens';

type TabOpts = Exclude<NonNullable<React.ComponentProps<typeof Tabs>['screenOptions']>, (...a: never[]) => unknown>;
type StackOpts = Exclude<NonNullable<React.ComponentProps<typeof Stack>['screenOptions']>, (...a: never[]) => unknown>;

/**
 * Navigatsiya "chrome"i — tab paneli va sarlavha paneli hamma joyda bir xil.
 * Layout fayllarida shrift/rang yozilmaydi: shu ikki funksiya ishlatiladi.
 */
export function tabsOptions(c: Palette, bottomInset: number): TabOpts {
  return {
    tabBarActiveTintColor: c.brandInk,
    tabBarInactiveTintColor: c.textMuted,
    tabBarStyle: { backgroundColor: c.bgChrome, borderTopWidth: size.hairline, borderTopColor: c.borderDefault, height: size.tabBar + bottomInset, paddingBottom: bottomInset, paddingTop: space.sm },
    tabBarLabelStyle: { fontFamily: FONT[500], fontSize: type.caption.fontSize },
    tabBarAllowFontScaling: false,
    tabBarItemStyle: { paddingHorizontal: 2, minHeight: size.touch },
    headerStyle: { backgroundColor: c.bgChrome },
    headerShadowVisible: false,
    headerTintColor: c.textStrong,
    headerTitleAlign: 'center',
    headerTitleStyle: { fontFamily: FONT[600], fontSize: type.titleSm.fontSize },
    sceneStyle: { backgroundColor: c.bgApp },
  };
}

export function stackOptions(c: Palette): StackOpts {
  return {
    headerStyle: { backgroundColor: c.bgChrome },
    headerTintColor: c.textStrong,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerLargeTitle: false,
    headerTitleAlign: 'center',
    headerTitleStyle: { fontFamily: FONT[600], fontSize: type.titleSm.fontSize },
    contentStyle: { backgroundColor: c.bgApp },
    ...(Platform.OS === 'android' ? { animation: 'fade_from_bottom' as const } : null),
  };
}
