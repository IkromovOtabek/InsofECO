/** Rollar — tashkilot ichidagi a'zolik roli. */
export const Role = {
  TADBIRKOR: 'TADBIRKOR',
  QURUVCHI: 'QURUVCHI',
  HAYDOVCHI: 'HAYDOVCHI',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const OrganizationType = {
  PLANT: 'PLANT', // beton zavodi
  CONTRACTOR: 'CONTRACTOR', // qurilish tashkiloti / xususiy quruvchi
} as const;
export type OrganizationType = (typeof OrganizationType)[keyof typeof OrganizationType];

export const OrderStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  CONFIRMED: 'CONFIRMED',
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const DeliveryStatus = {
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  LOADING: 'LOADING',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  UNLOADING: 'UNLOADING',
  COMPLETED: 'COMPLETED',
  DISPUTED: 'DISPUTED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const PaymentMethod = { CASH: 'CASH', PAYME: 'PAYME', CLICK: 'CLICK', TRANSFER: 'TRANSFER' } as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const VehicleType = { MIXER: 'MIXER', PUMP: 'PUMP', DUMP: 'DUMP' } as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

/** Beton markalari (O'zbekiston/GOST). */
export const ConcreteGrade = ['M100', 'M150', 'M200', 'M250', 'M300', 'M350', 'M400'] as const;
export type ConcreteGrade = (typeof ConcreteGrade)[number];
