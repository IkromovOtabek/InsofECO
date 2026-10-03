import { z } from 'zod';

const Role = z.enum(['TADBIRKOR', 'QURUVCHI', 'HAYDOVCHI']);
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const PageQuery = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const OrgListQuery = PageQuery.extend({
  type: z.enum(['PLANT', 'CONTRACTOR']).optional(),
  blocked: bool.optional(),
});
export type OrgListQuery = z.infer<typeof OrgListQuery>;

export const UserListQuery = PageQuery.extend({
  role: Role.optional(),
  blocked: bool.optional(),
  organizationId: z.string().max(40).optional(),
});
export type UserListQuery = z.infer<typeof UserListQuery>;

export const BlockSchema = z.object({ reason: z.string().trim().min(3).max(300) });
export type BlockInput = z.infer<typeof BlockSchema>;

export const MembershipSetSchema = z.object({
  organizationId: z.string().min(1).max(40),
  role: Role,
  isActive: z.boolean().default(true),
});
export type MembershipSetInput = z.infer<typeof MembershipSetSchema>;

export const MembershipPatchSchema = z.object({ isActive: z.boolean() });

export const BroadcastSchema = z.object({
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(2).max(400),
  /** Bo'sh — barcha faol foydalanuvchilar (superadminlardan tashqari). */
  role: Role.optional(),
  organizationId: z.string().max(40).optional(),
  /** true — faqat qabul qiluvchilar sonini qaytaradi, yubormaydi (tasdiq oynasi uchun). */
  dryRun: z.boolean().default(false),
});
export type BroadcastInput = z.infer<typeof BroadcastSchema>;

/** Kalit: `feature.chat`, `app.min_version` — kichik harf, nuqta, chiziq. */
export const ConfigKey = z.string().regex(/^[a-z][a-z0-9_.-]{1,63}$/);
export const ConfigSetSchema = z.object({
  value: z.union([z.string().max(2000), z.number(), z.boolean(), z.null(), z.record(z.unknown()), z.array(z.unknown())]),
  isPublic: z.boolean().default(false),
  description: z.string().trim().max(200).optional(),
}).refine((v) => JSON.stringify(v.value ?? null).length <= 8000, { message: 'Qiymat juda katta' });
export type ConfigSetInput = z.infer<typeof ConfigSetSchema>;
