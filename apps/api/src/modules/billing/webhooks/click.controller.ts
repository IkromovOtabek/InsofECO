import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { createHash } from 'crypto';
import { Public } from '../../../common/auth/decorators';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { BillingService } from '../billing.service';

/**
 * Click SHOP API: action=0 (Prepare), action=1 (Complete).
 * sign_string = md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + [merchant_prepare_id +] amount + action + sign_time)
 */
@Controller({ path: 'billing/payments/click', version: '1' })
export class ClickWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(@Body() b: Record<string, string>) {
    const secret = process.env.CLICK_SECRET_KEY ?? '';
    const action = Number(b.action);
    const base = `${b.click_trans_id}${b.service_id}${secret}${b.merchant_trans_id}${action === 1 ? b.merchant_prepare_id : ''}${b.amount}${b.action}${b.sign_time}`;
    const sign = createHash('md5').update(base).digest('hex');
    if (process.env.NODE_ENV === 'production' && sign !== b.sign_string) return { error: -1, error_note: 'SIGN CHECK FAILED' };

    const invoice = await this.prisma.invoice.findUnique({ where: { id: b.merchant_trans_id ?? '' } });
    if (!invoice) return { error: -5, error_note: 'Faktura topilmadi' };

    if (action === 0) {
      return { click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id, merchant_prepare_id: invoice.id, error: 0, error_note: 'Success' };
    }
    if (action === 1) {
      if (Number(b.error) < 0) return { click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id, error: -9, error_note: 'Cancelled' };
      await this.billing.recordPayment({ invoiceId: invoice.id, method: 'CLICK', amount: Number(b.amount), externalId: `click:${b.click_trans_id}` });
      return { click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id, merchant_confirm_id: invoice.id, error: 0, error_note: 'Success' };
    }
    return { error: -3, error_note: 'Action not found' };
  }
}
