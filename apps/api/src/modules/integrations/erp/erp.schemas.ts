import { z } from 'zod';
import { PhoneSchema } from '@insof/shared';

/** ERP → ECO: reys (nakladnoy) yaratish yoki yangilash. Kalit — externalRef (URL'da). */
export const ErpTripSchema = z.object({
  /** ERP zayavka raqami — bir zayavkaning reyslari bitta ECO buyurtmasiga yig'iladi */
  orderRef: z.string().min(1).max(40),
  customer: z.object({
    /** ERP mijoz kartasi id — berilsa mijoz shu bo'yicha topiladi (nom o'zgarsa ham) */
    externalRef: z.string().min(1).max(40).optional(),
    name: z.string().min(1).max(120),
    inn: z.string().regex(/^\d{9}$/).optional(),
    phone: PhoneSchema.optional(),
  }),
  address: z.string().min(1).max(200),
  /** Berilmasa 0/0 — haydovchi manzil matni bo'yicha boradi; geofence ishlamaydi */
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  scheduledAt: z.coerce.date(),
  product: z.object({
    grade: z.string().min(1).max(20), // M300
    name: z.string().min(1).max(80), // "Beton M300 (B22.5)"
    unitPrice: z.number().nonnegative(),
  }),
  plannedM3: z.number().positive().max(50),
  driverPhone: PhoneSchema.optional(),
  driverName: z.string().max(80).optional(),
  vehiclePlate: z.string().min(4).max(12).optional(),
  vehicleCapacityM3: z.number().positive().max(20).optional(),
  note: z.string().max(500).optional(),
});
export type ErpTripInput = z.infer<typeof ErpTripSchema>;

/** ERP → ECO: holatni majburan o'tkazish (ERP'da "Yuklandi", "Yo'lga chiqdi", "Yetkazildi", "Bekor"). */
export const ErpTripStatusSchema = z.object({
  to: z.enum(['ACCEPTED', 'LOADING', 'EN_ROUTE', 'COMPLETED', 'CANCELLED']),
  at: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
  loadedM3: z.number().positive().optional(),
  acceptedM3: z.number().positive().optional(),
});
export type ErpTripStatusInput = z.infer<typeof ErpTripStatusSchema>;

export const ErpDriverSchema = z.object({ phone: PhoneSchema, fullName: z.string().min(2).max(80) });
/** ERP xodim kartasi o'zgardi (F.I.O.) — ECO profili ham yangilanadi. */
export const ErpDriverPatchSchema = z.object({ fullName: z.string().min(2).max(80).optional() });
export const ErpVehicleSchema = z.object({
  plateNumber: z.string().min(4).max(12).transform((v) => v.toUpperCase().replace(/\s+/g, '')),
  capacityM3: z.number().positive().max(20),
  type: z.enum(['MIXER', 'PUMP', 'DUMP', 'TRUCK']).optional(),
  /** ERP'da texnika o'chirilsa ECO'da ham nofaol bo'ladi */
  isActive: z.boolean().optional(),
});

// ───────────────────────── ERP spravochniklari (master-data) ─────────────────────────
// ERP — manba. Quyidagilarning hammasi idempotent: bir xil ma'lumot qayta yuborilsa
// yangi yozuv yaratilmaydi, mavjudi yangilanadi.

/** ERP mijoz kartasi → ECO CONTRACTOR tashkiloti + kredit limiti. Kalit: externalRef (ERP Customer.id). */
export const ErpCustomerSchema = z.object({
  externalRef: z.string().min(1).max(40),
  name: z.string().min(1).max(160),
  inn: z.string().regex(/^\d{9}$/).optional(),
  phone: PhoneSchema.optional(),
  address: z.string().max(300).optional(),
  /** ERP kredit limiti (so'm) — shu zavod uchun CreditLimit */
  creditLimit: z.number().nonnegative().optional(),
  /** ERP'da arxivlangan mijoz ilovada ko'rinmaydi (o'chirilmaydi, yashiriladi) */
  isActive: z.boolean().optional(),
});
export type ErpCustomerInput = z.infer<typeof ErpCustomerSchema>;

/** ERP mahsulot kartasi (beton markasi) → ECO ConcreteMix. Kalit: grade. */
export const ErpMixSchema = z.object({
  grade: z.string().min(1).max(20),
  name: z.string().min(1).max(80),
  slump: z.string().max(10).optional(),
  unitPrice: z.number().nonnegative(),
  isActive: z.boolean().optional(),
});
export type ErpMixInput = z.infer<typeof ErpMixSchema>;

/** ERP xomashyo kartasi → ECO Material. Kalit: externalRef (ERP Material.id). */
export const ErpMaterialSchema = z.object({
  externalRef: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(16),
  category: z.string().max(40).optional(),
  /** Oxirgi kirim narxi — ERP'da xomashyo kartasida narx yo'q, kirimdan olinadi */
  price: z.number().nonnegative().optional(),
  minStock: z.number().nonnegative().optional(),
});
export type ErpMaterialInput = z.infer<typeof ErpMaterialSchema>;

/** ERP zayavka holatlari — ECO holatiga ECO tomonida o'giriladi. */
export const ErpOrderStatusSchema = z.enum(['DRAFT', 'BLOCKED', 'CONFIRMED', 'IN_PRODUCTION', 'DELIVERED', 'CLOSED', 'CANCELLED']);

/** ERP zayavkasi → ECO buyurtmasi. Kalit: externalRef (URL'da, ERP Order.orderNo). */
export const ErpOrderSchema = z.object({
  customer: z.object({
    externalRef: z.string().min(1).max(40).optional(),
    name: z.string().min(1).max(160),
    inn: z.string().regex(/^\d{9}$/).optional(),
    phone: PhoneSchema.optional(),
  }),
  status: ErpOrderStatusSchema,
  address: z.string().min(1).max(300),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  scheduledAt: z.coerce.date(),
  needsPump: z.boolean().optional(),
  note: z.string().max(500).optional(),
  items: z.array(z.object({
    grade: z.string().min(1).max(20),
    name: z.string().min(1).max(80),
    volumeM3: z.number().nonnegative().max(10000),
    unitPrice: z.number().nonnegative(),
  })).min(1).max(50),
});
export type ErpOrderInput = z.infer<typeof ErpOrderSchema>;

/** ERP schyoti → ECO hisob-fakturasi. Zayavkaga bog'langan schyotlargina o'tadi (ECO'da schyot buyurtmaga tegishli). */
export const ErpInvoiceSchema = z.object({
  orderRef: z.string().min(1).max(40),
  amount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative().optional(),
  status: z.enum(['OPEN', 'PARTIAL', 'PAID', 'CANCELLED']),
  issuedAt: z.coerce.date().optional(),
});
export type ErpInvoiceInput = z.infer<typeof ErpInvoiceSchema>;

/** ERP to'lovi → ECO to'lovi. Kalit: externalId (ERP Payment.id) — takror yuborilsa dublikat bo'lmaydi. */
export const ErpPaymentSchema = z.object({
  orderRef: z.string().min(1).max(40),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'TRANSFER', 'PAYME', 'CLICK']).optional(),
  paidAt: z.coerce.date().optional(),
});
export type ErpPaymentInput = z.infer<typeof ErpPaymentSchema>;
