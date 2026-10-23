import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

/**
 * Sentry — ilova xatolari (JS istisno, native crash). `EXPO_PUBLIC_SENTRY_DSN` bo'sh bo'lsa butunlay o'chiq
 * (lokal dev, eski build'lar). Dev rejimda ham yuborilmaydi — faqat do'kon/OTA to'plami.
 * Shaxsiy ma'lumot yuborilmaydi: sendDefaultPii=false, HTTP so'rov tanasi/sarlavhalari olinmaydi.
 * OTA guruhi teg sifatida qo'shiladi — qaysi yangilanishda xato chiqqani ko'rinadi.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
export const sentryEnabled = !!dsn && !__DEV__;

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeBreadcrumb(b) {
      // Tarmoq so'rovlari URL'ida token/telefon bo'lishi mumkin — faqat yo'l qoladi
      if ((b.category === 'fetch' || b.category === 'xhr') && b.data?.url) b.data.url = String(b.data.url).split('?')[0];
      return b;
    },
  });
  Sentry.setTag('update_id', Updates.updateId ?? 'embedded');
  Sentry.setTag('channel', Updates.channel ?? 'none');
}

/** Ekran xato chegarasi kabi qo'lda ushlangan xatolar uchun. */
export function reportError(e: unknown) {
  if (sentryEnabled) Sentry.captureException(e);
}

export { Sentry };
