import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthContext, CurrentUser, Roles } from '../../../common/auth/decorators';
import { Zod } from '../../../common/validation/zod-validation.pipe';
import { IntegrationGuard } from './integration.guard';
import {
  ErpCustomerInput, ErpCustomerLinkInput, ErpCustomerLinkSchema, ErpCustomerSchema, ErpDeleteUserSchema, ErpVerifyCredentialsSchema, ErpDriverPatchSchema, ErpDriverSchema, ErpInvoiceInput, ErpInvoiceSchema,
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

  /** ERP direktori haydovchi so'rovini rad etdi — "o'chirish so'ralgan" belgisi olib tashlanadi. */
  @Post('drivers/:userId/deletion-cancel') @HttpCode(200)
  cancelDeletion(@CurrentUser() a: AuthContext, @Param('userId') userId: string) { return this.erp.cancelDeletion(a, userId); }

  /** Saytdagi/ERP'dagi hisobni o'chirish so'rovi tasdiqlandi — telefon bo'yicha anonimlashtirish (faqat zavodga aloqador odam). */
  @Post('users/delete') @HttpCode(200)
  deleteUser(@CurrentUser() a: AuthContext, @Body(Zod(ErpDeleteUserSchema)) b: z.infer<typeof ErpDeleteUserSchema>) { return this.erp.deleteUser(a, b.phone); }

  /**
   * ERP login: ilovadagi telefon + parol to'g'rimi. To'g'ri bo'lsa — ECO foydalanuvchi id; ERP'ga kira oladimi,
   * ERP o'zi hal qiladi (direktor ruxsati). Xato javob raqam bor/yo'qligini oshkor qilmaydi.
   */
  @Post('auth/verify') @HttpCode(200)
  verifyCredentials(@Body(Zod(ErpVerifyCredentialsSchema)) b: z.infer<typeof ErpVerifyCredentialsSchema>) { return this.erp.verifyCredentials(b.phone, b.password); }

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

  // ── Mijozning ilova hisobi: ERP mijoz kartasi ↔ ilovada ro'yxatdan o'tgan quruvchi ──
  /** Hali hech bir ERP mijoziga ulanmagan, ilovada o'zi ro'yxatdan o'tgan mijozlar (nom / telefon / INN bo'yicha izlash). */
  @Get('customers/unlinked')
  unlinkedCustomers(@CurrentUser() a: AuthContext, @Query('q') q?: string) { return this.erp.unlinkedCustomers(a, q); }

  /** ERP mijoz kartasi ilovada kimga ulangan: tashkilot va a'zolari (kim ro'yxatdan o'tgan, kim faqat taklif qilingan). */
  @Get('customers/:externalRef/app')
  customerApp(@CurrentUser() a: AuthContext, @Param('externalRef') ref: string) { return this.erp.customerApp(a, ref); }

  /** ERP mijozini ilova hisobiga ulash. Mijozning ERP'dan kelgan tashkiloti bo'lsa — ikkalasi birlashtiriladi. */
  @Post('customers/:externalRef/link') @HttpCode(200)
  linkCustomer(@CurrentUser() a: AuthContext, @Param('externalRef') ref: string, @Body(Zod(ErpCustomerLinkSchema)) b: ErpCustomerLinkInput) { return this.erp.linkCustomer(a, ref, b.orgId); }

  /** Ilovada ro'yxatdan o'tgan barcha foydalanuvchilar (direktor kabineti uchun). */
  @Get('app-users')
  appUsers(@CurrentUser() a: AuthContext, @Query('q') q?: string, @Query('role') role?: string) {
    const r = role === 'TADBIRKOR' || role === 'QURUVCHI' || role === 'HAYDOVCHI' ? role : undefined;
    return this.erp.appUsers(a, q, r);
  }

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
