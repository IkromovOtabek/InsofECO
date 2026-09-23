import { z } from 'zod';

/** O'zbekiston telefon raqami, E.164: +998XXXXXXXXX */
export const PhoneSchema = z
  .string()
  .transform((s) => s.replace(/[\s\-()]/g, ''))
  .pipe(z.string().regex(/^\+998\d{9}$/, 'Telefon +998XXXXXXXXX ko\'rinishida bo\'lsin'));

export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

export const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  since: z.coerce.date().optional(),
});
export type CursorQuery = z.infer<typeof CursorQuerySchema>;

export const IdSchema = z.string().min(10);
