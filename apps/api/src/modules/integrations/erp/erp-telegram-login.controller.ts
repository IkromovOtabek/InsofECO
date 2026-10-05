import { Body, CanActivate, Controller, ExecutionContext, HttpCode, Injectable, Logger, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthContext, Roles } from '../../../common/auth/decorators';
import { DomainError } from '../../../common/errors/domain.error';
import { Zod } from '../../../common/validation/zod-validation.pipe';
import { TelegramLoginService } from '../../auth/telegram-login.service';
import { IntegrationGuard } from './integration.guard';

const BindSchema = z.object({ nonce: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/), chatId: z.string().regex(/^-?\d{1,20}$/) });
const ContactSchema = z.object({ chatId: z.string().regex(/^-?\d{1,20}$/), phone: z.string().min(9).max(20), name: z.string().max(120).optional() });

/**
 * `contact` tasdiqlagan telefon nomidan sessiya beriladi (bir martalik kod bilan teng). Shuning uchun bu yo'llarni
 * istalgan zavodning API kaliti emas, faqat botni yuritadigan ERP kaliti chaqira olishi kerak:
 * `TELEGRAM_LOGIN_CLIENT_IDS` — IntegrationClient.id lar (vergul bilan). Bo'sh bo'lsa (eski o'rnatish)
 * hamma faol kalitga ruxsat va ogohlantirish — prodda albatta to'ldiring.
 */
@Injectable()
class TelegramLoginClientGuard implements CanActivate {
  private static warned = false;
  private readonly logger = new Logger('TelegramLoginClientGuard');
  canActivate(ctx: ExecutionContext): boolean {
    const { auth } = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>();
    const allow = (process.env.TELEGRAM_LOGIN_CLIENT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!allow.length) {
      if (!TelegramLoginClientGuard.warned) {
        TelegramLoginClientGuard.warned = true;
        this.logger.warn("TELEGRAM_LOGIN_CLIENT_IDS bo'sh — istalgan integratsiya kaliti Telegram orqali kirishni tasdiqlay oladi");
      }
      return true;
    }
    if (!auth?.integration || !allow.includes(auth.integration.id)) throw DomainError.forbidden("Bu kalitga Telegram orqali kirishni tasdiqlash ruxsat etilmagan");
    return true;
  }
}

/**
 * ERP boti → ECO: ilovaga Telegram orqali kirish. Bot update'larini ERP qabul qiladi
 * (bitta token — bitta webhook), shu yerga faqat "Start bosildi" va "raqam ulashildi" keladi.
 */
@Controller({ path: 'erp/telegram-login', version: '1' })
@UseGuards(IntegrationGuard, TelegramLoginClientGuard)
@Roles('TADBIRKOR')
export class ErpTelegramLoginController {
  constructor(private readonly tg: TelegramLoginService) {}

  @Post('bind') @HttpCode(200)
  bind(@Body(Zod(BindSchema)) b: z.infer<typeof BindSchema>) { return this.tg.bind(b.nonce, b.chatId); }

  @Post('contact') @HttpCode(200)
  contact(@Body(Zod(ContactSchema)) b: z.infer<typeof ContactSchema>) { return this.tg.contact(b.chatId, b.phone, b.name); }
}
