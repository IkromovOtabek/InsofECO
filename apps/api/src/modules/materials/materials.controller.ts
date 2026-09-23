import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { InventoryAdjustSchema, MaterialCreateSchema, MaterialRequestApproveSchema, MaterialRequestCreateSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { MaterialsService } from './materials.service';

const RejectSchema = z.object({ reason: z.string().min(2).max(300) });

@Controller({ path: 'materials', version: '1' })
export class MaterialsController {
  constructor(private readonly s: MaterialsService) {}

  @Roles('TADBIRKOR', 'QURUVCHI') @Get()
  list(@CurrentUser() a: AuthContext) { return this.s.list(a); }

  @Roles('TADBIRKOR') @Post()
  create(@CurrentUser() a: AuthContext, @Body(Zod(MaterialCreateSchema)) b: z.infer<typeof MaterialCreateSchema>) { return this.s.create(a, b); }

  @Roles('TADBIRKOR') @Patch(':id')
  update(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(MaterialCreateSchema.partial())) b: Partial<z.infer<typeof MaterialCreateSchema>>) { return this.s.update(a, id, b); }

  @Roles('TADBIRKOR', 'HAYDOVCHI') @Get('warehouses')
  warehouses(@CurrentUser() a: AuthContext) { return this.s.warehouses(a); }

  @Roles('TADBIRKOR') @Post('inventory/adjust') @HttpCode(200)
  adjust(@CurrentUser() a: AuthContext, @Body(Zod(InventoryAdjustSchema)) b: z.infer<typeof InventoryAdjustSchema>) { return this.s.adjust(a, b); }
}

@Controller({ path: 'material-requests', version: '1' })
export class MaterialRequestsController {
  constructor(private readonly s: MaterialsService) {}

  @Roles('TADBIRKOR', 'QURUVCHI') @Get()
  list(@CurrentUser() a: AuthContext, @Query('status') status?: string) { return this.s.listRequests(a, status); }

  @Roles('QURUVCHI', 'TADBIRKOR') @Post()
  create(@CurrentUser() a: AuthContext, @Body(Zod(MaterialRequestCreateSchema)) b: z.infer<typeof MaterialRequestCreateSchema>) { return this.s.createRequest(a, b); }

  @Roles('TADBIRKOR') @Post(':id/approve') @HttpCode(200)
  approve(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(MaterialRequestApproveSchema)) b: z.infer<typeof MaterialRequestApproveSchema>) { return this.s.approve(a, id, b); }

  @Roles('TADBIRKOR') @Post(':id/reject') @HttpCode(200)
  reject(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(RejectSchema)) b: { reason: string }) { return this.s.reject(a, id, b.reason); }
}
