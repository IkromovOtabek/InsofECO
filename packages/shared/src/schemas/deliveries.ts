import { z } from 'zod';
import { DeliveryStatus } from '../enums';
import { GeoPointSchema } from './common';

export const PlanDeliveriesSchema = z.object({
  /** Berilmasa, tashkilotdagi standart mikser sig'imi. */
  capacityM3: z.number().positive().max(20).optional(),
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
  /** Yuklangan haqiqiy hajm (LOADING → EN_ROUTE). */
  loadedM3: z.number().positive().optional(),
});
export type DeliveryTransitionInput = z.infer<typeof DeliveryTransitionSchema>;

export const SignDeliverySchema = z
  .object({
    signatureKey: z.string().optional(),
    otpCode: z.string().regex(/^\d{4}$/).optional(),
    acceptedM3: z.number().positive(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => v.signatureKey || v.otpCode, { message: 'Imzo yoki SMS-kod kerak' });

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
