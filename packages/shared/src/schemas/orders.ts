import { z } from 'zod';
import { ConcreteGrade } from '../enums';
import { GeoPointSchema } from './common';

export const OrderItemInputSchema = z.object({
  mixId: z.string(),
  grade: z.enum(ConcreteGrade).optional(), // faqat ko'rsatish uchun; narx mixId dan
  volumeM3: z.number().positive().max(500).multipleOf(0.5),
});

export const CreateOrderSchema = z.object({
  plantOrgId: z.string(),
  siteId: z.string().optional(),
  address: z.string().min(5).max(200),
  location: GeoPointSchema,
  items: z.array(OrderItemInputSchema).min(1).max(5),
  scheduledAt: z.coerce.date(),
  /** Mashinalar orasidagi interval (daqiqa). Poydevor quyishda muhim. */
  intervalMinutes: z.number().int().min(0).max(240).default(30),
  needsPump: z.boolean().default(false),
  note: z.string().max(500).optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const ConfirmOrderSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
  priceOverrides: z
    .array(z.object({ itemId: z.string(), unitPrice: z.number().nonnegative() }))
    .optional(),
  deliveryFee: z.number().nonnegative().optional(),
  note: z.string().max(500).optional(),
});

export const RejectOrderSchema = z.object({ reason: z.string().min(3).max(300) });
export const CancelOrderSchema = z.object({ reason: z.string().max(300).optional() });

export const ListOrdersQuerySchema = z.object({
  status: z.string().optional(),
  date: z.coerce.date().optional(),
});
