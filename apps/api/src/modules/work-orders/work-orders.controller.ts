import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { WorkOrderCreateSchema, WorkOrderReviewSchema, WorkOrderSubmitSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { WorkOrdersService } from './work-orders.service';

const AssignSchema = z.object({ workerUserId: z.string() });

@Controller({ path: 'work-orders', version: '1' })
export class WorkOrdersController {
  constructor(private readonly s: WorkOrdersService) {}

  @Roles('TADBIRKOR', 'QURUVCHI') @Get()
  list(@CurrentUser() a: AuthContext, @Query('status') status?: string) { return this.s.list(a, status); }

  @Roles('TADBIRKOR', 'QURUVCHI') @Get(':id')
  get(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.s.get(a, id); }

  @Roles('TADBIRKOR') @Post()
  create(@CurrentUser() a: AuthContext, @Body(Zod(WorkOrderCreateSchema)) b: z.infer<typeof WorkOrderCreateSchema>) { return this.s.create(a, b); }

  @Roles('TADBIRKOR') @Post(':id/accept') @HttpCode(200)
  accept(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.s.transition(a, id, 'ACCEPTED'); }

  @Roles('TADBIRKOR') @Post(':id/assign') @HttpCode(200)
  assign(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(AssignSchema)) b: { workerUserId: string }) { return this.s.assign(a, id, b.workerUserId); }

  @Roles('QURUVCHI') @Post(':id/start') @HttpCode(200)
  start(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.s.take(a, id); }

  @Roles('QURUVCHI') @Post(':id/submit') @HttpCode(200)
  submit(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(WorkOrderSubmitSchema)) b: z.infer<typeof WorkOrderSubmitSchema>) { return this.s.submit(a, id, b); }

  @Roles('TADBIRKOR') @Post(':id/review') @HttpCode(200)
  review(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(WorkOrderReviewSchema)) b: z.infer<typeof WorkOrderReviewSchema>) { return this.s.review(a, id, b); }

  @Roles('TADBIRKOR') @Post(':id/pay') @HttpCode(200)
  pay(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.s.pay(a, id); }

  @Roles('TADBIRKOR') @Post(':id/cancel') @HttpCode(200)
  cancel(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.s.transition(a, id, 'CANCELLED'); }
}
