import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  CancelOrderSchema,
  ConfirmOrderSchema,
  CreateOrderInput,
  CreateOrderSchema,
  CursorQuerySchema,
  ListOrdersQuerySchema,
  RejectOrderSchema,
} from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { OrdersService } from './orders.service';

const ListQuery = CursorQuerySchema.merge(ListOrdersQuerySchema);
const CreateByPlant = CreateOrderSchema.extend({ clientOrgId: z.string() });

@Controller({ path: 'orders', version: '1' })
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Roles('QURUVCHI', 'TADBIRKOR')
  @Get()
  list(@CurrentUser() a: AuthContext, @Query(Zod(ListQuery)) q: z.infer<typeof ListQuery>) {
    return this.orders.list(a, q);
  }

  @Roles('QURUVCHI', 'TADBIRKOR')
  @Get(':id')
  get(@CurrentUser() a: AuthContext, @Param('id') id: string) {
    return this.orders.get(a, id);
  }

  @Roles('QURUVCHI', 'TADBIRKOR')
  @Post()
  create(@CurrentUser() a: AuthContext, @Body(Zod(CreateOrderSchema)) body: CreateOrderInput) {
    return this.orders.create(a, body);
  }

  /** Tadbirkor (zavod) mijoz nomidan — telefon orqali kelgan buyurtma. */
  @Roles('TADBIRKOR')
  @Post('on-behalf')
  createOnBehalf(@CurrentUser() a: AuthContext, @Body(Zod(CreateByPlant)) body: z.infer<typeof CreateByPlant>) {
    const { clientOrgId, ...rest } = body;
    return this.orders.create(a, rest, clientOrgId);
  }

  @Roles('QURUVCHI', 'TADBIRKOR') @Post(':id/submit') @HttpCode(200)
  submit(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.orders.submit(a, id); }

  @Roles('TADBIRKOR') @Post(':id/confirm') @HttpCode(200)
  confirm(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(ConfirmOrderSchema)) b: z.infer<typeof ConfirmOrderSchema>) { return this.orders.confirm(a, id, b); }

  @Roles('TADBIRKOR') @Post(':id/reject') @HttpCode(200)
  reject(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(RejectOrderSchema)) b: { reason: string }) { return this.orders.reject(a, id, b.reason); }

  @Roles('QURUVCHI', 'TADBIRKOR') @Post(':id/cancel') @HttpCode(200)
  cancel(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(CancelOrderSchema)) b: { reason?: string }) { return this.orders.cancel(a, id, b.reason); }
}
