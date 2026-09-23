import Constants from 'expo-constants';

/**
 * Backend manzillari.
 *
 * `EXPO_PUBLIC_*` o'zgaruvchilari Expo tomonidan to'plam (bundle) ichiga to'g'ridan-to'g'ri
 * yoziladi — shuning uchun birinchi navbatda shular o'qiladi. `expoConfig.extra` dev-client'da
 * har doim ham kelavermaydi (o'rnatilgan app.json'dan o'qilishi mumkin), shuning uchun u
 * faqat zaxira. Oxirgi zaxira — localhost: simulyator/emulyatorda ishlaydi, haqiqiy telefonda yo'q.
 */
const extra = Constants.expoConfig?.extra as { apiUrl?: string; erpUrl?: string } | undefined;

const clean = (v?: string | null) => (v && v.trim() ? v.trim().replace(/\/+$/, '') : undefined);

const apiUrl = clean(process.env.EXPO_PUBLIC_API_URL) ?? clean(extra?.apiUrl) ?? 'http://localhost:3010';
const erpUrl = clean(process.env.EXPO_PUBLIC_ERP_URL) ?? clean(extra?.erpUrl) ?? 'http://localhost:3000';

export const config = {
  /** Insof ECO backend — tadbirkor / quruvchi / haydovchi. */
  apiUrl,
  wsUrl: apiUrl.replace(/^http/, 'ws'),
  /** Insof ERP backend — zavod xodimlari (login + parol). */
  erpUrl,
};
