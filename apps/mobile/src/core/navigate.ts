import { Linking, Platform } from 'react-native';

/**
 * Obyektgacha yo'l ko'rsatish — qurilmada qaysi xarita ilovasi bo'lsa, o'sha.
 *
 * Android'da birinchi bo'lib `geo:` manzili yuboriladi. Bu standart Android manzili va
 * uni qabul qiladigan ilovalar ko'p bo'lsa, tizimning O'ZI "qaysi ilova bilan ochamiz?"
 * oynasini chiqaradi — Yandex Navigator, Yandex Xarita, Google Maps, 2GIS... qaysi biri
 * o'rnatilgan bo'lsa, ro'yxatda ko'rinadi. Biz haydovchi o'rniga tanlamaymiz.
 *
 * (Agar haydovchi ilgari "Har doim shu ilova" deb belgilagan bo'lsa, Android oynani
 * ko'rsatmay o'sha ilovani ochadi — bu foydalanuvchining o'z tanlovi, buzmaymiz.)
 *
 * iOS'da bunday umumiy manzil yo'q, shuning uchun tartib bilan sinaladi.
 * Oxirgi zaxira — brauzerdagi xarita: hech qanday navigator bo'lmasa ham manzil ochiladi.
 */
export async function openNavigation(lat: number, lng: number, label?: string): Promise<boolean> {
  const name = encodeURIComponent(label ?? '');
  const urls = Platform.OS === 'android'
    ? [
        `geo:${lat},${lng}?q=${lat},${lng}(${name})`,
        `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`,
      ]
    : [
        `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
        `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`,
        `maps://?daddr=${lat},${lng}`,
        `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`,
      ];

  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      /* bu manzilni ochadigan ilova yo'q — keyingisini sinaymiz */
    }
  }
  return false;
}
