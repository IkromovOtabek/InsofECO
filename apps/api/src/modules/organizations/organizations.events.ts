import { Role } from '@prisma/client';

/** Tashkilot spravochniklari o'zgardi — ERP webhook'i shu hodisalarni eshitadi (erp-webhook.listener). */
export const ORG_EVENTS = {
  membershipChanged: 'membership.changed',
  vehicleChanged: 'vehicle.changed',
  userUpdated: 'user.updated',
} as const;

export interface MembershipChangedEvent {
  organizationId: string;
  membershipId: string;
  userId: string;
  role: Role;
  isActive: boolean;
  /** registered — ilovada o'zi ro'yxatdan o'tdi; invited — taklif/ERP; approved/removed — Tadbirkor yoki ERP */
  reason: 'registered' | 'invited' | 'approved' | 'removed';
  /** Kim qildi (integratsiya bo'lsa — xizmat foydalanuvchisi id'si); null — foydalanuvchi o'zi */
  byUserId: string | null;
}

export interface VehicleChangedEvent {
  organizationId: string;
  vehicleId: string;
  byUserId: string | null;
}

/** Foydalanuvchi profilini (F.I.O.) o'zgartirdi — barcha HAYDOVCHI a'zoliklari bo'yicha ERP'larga yetkaziladi. */
export interface UserUpdatedEvent {
  userId: string;
  byUserId: string | null;
}
