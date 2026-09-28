import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PhoneSchema } from '@insof/shared';
import { RedisService } from '../../infra/redis/redis.service';
import { DomainError } from '../../common/errors/domain.error';

/**
 * Telegram orqali kirish — zavodning MAVJUD boti (Insof ERP boti) orqali. Bot update'larini
 * ERP oladi (webhook); ECO faqat holatni saqlaydi va ERP'dan `/v1/erp/telegram-login/*`
 * (X-Api-Key) orqali xabar oladi. Bitta tokenni ikki server tinglay olmagani uchun shunday.
 *
 * Oqim:
 *   1. Ilova `start` → tasodifiy `nonce` + `t.me/<bot>?start=eco_<nonce>` havolasi (5 daqiqa).
 *   2. Botda Start → ERP `bind(nonce, chatId)` → bot "Raqamni ulashish" tugmasini ko'rsatadi.
 *   3. Kontakt kelsa (ERP yuboruvchining O'Z raqami ekanini tekshiradi) → ERP `contact(chatId, phone)`
 *      → nonce "tasdiqlandi" + telefon.
 *   4. Ilova `poll` qiladi; tasdiqlangan nonce BIR MARTA sessiyaga almashtiriladi va o'chiriladi.
 *
 * Telefon Telegram tomonidan tasdiqlangan — SMS-kod bilan bir xil ishonch darajasi, shuning uchun
 * keyingi qadam (foydalanuvchi yaratish/topish) OTP bilan kirish bilan aynan bir xil.
 */

const TTL = 300; // soniya
/** `/start` parametri shu prefiks bilan — ERP boti oddiy /start dan ajratadi. */
export const TG_START_PREFIX = 'eco_';
const key = (nonce: string) => `tglogin:${nonce}`;
const chatKey = (chatId: string) => `tglogin:chat:${chatId}`;

type Pending = { status: 'pending' } | { status: 'confirmed'; phone: string; name?: string };

@Injectable()
export class TelegramLoginService {
  constructor(private readonly redis: RedisService) {}

  private get botUsername() {
    return (process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, '');
  }

  // ───────────────────────── Ilova tomoni ─────────────────────────

  async start() {
    if (!this.botUsername) throw new DomainError('AUTH_OTP_SEND_FAILED', 'Telegram orqali kirish hozircha sozlanmagan');
    // Telegram start parametri: faqat [A-Za-z0-9_-], 64 belgigacha
    const nonce = randomBytes(24).toString('base64url');
    await this.redis.client.set(key(nonce), JSON.stringify({ status: 'pending' } satisfies Pending), 'EX', TTL);
    return { nonce, url: `https://t.me/${this.botUsername}?start=${TG_START_PREFIX}${nonce}`, expiresIn: TTL };
  }

  /** `null` — hali kutilmoqda. Tasdiqlangan bo'lsa telefonni qaytaradi va nonce'ni o'chiradi (bir martalik). */
  async take(nonce: string): Promise<{ phone: string; name?: string } | null> {
    const raw = await this.redis.client.get(key(nonce));
    if (!raw) throw new DomainError('AUTH_OTP_EXPIRED', 'Kirish muddati tugadi. Qaytadan urinib ko\'ring');
    const state = JSON.parse(raw) as Pending;
    if (state.status !== 'confirmed') return null;
    // Ikki parallel so'rov bitta nonce'dan ikki sessiya olmasin
    if ((await this.redis.client.del(key(nonce))) !== 1) return null;
    return { phone: state.phone, name: state.name };
  }

  // ───────────────────────── Bot (ERP) tomoni ─────────────────────────

  /** Botda Start bosildi. `false` — nonce yo'q yoki muddati o'tgan. */
  async bind(nonce: string, chatId: string): Promise<{ ok: boolean }> {
    if (!(await this.redis.client.exists(key(nonce)))) return { ok: false };
    await this.redis.client.set(chatKey(chatId), nonce, 'EX', TTL);
    return { ok: true };
  }

  /**
   * Botga kontakt keldi. `matched: false` — bu chat ilovadan kirish jarayonida emas
   * (ERP o'zining xodim ulash oqimini davom ettiradi). O'z raqami ekanini ERP tekshiradi.
   */
  async contact(chatId: string, rawPhone: string, name?: string): Promise<{ matched: boolean; ok?: boolean; reason?: 'expired' | 'phone' }> {
    const nonce = await this.redis.client.get(chatKey(chatId));
    if (!nonce) return { matched: false };
    if (!(await this.redis.client.exists(key(nonce)))) {
      await this.redis.client.del(chatKey(chatId));
      return { matched: true, ok: false, reason: 'expired' };
    }
    const phone = PhoneSchema.safeParse(`+${rawPhone.replace(/\D/g, '')}`);
    if (!phone.success) return { matched: true, ok: false, reason: 'phone' };
    await this.redis.client.set(key(nonce), JSON.stringify({ status: 'confirmed', phone: phone.data, name } satisfies Pending), 'EX', TTL);
    await this.redis.client.del(chatKey(chatId));
    return { matched: true, ok: true };
  }
}
