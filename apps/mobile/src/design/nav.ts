import React from 'react';
import { Platform, Text, View } from 'react-native';
import type { Stack, Tabs } from 'expo-router';
import { FONT, Palette, radius, shadow, size, space, type } from './tokens';

type TabOpts = Exclude<NonNullable<React.ComponentProps<typeof Tabs>['screenOptions']>, (...a: never[]) => unknown>;
type StackOpts = Exclude<NonNullable<React.ComponentProps<typeof Stack>['screenOptions']>, (...a: never[]) => unknown>;

/** Suzuvchi tab paneli radiusi (demo: 26). */
const BAR_RADIUS = radius.xl + 2;
/** Panel ichki balandligi: oddiy — 64, haydovchi — 76 (har tab ≥ 64 px nishon). */
const BAR_H = { normal: 64, driver: size.driverTouch + space.md } as const;
/** Panel ichidagi vertikal bo'shliq. */
const BAR_PAD = 6;

/**
 * Navigatsiya "chrome"i — tab paneli va sarlavha paneli hamma joyda bir xil.
 * Layout fayllarida shrift/rang yozilmaydi: shu ikki funksiya ishlatiladi.
 *
 * Tab paneli — suzuvchi: chetlardan bo'shliq, radius 26, `shadow.pop`, bgChrome fon.
 * Panelning o'zi bgApp rangida (ekran bilan qo'shilib ketadi), yumaloq "kapsula" `tabBarBackground`da chiziladi —
 * shuning uchun kontent panel ostiga kirmaydi va hech qanday ekranga pastki padding kerak emas.
 * Faol tab — ikonka brandSoft pill ichida (`tabIcon` — ui.tsx). Yorliq shrifti kattalashadi, lekin 1.2× dan oshmaydi.
 */
export function tabsOptions(c: Palette, bottomInset: number, opts: { driver?: boolean } = {}): TabOpts {
  const driver = !!opts.driver;
  const barH = driver ? BAR_H.driver : BAR_H.normal;
  const bottomGap = Math.max(bottomInset, space.md);
  const top = space.sm;
  return {
    tabBarActiveTintColor: c.brandInk,
    tabBarInactiveTintColor: c.textMuted,
    tabBarStyle: {
      backgroundColor: c.bgApp,
      borderTopWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
      height: top + barH + bottomGap,
      paddingTop: top + BAR_PAD,
      paddingBottom: bottomGap + BAR_PAD,
      paddingHorizontal: space.md + space.xs,
    },
    tabBarBackground: () => React.createElement(View, {
      style: [{ position: 'absolute', left: space.md, right: space.md, top, bottom: bottomGap, borderRadius: BAR_RADIUS, borderCurve: 'continuous', backgroundColor: c.bgChrome }, shadow.pop],
    }),
    tabBarIconStyle: driver ? { width: size.driverTouch - space.sm, height: space.x10 - 4 } : { width: space.x12 + space.sm, height: space.xxxl - 2 },
    tabBarLabel: ({ focused, children }: { focused: boolean; color: string; children: string }) => React.createElement(Text, {
      numberOfLines: 1,
      maxFontSizeMultiplier: 1.2,
      style: { fontFamily: focused ? FONT[700] : FONT[500], fontSize: driver ? type.label.fontSize : type.overlineXs.fontSize + 0.5, lineHeight: driver ? type.label.lineHeight : type.caption.lineHeight, color: focused ? c.textStrong : c.textMuted, marginTop: 2 },
    }, children),
    tabBarAllowFontScaling: true,
    tabBarItemStyle: { paddingHorizontal: 2, minHeight: driver ? size.driverTouch : size.touch, height: barH - BAR_PAD * 2, borderRadius: BAR_RADIUS - BAR_PAD },
    headerStyle: { backgroundColor: c.bgApp },
    headerShadowVisible: false,
    headerTintColor: c.textStrong,
    headerTitleAlign: 'center',
    headerTitleStyle: { fontFamily: FONT[600], fontSize: type.titleSm.fontSize },
    sceneStyle: { backgroundColor: c.bgApp },
  };
}

/** Stack sarlavhasi — chiziqsiz, ekran foni (bgApp) bilan bir xil: sahifa bitta yuza bo'lib ko'rinadi. */
export function stackOptions(c: Palette): StackOpts {
  return {
    headerStyle: { backgroundColor: c.bgApp },
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
