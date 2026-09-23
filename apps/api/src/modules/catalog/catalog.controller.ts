import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { ConcreteGrade } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';

const MixSchema = z.object({
  grade: z.enum(ConcreteGrade),
  name: z.string().min(2).max(80),
  slump: z.string().max(10).optional(),
  unitPrice: z.number().nonnegative(),
  isActive: z.boolean().optional(),
});

@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  /** Quruvchi boshqa tashkilot (zavod) katalogini ko'radi → ?plantOrgId; Tadbirkor o'zinikini. */
  @Get('mixes')
  list(@CurrentUser() a: AuthContext, @Query('plantOrgId') plantOrgId?: string) {
    const orgId = plantOrgId ?? a.orgId;
    if (!orgId) throw new DomainError('VALIDATION', 'plantOrgId kerak');
    return this.prisma.concreteMix.findMany({ where: { organizationId: orgId, isActive: true, deletedAt: null }, orderBy: { grade: 'asc' } });
  }

  @Roles('TADBIRKOR')
  @Post('mixes')
  create(@CurrentUser() a: AuthContext, @Body(Zod(MixSchema)) body: z.infer<typeof MixSchema>) {
    return this.prisma.concreteMix.create({ data: { organizationId: a.orgId!, ...body } });
  }

  @Roles('TADBIRKOR')
  @Put('mixes/:id')
  async update(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(MixSchema.partial())) body: Partial<z.infer<typeof MixSchema>>) {
    const r = await this.prisma.concreteMix.updateMany({ where: { id, organizationId: a.orgId! }, data: body });
    if (r.count === 0) throw DomainError.notFound('Marka');
    return this.prisma.concreteMix.findUnique({ where: { id } });
  }
}
