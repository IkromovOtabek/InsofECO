import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../../common/auth/decorators';
import { Zod } from '../../../common/validation/zod-validation.pipe';
import { TelegramLoginService } from '../../auth/telegram-login.service';
import { IntegrationGuard } from './integration.guard';

const BindSchema = z.object({ nonce: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/), chatId: z.string().regex(/^-?\d{1,20}$/) });
const ContactSchema = z.object({ chatId: z.string().regex(/^-?\d{1,20}$/), phone: z.string().min(9).max(20), name: z.string().max(120).optional() });

/**
 * ERP boti → ECO: ilovaga Telegram orqali kirish. Bot update'larini ERP qabul qiladi
 * (bitta token — bitta webhook), shu yerga faqat "Start bosildi" va "raqam ulashildi" keladi.
 */
@Controller({ path: 'erp/telegram-login', version: '1' })
@UseGuards(IntegrationGuard)
@Roles('TADBIRKOR')
export class ErpTelegramLoginController {
  constructor(private readonly tg: TelegramLoginService) {}

  @Post('bind') @HttpCode(200)
  bind(@Body(Zod(BindSchema)) b: z.infer<typeof BindSchema>) { return this.tg.bind(b.nonce, b.chatId); }

  @Post('contact') @HttpCode(200)
  contact(@Body(Zod(ContactSchema)) b: z.infer<typeof ContactSchema>) { return this.tg.contact(b.chatId, b.phone, b.name); }
}
