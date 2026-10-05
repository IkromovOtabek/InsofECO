import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChangePasswordInput, ChangePasswordSchema, ForgotPasswordSchema, LoginInput, LoginSchema, OtpRequest, OtpRequestSchema, OtpVerify, OtpVerifySchema, RefreshSchema, RegisterSchema, ResetPasswordInput, ResetPasswordSchema } from '@insof/shared';
import { z } from 'zod';
import { DeviceInfoSchema } from '@insof/shared';
import { AuthService, RegisterRequest } from './auth.service';
import { TelegramLoginService } from './telegram-login.service';
import { AuthContext, CurrentUser, Public } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';

/**
 * Ro'yxatdan o'tish: umumiy sxema + `phoneVerificationToken` (POST /auth/register/verify javobi).
 * Intersection: chap tomon tokenni olib tashlaydi, o'ng tomon faqat tokenni qoldiradi — natija ikkalasi.
 */
const RegisterRequestSchema = RegisterSchema.and(z.object({ phoneVerificationToken: z.string().min(20).max(200).optional() }));

const TelegramPollSchema = z.object({ nonce: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/), device: DeviceInfoSchema });

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly telegram: TelegramLoginService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(200)
  requestOtp(@Body(Zod(OtpRequestSchema)) body: OtpRequest, @Ip() ip: string) {
    return this.auth.requestOtp(body.phone, ip);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(200)
  verifyOtp(@Body(Zod(OtpVerifySchema)) body: OtpVerify) {
    return this.auth.verifyOtp(body);
  }

  /**
   * Ro'yxatdan o'tish, 2-qadam (kod `otp/request` bilan yuborilgan): kod to'g'ri bo'lsa —
   * `{ status: 'verified', phoneVerificationToken }` yoki raqam tizimda bor bo'lsa `{ status: 'existing', ...sessiya }`.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register/verify')
  @HttpCode(200)
  verifyRegisterPhone(@Body(Zod(OtpVerifySchema)) body: OtpVerify) {
    return this.auth.verifyRegisterPhone(body);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body(Zod(RegisterRequestSchema)) body: RegisterRequest) {
    return this.auth.register(body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body(Zod(LoginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  // ── Telegram orqali kirish: havola → botda raqamni ulashish → ilova tasdiqni kutadi ──

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('telegram/start')
  @HttpCode(200)
  telegramStart() {
    return this.telegram.start();
  }

  /** Ilova har ~2 s so'raydi: `pending` yoki sessiya (tokenlar + profil). */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('telegram/poll')
  @HttpCode(200)
  async telegramPoll(@Body(Zod(TelegramPollSchema)) body: z.infer<typeof TelegramPollSchema>) {
    const done = await this.telegram.take(body.nonce);
    if (!done) return { status: 'pending' as const };
    return { status: 'ok' as const, ...(await this.auth.signInVerifiedPhone(done.phone, body.device, done.name)) };
  }

  /** Roli yo'q foydalanuvchi (Telegram/SMS bilan kirgan) — mijoz sifatida davom etadi. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('customer')
  @HttpCode(200)
  becomeCustomer(@CurrentUser() auth: AuthContext) {
    return this.auth.becomeCustomer(auth.userId);
  }

  // ── Parolni tiklash: kod → yangi parol ──

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(200)
  forgotPassword(@Body(Zod(ForgotPasswordSchema)) body: { phone: string }, @Ip() ip: string) {
    return this.auth.forgotPassword(body.phone, ip);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(200)
  resetPassword(@Body(Zod(ResetPasswordSchema)) body: ResetPasswordInput) {
    return this.auth.resetPassword(body);
  }

  /** Tizimga kirgan holda parolni almashtirish. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/change')
  @HttpCode(200)
  changePassword(@CurrentUser() auth: AuthContext, @Body(Zod(ChangePasswordSchema)) body: ChangePasswordInput) {
    return this.auth.changePassword(auth.userId, auth.sessionId, body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(Zod(RefreshSchema)) body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() auth: AuthContext) {
    await this.auth.logout(auth.sessionId);
  }
}
