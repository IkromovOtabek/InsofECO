import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

const pem = (v?: string) => v?.replace(/\\n/g, '\n');

/**
 * Prodda RS256 kalitlari majburiy.
 *
 * Quyidagi fallback ilgari izohda "faqat dev'da" deb yozilgan edi, lekin tekshiruv yo'q edi:
 * kalit unutilsa server tokenlarni ochiq matndagi `dev-only-secret-change-me` bilan imzolab
 * ketaverardi — u kod ichida, ya'ni reponi ko'rgan odam istalgan foydalanuvchi nomidan token
 * yasay olardi. Endi bunday holatda server umuman ko'tarilmaydi.
 */
if (process.env.NODE_ENV === 'production' && !process.env.JWT_PRIVATE_KEY) {
  throw new Error("JWT_PRIVATE_KEY yo'q. Prodda RS256 kalitlari majburiy — .env ga qo'shing.");
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      // Dev: kalit bo'lmasa HS256 fallback (faqat NODE_ENV !== production)
      ...(process.env.JWT_PRIVATE_KEY
        ? {
            privateKey: pem(process.env.JWT_PRIVATE_KEY),
            publicKey: pem(process.env.JWT_PUBLIC_KEY),
            signOptions: { algorithm: 'RS256', expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
          }
        : { secret: 'dev-only-secret-change-me', signOptions: { expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
