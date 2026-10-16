import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Backend manzillari.
 *
 * `EXPO_PUBLIC_*` o'zgaruvchilari Expo tomonidan to'plam (bundle) ichiga to'g'ridan-to'g'ri
 * yoziladi — shuning uchun birinchi navbatda shular o'qiladi. `expoConfig.extra` dev-client'da
 * har doim ham kelavermaydi (o'rnatilgan app.json'dan o'qilishi mumkin), shuning uchun u
 * faqat zaxira. Oxirgi zaxira — localhost: simulyator/emulyatorda ishlaydi, haqiqiy telefonda yo'q.
 */
const extra = Constants.expoConfig?.extra as { apiUrl?: string; erpUrl?: string; yandexMapKitKey?: string } | undefined;

const clean = (v?: string | null) => (v && v.trim() ? v.trim().replace(/\/+$/, '') : undefined);

const apiUrl = clean(process.env.EXPO_PUBLIC_API_URL) ?? clean(extra?.apiUrl) ?? 'http://localhost:3010';
const erpUrl = clean(process.env.EXPO_PUBLIC_ERP_URL) ?? clean(extra?.erpUrl) ?? 'http://localhost:3000';

/**
 * Production to'plam (NODE_ENV=production: do'kon build'i, OTA, release APK) lokal yoki LAN manzil bilan ochilmasin —
 * u serverga umuman ulanmaydi va foydalanuvchi buni "ilova ishlamayapti" deb biladi. Shuning uchun ochilishdayoq
 * aniq xato (yig'ish paytidagi tekshiruv — app.config.ts). Dev (simulyator, dev-client) o'zgarishsiz.
 * `APP_ENV` ish vaqtida faqat `EXPO_PUBLIC_` prefiksi bilan to'plamga tushadi.
 */
const LOCAL_URL = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(?=[:/]|$)/i;
if (process.env.NODE_ENV === 'production' || process.env.EXPO_PUBLIC_APP_ENV === 'production') {
  for (const [name, v] of [['EXPO_PUBLIC_API_URL', apiUrl], ['EXPO_PUBLIC_ERP_URL', erpUrl]] as const) {
    if (LOCAL_URL.test(v)) throw new Error(`[config] ${name}="${v}" — production to'plam uchun yaroqsiz (localhost / LAN IP). To'plam noto'g'ri muhit bilan yig'ilgan.`);
  }
}
/**
 * Majburiy yangilanish ekrani uchun zaxira havolalar (server 426 javobida havola bermasa).
 * Android — Play Market sahifasi (paket nomi `app.config.ts` bilan bir xil). iOS — App Store havolasi
 * `EXPO_PUBLIC_IOS_STORE_URL` bilan beriladi; bo'lmasa — yordam sayti.
 */
const storeUrl = Platform.OS === 'android'
  ? clean(process.env.EXPO_PUBLIC_ANDROID_STORE_URL) ?? 'https://play.google.com/store/apps/details?id=uz.insofeco.app'
  : clean(process.env.EXPO_PUBLIC_IOS_STORE_URL) ?? 'https://insof-erp.uz';
/** Qo'llab-quvvatlash Telegram'i (`https://t.me/...`) — ixtiyoriy, bo'lmasa tugma ko'rinmaydi. */
const supportTelegram = clean(process.env.EXPO_PUBLIC_SUPPORT_TELEGRAM) ?? null;
const yandexMapKitKey = clean(process.env.EXPO_PUBLIC_YANDEX_MAPKIT_KEY) ?? clean(extra?.yandexMapKitKey) ?? '';

export const config = {
  /** Insof ECO backend — tadbirkor / quruvchi / haydovchi. */
  apiUrl,
  wsUrl: apiUrl.replace(/^http/, 'ws'),
  /** Insof ERP backend — zavod xodimlari (login + parol). */
  erpUrl,
  /** Yandex MapKit kaliti — `core/map.tsx` uni birinchi xaritadan oldin bir marta beradi. */
  yandexMapKitKey,
  /**
   * Xaritani chizsa bo'ladimi.
   *
   * Ikkala platformada ham Yandex MapKit: kalitsiz u xaritani chizmaydi (bo'sh fon va
   * xato logi), shuning uchun kalit yo'q build'da xarita joyini ro'yxat/raqamlar egallaydi.
   */
  mapsEnabled: !!yandexMapKitKey,
  /** Ilovani yangilash havolasi (do'kon / APK) — 426 javobida havola bo'lmasa. */
  storeUrl,
  /** Qo'llab-quvvatlash Telegram havolasi yoki `null`. */
  supportTelegram,
};
