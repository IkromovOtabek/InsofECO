import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthContext, CurrentUser, Roles } from '../../../common/auth/decorators';
import { Zod } from '../../../common/validation/zod-validation.pipe';
import { IntegrationGuard } from './integration.guard';
import {
  ErpCustomerInput, ErpCustomerSchema, ErpDriverPatchSchema, ErpDriverSchema, ErpInvoiceInput, ErpInvoiceSchema,
  ErpMaterialInput, ErpMaterialSchema, ErpMixInput, ErpMixSchema, ErpOrderInput, ErpOrderSchema,
  ErpPaymentInput, ErpPaymentSchema, ErpTripInput, ErpTripSchema, ErpTripStatusInput, ErpTripStatusSchema, ErpVehicleSchema,
} from './erp.schemas';
import { ErpService } from './erp.service';

/**
 * Insof ERP uchun mashina-mashina API. Kirish: `X-Api-Key` (IntegrationClient).
 * Tashkilot va rol kalitga bog'langan — X-Org-Id kerak emas. Faqat integratsiya kaliti kiradi (mobil JWT emas).
 */
@Controller({ path: 'erp', version: '1' })
@UseGuards(IntegrationGuard)
@Roles('TADBIRKOR')
export class ErpController {
  constructor(private readonly erp: ErpService) {}

  @Get('ping')
  ping(@CurrentUser() a: AuthContext) { return this.erp.ping(a); }

  @Get('drivers')
  drivers(@CurrentUser() a: AuthContext) { return this.erp.drivers(a); }

  @Put('drivers')
  upsertDriver(@CurrentUser() a: AuthContext, @Body(Zod(ErpDriverSchema)) b: z.infer<typeof ErpDriverSchema>) { return this.erp.upsertDriver(a, b); }

  /** ERP'da xodim kartasi o'zgardi (F.I.O.). */
  @Patch('drivers/:userId')
  patchDriver(@CurrentUser() a: AuthContext, @Param('userId') userId: string, @Body(Zod(ErpDriverPatchSchema)) b: z.infer<typeof ErpDriverPatchSchema>) { return this.erp.patchDriver(a, userId, b); }

  /** Ilovada ro'yxatdan o'tgan haydovchini ERP'dan tasdiqlash (Tadbirkor o'rniga). */
  @Post('drivers/:userId/approve') @HttpCode(200)
  approveDriver(@CurrentUser() a: AuthContext, @Param('userId') userId: string) { return this.erp.setDriverActive(a, userId, true); }

  /** ERP'da xodim o'chirildi — ilovaga kira olmaydi. */
  @Post('drivers/:userId/deactivate') @HttpCode(200)
  deactivateDriver(@CurrentUser() a: AuthContext, @Param('userId') userId: string) { return this.erp.setDriverActive(a, userId, false); }

  @Get('vehicles')
  vehicles(@CurrentUser() a: AuthContext) { return this.erp.vehicles(a); }

  @Put('vehicles')
  upsertVehicle(@CurrentUser() a: AuthContext, @Body(Zod(ErpVehicleSchema)) b: z.infer<typeof ErpVehicleSchema>) { return this.erp.upsertVehicle(a, b); }

  @Get('trips')
  trips(@CurrentUser() a: AuthContext, @Query('date') date?: string) { return this.erp.listTrips(a, date ? new Date(date) : new Date()); }

  @Get('trips/:ref')
  trip(@CurrentUser() a: AuthContext, @Param('ref') ref: string) { return this.erp.getTrip(a, ref); }

  /** Yaratish yoki yangilash — ERP nakladnoy raqami bo'yicha idempotent. */
  @Put('trips/:ref')
  upsertTrip(@CurrentUser() a: AuthContext, @Param('ref') ref: string, @Body(Zod(ErpTripSchema)) b: ErpTripInput) { return this.erp.upsertTrip(a, ref, b); }

  @Post('trips/:ref/status') @HttpCode(200)
  setStatus(@CurrentUser() a: AuthContext, @Param('ref') ref: string, @Body(Zod(ErpTripStatusSchema)) b: ErpTripStatusInput) { return this.erp.setStatus(a, ref, b); }

  // ───────── kuzatuv ─────────

  /** Yo'ldagi barcha reyslarning oxirgi joylashuvi — ERP xaritasi shu bo'yicha yangilanadi. */
  @Get('positions')
  positions(@CurrentUser() a: AuthContext) { return this.erp.positions(a); }

  /** Bitta reysning to'liq izi. */
  @Get('mileage')
  mileage(@CurrentUser() a: AuthContext, @Query('from') from?: string, @Query('to') to?: string) {
    return this.erp.mileage(a, from, to);
  }

  @Get('trips/:ref/track')
  track(@CurrentUser() a: AuthContext, @Param('ref') ref: string) { return this.erp.track(a, ref); }

  // ───────── spravochniklar (ERP — manba) ─────────

  @Put('customers')
  upsertCustomer(@CurrentUser() a: AuthContext, @Body(Zod(ErpCustomerSchema)) b: ErpCustomerInput) { return this.erp.upsertCustomer(a, b); }

  @Put('mixes')
  upsertMix(@CurrentUser() a: AuthContext, @Body(Zod(ErpMixSchema)) b: ErpMixInput) { return this.erp.upsertMix(a, b); }

  @Put('materials')
  upsertMaterial(@CurrentUser() a: AuthContext, @Body(Zod(ErpMaterialSchema)) b: ErpMaterialInput) { return this.erp.upsertMaterial(a, b); }

  /** ERP zayavkasi — reyssiz ham ko'rinadi (mijoz ilovada o'z buyurtmasini kuzatadi). */
  @Put('orders/:ref')
  upsertOrder(@CurrentUser() a: AuthContext, @Param('ref') ref: string, @Body(Zod(ErpOrderSchema)) b: ErpOrderInput) { return this.erp.upsertOrder(a, ref, b); }

  @Put('invoices/:ref')
  upsertInvoice(@CurrentUser() a: AuthContext, @Param('ref') ref: string, @Body(Zod(ErpInvoiceSchema)) b: ErpInvoiceInput) { return this.erp.upsertInvoice(a, ref, b); }

  @Put('payments/:ref')
  upsertPayment(@CurrentUser() a: AuthContext, @Param('ref') ref: string, @Body(Zod(ErpPaymentSchema)) b: ErpPaymentInput) { return this.erp.upsertPayment(a, ref, b); }
}
