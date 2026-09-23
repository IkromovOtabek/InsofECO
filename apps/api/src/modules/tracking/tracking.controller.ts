import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { GpsBatch, GpsBatchSchema } from '@insof/shared';
import { AuthContext, CurrentUser } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { DomainError } from '../../common/errors/domain.error';
import { TrackingService } from './tracking.service';

/** HTTP fallback — WS uzilganda mobil outbox shu orqali yuboradi. */
@Controller({ path: 'tracking', version: '1' })
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('gps') @HttpCode(200)
  async gps(@CurrentUser() a: AuthContext, @Body(Zod(GpsBatchSchema)) b: GpsBatch) {
    const pos = await this.tracking.ingest(a.userId, b);
    return { accepted: pos ? b.points.length : 0 };
  }

  @Get('deliveries/:id/position')
  async position(@CurrentUser() a: AuthContext, @Param('id') id: string) {
    if (!(await this.tracking.canWatch(a.userId, id))) throw DomainError.forbidden();
    return (await this.tracking.lastPosition(id)) ?? null;
  }

  @Get('deliveries/:id/track')
  async track(@CurrentUser() a: AuthContext, @Param('id') id: string) {
    if (!(await this.tracking.canWatch(a.userId, id))) throw DomainError.forbidden();
    return this.tracking.track(id);
  }
}
