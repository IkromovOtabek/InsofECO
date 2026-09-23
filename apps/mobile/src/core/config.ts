import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Backend manzillari.
 *
 * `EXPO_PUBLIC_*` o'zgaruvchilari Expo tomonidan to'plam (bundle) ichiga to'g'ridan-to'g'ri
 * yoziladi — shuning uchun birinchi navbatda shular o'qiladi. `expoConfig.extra` dev-client'da
 * har doim ham kelavermaydi (o'rnatilgan app.json'dan o'qilishi mumkin), shuning uchun u
 * faqat zaxira. Oxirgi zaxira — localhost: simulyator/emulyatorda ishlaydi, haqiqiy telefonda yo'q.
 */
const extra = Constants.expoConfig?.extra as { apiUrl?: string; erpUrl?: string; hasMaps?: boolean } | undefined;

const clean = (v?: string | null) => (v && v.trim() ? v.trim().replace(/\/+$/, '') : undefined);

const apiUrl = clean(process.env.EXPO_PUBLIC_API_URL) ?? clean(extra?.apiUrl) ?? 'http://localhost:3010';
const erpUrl = clean(process.env.EXPO_PUBLIC_ERP_URL) ?? clean(extra?.erpUrl) ?? 'http://localhost:3000';

export const config = {
  /** Insof ECO backend — tadbirkor / quruvchi / haydovchi. */
  apiUrl,
  wsUrl: apiUrl.replace(/^http/, 'ws'),
  /** Insof ERP backend — zavod xodimlari (login + parol). */
  erpUrl,
  /**
   * Xaritani chizsa bo'ladimi.
   *
   * Android'da react-native-maps Google Maps'ga tayanadi: kalit bo'lmasa komponent
   * mount bo'lishi bilan ilova butunlay yiqiladi ("API key not found"). iOS'da esa
   * Apple Maps ishlaydi va kalit kerak emas.
   *
   * Kalit `GOOGLE_MAPS_ANDROID_KEY` bilan build vaqtida beriladi.
   */
  mapsEnabled: Platform.OS !== 'android' || extra?.hasMaps === true,
};
