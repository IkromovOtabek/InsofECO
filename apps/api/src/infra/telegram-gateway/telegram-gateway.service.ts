import { Injectable, Logger } from '@nestjs/common';

/**
 * Dev/test rejimi: Gateway sozlanmagan va prod emas — hech narsa yuborilmaydi, kod doimiy
 * (OTP `000000`, qabul kodi `0000`). Prodda (NODE_ENV=production) hech qachon.
 */
export const devCodeAllowed = (gatewayEnabled: boolean) => !gatewayEnabled && process.env.NODE_ENV !== 'production';

/** Raqam qisman yashiriladi — jurnalda to'liq telefon va kodning o'zi yozilmaydi. */
export const maskPhone = (phone: string) => `${phone.slice(0, 7)}***`;

/**
 * Telegram Gateway — tasdiqlash kodini foydalanuvchining Telegram'iga "Verification Codes"
 * rasmiy chati orqali yuboradi (bot ham, kontakt ham kerak emas — faqat telefon raqam).
 * Bu bir martalik kodlarning YAGONA kanali (SMS yo'q — Insof ERP bilan bir xil). Raqamda Telegram
 * bo'lmasa xato tashlaydi; OTP chaqiruvchisi sababni jurnalga yozadi va neytral javob qaytaradi.
 *
 * Sozlash: TELEGRAM_GATEWAY_TOKEN — https://gateway.telegram.org kabinetidagi API token.
 * Ixtiyoriy: TELEGRAM_GATEWAY_SENDER — kod tasdiqlangan kanal nomidan yuborilsin (username, @siz).
 *
 * Kodni o'zimiz yaratamiz va `code` parametri bilan beramiz — tekshiruv OtpService'da bitta
 * joyda qoladi, Gateway'ning `checkVerificationStatus` iga bog'lanmaymiz.
 */
@Injectable()
export class TelegramGatewayService {
  private readonly logger = new Logger(TelegramGatewayService.name);

  private get token() {
    return process.env.TELEGRAM_GATEWAY_TOKEN?.trim() ?? '';
  }

  get enabled() {
    return !!this.token;
  }

  /** Xatoni YUTMAYDI — tashlaydi: chaqiruvchi sababni jurnalga yozishi yoki "yuborilmadi" deyishi uchun. */
  async sendCode(phone: string, code: string, ttlSeconds: number): Promise<void> {
    const sender = process.env.TELEGRAM_GATEWAY_SENDER?.trim().replace(/^@/, '');
    const r = await fetch('https://gatewayapi.telegram.org/sendVerificationMessage', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        phone_number: phone,
        code,
        // Gateway 30..3600 oralig'ini qabul qiladi
        ttl: Math.min(3600, Math.max(30, ttlSeconds)),
        ...(sender ? { sender_username: sender } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await r.text().catch(() => '');
    let j: { ok?: boolean; error?: string; result?: { delivery_status?: { status?: string } } } = {};
    try { j = JSON.parse(body); } catch { /* pastda umumiy xato */ }
    if (!r.ok || !j.ok) {
      const reason = j.error ?? `HTTP ${r.status}: ${body.slice(0, 200)}`;
      this.logger.warn(`Gateway rad etdi (${maskPhone(phone)}): ${reason}`);
      throw new Error(`Telegram Gateway: ${reason}`);
    }
  }
}
