import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { deviceId } from './api';
import { erpApi } from './erp';
import { authApi } from '@/features/auth/api';

/**
 * Bildirishnomalar — ikkala backend uchun bitta joy.
 *
 * Ilovada ikki xil hisob bor: ECO (telefon bilan — tadbirkor, quruvchi, pudratchi
 * haydovchi) va Insof ERP (login bilan — zavod xodimlari). Ikkalasi ham Expo push
 * tokenini ishlatadi, faqat token boshqa serverga yoziladi. Shuning uchun ruxsat,
 * kanallar va bosilganda ochish qoidasi shu faylda, hisob turi esa parametr.
 *
 * Ovoz: `assets/bildirishnoma.wav`. iOS uni nomi bo'yicha to'plamdan topadi, Android
 * esa kanalga bog'langan ovozni chaladi — shuning uchun ikkalasida ham bitta fayl.
 */

/** Serverdagi nom bilan bir xil bo'lishi shart (`lib/push.ts`). */
export const PUSH_SOUND = 'bildirishnoma.wav';

/**
 * Android kanallari.
 *
 * Nega eski 'default' emas: Android kanal yaratilgandan keyin uning ovozini va
 * muhimligini DASTUR o'zgartira olmaydi — faqat foydalanuvchi sozlamalardan.
 * Eski ilovada 'default' tizim ovozi bilan yaratilgan, shuning uchun yangi ovoz
 * yangi kanallarda beriladi.
 *
 * `muhim` — ekran ustida chiqadi va ovoz beradi (reys biriktirildi, limit oshdi).
 * `oddiy` — ro'yxatda turadi, ovozi yumshoqroq (to'lov qaydi, yetkazildi xabari).
 */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('muhim', {
    name: 'Muhim xabarlar',
    importance: Notifications.AndroidImportance.MAX,
    sound: PUSH_SOUND,
    vibrationPattern: [0, 200, 110, 200],
    lightColor: '#0A4CD5',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync('oddiy', {
    name: "Ma'lumot uchun",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: PUSH_SOUND,
    vibrationPattern: [0, 120],
    lightColor: '#0A4CD5',
    showBadge: true,
  });
}

/**
 * Ruxsat so'rash va Expo tokenini serverga yozish.
 *
 * `false` — ruxsat berilmagan yoki token olinmadi: ilova baribir ishlaydi, xabarlar
 * faqat ichkaridagi ro'yxatda ko'rinadi. Shuning uchun xato ko'tarilmaydi.
 */
export async function registerPush(kind: 'eco' | 'erp'): Promise<boolean> {
  try {
    await ensureChannels();
    const { status } = await Notifications.getPermissionsAsync();
    const granted = status === 'granted' || (await Notifications.requestPermissionsAsync()).status === 'granted';
    if (!granted) return false;

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    if (kind === 'erp') {
      await erpApi('/devices', { method: 'PUT', body: { deviceId: deviceId(), expoPushToken: token, platform: Platform.OS } });
    } else {
      await authApi.registerPush(token);
    }
    return true;
  } catch {
    // Tokensiz ham ilova to'liq ishlaydi — xabarlar ro'yxatdan o'qiladi
    return false;
  }
}

/**
 * Chiqishda: bu telefonga endi xabar yuborilmaydi.
 * Aks holda ishdan ketgan xodimning telefonida zavod xabarlari chiqib turardi.
 */
export async function unregisterPush(kind: 'eco' | 'erp'): Promise<void> {
  try {
    if (kind === 'erp') await erpApi('/devices', { method: 'DELETE', query: { deviceId: deviceId() } });
    await Notifications.setBadgeCountAsync(0);
  } catch {
    /* chiqishni to'xtatmaydi */
  }
}

/** Ilova ikonkasidagi raqam. O'qilmagan xabar qolmasa 0 — Telegram kabi. */
export const setBadge = (n: number) => Notifications.setBadgeCountAsync(Math.max(0, n)).catch(() => {});

/**
 * Xabar bosilganda qaysi ekran ochiladi.
 *
 * ERP xabarlarida `{key, id}` bo'ladi — ular umumiy kartochka ekraniga tushadi.
 * ECO xabarlarida `{screen, ...}` — har ekranning o'z manzili bor.
 * Mos ekran topilmasa `null`: ilova shunchaki ochiladi, xato chiqmaydi.
 */
export function routeOf(data: unknown): string | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

  // Insof ERP — hujjat kartochkasi
  const key = str(d.key), id = str(d.id);
  if (key && id) return `/erp/${key}/${id}`;

  // Insof ECO
  switch (str(d.screen)) {
    case 'delivery': return str(d.deliveryId) ? `/delivery/${str(d.deliveryId)}` : null;
    case 'order': return str(d.orderId) ? `/order/${str(d.orderId)}` : null;
    case 'shipment': return str(d.id) ? `/shipment/${str(d.id)}` : null;
    case 'work-order': return str(d.id) ? `/work-order/${str(d.id)}` : null;
    case 'project': return str(d.id) ? `/project/${str(d.id)}` : null;
    case 'chat': return str(d.id) ? `/chat/${str(d.id)}` : null;
    default: return null;
  }
}
