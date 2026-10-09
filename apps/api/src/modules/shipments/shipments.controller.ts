import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { ShipmentTransitionSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { ShipmentsService } from './shipments.service';

/** Yuk reysi GPS paketi — beton reysidagi `GpsBatchSchema` nuqtasi bilan bir xil (reys id URL'da). */
const ShipmentGpsSchema = z.object({
  points: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    speedKmh: z.number().nonnegative().optional(),
    heading: z.number().min(0).max(360).optional(),
    at: z.coerce.date(),
  })).max(200),
  /** Nuqtasiz "tiriklik" belgisi (iOS turgan telefonda nuqta bermaydi) — paket bo'sh bo'lishi mumkin. */
  ping: z.coerce.date().optional(),
  platform: z.enum(['ios', 'android']).optional(),
}).refine((b) => b.points.length > 0 || !!b.ping, { message: 'Nuqta yoki ping kerak', path: ['points'] });

/** Rejadagi yo'l — haydovchi ilovasidagi Yandex yo'li (soddalashtirilgan). */
const PlannedRouteSchema = z.object({
  line: z.array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })).min(2).max(500),
  meters: z.number().nonnegative().optional(),
  seconds: z.number().nonnegative().optional(),
});

@Controller({ path: 'shipments', version: '1' })
export class ShipmentsController {
  constructor(private readonly s: ShipmentsService) {}

  @Roles('TADBIRKOR', 'HAYDOVCHI', 'QURUVCHI') @Get()
  list(@CurrentUser() a: AuthContext, @Query('status') status?: string) { return this.s.list(a, status); }

  @Roles('HAYDOVCHI') @Get('history')
  history(@CurrentUser() a: AuthContext) { return this.s.history(a); }

  @Roles('TADBIRKOR', 'HAYDOVCHI', 'QURUVCHI') @Get(':id')
  get(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.s.get(a, id); }

  /** Bosib o'tilgan yo'l: soddalashtirilgan iz, km, vaqt (xaritadagi "Bosib o'tildi"). `?since=ISO` — faqat oxirgi qism (jonli xaritadagi dum). */
  @Roles('TADBIRKOR', 'HAYDOVCHI', 'QURUVCHI') @Get(':id/track')
  track(@CurrentUser() a: AuthContext, @Param('id') id: string, @Query('since') since?: string) {
    // Noto'g'ri sana — e'tiborsiz (butun iz), so'rov rad etilmaydi
    const d = since ? new Date(since) : undefined;
    return this.s.track(a, id, d && Number.isFinite(d.getTime()) ? d : undefined);
  }

  /** Haydovchi telefonining fon GPS'i (buferdan to'p-to'p). */
  @Roles('HAYDOVCHI') @Post(':id/gps') @HttpCode(200)
  gps(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(ShipmentGpsSchema)) b: z.infer<typeof ShipmentGpsSchema>) { return this.s.ingestGps(a, id, b); }

  /** Rejadagi yo'l (Yandex) — "marshrutdan chiqdi" kuzatuvi uchun. Yo'l qurilganda / qayta qurilganda, 2 daqiqada ko'pi bilan bir. */
  @Roles('HAYDOVCHI') @Put(':id/planned-route') @HttpCode(200)
  plannedRoute(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(PlannedRouteSchema)) b: z.infer<typeof PlannedRouteSchema>) { return this.s.setPlannedRoute(a, id, b); }

  @Roles('TADBIRKOR', 'HAYDOVCHI', 'QURUVCHI') @Post(':id/transition') @HttpCode(200)
  transition(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(ShipmentTransitionSchema)) b: z.infer<typeof ShipmentTransitionSchema>, @Headers('idempotency-key') _k?: string) { return this.s.transition(a, id, b); }
}
