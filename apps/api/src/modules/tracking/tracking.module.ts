import { Module } from '@nestjs/common';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';

@Module({ imports: [DeliveriesModule], controllers: [TrackingController], providers: [TrackingGateway, TrackingService], exports: [TrackingService] })
export class TrackingModule {}
