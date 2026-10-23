import * as Sentry from '@sentry/node';

/**
 * Sentry — prod xatolarini (500, ishlov berilmagan istisno) kuzatish. `SENTRY_DSN` bo'sh bo'lsa butunlay o'chiq.
 * Boshqa importlardan OLDIN yuklanadi (main.ts birinchi qatori) — http/express avto-instrumentatsiyasi shuni talab qiladi.
 * Shaxsiy ma'lumot yuborilmaydi: sendDefaultPii=false, so'rov tanasi va sarlavhalari (token, parol, telefon) olib tashlanadi.
 */
const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.GIT_COMMIT ? `insof-eco-api@${process.env.GIT_COMMIT.slice(0, 12)}` : undefined,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.query_string;
      }
      return event;
    },
  });
}

export const sentryEnabled = !!dsn;
