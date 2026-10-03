import React from 'react';
import { Platform, Text, View } from 'react-native';
import type { Stack, Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { FONT, Palette, duration, elevation, radius, size, space, type } from './tokens';
import { FloatingTabBar } from './ui';

type TabOpts = Exclude<NonNullable<React.ComponentProps<typeof Tabs>['screenOptions']>, (...a: never[]) => unknown>;
type StackOpts = Exclude<NonNullable<React.ComponentProps<typeof Stack>['screenOptions']>, (...a: never[]) => unknown>;

/** Suzuvchi tab paneli radiusi (demo: 26 css → 36 dp). */
const BAR_RADIUS = radius.tabBar;
/** Panel ichki balandligi (demo 7+24+2+12+7 css → 72 dp); haydovchi — 92. */
const BAR_H = { normal: 72, driver: size.driverTouch + space.x7 } as const;
/** Panel ichidagi vertikal bo'shliq (7 css → 10). */
const BAR_PAD = 10;

/**
 * Demo 1:1 tab paneli — `<Tabs tabBar={floatingTabBar({ driver })} …>`: brandSoft pill tablar orasida prujina bilan suriladi.
 * `tabsOptions` bilan birga ishlatiladi (u sarlavha va sahna rangini beradi).
 */
export function floatingTabBar(opts: { driver?: boolean } = {}) {
  return (props: BottomTabBarProps) => React.createElement(FloatingTabBar, { ...props, driver: !!opts.driver });
}

/**
 * Navigatsiya "chrome"i — tab paneli va sarlavha paneli hamma joyda bir xil.
 * Layout fayllarida shrift/rang yozilmaydi: shu ikki funksiya ishlatiladi.
 *
 * Tab paneli — suzuvchi: chetlardan bo'shliq, radius 26, `shadow.pop`, bgChrome fon.
 * Panelning o'zi bgApp rangida (ekran bilan qo'shilib ketadi), yumaloq "kapsula" `tabBarBackground`da chiziladi —
 * shuning uchun kontent panel ostiga kirmaydi va hech qanday ekranga pastki padding kerak emas.
 * Faol tab — ikonka brandSoft pill ichida (`tabIcon` — ui.tsx). Yorliq shrifti kattalashadi, lekin 1.2× dan oshmaydi.
 */
export function tabsOptions(c: Palette, bottomInset: number, opts: { driver?: boolean; /** `useReducedMotion()` — tab almashganda animatsiyasiz. */ reduce?: boolean } = {}): TabOpts {
  const driver = !!opts.driver;
  const barH = driver ? BAR_H.driver : BAR_H.normal;
  const bottomGap = Math.max(bottomInset, space.lg);
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
      paddingHorizontal: space.lg + space.sm,
    },
    tabBarBackground: () => React.createElement(View, {
      style: [{ position: 'absolute', left: space.lg, right: space.lg, top, bottom: bottomGap, borderRadius: BAR_RADIUS, borderCurve: 'continuous', backgroundColor: c.bgChrome }, elevation(c).sh2],
    }),
    tabBarIconStyle: driver ? { width: size.tabPillWDriver, height: size.tabPillHDriver } : { width: size.tabPillW, height: size.tabPillH },
    tabBarLabel: ({ focused, children }: { focused: boolean; color: string; children: string }) => React.createElement(Text, {
      numberOfLines: 1,
      maxFontSizeMultiplier: 1.2,
      style: { ...(driver ? type.tabLabelDriver : type.tabLabel), color: focused ? c.textStrong : c.textMuted, marginTop: 3 },
    }, children),
    tabBarAllowFontScaling: true,
    tabBarItemStyle: { paddingHorizontal: 2, minHeight: driver ? size.driverTouch : size.touch, height: barH - BAR_PAD * 2, borderRadius: BAR_RADIUS - BAR_PAD },
    headerStyle: { backgroundColor: c.bgApp },
    headerShadowVisible: false,
    headerTintColor: c.textStrong,
    headerTitleAlign: 'center',
    headerTitleStyle: { fontFamily: FONT[600], fontSize: type.titleSm.fontSize },
    sceneStyle: { backgroundColor: c.bgApp },
    // Tablar orasida yumshoq cross-fade (native driver, UI oqimida); harakat kamaytirilgan bo'lsa — bir zumda
    animation: opts.reduce ? 'none' : 'fade',
    transitionSpec: { animation: 'timing', config: { duration: duration.tab } },
  };
}

type StackAnim = NonNullable<StackOpts['animation']>;

/** Oddiy push: iOS — tizim slaydi (orqaga surish bilan), Android — fade_from_bottom. */
const PUSH: StackAnim = Platform.OS === 'ios' ? 'default' : 'fade_from_bottom';

/** Stack sarlavhasi — chiziqsiz, ekran foni (bgApp) bilan bir xil: sahifa bitta yuza bo'lib ko'rinadi. */
export function stackOptions(c: Palette, opts: { /** `useReducedMotion()` — o'tishlar animatsiyasiz. */ reduce?: boolean } = {}): StackOpts {
  return {
    headerStyle: { backgroundColor: c.bgApp },
    headerTintColor: c.textStrong,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerLargeTitle: false,
    headerTitleAlign: 'center',
    headerTitleStyle: { fontFamily: FONT[600], fontSize: type.titleSm.fontSize },
    contentStyle: { backgroundColor: c.bgApp },
    animation: opts.reduce ? 'none' : PUSH,
    animationDuration: duration.nav,
    gestureEnabled: true,
  };
}

/**
 * Modalga o'xshash ekran (sozlamalar, rasmiylashtirish, yangi forma) — pastdan yumshoq ko'tariladi,
 * lekin oddiy kartochka bo'lib qoladi (o'z orqaga tugmasi va sarlavhasi ishlayveradi).
 */
export function sheetScreen(opts: { reduce?: boolean } = {}): StackOpts {
  return { animation: opts.reduce ? 'none' : 'fade_from_bottom', animationDuration: duration.nav, gestureEnabled: true };
}

/** Haqiqiy modal (iOS — varaq, pastga tortib yopiladi). Ichida o'z sarlavhasi bo'lgan qisqa formalar uchun. */
export function modalScreen(opts: { reduce?: boolean } = {}): StackOpts {
  return { presentation: 'modal', animation: opts.reduce ? 'none' : 'default', animationDuration: duration.nav, gestureEnabled: true };
}

/** Kirish oqimi (login → OTP → ro'yxat): qadamlar orasida yumshoq fade, 280 ms. */
export function authStackOptions(c: Palette, opts: { reduce?: boolean } = {}): StackOpts {
  return { ...stackOptions(c, opts), headerShown: false, animation: opts.reduce ? 'none' : 'fade', animationDuration: 280 };
}
