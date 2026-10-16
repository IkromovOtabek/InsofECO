import { z } from 'zod';
import { DeliveryStatus } from '../enums';
import { GeoPointSchema } from './common';

export const PlanDeliveriesSchema = z.object({
  /** Berilmasa, tashkilotdagi standart mikser sig'imi. Minimum 1 m³ — 0.01 berilsa minglab reys yaratilardi. */
  capacityM3: z.number().min(1).max(20).optional(),
});

export const AssignDeliverySchema = z.object({
  driverUserId: z.string(),
  vehicleId: z.string(),
});

export const DeliveryTransitionSchema = z.object({
  to: z.enum(Object.values(DeliveryStatus) as [DeliveryStatus, ...DeliveryStatus[]]),
  /** Mobil vaqti — offline holatda haqiqiy bosilgan vaqt. */
  at: z.coerce.date(),
  location: GeoPointSchema.optional(),
  photoKey: z.string().optional(),
  note: z.string().max(500).optional(),
  /** Yuklangan haqiqiy hajm (LOADING → EN_ROUTE). Server mashina sig'imi bilan cheklaydi. */
  loadedM3: z.number().positive().max(50).optional(),
  /** E'tiroz hal qilinganda (DISPUTED → COMPLETED, dispetcher): faktura shu hajm bo'yicha. Majburiy. */
  acceptedM3: z.number().positive().optional(),
});
export type DeliveryTransitionInput = z.infer<typeof DeliveryTransitionSchema>;

export const SignDeliverySchema = z
  .object({
    signatureKey: z.string().optional(),
    /** Qabul kodi — 6 xona (4 xona ~1,5 soatda terib topilardi). */
    otpCode: z.string().regex(/^\d{6}$/).optional(),
    acceptedM3: z.number().positive(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => v.signatureKey || v.otpCode, { message: 'Imzo yoki qabul kodi kerak' });

export const DisputeDeliverySchema = z.object({
  reason: z.enum(['VOLUME', 'QUALITY', 'LATE', 'OTHER']),
  comment: z.string().max(500).optional(),
  photoKeys: z.array(z.string()).max(5).default([]),
});

export const GpsBatchSchema = z.object({
  deliveryId: z.string(),
  points: z
    .array(
      z.object({
        lat: z.number(),
        lng: z.number(),
        speedKmh: z.number().nonnegative().optional(),
        heading: z.number().min(0).max(360).optional(),
        at: z.coerce.date(),
      }),
    )
    .min(1)
    .max(200),
});
export type GpsBatch = z.infer<typeof GpsBatchSchema>;
