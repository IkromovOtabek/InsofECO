import { Linking, Platform } from 'react-native';

/**
 * Navigatsiya ilovasini ochish — obyektgacha yo'l ko'rsatilsin.
 *
 * Ro'yxat tartibda sinaladi: Yandex Navigator (O'zbekistonda eng aniq yo'l), keyin
 * Google Maps, keyin tizim xaritasi, oxirida brauzerdagi Yandex Xarita — ya'ni
 * telefonda hech qanday navigator bo'lmasa ham manzil ochiladi.
 *
 * `canOpenURL` ataylab ishlatilmadi: Android 11+ da u faqat manifestdagi `queries`
 * da e'lon qilingan sxemalarni ko'radi va o'rnatilgan ilovani ham "yo'q" deb qaytaradi.
 * `openURL` esa oshkor (implicit) intent yuboradi — bunday cheklov yo'q.
 */
export async function openNavigation(lat: number, lng: number, label?: string): Promise<boolean> {
  const name = encodeURIComponent(label ?? '');
  const urls = [
    `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`,
    Platform.OS === 'ios' ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving` : `google.navigation:q=${lat},${lng}`,
    Platform.OS === 'ios' ? `maps://?daddr=${lat},${lng}` : `geo:${lat},${lng}?q=${lat},${lng}(${name})`,
    `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`,
  ];
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      /* bu ilova yo'q — keyingisini sinaymiz */
    }
  }
  return false;
}
