import { Injectable, Logger } from '@nestjs/common';

export interface PushMessage {
  to: string[]; // Expo push tokenlar
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Android kanali: "muhim" — ekran ustida va ovoz bilan, "oddiy" — yumshoqroq. */
  channel?: 'muhim' | 'oddiy';
}

/**
 * Bildirishnoma ovozi — ilova to'plamidagi fayl (`apps/mobile/assets/bildirishnoma.wav`).
 *
 * Tizim ovozi emas: xodim telefonda ko'p xabar oladi va Insof xabari tanish ovoz bilan
 * kelishi kerak (Telegram'da bo'lgani kabi). iOS ovozni shu nom bo'yicha topadi,
 * Android esa kanalga bog'langan ovozni chaladi — shuning uchun `channelId` ham yuboriladi.
 *
 * Ilova eski versiyada bo'lsa bu kanal mavjud bo'lmaydi va tizim standart ovozni chaladi —
 * ya'ni xabar baribir yetib boradi.
 */
export const PUSH_SOUND = 'bildirishnoma.wav';

/** Expo Push API cheklovi: bitta so'rovda 100 tagacha xabar. */
const EXPO_CHUNK = 100;

/** Expo Push API — iOS (APNs) va Android (FCM) ga bitta endpoint. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async send(msg: PushMessage): Promise<void> {
    if (msg.to.length === 0) return;
    const messages = msg.to.map((to) => ({
      to, title: msg.title, body: msg.body, data: msg.data,
      sound: PUSH_SOUND, channelId: msg.channel ?? 'muhim', priority: 'high',
      // Telefon uzoq o'chiq tursa eski xabar ma'nosini yo'qotadi
      ttl: 86400,
    }));
    // Expo bitta so'rovda ko'pi bilan 100 ta xabar qabul qiladi — ortig'i butun so'rovni rad ettirardi
    for (let i = 0; i < messages.length; i += EXPO_CHUNK) {
      try {
        const r = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
          },
          body: JSON.stringify(messages.slice(i, i + EXPO_CHUNK)),
          // Expo javob bermasa so'rov (va uni kutgan HTTP/navbat ishi) osilib qolmasin
          signal: AbortSignal.timeout(15_000),
        });
        if (!r.ok) this.logger.warn(`Expo push ${r.status}`);
      } catch (e) {
        this.logger.error(e);
      }
    }
  }
}
