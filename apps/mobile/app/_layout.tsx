import '@/core/i18n';
import '@/core/erp-track'; // fon GPS vazifasi ilova ishga tushganda ro'yxatdan o'tsin
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { ThemeProvider, useTheme } from '@/design/theme';
import { queryClient, persister } from '@/core/query';
import { useSession } from '@/core/session';
import { outbox } from '@/core/outbox';
import { authApi } from '@/features/auth/api';
import { LaunchOverlay } from '@/components/launch';
import { PinLock } from '@/components/pin-lock';
import { useFonts } from 'expo-font';
import { ERP_FONTS } from '@/design/fonts';
import { erpAuth } from '@/core/erp';
import { ERP_GROUPS, erpRoleConfig } from '@/features/erp/roles';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });

const ROLE_GROUP = { TADBIRKOR: '(tadbirkor)', QURUVCHI: '(quruvchi)', HAYDOVCHI: '(haydovchi)' } as const;

/**
 * Auth gate: sessiya holati va faol rolga qarab yo'naltirish. Ekranlar buni bilmaydi.
 * Ikki xil hisob bor — ECO (telefon+parol, 3 rol) va Insof ERP (login+parol, 10 bo'lim);
 * qaysi biri ekanini `kind` aytadi, rol esa qaysi guruhga tushishini.
 */
function Gate() {
  const { status, kind, active, user, erp } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const segs = segments as unknown as string[];
    const group = segs[0];
    if (status === 'anon') { if (group !== '(auth)') router.replace('/(auth)/welcome'); return; }
    // Kirgan holda ham ochiladigan auth ekranlari: xavfsizlik sozlamalari va yakun
    const security = group === '(auth)' && ['pin', 'change-password', 'done'].includes(segs[1] ?? '');
    if (security) return;

    if (kind === 'erp') {
      if (!erp) { router.replace('/(auth)/login'); return; }
      const target = erpRoleConfig(erp.role).group;
      // `erp/<kartochka>` — barcha bo'limlar uchun umumiy ekran, guruhdan tashqarida
      if (group !== target && group !== 'erp') router.replace(`/${target}` as never);
      return;
    }

    if (!active) { if (group !== '(auth)' || segs[1] !== 'select-role') router.replace('/(auth)/select-role'); return; }
    const target = ROLE_GROUP[active.role];
    const shared = ['delivery', 'order', 'project', 'work-order', 'shipment', 'chat', 'worker'].includes(group ?? '');
    if (group !== target && !shared) router.replace(`/${target}` as never);
  }, [status, kind, active, erp, segments, router]);

  useEffect(() => {
    if (status !== 'authed') return;
    if (kind === 'erp') {
      // Xodim o'chirilgan yoki roli o'zgargan bo'lsa — darhol bilinadi (401 → signOut)
      void erpAuth.me().then((u) => useSession.getState().setErpUser(u)).catch(() => {});
      return;
    }
    void outbox.flush();
    void authApi.me().then((u) => useSession.getState().setUser(u)).catch(() => {});
    void registerPush();
    void user;
  }, [status, kind, user?.id, erp?.id]);

  return null;
}

async function registerPush() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    const granted = status === 'granted' || (await Notifications.requestPermissionsAsync()).status === 'granted';
    if (!granted) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Umumiy', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250], lightColor: '#0E8A4F' });
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await authApi.registerPush(token);
  } catch { /* push ixtiyoriy */ }
}

function Nav() {
  const { c, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bgCanvas },
          headerTintColor: c.textPrimary,
          headerShadowVisible: false,
          headerBackTitle: 'Orqaga',
          contentStyle: { backgroundColor: c.bgCanvas },
          // iOS: large title HIG; Android: Material — markazsiz, oddiy
          headerLargeTitle: Platform.OS === 'ios',
          headerTitleAlign: Platform.OS === 'android' ? 'left' : 'center',
        }}
      >
        {/* Sessiya yuklanguncha ko'rinadigan ekran. E'lon qilinmasa standart sarlavha bilan
            chiziladi va Gate uni darhol `replace` qilganda react-native-screens yangi
            arxitekturada yiqiladi: "ScreenStackFragment added into a non-stack container". */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tadbirkor)" options={{ headerShown: false }} />
        <Stack.Screen name="(quruvchi)" options={{ headerShown: false }} />
        <Stack.Screen name="(haydovchi)" options={{ headerShown: false }} />
        {/* Insof ERP — har bir bo'lim o'z guruhida */}
        {ERP_GROUPS.map((g) => <Stack.Screen key={g} name={g} options={{ headerShown: false }} />)}
        <Stack.Screen name="erp/[key]/[id]" options={{ title: 'Kartochka', headerLargeTitle: false }} />
        <Stack.Screen name="erp/new/[key]" options={{ title: 'Yangi', headerLargeTitle: false, presentation: 'modal' }} />
        <Stack.Screen name="erp/list/[key]" options={{ title: "Ro'yxat", headerLargeTitle: false }} />
        <Stack.Screen name="delivery/[id]" options={{ title: 'Reys' }} />
        <Stack.Screen name="order/[id]" options={{ title: 'Buyurtma' }} />
        <Stack.Screen name="project/[id]" options={{ title: 'Loyiha', headerLargeTitle: false }} />
        <Stack.Screen name="work-order/[id]" options={{ title: 'Ish buyurtmasi', headerLargeTitle: false }} />
        <Stack.Screen name="shipment/[id]" options={{ title: 'Yuk', headerLargeTitle: false }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Suhbat', headerLargeTitle: false }} />
        <Stack.Screen name="worker/[id]" options={{ title: 'Quruvchi', headerLargeTitle: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const hydrate = useSession((s) => s.hydrate);
  // Maket shriftlari — yuklangunicha tizim shrifti chiziladi, ekran bloklanmaydi
  useFonts(ERP_FONTS);
  useEffect(() => { void hydrate(); }, [hydrate]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 3600_000 }}>
        <ThemeProvider>
          <Gate />
          <Nav />
          {/* PIN qulfi — hisob ustida; ochilish ekrani esa hammasining ustida */}
          <PinLock />
          <LaunchOverlay />
        </ThemeProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
