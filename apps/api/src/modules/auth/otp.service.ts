import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { DEFAULT_RULES } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { SmsPort } from '../../infra/sms/sms.port';
import { DomainError } from '../../common/errors/domain.error';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sms: SmsPort,
  ) {}

  private get isFake() {
    return (process.env.SMS_PROVIDER ?? 'FAKE') === 'FAKE';
  }

  async request(phone: string, ip: string): Promise<{ retryAfter: number }> {
    const okPhone = await this.redis.allow(`otp:p:${phone}`, DEFAULT_RULES.otpPerPhonePerHour, 3600);
    const okIp = await this.redis.allow(`otp:ip:${ip}`, 10, 3600);
    if (!okPhone || !okIp) throw new DomainError('AUTH_OTP_RATE_LIMIT', 'Juda ko\'p urinish. Keyinroq urinib ko\'ring');

    const code = this.isFake ? '000000' : String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpCode.create({
      data: { phone, codeHash: await argon2.hash(code), expiresAt: new Date(Date.now() + DEFAULT_RULES.otpTtlSeconds * 1000) },
    });
    try {
      await this.sms.send(phone, `Insof ECO: kirish kodi ${code}. Hech kimga bermang.`);
    } catch (e) {
      // Kod bazada qoldi, lekin foydalanuvchiga yetmadi — "yuborildi" deb aldamaymiz
      this.logger.error(`OTP SMS yuborilmadi (${phone.slice(0, 7)}***): ${e instanceof Error ? e.message : String(e)}`);
      throw new DomainError('AUTH_OTP_SEND_FAILED', 'SMS yuborilmadi. Birozdan keyin qayta urinib ko\'ring');
    }
    return { retryAfter: 60 };
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
