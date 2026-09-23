import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingListener } from './billing.listener';
import { PaymeWebhookController } from './webhooks/payme.controller';
import { ClickWebhookController } from './webhooks/click.controller';

@Module({
  controllers: [BillingController, PaymeWebhookController, ClickWebhookController],
  providers: [BillingService, BillingListener],
  exports: [BillingService],
})
export class BillingModule {}
