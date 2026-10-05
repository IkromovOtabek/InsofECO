import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomInt } from 'crypto';
import { DEFAULT_RULES } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { TelegramGatewayService, devCodeAllowed, maskPhone } from '../../infra/telegram-gateway/telegram-gateway.service';
import { DomainError } from '../../common/errors/domain.error';

/**
 * Kod qayerga ketdi. Endi FAQAT Telegram — maydon eski ilovalar (1.0.x) uchun saqlangan:
 * ular `channel` ga qarab "Telegram'ga yubordik" deb yozadi.
 */
export type OtpChannel = 'telegram';

/** Telefon egaligi tasdig'i nima uchun berilgan — boshqa maqsadga ishlatilmaydi. */
export type PhoneTokenPurpose = 'register';

/** Tasdiq tokeni umri: kod kiritilgandan keyin ma'lumotlarni to'ldirishga 10 daqiqa. */
export const PHONE_TOKEN_TTL_SECONDS = 600;

/** Redis kaliti — tokenning o'zi emas, SHA-256 xeshi saqlanadi (Redis dampi tokenni oshkor qilmasin). */
const phoneTokenKey = (token: string) => `phonetok:${createHash('sha256').update(token).digest('hex')}`;

/** Dev/test rejimidagi (Gateway yo'q, prod emas) doimiy kod — seed/smoke skriptlari va lokal ishlab chiqish uchun. */
export const DEV_OTP_CODE = '000000';

/** Har doim bir xil javob: kod yetkazildimi-yo'qmi, raqam tizimda bormi-yo'qmi — tashqaridan bilinmaydi. */
const NEUTRAL = { retryAfter: 60, channel: 'telegram' as const };

/**
 * Bir martalik kirish kodi — FAQAT Telegram Gateway orqali (TELEGRAM_GATEWAY_TOKEN), raqamning
 * Telegram hisobiga "Verification Codes" chatiga. SMS kanali yo'q (Insof ERP bilan bir xil).
 *
 * Gateway sozlanmagan yoki yetkaza olmasa ham javob NEYTRAL (`{retryAfter, channel:'telegram'}`),
 * sabab faqat server jurnaliga yoziladi: aks holda xato javobi raqam haqida ma'lumot oshkor qilardi.
 * Kod kelmagan foydalanuvchi login+parol yoki "Telegram orqali kirish" (bot) yo'lidan foydalanadi.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly telegram: TelegramGatewayService,
  ) {}

  /** Raqam bor-yo'qligi oshkor bo'lmasligi uchun — mavjud bo'lmagan raqamga ham neytral javob. */
  get neutralResponse(): { retryAfter: number; channel: OtpChannel } {
    return { ...NEUTRAL };
  }

  /**
   * Soatlik chek (raqam + IP). Raqam tizimda bor-yo'qligidan QAT'I NAZAR bir xil qo'llanadi —
   * aks holda "juda ko'p urinish" faqat mavjud raqamda chiqib, uni oshkor qilardi.
   */
  async assertRate(phone: string, ip: string): Promise<void> {
    const okPhone = await this.redis.allow(`otp:p:${phone}`, DEFAULT_RULES.otpPerPhonePerHour, 3600);
    const okIp = await this.redis.allow(`otp:ip:${ip}`, 10, 3600);
    if (!okPhone || !okIp) throw new DomainError('AUTH_OTP_RATE_LIMIT', 'Juda ko\'p urinish. Keyinroq urinib ko\'ring');
  }

  async request(phone: string, ip: string): Promise<{ retryAfter: number; channel: OtpChannel }> {
    await this.assertRate(phone, ip);
    return this.issue(phone);
  }

  /** Kod yaratib Telegram'ga yuboradi. Chekni (`assertRate`) chaqiruvchi tekshirgan bo'lishi shart. */
  requestWithoutRate(phone: string) {
    return this.issue(phone);
  }

  private async issue(phone: string): Promise<{ retryAfter: number; channel: OtpChannel }> {
    const dev = devCodeAllowed(this.telegram.enabled);
    // Prodda Gateway yo'q — hech bir kanal yetkaza olmaydi: kod yaratilmaydi, javob neytral
    if (!this.telegram.enabled && !dev) {
      this.logger.warn(`OTP yetkazilmadi ${maskPhone(phone)}: TELEGRAM_GATEWAY_TOKEN sozlanmagan`);
      return this.neutralResponse;
    }

    const code = dev ? DEV_OTP_CODE : String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpCode.create({
      data: { phone, codeHash: await argon2.hash(code), expiresAt: new Date(Date.now() + DEFAULT_RULES.otpTtlSeconds * 1000) },
    });
    if (dev) return this.neutralResponse; // dev/test: hech narsa yuborilmaydi, kod — DEV_OTP_CODE

    try {
      await this.telegram.sendCode(phone, code, DEFAULT_RULES.otpTtlSeconds);
    } catch (e) {
      // Raqamda Telegram yo'q / Gateway rad etdi — sabab faqat jurnalda, javob baribir neytral
      this.logger.warn(`OTP yetkazilmadi ${maskPhone(phone)}: ${e instanceof Error ? e.message : String(e)}`);
    }
    return this.neutralResponse;
  }

  async verify(phone: string, code: string): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new DomainError('AUTH_OTP_INVALID', 'Kod noto\'g\'ri');
    if (otp.expiresAt < new Date()) throw new DomainError('AUTH_OTP_EXPIRED', 'Kod muddati tugagan');
    if (otp.attempts >= 5) throw new DomainError('AUTH_OTP_INVALID', 'Urinishlar tugadi, yangi kod so\'rang');
    const ok = await argon2.verify(otp.codeHash, code);
    if (!ok) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new DomainError('AUTH_OTP_INVALID', 'Kod noto\'g\'ri');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  }

  /**
   * Kod tasdiqlangandan keyin beriladigan qisqa muddatli token: telefon raqamiga va maqsadga bog'langan,
   * bir martalik (`consumePhoneToken` uni o'chiradi). 256 bit tasodifiy — taxmin qilib bo'lmaydi.
   */
  async issuePhoneToken(phone: string, purpose: PhoneTokenPurpose): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.redis.client.set(phoneTokenKey(token), JSON.stringify({ phone, purpose }), 'EX', PHONE_TOKEN_TTL_SECONDS);
    return token;
  }

  /** Tokenni o'chirmasdan tekshirish (ro'yxatdan o'tishdagi oldindan tekshiruvlar uchun). */
  async checkPhoneToken(token: string, phone: string, purpose: PhoneTokenPurpose): Promise<boolean> {
    return matches(await this.redis.client.get(phoneTokenKey(token)), phone, purpose);
  }

  /**
   * Tokenni atomar olish va o'chirish (GET+DEL bitta MULTI'da) — ikki parallel so'rovdan faqat
   * bittasi uni ishlata oladi. Raqam yoki maqsad mos kelmasa ham token yo'q qilinadi.
   */
  async consumePhoneToken(token: string, phone: string, purpose: PhoneTokenPurpose): Promise<boolean> {
    const key = phoneTokenKey(token);
    const res = await this.redis.client.multi().get(key).del(key).exec();
    const raw = res?.[0]?.[1];
    return matches(typeof raw === 'string' ? raw : null, phone, purpose);
  }
}

function matches(raw: string | null, phone: string, purpose: PhoneTokenPurpose): boolean {
  if (!raw) return false;
  try {
    const v = JSON.parse(raw) as { phone?: unknown; purpose?: unknown };
    return v.phone === phone && v.purpose === purpose;
  } catch {
    return false;
  }
}
