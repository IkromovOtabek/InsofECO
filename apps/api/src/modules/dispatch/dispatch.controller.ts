import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { AssignDeliverySchema, PlanDeliveriesSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { DispatchService } from './dispatch.service';

@Controller({ path: 'dispatch', version: '1' })
@Roles('TADBIRKOR')
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Get('board')
  board(@CurrentUser() a: AuthContext, @Query('date') date?: string) {
    return this.dispatch.board(a, date ? new Date(date) : new Date());
  }

  @Post('orders/:id/plan') @HttpCode(200)
  plan(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(PlanDeliveriesSchema)) b: z.infer<typeof PlanDeliveriesSchema>) {
    return this.dispatch.plan(a, id, b.capacityM3);
  }

  @Post('deliveries/:id/assign') @HttpCode(200)
  assign(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(AssignDeliverySchema)) b: z.infer<typeof AssignDeliverySchema>) {
    return this.dispatch.assign(a, id, b.driverUserId, b.vehicleId);
  }
}
