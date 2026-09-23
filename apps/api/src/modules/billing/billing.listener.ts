import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BillingService } from './billing.service';

/** Modullar aro bog'lanish faqat hodisalar orqali (ADR-0003). */
@Injectable()
export class BillingListener {
  constructor(private readonly billing: BillingService) {}

  @OnEvent('delivery.completed', { async: true })
  onDeliveryCompleted(e: { deliveryId: string }) {
    return this.billing.addDeliveryLine(e.deliveryId);
  }

  @OnEvent('order.delivered', { async: true })
  onOrderDelivered(e: { orderId: string }) {
    return this.billing.issueForOrder(e.orderId);
  }
}
