import { Injectable, Logger } from '@nestjs/common';

export interface PushMessage {
  to: string[]; // Expo push tokenlar
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Expo Push API — iOS (APNs) va Android (FCM) ga bitta endpoint. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async send(msg: PushMessage): Promise<void> {
    if (msg.to.length === 0) return;
    const messages = msg.to.map((to) => ({ to, title: msg.title, body: msg.body, data: msg.data, sound: 'default', priority: 'high' }));
    try {
      const r = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(messages),
      });
      if (!r.ok) this.logger.warn(`Expo push ${r.status}`);
    } catch (e) {
      this.logger.error(e);
    }
  }
}
