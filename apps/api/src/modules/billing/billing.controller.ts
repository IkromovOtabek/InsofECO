import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { BillingService } from './billing.service';

const CashSchema = z.object({ amount: z.number().positive() });

@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Roles('TADBIRKOR', 'QURUVCHI')
  @Get('summary')
  summary(@CurrentUser() a: AuthContext) {
    return this.billing.summary(a);
  }

  @Roles('TADBIRKOR')
  @Post('invoices/:id/payments/cash')
  cash(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(CashSchema)) b: { amount: number }) {
    return this.billing.cashPayment(a, id, b.amount);
  }
}
