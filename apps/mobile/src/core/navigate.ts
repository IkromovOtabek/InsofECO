import { Linking, Platform } from 'react-native';
import { dialog, toast, type DialogButton } from '@/design/ui';

/**
 * Obyektgacha yo'l — haydovchi O'ZI tanlagan navigator ilovasida.
 *
 * Qanday ishlaydi: har bir ma'lum ilova uchun `Linking.canOpenURL` so'raladi va faqat
 * telefonda BOR ilovalar ro'yxatda chiqadi; oxirida doim brauzerdagi Yandex Xarita (zaxira).
 * Hech qanday ilova topilmasa, ro'yxat ko'rsatilmay to'g'ridan-to'g'ri brauzer ochiladi.
 *
 * MUHIM — native sozlama: Android 11+ va iOS boshqa ilovalarni "ko'rish"ga ruxsat bermaydi,
 * shuning uchun sxemalar ro'yxati ilova manifestiga yozilgan:
 *   iOS     — `ios.infoPlist.LSApplicationQueriesSchemes` (app.config.ts)
 *   Android — `<queries>` intentlari (plugins/withNavigatorQueries.js)
 * Yangi ilova qo'shsangiz — ikkalasiga ham sxemani qo'shing va yangi native build qiling.
 * Eski build'da (sxemalar yo'q) `canOpenURL` false qaytaradi — foydalanuvchi brauzer variantini ko'radi, yiqilmaydi.
 */

export interface NavTarget {
  lat: number;
  lng: number;
  /** Obyekt nomi yoki manzili — ro'yxat sarlavhasi ostida ko'rinadi. */
  label?: string;
}

interface NavApp {
  id: string;
  name: string;
  /** `canOpenURL` uchun — ilova o'rnatilganmi. */
  probe: string;
  url: (t: NavTarget) => string;
  only?: 'ios' | 'android';
}

const APPS: NavApp[] = [
  { id: 'yandexnavi', name: 'Yandex Navigator', probe: 'yandexnavi://', url: (t) => `yandexnavi://build_route_on_map?lat_to=${t.lat}&lon_to=${t.lng}` },
  { id: 'yandexmaps', name: 'Yandex Xaritalar', probe: 'yandexmaps://', url: (t) => `yandexmaps://maps.yandex.ru/?rtext=~${t.lat},${t.lng}&rtt=auto` },
  // 2GIS: avval uzunlik, keyin kenglik
  { id: '2gis', name: '2GIS', probe: 'dgis://', url: (t) => `dgis://2gis.ru/routeSearch/rsType/car/to/${t.lng},${t.lat}` },
  { id: 'google', name: 'Google Maps', only: 'ios', probe: 'comgooglemaps://', url: (t) => `comgooglemaps://?daddr=${t.lat},${t.lng}&directionsmode=driving` },
  { id: 'google', name: 'Google Maps', only: 'android', probe: 'google.navigation:q=0,0', url: (t) => `google.navigation:q=${t.lat},${t.lng}&mode=d` },
  { id: 'apple', name: 'Apple Xaritalar', only: 'ios', probe: 'maps://', url: (t) => `maps://?daddr=${t.lat},${t.lng}&dirflg=d` },
  { id: 'waze', name: 'Waze', probe: 'waze://', url: (t) => `waze://?ll=${t.lat},${t.lng}&navigate=yes` },
];

/** Brauzerdagi Yandex Xarita — hech qanday ilova bo'lmasa ham ishlaydi. */
export const webRouteUrl = (t: NavTarget) => `https://yandex.uz/maps/?rtext=~${t.lat},${t.lng}&rtt=auto`;

const validTarget = (t: NavTarget) =>
  Number.isFinite(t.lat) && Number.isFinite(t.lng) && Math.abs(t.lat) <= 90 && Math.abs(t.lng) <= 180 && !(t.lat === 0 && t.lng === 0);

async function canOpen(url: string) {
  try { return await Linking.canOpenURL(url); } catch { return false; }
}

async function open(url: string) {
  try { await Linking.openURL(url); return true; } catch { return false; }
}

const platformApps = () => APPS.filter((a) => !a.only || a.only === Platform.OS);

/** Telefonda o'rnatilgan navigatorlar (shu platformaga mosi). */
export async function installedNavigators(): Promise<{ id: string; name: string }[]> {
  const mine = platformApps();
  const ok = await Promise.all(mine.map((a) => canOpen(a.probe)));
  return mine.filter((_, i) => ok[i]).map(({ id, name }) => ({ id, name }));
}

type NavResult = 'opened' | 'cancelled' | 'failed';

async function choose(t: NavTarget): Promise<NavResult> {
  if (!validTarget(t)) {
    toast.warning('Obyekt nuqtasi belgilanmagan — dispetcherdan manzilni aniqlang', 'Navigator');
    return 'failed';
  }
  const mine = platformApps();
  const ok = await Promise.all(mine.map((a) => canOpen(a.probe)));
  const apps = mine.filter((_, i) => ok[i]);

  // Telefonda birorta navigator yo'q — ro'yxat ko'rsatishning ma'nosi yo'q, brauzerni ochamiz
  if (!apps.length) return (await open(webRouteUrl(t))) ? 'opened' : 'failed';

  return new Promise<NavResult>((resolve) => {
    const pick = async (url: string, fallback?: string) => {
      if (await open(url)) return resolve('opened');
      // Ilova o'chirilgan yoki havola qabul qilinmadi — brauzer bilan bo'lsa ham yo'l ochilsin
      if (fallback && (await open(fallback))) return resolve('opened');
      toast.error("Navigator ochilmadi. Boshqa ilovani tanlab ko'ring", 'Navigator');
      resolve('failed');
    };
    const buttons: DialogButton[] = [
      ...apps.map((a) => ({ text: a.name, onPress: () => void pick(a.url(t), webRouteUrl(t)) })),
      { text: 'Brauzerda (Yandex Xarita)', onPress: () => void pick(webRouteUrl(t)) },
      { text: 'Bekor', style: 'cancel' as const, onPress: () => resolve('cancelled') },
    ];
    dialog('Qaysi ilovada ochamiz?', t.label ? `Manzil: ${t.label}` : "Yo'l tanlangan ilovada quriladi", buttons, { icon: 'navigation', tone: 'brand' });
  });
}

/**
 * Navigatorni tanlash oynasi va tanlangan ilovada yo'l. Bu imzo boshqa bo'limlar (ERP
 * direktor, logistika) uchun ham — o'zgartirmang.
 * @returns `true` — biror ilova (yoki brauzer) ochildi.
 */
export async function openInNavigator(target: NavTarget): Promise<boolean> {
  return (await choose(target)) === 'opened';
}

/**
 * Eski imzo — ERP kartochkasi va boshqa joylar shu bilan chaqiradi.
 * Foydalanuvchi o'zi "Bekor" desa — bu xato emas, shuning uchun `true`
 * ("navigator topilmadi" degan ogohlantirish chiqmasin).
 */
export async function openNavigation(lat: number, lng: number, label?: string): Promise<boolean> {
  return (await choose({ lat, lng, label })) !== 'failed';
}
