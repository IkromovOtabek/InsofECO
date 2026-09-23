import { OrderStatus } from '@insof/shared';

export const ORDER_EVENTS = {
  submitted: 'order.submitted',
  confirmed: 'order.confirmed',
  rejected: 'order.rejected',
  cancelled: 'order.cancelled',
  delivered: 'order.delivered',
  statusChanged: 'order.status_changed',
} as const;

export interface OrderStatusChangedEvent {
  orderId: string;
  plantOrgId: string;
  clientOrgId: string;
  from: OrderStatus;
  to: OrderStatus;
  byUserId: string;
}
