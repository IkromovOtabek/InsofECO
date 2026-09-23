import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ShipmentTransitionSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { ShipmentsService } from './shipments.service';

@Controller({ path: 'shipments', version: '1' })
export class ShipmentsController {
  constructor(private readonly s: ShipmentsService) {}

  @Roles('TADBIRKOR', 'HAYDOVCHI', 'QURUVCHI') @Get()
  list(@CurrentUser() a: AuthContext, @Query('status') status?: string) { return this.s.list(a, status); }

  @Roles('HAYDOVCHI') @Get('history')
  history(@CurrentUser() a: AuthContext) { return this.s.history(a); }

  @Roles('TADBIRKOR', 'HAYDOVCHI', 'QURUVCHI') @Get(':id')
  get(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.s.get(a, id); }

  @Roles('TADBIRKOR', 'HAYDOVCHI', 'QURUVCHI') @Post(':id/transition') @HttpCode(200)
  transition(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(ShipmentTransitionSchema)) b: z.infer<typeof ShipmentTransitionSchema>, @Headers('idempotency-key') _k?: string) { return this.s.transition(a, id, b); }
}
