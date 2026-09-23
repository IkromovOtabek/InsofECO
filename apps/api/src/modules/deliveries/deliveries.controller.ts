import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { DeliveryTransitionInput, DeliveryTransitionSchema, DisputeDeliverySchema, SignDeliverySchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { DeliveriesService } from './deliveries.service';

@Controller({ path: 'deliveries', version: '1' })
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  /** Haydovchi uchun X-Org-Id shart emas — reyslar driver profili orqali. */
  @Get('mine')
  mine(@CurrentUser() a: AuthContext, @Query('date') date?: string) {
    return this.deliveries.mine(a, date ? new Date(date) : new Date());
  }

  @Get(':id')
  get(@CurrentUser() a: AuthContext, @Param('id') id: string) {
    return this.deliveries.get(a, id);
  }

  @Post(':id/transition') @HttpCode(200)
  transition(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(DeliveryTransitionSchema)) b: DeliveryTransitionInput, @Headers('idempotency-key') key?: string) {
    return this.deliveries.transition(a, id, b, key);
  }

  @Roles('QURUVCHI', 'TADBIRKOR') @Post(':id/sign') @HttpCode(200)
  sign(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(SignDeliverySchema)) b: z.infer<typeof SignDeliverySchema>, @Headers('idempotency-key') key?: string) {
    return this.deliveries.sign(a, id, b, key);
  }

  /** Haydovchi: quruvchi ilovasiz — SMS-kod bilan yakunlash. */
  @Post(':id/sign/by-otp') @HttpCode(200)
  signByOtp(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(SignDeliverySchema)) b: z.infer<typeof SignDeliverySchema>, @Headers('idempotency-key') key?: string) {
    return this.deliveries.sign(a, id, b, key);
  }

  @Post(':id/accept-otp/request') @HttpCode(200)
  requestOtp(@CurrentUser() a: AuthContext, @Param('id') id: string) {
    return this.deliveries.requestAcceptOtp(a, id);
  }

  @Roles('QURUVCHI', 'TADBIRKOR') @Post(':id/dispute') @HttpCode(200)
  dispute(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(DisputeDeliverySchema)) b: z.infer<typeof DisputeDeliverySchema>) {
    return this.deliveries.dispute(a, id, b);
  }
}
