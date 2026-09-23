import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { GeoPointSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';

const SiteSchema = z.object({ name: z.string().min(2).max(120), address: z.string().min(5).max(200), location: GeoPointSchema });
const StageSchema = z.object({ name: z.string().min(2).max(80), order: z.number().int().min(0) });
const ReportSchema = z.object({ date: z.coerce.date(), text: z.string().min(2).max(1000), workers: z.number().int().min(0).default(0), photoKeys: z.array(z.string()).max(10).default([]) });

@Controller({ path: 'sites', version: '1' })
@Roles('QURUVCHI', 'TADBIRKOR')
export class SitesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() a: AuthContext) {
    return this.prisma.constructionSite.findMany({
      where: { organizationId: a.orgId! },
      include: { stages: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  create(@CurrentUser() a: AuthContext, @Body(Zod(SiteSchema)) b: z.infer<typeof SiteSchema>) {
    return this.prisma.constructionSite.create({
      data: {
        organizationId: a.orgId!,
        name: b.name,
        address: b.address,
        lat: b.location.lat,
        lng: b.location.lng,
        // Qishloq qurilishi standart bosqichlari
        stages: { create: ['Poydevor', 'Devor', 'Tom', 'Pardoz'].map((name, order) => ({ name, order })) },
      },
      include: { stages: true },
    });
  }

  @Post(':id/stages')
  async addStage(@CurrentUser() a: AuthContext, @Param('id') siteId: string, @Body(Zod(StageSchema)) b: z.infer<typeof StageSchema>) {
    await this.ownSite(a, siteId);
    return this.prisma.stage.create({ data: { siteId, ...b } });
  }

  @Post(':id/stages/:stageId/reports')
  async addReport(@CurrentUser() a: AuthContext, @Param('id') siteId: string, @Param('stageId') stageId: string, @Body(Zod(ReportSchema)) b: z.infer<typeof ReportSchema>) {
    await this.ownSite(a, siteId);
    return this.prisma.dailyReport.create({ data: { stageId, createdBy: a.userId, ...b } });
  }

  private async ownSite(a: AuthContext, siteId: string) {
    const s = await this.prisma.constructionSite.findFirst({ where: { id: siteId, organizationId: a.orgId! } });
    if (!s) throw DomainError.notFound('Obyekt');
    return s;
  }
}
