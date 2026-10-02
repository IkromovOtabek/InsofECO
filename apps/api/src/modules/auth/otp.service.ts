import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { DEFAULT_RULES } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { SmsPort } from '../../infra/sms/sms.port';
import { TelegramGatewayService } from '../../infra/telegram-gateway/telegram-gateway.service';
import { DomainError } from '../../common/errors/domain.error';

/** Kod qayerga ketdi — ilova "Telegram'ga yubordik" yoki "SMS yubordik" deb yozadi. */
export type OtpChannel = 'telegram' | 'sms';

/**
 * Kirish kodi: avval Telegram Gateway (TELEGRAM_GATEWAY_TOKEN bo'lsa) — raqamda Telegram bo'lmasa
 * yoki Gateway rad etsa SMS'ga (Eskiz) tushadi. Ikkalasi ham ishlamasa — "yuborilmadi" xatosi.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sms: SmsPort,
    private readonly telegram: TelegramGatewayService,
  ) {}

  private get smsFake() {
    return (process.env.SMS_PROVIDER ?? 'FAKE') === 'FAKE';
  }

  /** Dev: hech qanday haqiqiy kanal yo'q — kod har doim 000000. */
  private get isFake() {
    return this.smsFake && !this.telegram.enabled;
  }

  /** Raqam tizimda yo'q bo'lsa ham shu qaytariladi (parolni tiklash) — javob farq qilmasin. */
  get defaultChannel(): OtpChannel {
    return this.telegram.enabled ? 'telegram' : 'sms';
  }

  async request(phone: string, ip: string): Promise<{ retryAfter: number; channel: OtpChannel }> {
    const okPhone = await this.redis.allow(`otp:p:${phone}`, DEFAULT_RULES.otpPerPhonePerHour, 3600);
    const okIp = await this.redis.allow(`otp:ip:${ip}`, 10, 3600);
    if (!okPhone || !okIp) throw new DomainError('AUTH_OTP_RATE_LIMIT', 'Juda ko\'p urinish. Keyinroq urinib ko\'ring');

    const code = this.isFake ? '000000' : String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpCode.create({
      data: { phone, codeHash: await argon2.hash(code), expiresAt: new Date(Date.now() + DEFAULT_RULES.otpTtlSeconds * 1000) },
    });

    if (this.telegram.enabled) {
      try {
        await this.telegram.sendCode(phone, code, DEFAULT_RULES.otpTtlSeconds);
        return { retryAfter: 60, channel: 'telegram' };
      } catch (e) {
        // Raqamda Telegram yo'q / Gateway ishlamadi. SMS sozlanmagan bo'lsa (FAKE) zaxira yo'q —
        // soxta adapter "yubordim" deb aldab qo'ymasin.
        if (this.smsFake) {
          throw new DomainError('AUTH_OTP_SEND_FAILED', 'Kod Telegram\'ga yuborilmadi. Raqamda Telegram ochilganini tekshiring yoki login va parol bilan kiring');
        }
        this.logger.warn(`Telegram'ga yuborilmadi, SMS'ga o'tamiz: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    try {
      await this.sms.send(phone, `Insof ECO: kirish kodi ${code}. Hech kimga bermang.`);
    } catch (e) {
      // Kod bazada qoldi, lekin foydalanuvchiga yetmadi — "yuborildi" deb aldamaymiz
      this.logger.error(`OTP SMS yuborilmadi (${phone.slice(0, 7)}***): ${e instanceof Error ? e.message : String(e)}`);
      throw new DomainError('AUTH_OTP_SEND_FAILED', 'SMS yuborilmadi. Birozdan keyin qayta urinib ko\'ring');
    }
    return { retryAfter: 60, channel: 'sms' };
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
}
