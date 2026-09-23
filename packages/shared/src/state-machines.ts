import { DeliveryStatus, OrderStatus, Role } from './enums';

/** Kim qaysi o'tishni qila oladi. Backend guard + mobil tugma ko'rinishi shu jadvaldan. */
export interface Transition<S extends string> {
  from: S;
  to: S;
  roles: readonly Role[];
}

export const ORDER_TRANSITIONS: readonly Transition<OrderStatus>[] = [
  { from: 'DRAFT', to: 'SUBMITTED', roles: ['QURUVCHI', 'TADBIRKOR'] },
  { from: 'DRAFT', to: 'CANCELLED', roles: ['QURUVCHI', 'TADBIRKOR'] },
  { from: 'SUBMITTED', to: 'CONFIRMED', roles: ['TADBIRKOR'] },
  { from: 'SUBMITTED', to: 'REJECTED', roles: ['TADBIRKOR'] },
  { from: 'SUBMITTED', to: 'CANCELLED', roles: ['QURUVCHI', 'TADBIRKOR'] },
  { from: 'CONFIRMED', to: 'SCHEDULED', roles: ['TADBIRKOR'] },
  { from: 'CONFIRMED', to: 'CANCELLED', roles: ['QURUVCHI', 'TADBIRKOR'] },
  { from: 'SCHEDULED', to: 'IN_PROGRESS', roles: ['TADBIRKOR', 'HAYDOVCHI'] }, // birinchi reys LOADING bo'lganda tizim
  { from: 'SCHEDULED', to: 'CANCELLED', roles: ['TADBIRKOR'] },
  { from: 'IN_PROGRESS', to: 'DELIVERED', roles: ['TADBIRKOR', 'HAYDOVCHI', 'QURUVCHI'] }, // oxirgi reys COMPLETED bo'lganda tizim
  { from: 'DELIVERED', to: 'COMPLETED', roles: ['TADBIRKOR', 'QURUVCHI'] },
];

export const DELIVERY_TRANSITIONS: readonly Transition<DeliveryStatus>[] = [
  { from: 'ASSIGNED', to: 'ACCEPTED', roles: ['HAYDOVCHI'] },
  { from: 'ASSIGNED', to: 'DECLINED', roles: ['HAYDOVCHI'] },
  { from: 'ASSIGNED', to: 'CANCELLED', roles: ['TADBIRKOR'] },
  { from: 'ACCEPTED', to: 'LOADING', roles: ['HAYDOVCHI', 'TADBIRKOR'] },
  { from: 'ACCEPTED', to: 'CANCELLED', roles: ['TADBIRKOR'] },
  { from: 'LOADING', to: 'EN_ROUTE', roles: ['HAYDOVCHI', 'TADBIRKOR'] },
  { from: 'LOADING', to: 'FAILED', roles: ['HAYDOVCHI', 'TADBIRKOR'] }, // yuklashda nosozlik
  { from: 'EN_ROUTE', to: 'ARRIVED', roles: ['HAYDOVCHI', 'TADBIRKOR'] }, // geofence ham
  { from: 'EN_ROUTE', to: 'FAILED', roles: ['HAYDOVCHI', 'TADBIRKOR'] },
  { from: 'ARRIVED', to: 'UNLOADING', roles: ['HAYDOVCHI', 'TADBIRKOR'] },
  { from: 'ARRIVED', to: 'FAILED', roles: ['HAYDOVCHI', 'TADBIRKOR'] },
  { from: 'UNLOADING', to: 'FAILED', roles: ['TADBIRKOR'] }, // dispetcher override
  { from: 'UNLOADING', to: 'COMPLETED', roles: ['QURUVCHI', 'HAYDOVCHI', 'TADBIRKOR'] }, // imzo/OTP orqali
  { from: 'UNLOADING', to: 'DISPUTED', roles: ['QURUVCHI'] },
  { from: 'DISPUTED', to: 'COMPLETED', roles: ['TADBIRKOR'] },
];

export function canTransition<S extends string>(
  table: readonly Transition<S>[],
  from: S,
  to: S,
  role: Role,
): boolean {
  return table.some((t) => t.from === from && t.to === to && t.roles.includes(role));
}

export function nextStatesFor<S extends string>(table: readonly Transition<S>[], from: S, role: Role): S[] {
  return table.filter((t) => t.from === from && t.roles.includes(role)).map((t) => t.to);
}

/** Haydovchi uchun "asosiy" keyingi tugma — ekranda bitta katta tugma. */
export const DRIVER_PRIMARY_NEXT: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  ASSIGNED: 'ACCEPTED',
  ACCEPTED: 'LOADING',
  LOADING: 'EN_ROUTE',
  EN_ROUTE: 'ARRIVED',
  ARRIVED: 'UNLOADING',
  UNLOADING: 'COMPLETED',
};

export const ACTIVE_DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'ACCEPTED',
  'LOADING',
  'EN_ROUTE',
  'ARRIVED',
  'UNLOADING',
];
export const TRACKED_DELIVERY_STATUSES: readonly DeliveryStatus[] = ['LOADING', 'EN_ROUTE', 'ARRIVED', 'UNLOADING'];
