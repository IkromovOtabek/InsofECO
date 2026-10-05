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
