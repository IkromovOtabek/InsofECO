import { DeliveryStatus } from '@insof/shared';

export const DELIVERY_EVENTS = {
  assigned: 'delivery.assigned',
  statusChanged: 'delivery.status_changed',
  completed: 'delivery.completed',
  slaBreached: 'delivery.sla_breached',
  disputed: 'delivery.disputed',
} as const;

export interface DeliveryStatusChangedEvent {
  deliveryId: string;
  orderId: string;
  plantOrgId: string;
  clientOrgId: string;
  driverUserId: string | null;
  from: DeliveryStatus;
  to: DeliveryStatus;
  byUserId: string;
  at: Date;
}
