import { Linking } from 'react-native';
import { dialog } from '@/design/ui';
import { distanceLabel } from '@/core/geo';
import { POOR_ACCURACY_M, SITE_RADIUS_M, checkAtSite, type Fix, type SiteCheck } from '@/core/location';

/**
 * "Yetib keldim" / "Yetkazdim" oldidan joy tekshiruvi — oynasi bilan.
 *
 * Obyekt yonida bo'lmasa haydovchi aniq raqamni ko'radi ("Obyektgacha 2.4 km") va
 * "Qayta tekshirish" tugmasini oladi: mashina darvoza oldida turgan, GPS esa hali
 * yangilanmagan bo'lishi mumkin. Ruxsat yopiq bo'lsa — Sozlamalarga to'g'ridan-to'g'ri yo'l.
 *
 * Server ham xuddi shu radius bilan tekshiradi; bu yerdagi tekshiruv — haydovchiga darhol
 * va tushunarli javob berish uchun (internet sekin bo'lsa ham).
 *
 * @returns obyekt yonidagi aniq nuqta; `null` — to'xtatildi (hech narsa yuborilmaydi);
 *          `undefined` — obyekt nuqtasi noma'lum va GPS ham yo'q: tekshirib bo'lmaydi, server qaror qiladi.
 */
export async function confirmAtSite(dest: { lat: number; lng: number } | null, action: string): Promise<Fix | null | undefined> {
  // Zayavkada obyekt nuqtasi yo'q — tekshirib bo'lmaydi. Haydovchini to'xtatmaymiz (xato zayavkada),
  // nuqta olinsa — iz uchun yuboriladi.
  if (!dest) {
    const r = await checkAtSite({ lat: 0, lng: 0 }, Number.POSITIVE_INFINITY);
    return r.ok ? r.fix : undefined;
  }
  for (;;) {
    const r = await checkAtSite(dest);
    if (r.ok) return r.fix;
    const retry = await explain(r, action);
    if (!retry) return null;
  }
}

/** Sababni aytadi; `true` — haydovchi "Qayta tekshirish"ni bosdi. */
function explain(r: Exclude<SiteCheck, { ok: true }>, action: string): Promise<boolean> {
  return new Promise((resolve) => {
    const again = { text: 'Qayta tekshirish', onPress: () => resolve(true) };
    const close = { text: 'Yopish', style: 'cancel' as const, onPress: () => resolve(false) };
    switch (r.reason) {
      case 'far': {
        const acc = r.fix.accuracyM;
        const weak = acc != null && acc > POOR_ACCURACY_M
          ? `\n\nGPS aniqligi past (±${Math.round(acc)} m) — ochiq joyga chiqib qayta tekshiring.` : '';
        dialog(
          'Siz hali obyektda emassiz',
          `Obyektgacha ${distanceLabel(r.distanceM)}. «${action}» faqat obyektdan ${SITE_RADIUS_M} m ichida belgilanadi.${weak}`,
          [again, close], { tone: 'warning', icon: 'map-pin' },
        );
        return;
      }
      case 'services-off':
        dialog('GPS o\'chiq', `«${action}» uchun telefon joylashuvini (GPS) yoqing.`, [again, close], { tone: 'warning', icon: 'locate' });
        return;
      case 'blocked':
        dialog('Joylashuvga ruxsat yo\'q', `Ilova joylashuvni so'ray olmaydi — Sozlamalar → Joylashuv → «Ilova ishlatilganda» ni yoqing. Busiz «${action}» belgilanmaydi.`, [
          { text: 'Sozlamalarni ochish', onPress: () => { void Linking.openSettings(); resolve(false); } },
          again, close,
        ], { tone: 'warning', icon: 'locate' });
        return;
      case 'denied':
        dialog('Joylashuvga ruxsat berilmadi', `«${action}» obyekt yonida turganingiz tekshirilgandan keyin belgilanadi. Ruxsat bering.`, [again, close], { tone: 'warning', icon: 'locate' });
        return;
      case 'mocked':
        dialog('Soxta joylashuv aniqlandi', 'Telefonda joylashuvni almashtiruvchi ilova yoqilgan. Uni o\'chirib, qayta tekshiring.', [again, close], { tone: 'danger', icon: 'triangle-alert' });
        return;
      default:
        dialog('Joylashuv aniqlanmadi', 'GPS javob bermadi. Ochiq joyga chiqib, bir necha soniyadan keyin qayta tekshiring.', [again, close], { tone: 'warning', icon: 'locate' });
    }
  });
}
