import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChangePasswordInput, ChangePasswordSchema, ForgotPasswordSchema, LoginInput, LoginSchema, OtpRequest, OtpRequestSchema, OtpVerify, OtpVerifySchema, RefreshSchema, RegisterInput, RegisterSchema, ResetPasswordInput, ResetPasswordSchema } from '@insof/shared';
import { AuthService } from './auth.service';
import { AuthContext, CurrentUser, Public } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body(Zod(RegisterSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body(Zod(LoginSchema)) body: LoginInput) {
    return this.auth.login(body);
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
