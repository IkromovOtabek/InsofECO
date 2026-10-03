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
};
