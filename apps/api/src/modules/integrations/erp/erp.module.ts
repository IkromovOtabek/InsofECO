import { Module } from '@nestjs/common';
import { DeliveriesModule } from '../../deliveries/deliveries.module';
import { OrganizationsModule } from '../../organizations/organizations.module';
import { TrackingModule } from '../../tracking/tracking.module';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';
import { ErpWebhookListener } from './erp-webhook.listener';
import { IntegrationGuard } from './integration.guard';

/** Insof ERP integratsiyasi: /v1/erp/* (X-Api-Key) + ERP'ga webhook. */
@Module({
  imports: [DeliveriesModule, OrganizationsModule, TrackingModule],
  controllers: [ErpController],
  providers: [ErpService, ErpWebhookListener, IntegrationGuard],
})
export class ErpIntegrationModule {}
