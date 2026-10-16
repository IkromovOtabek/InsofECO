import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BillingService } from './billing.service';

/**
 * Modullar aro bog'lanish faqat hodisalar orqali (ADR-0003).
 * Xato yutilmaydi — jurnalga yoziladi; yo'qolgan qatorlarni `issueForOrder` reconcile qiladi.
 */
@Injectable()
export class BillingListener {
  private readonly logger = new Logger(BillingListener.name);
  constructor(private readonly billing: BillingService) {}

  @OnEvent('delivery.completed', { async: true })
  async onDeliveryCompleted(e: { deliveryId: string }) {
    try {
      await this.billing.addDeliveryLine(e.deliveryId);
    } catch (err) {
      this.logger.error(`faktura qatori yozilmadi (reys ${e.deliveryId}): ${(err as Error).message}`);
    }
  }

  @OnEvent('order.delivered', { async: true })
  async onOrderDelivered(e: { orderId: string }) {
    try {
      await this.billing.issueForOrder(e.orderId);
    } catch (err) {
      this.logger.error(`faktura chiqarilmadi (buyurtma ${e.orderId}): ${(err as Error).message}`);
    }
  }
}
